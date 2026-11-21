"""
Real-time attendance tracking helpers: breaks, net working time, device restriction and the
attendance audit log. Shared by the geo/selfie punch endpoints and the time-tracking router.

All timer values are derived from server-side timestamps, so they stay correct across page
refreshes, closed browsers and lost connections (the client only animates between server reads).
"""
import logging
import re
from datetime import datetime
from typing import Optional

import mysql.connector
from fastapi import HTTPException, Request

from backend.config import DB_CONFIG

log = logging.getLogger(__name__)

# Allow employees to take multiple breaks (tea, lunch, etc.) during their work day.
MAX_BREAKS_PER_DAY = 10

_MOBILE_UA = re.compile(r"Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile|BlackBerry|webOS|Windows Phone", re.I)


def _conn():
    return mysql.connector.connect(**DB_CONFIG)


# ── schema ────────────────────────────────────────────────────────────────────

def ensure_time_tracking_tables() -> None:
    """Idempotent DDL, called at startup."""
    conn = None
    try:
        conn = _conn()
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS attendance_breaks (
                id                 INT AUTO_INCREMENT PRIMARY KEY,
                employee_id        VARCHAR(50) NOT NULL,
                wfh_attendance_id  INT NOT NULL,
                work_date          DATE NOT NULL,
                break_start        DATETIME NOT NULL,
                break_end          DATETIME NULL,
                duration_seconds   INT NULL,
                created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_break_emp_date (employee_id, work_date),
                INDEX idx_break_session  (wfh_attendance_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS attendance_audit_log (
                id               INT AUTO_INCREMENT PRIMARY KEY,
                employee_id      VARCHAR(50) NOT NULL,
                attendance_date  DATE NULL,
                action           VARCHAR(50) NOT NULL,
                old_values       TEXT NULL,
                new_values       TEXT NULL,
                reason           VARCHAR(500) NULL,
                performed_by     VARCHAR(50) NOT NULL,
                performed_name   VARCHAR(150) NULL,
                performed_role   VARCHAR(30) NULL,
                created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_audit_emp (employee_id, attendance_date),
                INDEX idx_audit_at  (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
        """)
        for col, ddl in (("break_minutes", "INT NOT NULL DEFAULT 0"), ("work_minutes", "INT NULL")):
            cur.execute(
                "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = %s "
                "AND table_name = 'attendance' AND column_name = %s", (DB_CONFIG["database"], col))
            if cur.fetchone()[0] == 0:
                cur.execute(f"ALTER TABLE attendance ADD COLUMN {col} {ddl}")
        conn.commit()
        cur.close()
    except Exception as exc:
        log.warning("ensure_time_tracking_tables failed: %s", exc)
    finally:
        if conn:
            try: conn.close()
            except Exception: pass


# ── device restriction ────────────────────────────────────────────────────────

def is_mobile_user_agent(ua: Optional[str]) -> bool:
    return bool(ua and _MOBILE_UA.search(ua))


def require_desktop(request: Request) -> None:
    """Reject attendance actions from phones / mobile browsers (HR can switch this off in config)."""
    if not is_mobile_user_agent(request.headers.get("user-agent")):
        return
    enabled = "1"
    try:
        conn = _conn()
        cur = conn.cursor()
        cur.execute("SELECT config_value FROM wfh_system_config WHERE config_key = 'block_mobile_attendance'")
        row = cur.fetchone()
        cur.close(); conn.close()
        if row:
            enabled = row[0]
    except Exception:
        pass
    if enabled != "0":
        raise HTTPException(
            status_code=403,
            detail="Attendance actions (check-in, check-out, break) are not allowed on mobile phones. "
                   "Please use your office or home computer.")


# ── staff verification + audit ────────────────────────────────────────────────

def verify_staff(user_id: Optional[str]) -> dict:
    """The acting user must exist and be HR or admin."""
    uid = (user_id or "").strip()
    if not uid:
        raise HTTPException(status_code=403, detail="Only HR or admin can change attendance records.")
    conn = _conn()
    cur = conn.cursor(dictionary=True)
    cur.execute("SELECT user_id, COALESCE(full_name, username, '') AS full_name, role FROM users WHERE user_id = %s LIMIT 1", (uid,))
    row = cur.fetchone()
    cur.close(); conn.close()
    if not row or str(row["role"]).lower() not in ("hr", "admin"):
        raise HTTPException(status_code=403, detail="Only HR or admin can change attendance records.")
    return {"user_id": str(row["user_id"]), "name": row["full_name"], "role": str(row["role"]).lower()}


def log_audit(cur, *, employee_id: str, attendance_date, action: str, actor: dict,
              old: Optional[dict] = None, new: Optional[dict] = None, reason: Optional[str] = None) -> None:
    import json
    cur.execute(
        """INSERT INTO attendance_audit_log
             (employee_id, attendance_date, action, old_values, new_values, reason,
              performed_by, performed_name, performed_role)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
        (employee_id, attendance_date, action,
         json.dumps(old, default=str) if old is not None else None,
         json.dumps(new, default=str) if new is not None else None,
         (reason or None) and str(reason)[:500],
         actor["user_id"], actor.get("name"), actor.get("role")),
    )


# ── break / timer maths ───────────────────────────────────────────────────────

def _secs(a: datetime, b: datetime) -> int:
    return max(0, int((b - a).total_seconds()))


def day_timer(cur, employee_id: str, now: Optional[datetime] = None) -> dict:
    """Today's attendance clock for one employee, computed entirely from stored timestamps."""
    now = now or datetime.now()
    cur.execute(
        """SELECT id, status, punch_in_at, punch_out_at FROM wfh_attendance
           WHERE employee_id = %s AND DATE(punch_in_at) = CURDATE()
           ORDER BY id DESC LIMIT 1""", (employee_id,))
    s = cur.fetchone()
    base = {"server_now": now.isoformat(), "employee_id": employee_id}
    if not s:
        return {**base, "state": "NOT_STARTED", "max_breaks": MAX_BREAKS_PER_DAY, "breaks_left": MAX_BREAKS_PER_DAY, "work_seconds": 0, "break_seconds": 0, "gross_seconds": 0,
                "breaks": [], "break_started_at": None, "punch_in_at": None, "punch_out_at": None}
    cur.execute(
        """SELECT id, break_start, break_end, duration_seconds FROM attendance_breaks
           WHERE wfh_attendance_id = %s ORDER BY break_start""", (s["id"],))
    rows = cur.fetchall()
    breaks, done, open_start = [], 0, None
    for r in rows:
        if r["break_end"] is None:
            open_start = r["break_start"]
            end_ref = s["punch_out_at"] or now
            secs = _secs(r["break_start"], end_ref)
        else:
            secs = r["duration_seconds"] if r["duration_seconds"] is not None else _secs(r["break_start"], r["break_end"])
            done += secs
        breaks.append({"id": r["id"], "start": r["break_start"].isoformat(),
                       "end": r["break_end"].isoformat() if r["break_end"] else None, "seconds": secs})
    end_ref = s["punch_out_at"] or now
    break_secs = done + (_secs(open_start, end_ref) if open_start else 0)
    gross = _secs(s["punch_in_at"], end_ref)
    if s["status"] == "PENDING_SELFIE":
        state = "PENDING_SELFIE"
    elif s["punch_out_at"]:
        state = "CHECKED_OUT"
    elif open_start:
        state = "ON_BREAK"
    else:
        state = "WORKING"
    return {**base, "state": state, "wfh_id": s["id"],
            "max_breaks": MAX_BREAKS_PER_DAY, "breaks_left": max(0, MAX_BREAKS_PER_DAY - len(breaks)),
            "punch_in_at": s["punch_in_at"].isoformat(),
            "punch_out_at": s["punch_out_at"].isoformat() if s["punch_out_at"] else None,
            "break_started_at": open_start.isoformat() if open_start else None,
            "gross_seconds": gross, "break_seconds": break_secs,
            "work_seconds": max(0, gross - break_secs), "breaks": breaks}


def finalize_day(cur, employee_id: str, wfh_id: int, punch_in: datetime, punch_out: datetime) -> dict:
    """On punch-out: close any open break, then store break + net working minutes on the attendance row."""
    cur.execute(
        """UPDATE attendance_breaks
           SET break_end = %s, duration_seconds = TIMESTAMPDIFF(SECOND, break_start, %s)
           WHERE wfh_attendance_id = %s AND break_end IS NULL""", (punch_out, punch_out, wfh_id))
    cur.execute("SELECT COALESCE(SUM(duration_seconds), 0) AS s FROM attendance_breaks WHERE wfh_attendance_id = %s", (wfh_id,))
    row = cur.fetchone()
    break_secs = int((row["s"] if isinstance(row, dict) else row[0]) or 0)
    gross = _secs(punch_in, punch_out)
    work_min = max(0, (gross - break_secs) // 60)
    break_min = break_secs // 60
    cur.execute(
        "UPDATE attendance SET break_minutes = %s, work_minutes = %s WHERE employee_id = %s AND date = %s",
        (break_min, work_min, employee_id, punch_in.date()))
    return {"break_minutes": break_min, "work_minutes": work_min, "gross_minutes": gross // 60}


# ── live totals (do not wait for punch-out) ───────────────────────────────────

def break_seconds_sql(emp_col: str, date_col: str) -> str:
    """SQL scalar subquery: break seconds for one employee-day, counting a still-running break up to now."""
    return (
        "COALESCE((SELECT SUM(CASE WHEN b.break_end IS NULL "
        "THEN TIMESTAMPDIFF(SECOND, b.break_start, NOW()) ELSE b.duration_seconds END) "
        f"FROM attendance_breaks b WHERE b.employee_id = {emp_col} AND b.work_date = {date_col}), 0)"
    )


def _to_secs(t) -> Optional[int]:
    if t is None or t == "":
        return None
    parts = str(t).split(":")
    try:
        return int(parts[0]) * 3600 + int(parts[1]) * 60 + (int(float(parts[2])) if len(parts) > 2 else 0)
    except (ValueError, IndexError):
        return None


def net_seconds(work_date, check_in, check_out, break_secs: int, now: Optional[datetime] = None) -> Optional[int]:
    """
    Net working time = (check-out − check-in) − breaks. For today's day that is still open (no check-out),
    the clock runs to now. Past days without a check-out have no net time.
    """
    now = now or datetime.now()
    ci = _to_secs(check_in)
    if ci is None:
        return None
    co = _to_secs(check_out)
    if co is None:
        if work_date == now.date():
            co = now.hour * 3600 + now.minute * 60 + now.second
        else:
            return None
    return max(0, co - ci - int(break_secs or 0))
