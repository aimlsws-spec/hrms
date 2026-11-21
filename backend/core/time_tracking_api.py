"""Break start / break end, the live attendance timer, and HR working-hours reports + audit log."""
import json
import logging
from datetime import date, datetime, timedelta
from typing import Optional

import mysql.connector
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from backend.config import DB_CONFIG
from backend.core.time_tracking import (day_timer, require_desktop, verify_staff, is_mobile_user_agent,
                                        MAX_BREAKS_PER_DAY, break_seconds_sql, net_seconds)

log = logging.getLogger(__name__)
router = APIRouter()


def _db():
    return mysql.connector.connect(**DB_CONFIG)


class BreakBody(BaseModel):
    employee_id: str


def _open_session(cur, emp_id: str) -> dict:
    cur.execute(
        """SELECT id, status, punch_in_at, punch_out_at FROM wfh_attendance
           WHERE employee_id = %s AND DATE(punch_in_at) = CURDATE()
           ORDER BY id DESC LIMIT 1 FOR UPDATE""", (emp_id,))
    s = cur.fetchone()
    if not s:
        raise HTTPException(status_code=409, detail="You have not checked in today.")
    if s["status"] == "PENDING_SELFIE":
        raise HTTPException(status_code=409, detail="Finish your check-in selfie first.")
    if s["punch_out_at"]:
        raise HTTPException(status_code=409, detail="You have already checked out today.")
    return s


@router.get("/api/wfh/timer")
def attendance_timer(employee_id: str = "", request: Request = None):
    """Live attendance clock: state, working time, break time (all computed on the server)."""
    emp_id = employee_id.strip()
    if not emp_id:
        raise HTTPException(status_code=422, detail="employee_id is required")
    conn = _db()
    try:
        cur = conn.cursor(dictionary=True)
        t = day_timer(cur, emp_id)
        t["mobile_blocked"] = is_mobile_user_agent(request.headers.get("user-agent")) if request else False
        cur.close()
        return {"success": True, **t}
    finally:
        conn.close()


@router.post("/api/wfh/break/start")
def break_start(body: BreakBody, request: Request):
    require_desktop(request)
    emp_id = body.employee_id.strip()
    conn = _db()
    try:
        cur = conn.cursor(dictionary=True)
        s = _open_session(cur, emp_id)
        cur.execute("SELECT id FROM attendance_breaks WHERE wfh_attendance_id = %s AND break_end IS NULL", (s["id"],))
        if cur.fetchone():
            raise HTTPException(status_code=409, detail="A break is already running. End it first.")
        cur.execute("SELECT COUNT(*) AS n FROM attendance_breaks WHERE wfh_attendance_id = %s", (s["id"],))
        if (cur.fetchone() or {}).get("n", 0) >= MAX_BREAKS_PER_DAY:
            raise HTTPException(status_code=409, detail=f"Maximum breaks limit ({MAX_BREAKS_PER_DAY}) reached for today.")
        now = datetime.now()
        cur.execute(
            "INSERT INTO attendance_breaks (employee_id, wfh_attendance_id, work_date, break_start) VALUES (%s, %s, %s, %s)",
            (emp_id, s["id"], now.date(), now))
        conn.commit()
        t = day_timer(cur, emp_id, now)
        cur.close()
        return {"success": True, "message": "Break started. Your working timer is paused.", **t}
    except HTTPException:
        conn.rollback(); raise
    except Exception as exc:
        conn.rollback(); log.error("break_start: %s", exc)
        raise HTTPException(status_code=500, detail="Could not start the break.")
    finally:
        conn.close()


@router.post("/api/wfh/break/end")
def break_end(body: BreakBody, request: Request):
    require_desktop(request)
    emp_id = body.employee_id.strip()
    conn = _db()
    try:
        cur = conn.cursor(dictionary=True)
        s = _open_session(cur, emp_id)
        cur.execute("SELECT id, break_start FROM attendance_breaks WHERE wfh_attendance_id = %s AND break_end IS NULL", (s["id"],))
        b = cur.fetchone()
        if not b:
            raise HTTPException(status_code=409, detail="No break is running.")
        now = datetime.now()
        secs = max(0, int((now - b["break_start"]).total_seconds()))
        cur.execute("UPDATE attendance_breaks SET break_end = %s, duration_seconds = %s WHERE id = %s", (now, secs, b["id"]))
        conn.commit()
        t = day_timer(cur, emp_id, now)
        cur.close()
        m, sec = divmod(secs, 60)
        return {"success": True, "message": f"Break ended ({m}m {sec}s). Your working timer is running again.", **t}
    except HTTPException:
        conn.rollback(); raise
    except Exception as exc:
        conn.rollback(); log.error("break_end: %s", exc)
        raise HTTPException(status_code=500, detail="Could not end the break.")
    finally:
        conn.close()


# ── HR reports ────────────────────────────────────────────────────────────────

def _net_minutes(row: dict) -> Optional[int]:
    """Stored net minutes, or derived from check-in/out for manually entered days."""
    if row.get("work_minutes") is not None:
        return int(row["work_minutes"])
    ci, co = row.get("check_in"), row.get("check_out")
    if not ci or not co:
        return None
    def mins(t):
        h, m = str(t).split(":")[:2]
        return int(h) * 60 + int(m)
    return max(0, mins(co) - mins(ci) - int(row.get("break_minutes") or 0))


@router.get("/api/hr/work-hours-report")
def work_hours_report(reviewer_user_id: str = "", from_date: Optional[str] = None,
                      to_date: Optional[str] = None, employee_id: Optional[str] = None):
    """Employee-wise attendance with working hours and break time for a date range."""
    verify_staff(reviewer_user_id)
    today = date.today()
    try:
        d_from = date.fromisoformat(from_date) if from_date else today.replace(day=1)
        d_to = date.fromisoformat(to_date) if to_date else today
    except ValueError:
        raise HTTPException(status_code=422, detail="Dates must be YYYY-MM-DD")
    if d_to < d_from or (d_to - d_from).days > 366:
        raise HTTPException(status_code=422, detail="Choose a valid range of up to one year")
    conn = _db()
    try:
        cur = conn.cursor(dictionary=True)
        args = [d_from, d_to]
        extra = ""
        if employee_id:
            extra = " AND a.employee_id = %s"
            args.append(employee_id.strip())
        cur.execute(f"""
            SELECT a.employee_id, COALESCE(e.full_name, a.employee_id) AS full_name,
                   COALESCE(e.department, '') AS department,
                   a.date, a.status, CAST(a.check_in AS CHAR) AS check_in, CAST(a.check_out AS CHAR) AS check_out,
                   COALESCE(a.break_minutes, 0) AS break_minutes, a.work_minutes,
                   {break_seconds_sql('a.employee_id', 'a.date')} AS break_seconds,
                   COALESCE(a.beyond_grace, 0) AS beyond_grace, COALESCE(a.late_minutes, 0) AS late_minutes,
                   (SELECT COUNT(*) FROM attendance_breaks b WHERE b.employee_id = a.employee_id AND b.work_date = a.date) AS breaks_count
            FROM attendance a
            LEFT JOIN employees e ON e.employee_code = a.employee_id
            WHERE a.date BETWEEN %s AND %s {extra}
            ORDER BY a.date DESC, full_name
        """, args)
        rows = cur.fetchall()
        cur.close()
    finally:
        conn.close()

    summary: dict = {}
    out = []
    for r in rows:
        brk = int(r.get("break_seconds") or 0)
        net = net_seconds(r["date"], r["check_in"], r["check_out"], brk)
        live = r["check_out"] is None and r["date"] == today
        r["date"] = r["date"].isoformat()
        r["break_seconds"] = brk
        r["break_minutes"] = round(brk / 60, 1)
        r["net_seconds"] = net
        r["net_minutes"] = None if net is None else net // 60
        r["in_progress"] = live
        out.append({k: (int(v) if hasattr(v, "as_tuple") else v) for k, v in r.items()})
        s = summary.setdefault(r["employee_id"], {
            "employee_id": r["employee_id"], "full_name": r["full_name"], "department": r["department"],
            "days_present": 0, "late_days": 0, "total_net_seconds": 0, "total_break_seconds": 0, "days_with_hours": 0})
        if r["status"] in ("PRESENT", "HALF_DAY", "LATE"):
            s["days_present"] += 1
        if r["beyond_grace"]:
            s["late_days"] += 1
        s["total_break_seconds"] += brk
        if net is not None:
            s["total_net_seconds"] += net
            s["days_with_hours"] += 1
    for s in summary.values():
        s["avg_net_seconds"] = round(s["total_net_seconds"] / s["days_with_hours"]) if s["days_with_hours"] else 0
        # minute fields kept for older callers
        s["total_net_minutes"] = s["total_net_seconds"] // 60
        s["total_break_minutes"] = round(s["total_break_seconds"] / 60, 1)
        s["avg_net_minutes"] = s["avg_net_seconds"] // 60
    return {"success": True, "from_date": d_from.isoformat(), "to_date": d_to.isoformat(),
            "records": out, "summary": sorted(summary.values(), key=lambda x: x["full_name"])}


@router.get("/api/hr/attendance-breaks")
def employee_breaks(reviewer_user_id: str = "", employee_id: str = "", work_date: str = ""):
    """The individual breaks an employee took on one day."""
    verify_staff(reviewer_user_id)
    try:
        d = date.fromisoformat(work_date)
    except ValueError:
        raise HTTPException(status_code=422, detail="work_date must be YYYY-MM-DD")
    conn = _db()
    try:
        cur = conn.cursor(dictionary=True)
        cur.execute("""SELECT id, break_start, break_end, duration_seconds FROM attendance_breaks
                       WHERE employee_id = %s AND work_date = %s ORDER BY break_start""", (employee_id.strip(), d))
        rows = cur.fetchall()
        cur.close()
    finally:
        conn.close()
    return {"success": True, "breaks": [
        {"id": r["id"], "start": r["break_start"].isoformat(),
         "end": r["break_end"].isoformat() if r["break_end"] else None,
         "seconds": r["duration_seconds"]} for r in rows]}


@router.get("/api/hr/attendance-audit-log")
def attendance_audit_log(reviewer_user_id: str = "", employee_id: Optional[str] = None, limit: int = 200):
    """Who changed which attendance record, when, from what to what, and why."""
    verify_staff(reviewer_user_id)
    limit = max(1, min(limit, 1000))
    conn = _db()
    try:
        cur = conn.cursor(dictionary=True)
        if employee_id:
            cur.execute("SELECT * FROM attendance_audit_log WHERE employee_id = %s ORDER BY id DESC LIMIT %s", (employee_id.strip(), limit))
        else:
            cur.execute("SELECT * FROM attendance_audit_log ORDER BY id DESC LIMIT %s", (limit,))
        rows = cur.fetchall()
        cur.close()
    finally:
        conn.close()
    out = []
    for r in rows:
        out.append({**r,
                    "attendance_date": r["attendance_date"].isoformat() if r["attendance_date"] else None,
                    "created_at": r["created_at"].isoformat() if r["created_at"] else None,
                    "old_values": json.loads(r["old_values"]) if r["old_values"] else None,
                    "new_values": json.loads(r["new_values"]) if r["new_values"] else None})
    return {"success": True, "records": out}


# ── HR: who punched in, from where, with which selfie ─────────────────────────

@router.get("/api/hr/attendance-evidence")
def attendance_evidence(reviewer_user_id: str = "", from_date: Optional[str] = None, to_date: Optional[str] = None,
                        q: Optional[str] = None, mode: Optional[str] = None):
    """
    One row per punch in the range: employee, work mode, times, GPS position, distance from the office
    (WFO) or registered home (WFH), and the ids of the check-in / check-out selfies. HR/admin only.
    The images themselves are fetched one at a time (and audit-logged) via /api/wfh/selfie/{id}.
    """
    verify_staff(reviewer_user_id)
    from backend.core.wfo_attendance import get_office_location
    today = date.today()
    try:
        d_to = date.fromisoformat(to_date) if to_date else today
        d_from = date.fromisoformat(from_date) if from_date else d_to - timedelta(days=6)
    except ValueError:
        raise HTTPException(status_code=422, detail="Dates must be YYYY-MM-DD")
    if d_to < d_from or (d_to - d_from).days > 92:
        raise HTTPException(status_code=422, detail="Choose a range of up to 3 months")
    mode = (mode or "").upper()
    if mode not in ("", "WFO", "WFH"):
        raise HTTPException(status_code=422, detail="mode must be WFO or WFH")

    args = [d_from, d_to]
    where = ""
    if q and q.strip():
        where += " AND (e.full_name LIKE %s OR w.employee_id LIKE %s)"
        args += [f"%{q.strip()}%", f"%{q.strip()}%"]
    if mode:
        where += " AND e.default_work_mode = %s"
        args.append(mode)

    conn = _db()
    try:
        cur = conn.cursor(dictionary=True)
        cur.execute(f"""
            SELECT w.id AS wfh_id, w.employee_id, COALESCE(e.full_name, w.employee_id) AS full_name,
                   COALESCE(e.department, '') AS department, e.default_work_mode AS work_mode,
                   w.punch_in_at, w.punch_out_at, w.status, w.attendance_method,
                   w.geo_latitude, w.geo_longitude, w.geo_distance_meters, w.client_ip,
                   h.latitude AS home_lat, h.longitude AS home_lon,
                   (SELECT s.id FROM attendance_selfies s WHERE s.wfh_attendance_id = w.id
                      AND s.capture_type = 'checkin' AND s.status <> 'deleted' ORDER BY s.id DESC LIMIT 1) AS checkin_selfie_id,
                   (SELECT s.id FROM attendance_selfies s WHERE s.wfh_attendance_id = w.id
                      AND s.capture_type = 'checkout' AND s.status <> 'deleted' ORDER BY s.id DESC LIMIT 1) AS checkout_selfie_id,
                   (SELECT COUNT(*) FROM attendance_selfies s WHERE s.wfh_attendance_id = w.id AND s.status = 'deleted') AS deleted_selfies
            FROM wfh_attendance w
            LEFT JOIN employees e ON e.employee_code = w.employee_id
            LEFT JOIN employee_home_locations h ON h.employee_id = w.employee_id
            WHERE DATE(w.punch_in_at) BETWEEN %s AND %s {where}
            ORDER BY w.punch_in_at DESC
            LIMIT 500
        """, args)
        rows = cur.fetchall()
        office = get_office_location(conn)
        cur.close()
    finally:
        conn.close()

    out = []
    for r in rows:
        mode_ = r["work_mode"] or "WFH"
        ref = None
        if mode_ == "WFO" and office:
            ref = {"label": "Office", "latitude": office["latitude"], "longitude": office["longitude"]}
        elif mode_ == "WFH" and r["home_lat"] is not None:
            ref = {"label": "Registered home", "latitude": float(r["home_lat"]), "longitude": float(r["home_lon"])}
        out.append({
            "wfh_id": r["wfh_id"], "employee_id": r["employee_id"], "full_name": r["full_name"],
            "department": r["department"], "work_mode": mode_,
            "punch_in_at": r["punch_in_at"].isoformat() if r["punch_in_at"] else None,
            "punch_out_at": r["punch_out_at"].isoformat() if r["punch_out_at"] else None,
            "status": r["status"], "method": r["attendance_method"],
            "latitude": float(r["geo_latitude"]) if r["geo_latitude"] is not None else None,
            "longitude": float(r["geo_longitude"]) if r["geo_longitude"] is not None else None,
            "distance_meters": float(r["geo_distance_meters"]) if r["geo_distance_meters"] is not None else None,
            "reference": ref, "client_ip": r["client_ip"],
            "checkin_selfie_id": r["checkin_selfie_id"], "checkout_selfie_id": r["checkout_selfie_id"],
            "selfie_deleted": bool(r["deleted_selfies"]) and not r["checkin_selfie_id"],
        })
    return {"success": True, "from_date": d_from.isoformat(), "to_date": d_to.isoformat(), "count": len(out), "records": out}
