"""
Attendance regularization: an employee asks HR to correct or create a day's check-in / check-out.

Rules (so a correction can never break payroll):
  * only past days, within WINDOW_DAYS, and not before the employee joined
  * check-out after check-in, a believable length, a real reason
  * one open request per employee per day
  * not on a day of approved full-day leave (it would be paid twice / unpaid twice)
  * not for a month whose payroll is already processed or paid
  * approving writes the attendance row and re-applies the late policy, so the monthly late count and the
    half-day deduction are recalculated (payroll reads attendance, so it follows automatically)
  * every decision is audit-logged and the employee is notified
"""
import logging
from datetime import date, datetime, time, timedelta
from typing import Optional

import mysql.connector

from backend.config import DB_CONFIG
from backend.core.time_tracking import log_audit

log = logging.getLogger(__name__)

WINDOW_DAYS = 31          # how far back a correction may be requested
MAX_SHIFT_HOURS = 16


def _conn():
    return mysql.connector.connect(**DB_CONFIG)


def _fail(msg: str) -> dict:
    return {"success": False, "message": msg}


def _parse_time(v) -> Optional[time]:
    if isinstance(v, time):
        return v
    try:
        p = str(v).strip().split(":")
        return time(int(p[0]), int(p[1]), int(p[2]) if len(p) > 2 else 0)
    except (ValueError, IndexError):
        return None


def _hm(v) -> Optional[str]:
    """time / timedelta / 'HH:MM:SS' -> 'HH:MM'"""
    if v is None:
        return None
    if isinstance(v, timedelta):
        secs = int(v.total_seconds())
        return f"{secs // 3600:02d}:{(secs % 3600) // 60:02d}"
    return str(v)[:5]


def payroll_locked(cur, employee_id: str, d: date) -> bool:
    """True when this employee's payroll for d's month is already processed or paid."""
    ym = d.strftime("%Y-%m")
    cur.execute("SELECT status FROM monthly_payroll WHERE employee_id = %s AND month_year = %s", (employee_id, ym))
    row = cur.fetchone()
    if row and str(row["status"]).lower() in ("processed", "paid"):
        return True
    cur.execute("SELECT 1 FROM attendance_deductions WHERE employee_id = %s AND year = %s AND month = %s "
                "AND payroll_processed = 1 LIMIT 1", (employee_id, d.year, d.month))
    return cur.fetchone() is not None


def _notify(cur, user_ids, title: str, message: str, kind: str) -> None:
    ids = [u for u in user_ids if u]
    if ids:
        cur.executemany("INSERT INTO notifications (user_id, title, message, type) VALUES (%s, %s, %s, %s)",
                        [(u, title, message, kind) for u in ids])


def _staff_ids(cur) -> list:
    cur.execute("SELECT user_id FROM users WHERE LOWER(role) IN ('hr', 'admin') AND COALESCE(is_active, 1) = 1")
    return [r["user_id"] for r in cur.fetchall()]


# ── request ───────────────────────────────────────────────────────────────────

def request_regularization(employee_id: str, attendance_date: str, requested_check_in: str,
                           requested_check_out: str, reason: str) -> dict:
    employee_id = (employee_id or "").strip()
    reason = (reason or "").strip()
    try:
        d = date.fromisoformat(str(attendance_date)[:10])
    except ValueError:
        return _fail("Choose a valid date.")
    t_in, t_out = _parse_time(requested_check_in), _parse_time(requested_check_out)
    if not t_in or not t_out:
        return _fail("Enter both a check-in and a check-out time.")
    if t_out <= t_in:
        return _fail("Check-out must be later than check-in.")
    if (datetime.combine(d, t_out) - datetime.combine(d, t_in)).total_seconds() > MAX_SHIFT_HOURS * 3600:
        return _fail(f"A working day cannot be longer than {MAX_SHIFT_HOURS} hours.")
    if len(reason) < 5:
        return _fail("Please explain the reason (at least 5 characters).")
    today = date.today()
    if d >= today:
        return _fail("You can only correct a day that has already ended. Today's attendance is marked by punching in and out.")
    if (today - d).days > WINDOW_DAYS:
        return _fail(f"Corrections are only allowed for the last {WINDOW_DAYS} days.")

    conn = _conn()
    try:
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT full_name, status, joining_date FROM employees WHERE employee_code = %s", (employee_id,))
        emp = cur.fetchone()
        if not emp:
            return _fail("Employee not found.")
        if str(emp["status"]).lower() != "active":
            return _fail("Only active employees can request a correction.")
        if emp["joining_date"] and d < emp["joining_date"]:
            return _fail("That date is before your joining date.")

        cur.execute("SELECT id FROM attendance_regularization WHERE employee_id = %s AND attendance_date = %s AND status = 'Pending'",
                    (employee_id, d))
        if cur.fetchone():
            return _fail("You already have a pending request for that day. Wait for HR to decide it.")

        cur.execute("SELECT status, check_in, check_out FROM attendance WHERE employee_id = %s AND date = %s", (employee_id, d))
        original = cur.fetchone()
        if original and original["status"] == "ON_LEAVE":
            return _fail("You were on approved leave that day, so there is nothing to correct.")
        cur.execute("""SELECT id FROM leave_requests WHERE employee_id = %s AND status = 'Approved'
                       AND %s BETWEEN start_date AND end_date AND COALESCE(days_count, 1) >= 1 LIMIT 1""", (employee_id, d))
        if cur.fetchone():
            return _fail("You have approved leave on that day. Ask HR to change the leave instead.")
        if original and original["check_in"] is not None and original["check_out"] is not None \
                and _hm(original["check_in"]) == t_in.strftime("%H:%M") and _hm(original["check_out"]) == t_out.strftime("%H:%M"):
            return _fail("Those times are already recorded for that day.")
        if payroll_locked(cur, employee_id, d):
            return _fail("Payroll for that month has already been processed, so attendance can no longer be changed. Please contact HR or the accountant.")

        cur.execute("""INSERT INTO attendance_regularization
                       (employee_id, attendance_date, original_check_in, original_check_out,
                        requested_check_in, requested_check_out, reason)
                       VALUES (%s, %s, %s, %s, %s, %s, %s)""",
                    (employee_id, d, original["check_in"] if original else None, original["check_out"] if original else None,
                     t_in, t_out, reason))
        rid = cur.lastrowid
        _notify(cur, _staff_ids(cur), "Attendance correction request",
                f"{emp['full_name']} ({employee_id}) asked to correct {d.strftime('%d %b %Y')}: "
                f"{t_in.strftime('%H:%M')} - {t_out.strftime('%H:%M')}. Review it under Attendance, Regularization.",
                "regularization_request")
        conn.commit()
        return {"success": True, "request_id": rid, "message": "Request sent to HR. You will be notified when it is decided."}
    except Exception as exc:
        conn.rollback()
        log.error("request_regularization failed: %s", exc, exc_info=True)
        return _fail("Could not save the request. Please try again.")
    finally:
        conn.close()


# ── decide ────────────────────────────────────────────────────────────────────

def _load_pending(cur, request_id: int):
    cur.execute("SELECT * FROM attendance_regularization WHERE id = %s FOR UPDATE", (request_id,))
    req = cur.fetchone()
    if not req:
        return None, _fail("Request not found.")
    if req["status"] != "Pending":
        return None, _fail(f"This request was already {req['status'].lower()}.")
    return req, None


def approve_regularization(request_id: int, actor: dict, comments: Optional[str] = None) -> dict:
    from backend.core.attendance_rules import apply_late_flags
    conn = _conn()
    try:
        cur = conn.cursor(dictionary=True)
        req, err = _load_pending(cur, request_id)
        if err:
            conn.rollback()
            return err
        emp_id, d = req["employee_id"], req["attendance_date"]
        if payroll_locked(cur, emp_id, d):
            conn.rollback()
            return _fail("Payroll for that month is already processed or paid, so this day can no longer be changed.")
        cur.execute("""SELECT id FROM leave_requests WHERE employee_id = %s AND status = 'Approved'
                       AND %s BETWEEN start_date AND end_date AND COALESCE(days_count, 1) >= 1 LIMIT 1""", (emp_id, d))
        if cur.fetchone():
            conn.rollback()
            return _fail("The employee has approved leave on that day. Change the leave first.")

        cur.execute("SELECT status, CAST(check_in AS CHAR) AS check_in, CAST(check_out AS CHAR) AS check_out "
                    "FROM attendance WHERE employee_id = %s AND date = %s", (emp_id, d))
        old = cur.fetchone()
        t_in, t_out = _parse_time(_hm(req["requested_check_in"]) + ":00"), _parse_time(_hm(req["requested_check_out"]) + ":00")
        cur.execute("""INSERT INTO attendance (employee_id, date, check_in, check_out, status, source, check_in_source)
                       VALUES (%s, %s, %s, %s, 'PRESENT', 'MANUAL', 'REGULARIZED')
                       ON DUPLICATE KEY UPDATE check_in = VALUES(check_in), check_out = VALUES(check_out),
                                               status = 'PRESENT', check_in_source = 'REGULARIZED'""",
                    (emp_id, d, t_in, t_out))
        # net working minutes for the day (any recorded break is subtracted)
        cur.execute("SELECT COALESCE(SUM(duration_seconds), 0) AS s FROM attendance_breaks WHERE employee_id = %s AND work_date = %s", (emp_id, d))
        brk = int(cur.fetchone()["s"] or 0)
        gross = int((datetime.combine(d, t_out) - datetime.combine(d, t_in)).total_seconds())
        cur.execute("UPDATE attendance SET break_minutes = %s, work_minutes = %s WHERE employee_id = %s AND date = %s",
                    (brk // 60, max(0, gross - brk) // 60, emp_id, d))
        late = apply_late_flags(cur, emp_id, d, t_in)    # recounts the month and the half-day deduction

        cur.execute("""UPDATE attendance_regularization SET status = 'Approved', approved_by = %s,
                       approval_comments = %s, approved_at = NOW() WHERE id = %s""",
                    (actor["user_id"], comments, request_id))
        log_audit(cur, employee_id=emp_id, attendance_date=d, action="REGULARIZATION_APPROVED", actor=actor, old=old,
                  new={"status": "PRESENT", "check_in": t_in.strftime("%H:%M:%S"), "check_out": t_out.strftime("%H:%M:%S"),
                       "late_days_this_month": late["late_days"], "half_days_deducted": late["half_days"]},
                  reason=comments or req["reason"])
        _notify(cur, [emp_id], "Attendance correction approved",
                f"Your correction for {d.strftime('%d %b %Y')} was approved ({t_in.strftime('%H:%M')} - {t_out.strftime('%H:%M')})."
                + (f" Note: {comments}" if comments else ""), "regularization_decision")
        conn.commit()
        return {"success": True, "message": "Approved. Attendance and the monthly late count are updated.",
                "late_days": late["late_days"], "half_days_deducted": late["half_days"]}
    except Exception as exc:
        conn.rollback()
        log.error("approve_regularization failed: %s", exc, exc_info=True)
        return _fail("Could not approve the request.")
    finally:
        conn.close()


def reject_regularization(request_id: int, actor: dict, comments: Optional[str]) -> dict:
    comments = (comments or "").strip()
    if len(comments) < 3:
        return _fail("Please write a short reason for rejecting.")
    conn = _conn()
    try:
        cur = conn.cursor(dictionary=True)
        req, err = _load_pending(cur, request_id)
        if err:
            conn.rollback()
            return err
        d = req["attendance_date"]
        cur.execute("""UPDATE attendance_regularization SET status = 'Rejected', approved_by = %s,
                       approval_comments = %s, approved_at = NOW() WHERE id = %s""", (actor["user_id"], comments, request_id))
        log_audit(cur, employee_id=req["employee_id"], attendance_date=d, action="REGULARIZATION_REJECTED", actor=actor,
                  new={"requested_check_in": _hm(req["requested_check_in"]), "requested_check_out": _hm(req["requested_check_out"])},
                  reason=comments)
        _notify(cur, [req["employee_id"]], "Attendance correction rejected",
                f"Your correction for {d.strftime('%d %b %Y')} was rejected. Reason: {comments}", "regularization_decision")
        conn.commit()
        return {"success": True, "message": "Request rejected. The employee has been told why."}
    except Exception as exc:
        conn.rollback()
        log.error("reject_regularization failed: %s", exc, exc_info=True)
        return _fail("Could not reject the request.")
    finally:
        conn.close()


# ── lists ─────────────────────────────────────────────────────────────────────

def _shape(r: dict) -> dict:
    return {
        "id": r["id"], "employee_id": r["employee_id"], "employee_name": r.get("employee_name") or r["employee_id"],
        "attendance_date": r["attendance_date"].isoformat() if r["attendance_date"] else None,
        "original_check_in": _hm(r["original_check_in"]), "original_check_out": _hm(r["original_check_out"]),
        "requested_check_in": _hm(r["requested_check_in"]), "requested_check_out": _hm(r["requested_check_out"]),
        "reason": r["reason"], "status": r["status"], "approved_by": r["approved_by"],
        "approval_comments": r["approval_comments"],
        "approved_at": r["approved_at"].isoformat() if r["approved_at"] else None,
        "created_at": r["created_at"].isoformat() if r["created_at"] else None,
    }


def list_requests(status: Optional[str] = None, employee_id: Optional[str] = None) -> list:
    conn = _conn()
    try:
        cur = conn.cursor(dictionary=True)
        where, args = [], []
        if status:
            where.append("ar.status = %s"); args.append(status)
        if employee_id:
            where.append("ar.employee_id = %s"); args.append(employee_id)
        cur.execute(f"""SELECT ar.*, e.full_name AS employee_name FROM attendance_regularization ar
                        LEFT JOIN employees e ON e.employee_code = ar.employee_id
                        {'WHERE ' + ' AND '.join(where) if where else ''}
                        ORDER BY ar.created_at DESC LIMIT 300""", args)
        return [_shape(r) for r in cur.fetchall()]
    finally:
        conn.close()
