"""
Attendance Management API
Table names and columns aligned with actual hrms DB schema:
  - attendance(id, employee_id, date, status, check_in, check_out,
               late_minutes, overtime_minutes, created_at)
  - leave_balance(id, employee_id, casual_leave, sick_leave, earned_leave, updated_at)
  - leave_requests(created via _migrate_schema in app.py)
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
import mysql.connector

from backend.config import DB_CONFIG

# ---------------------------------------------------------------------------
# Office hours constants (minutes from midnight)
# ---------------------------------------------------------------------------
OFFICE_START_MINS = 9 * 60 + 30    # 09:30 → 570
GRACE_TIME_MINS   = 9 * 60 + 50    # 09:50 → 590  (company policy: after 09:50 counts as a late day)
OFFICE_END_MINS   = 18 * 60 + 30   # 18:30 → 1110
SCHEDULED_DAY_MINS = OFFICE_END_MINS - OFFICE_START_MINS


def get_db_connection():
    return mysql.connector.connect(**DB_CONFIG)


# ---------------------------------------------------------------------------
# Late / overtime calculation helper
# ---------------------------------------------------------------------------

def _to_mins(t) -> Optional[int]:
    """Convert a TIME / 'HH:MM' / 'HH:MM:SS' value to minutes from midnight."""
    try:
        parts = str(t).split(':')
        return int(parts[0]) * 60 + int(parts[1])
    except Exception:
        return None


def _calc_attendance_metrics(check_in, check_out, is_on_leave: bool = False) -> dict:
    """Compute all time-based attendance metrics for one record.

    Returns a dict with:
      late_minutes     – minutes after 09:30  (0 if on time or on leave)
      early_minutes    – minutes before 09:30  (0 if late or on leave)
      beyond_grace     – 1 if check_in > 09:50, else 0
      overtime_minutes – total worked minutes beyond the scheduled day
                         (early arrivals can offset a near-on-time checkout)
    All values are >= 0.
    """
    zero = dict(late_minutes=0, early_minutes=0, beyond_grace=0, overtime_minutes=0)
    if is_on_leave or check_in is None:
        return zero

    checkin_mins = _to_mins(check_in)
    if checkin_mins is None:
        return zero

    late  = max(0, checkin_mins - OFFICE_START_MINS)
    early = max(0, OFFICE_START_MINS - checkin_mins)
    grace = 1 if checkin_mins > GRACE_TIME_MINS else 0

    ot = 0
    if check_out is not None:
        checkout_mins = _to_mins(check_out)
        if checkout_mins is not None:
            worked_mins = max(0, checkout_mins - checkin_mins)
            ot = max(0, worked_mins - SCHEDULED_DAY_MINS)

    return dict(late_minutes=late, early_minutes=early, beyond_grace=grace, overtime_minutes=ot)


def _calc_late_overtime(check_in, check_out, is_on_leave: bool = False):
    """Backward-compat shim → returns (late_minutes, overtime_minutes)."""
    m = _calc_attendance_metrics(check_in, check_out, is_on_leave)
    return m['late_minutes'], m['overtime_minutes']


# ---------------------------------------------------------------------------
# One-time DB migration: add columns + backfill existing rows
# ---------------------------------------------------------------------------

def _migrate_attendance_cols():
    """Add new time-tracking columns to attendance if absent, then backfill all rows."""
    try:
        conn = get_db_connection()
        cur  = conn.cursor()

        # INT columns (late, early, overtime in minutes)
        for col in ('late_minutes', 'overtime_minutes', 'early_minutes'):
            try:
                cur.execute(f"ALTER TABLE attendance ADD COLUMN {col} INT NOT NULL DEFAULT 0")
                conn.commit()
            except mysql.connector.errors.DatabaseError as exc:
                if getattr(exc, 'errno', None) == 1060:
                    conn.rollback()
                else:
                    conn.rollback()

        # TINYINT flag: 1 when check_in > 09:50
        try:
            cur.execute(
                "ALTER TABLE attendance ADD COLUMN beyond_grace TINYINT NOT NULL DEFAULT 0"
            )
            conn.commit()
        except mysql.connector.errors.DatabaseError as exc:
            if getattr(exc, 'errno', None) == 1060:
                conn.rollback()
            else:
                conn.rollback()

        # Backfill all rows that have a check_in — pure SQL, idempotent
        # OFFICE_START=570  GRACE=590  OFFICE_END=1110  SCHEDULED_DAY=540
        cur.execute("""
            UPDATE attendance
            SET
                late_minutes = CASE
                    WHEN status = 'ON_LEAVE' OR check_in IS NULL THEN 0
                    WHEN CAST(TIME_TO_SEC(check_in) / 60 AS SIGNED) > 570
                    THEN GREATEST(0, CAST(TIME_TO_SEC(check_in) / 60 AS SIGNED) - 570)
                    ELSE 0
                END,
                early_minutes = CASE
                    WHEN status = 'ON_LEAVE' OR check_in IS NULL THEN 0
                    WHEN CAST(TIME_TO_SEC(check_in) / 60 AS SIGNED) < 570
                    THEN GREATEST(0, 570 - CAST(TIME_TO_SEC(check_in) / 60 AS SIGNED))
                    ELSE 0
                END,
                beyond_grace = CASE
                    WHEN status = 'ON_LEAVE' OR check_in IS NULL THEN 0
                    WHEN CAST(TIME_TO_SEC(check_in) / 60 AS SIGNED) > 590 THEN 1
                    ELSE 0
                END,
                overtime_minutes = CASE
                    WHEN status = 'ON_LEAVE' OR check_out IS NULL THEN 0
                    ELSE GREATEST(
                        0,
                        CAST(TIME_TO_SEC(check_out) / 60 AS SIGNED)
                        - CAST(TIME_TO_SEC(check_in) / 60 AS SIGNED)
                        - 540
                    )
                END
            WHERE check_in IS NOT NULL
        """)
        conn.commit()
        cur.close()
        conn.close()
    except Exception:
        pass   # never block startup


_migrate_attendance_cols()

router = APIRouter()


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class AttendanceRecord(BaseModel):
    employee_id: str
    attendance_date: str          # kept as-is for API compatibility
    check_in: str
    check_out: Optional[str] = None
    status: str = "PRESENT"
    remarks: Optional[str] = None
    modified_by: Optional[str] = None   # HR/admin user_id performing the change (required)
    reason: Optional[str] = None


class LeaveRequest(BaseModel):
    employee_id: str
    leave_type: str
    start_date: str
    end_date: str
    reason: str


# ---------------------------------------------------------------------------
# Attendance endpoints
# ---------------------------------------------------------------------------

@router.post("/api/attendance/mark")
async def mark_attendance(record: AttendanceRecord):
    """Mark or update attendance for an employee (upsert on employee_id + date). HR/admin only; audit-logged."""
    from backend.core.time_tracking import verify_staff, log_audit
    actor = verify_staff(record.modified_by)
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        ocur = conn.cursor(dictionary=True)
        ocur.execute("""SELECT status, CAST(check_in AS CHAR) AS check_in, CAST(check_out AS CHAR) AS check_out
                        FROM attendance WHERE employee_id = %s AND date = %s""", (record.employee_id, record.attendance_date))
        old_row = ocur.fetchone()
        ocur.close()

        is_on_leave = record.status == "ON_LEAVE"
        m = _calc_attendance_metrics(record.check_in, record.check_out, is_on_leave)

        cursor.execute("""
            INSERT INTO attendance
                (employee_id, date, check_in, check_out, status,
                 late_minutes, early_minutes, beyond_grace, overtime_minutes)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                check_in         = VALUES(check_in),
                check_out        = VALUES(check_out),
                status           = VALUES(status),
                late_minutes     = VALUES(late_minutes),
                early_minutes    = VALUES(early_minutes),
                beyond_grace     = VALUES(beyond_grace),
                overtime_minutes = VALUES(overtime_minutes)
        """, (
            record.employee_id,
            record.attendance_date,
            record.check_in,
            record.check_out,
            record.status,
            m['late_minutes'],
            m['early_minutes'],
            m['beyond_grace'],
            m['overtime_minutes'],
        ))

        acur = conn.cursor(dictionary=True)
        log_audit(acur, employee_id=record.employee_id, attendance_date=record.attendance_date[:10],
                  action="MANUAL_UPDATE" if old_row else "MANUAL_CREATE", actor=actor, old=old_row,
                  new={"status": record.status, "check_in": record.check_in, "check_out": record.check_out},
                  reason=record.reason or record.remarks)
        acur.close()
        conn.commit()
        cursor.close()

        # Keep monthly_late_summary / attendance_deductions in step with the manual entry
        if record.check_in and record.status not in ("ON_LEAVE", "ABSENT"):
            try:
                from datetime import datetime as _dt, date as _date
                from backend.core.attendance_rules import apply_late_flags
                parts = str(record.check_in).split(":")
                ci = _dt(2000, 1, 1, int(parts[0]), int(parts[1]), int(parts[2]) if len(parts) > 2 else 0).time()
                d_ = _date.fromisoformat(str(record.attendance_date)[:10])
                dcur = conn.cursor(dictionary=True)
                apply_late_flags(dcur, record.employee_id, d_, ci)
                conn.commit()
                dcur.close()
            except Exception as exc:
                import logging; logging.getLogger(__name__).warning("mark_attendance: late policy update failed: %s", exc)
        conn.close()
        return {"success": True, "message": "Attendance marked", **m}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/attendance/{employee_id}")
async def get_attendance(employee_id: str, month: Optional[str] = None):
    """Return attendance records. month = 'YYYY-MM' (optional filter)."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        

        from backend.core.time_tracking import break_seconds_sql, net_seconds
        safe_select = """
                SELECT id, employee_id, date, status,
                       CASE WHEN check_in  IS NOT NULL THEN CAST(check_in  AS CHAR) ELSE NULL END AS check_in,
                       CASE WHEN check_out IS NOT NULL THEN CAST(check_out AS CHAR) ELSE NULL END AS check_out,
                       COALESCE(late_minutes,     0) AS late_minutes,
                       COALESCE(early_minutes,    0) AS early_minutes,
                       COALESCE(beyond_grace,     0) AS beyond_grace,
                       COALESCE(overtime_minutes, 0) AS overtime_minutes,
                       COALESCE(break_minutes, 0) AS break_minutes,
                       work_minutes,
                       __BRK__ AS break_seconds,
                       created_at
                FROM attendance
        """.replace("__BRK__", break_seconds_sql("attendance.employee_id", "attendance.date"))
        if month:
            year_int  = int(month.split('-')[0])
            month_int = int(month.split('-')[1])
            cursor.execute(safe_select + """
                WHERE employee_id = %s
                  AND YEAR(date) = %s AND MONTH(date) = %s
                ORDER BY date DESC
            """, (employee_id, year_int, month_int))
        else:
            cursor.execute(safe_select + """
                WHERE employee_id = %s
                ORDER BY date DESC
                LIMIT 30
            """, (employee_id,))

        records = cursor.fetchall()
        for r in records:
            r["break_seconds"] = int(r.get("break_seconds") or 0)
            r["net_seconds"] = net_seconds(r["date"], r["check_in"], r["check_out"], r["break_seconds"])
        cursor.close()
        conn.close()
        return {"success": True, "data": records}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Late-arrival summary endpoint
# ---------------------------------------------------------------------------

@router.get("/api/attendance/late-summary/{employee_id}")
async def get_late_summary(employee_id: str, month: Optional[str] = None, year: Optional[str] = None):
    """Return monthly late/early/overtime summary and deduction info.

    month = 'YYYY-MM' (legacy) OR month='MM' + year='YYYY' (frontend format).
    """
    try:
        from datetime import date as _date
        now = _date.today()
        if month and '-' in month:
            # Legacy format: YYYY-MM
            year_int  = int(month.split('-')[0])
            month_int = int(month.split('-')[1])
        elif month and year:
            # Frontend format: month=MM&year=YYYY
            year_int  = int(year)
            month_int = int(month)
        else:
            year_int, month_int = now.year, now.month

        conn = get_db_connection()
        cur  = conn.cursor(dictionary=True)

        cur.execute("""
            SELECT
                COUNT(*)                             AS total_records,
                SUM(CASE WHEN late_minutes  > 0 THEN 1 ELSE 0 END)  AS late_count,
                SUM(CASE WHEN early_minutes > 0 THEN 1 ELSE 0 END)  AS early_count,
                SUM(CASE WHEN beyond_grace  = 1 THEN 1 ELSE 0 END)  AS grace_late_count,
                SUM(COALESCE(late_minutes,  0))      AS total_late_minutes,
                SUM(COALESCE(early_minutes, 0))      AS total_early_minutes,
                SUM(COALESCE(overtime_minutes, 0))   AS total_overtime_minutes
            FROM attendance
            WHERE employee_id = %s
              AND YEAR(date)  = %s
              AND MONTH(date) = %s
              AND status NOT IN ('ON_LEAVE', 'ABSENT')
        """, (employee_id, year_int, month_int))
        row = cur.fetchone() or {}

        grace_late_count  = int(row.get('grace_late_count', 0) or 0)
        deductions_applied = grace_late_count // 3

        # Fetch daily salary for deduction value
        cur.execute("""
            SELECT es.gross_salary
            FROM employee_salaries es
            JOIN (
                SELECT employee_id, MAX(id) AS max_id
                FROM employee_salaries
                WHERE status = 'active'
                GROUP BY employee_id
            ) _l ON es.id = _l.max_id
            WHERE es.employee_id = %s
        """, (employee_id,))
        sal_row = cur.fetchone()
        monthly_salary = float(sal_row['gross_salary']) if sal_row and sal_row.get('gross_salary') else 0.0

        import calendar as _cal
        total_days   = _cal.monthrange(year_int, month_int)[1]
        daily_salary = monthly_salary / total_days if total_days else 0.0
        half_day_val = round(daily_salary / 2, 2)
        late_deduction = round(deductions_applied * half_day_val, 2)

        cur.close()
        conn.close()

        return {
            "success":              True,
            "employee_id":          employee_id,
            "month":                f"{year_int:04d}-{month_int:02d}",
            "late_count":           int(row.get('late_count',  0) or 0),
            "early_count":          int(row.get('early_count', 0) or 0),
            "grace_late_count":     grace_late_count,
            "deductions_applied":   deductions_applied,
            "half_day_value":       half_day_val,
            "late_arrival_deduction": late_deduction,
            "total_late_minutes":   int(row.get('total_late_minutes',     0) or 0),
            "total_early_minutes":  int(row.get('total_early_minutes',    0) or 0),
            "total_overtime_minutes": int(row.get('total_overtime_minutes', 0) or 0),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# /api/hr/wfo-attendance lives in app.py (selfie + geo based)

@router.get("/api/hr/wfh-attendance")
async def get_hr_wfh_attendance(date: str = None):
    try:
        from datetime import date as _date
        target_date = date or _date.today().isoformat()
        
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        
        cur.execute("""
            SELECT e.employee_code AS employee_id, e.full_name, d.name AS department,
                   dwm.status AS wfh_status,
                   wa.punch_in_at AS checkin_at,
                   CONCAT(wa.geo_latitude, ',', wa.geo_longitude) AS checkin_location,
                   CASE WHEN wa.punch_in_at > CONCAT(dwm.work_date, ' 10:00:00') THEN 1 ELSE 0 END AS is_late,
                   wa.punch_out_at AS checkout_at,
                   NULL AS checkout_location,
                   ROUND(wa.duration_minutes / 60.0, 2) AS duration_hours,
                   CASE WHEN wa.status IN ('APPROVED', 'AUTO_APPROVED') THEN 1 ELSE 0 END AS is_approved
            FROM employees e
            LEFT JOIN departments d ON e.department_id = d.id
            JOIN daily_work_mode dwm ON e.employee_code = dwm.employee_id AND dwm.work_date = %s AND dwm.mode = 'WFH'
            LEFT JOIN wfh_attendance wa ON e.employee_code = wa.employee_id AND DATE(wa.punch_in_at) = %s
        """, (target_date, target_date))
        
        records = cur.fetchall()
        for r in records:
            if hasattr(r.get('checkin_at'), 'isoformat'): r['checkin_at'] = r['checkin_at'].isoformat()
            if hasattr(r.get('checkout_at'), 'isoformat'): r['checkout_at'] = r['checkout_at'].isoformat()
            
        cur.close()
        conn.close()
        return {"success": True, "records": records}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Leave endpoints
# ---------------------------------------------------------------------------

# POST /api/leave/apply lives in app.py (handles half-day + unpaid split)

@router.get("/api/leave/balance/{employee_id}")
async def get_leave_balance(employee_id: str):
    """Return leave balance for an employee; creates a default row if none exists."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute(
            "SELECT * FROM leave_balance WHERE employee_id = %s",
            (employee_id,)
        )
        balance = cursor.fetchone()

        if not balance:
            cursor.execute(
                "INSERT IGNORE INTO leave_balance (employee_id) VALUES (%s)",
                (employee_id,)
            )
            conn.commit()
            balance = {
                "employee_id": employee_id,
                "casual_leave": 0.5,
                "sick_leave":   0.5,
                "earned_leave": 0.5,
            }

        cursor.close()
        conn.close()
        casual = float(balance.get("casual_leave") or 0)
        sick = float(balance.get("sick_leave") or 0)
        earned = float(balance.get("earned_leave") or 0)
        # Compute unpaid leaves taken (approved & marked unpaid)
        try:
            conn = get_db_connection()
            cur2 = conn.cursor()
            cur2.execute("""
                SELECT COALESCE(SUM(days_count), 0) FROM leave_requests
                WHERE employee_id = %s AND LOWER(status) = 'approved' AND COALESCE(is_unpaid, 0) = 1
            """, (employee_id,))
            unpaid_taken = float(cur2.fetchone()[0] or 0)
            cur2.close()
            conn.close()
        except Exception:
            unpaid_taken = 0.0
        summary = {
            **balance,
            "casual_balance": casual,
            "sick_balance": sick,
            "paid_balance": earned,
            "unpaid_taken": unpaid_taken,
            "earned_balance": earned,
            "total_balance": casual + sick + earned,
            "total_remaining": casual + sick + earned,
        }
        rows = [
            {"leave_type": "Casual Leave", "total_days": 0.5, "used_days": max(0, 0.5 - casual), "remaining_days": casual},
            {"leave_type": "Sick Leave", "total_days": 0.5, "used_days": max(0, 0.5 - sick), "remaining_days": sick},
            {"leave_type": "Earned Leave", "total_days": 0.5, "used_days": max(0, 0.5 - earned), "remaining_days": earned},
        ]
        return {
            "success": True,
            "data": summary,
            "balance": summary,
            "summary": summary,
            "balances": rows,
            "rows": rows,
            "total_remaining": summary["total_remaining"],
        }
    except Exception as e:
        defaults = {
            "employee_id": employee_id,
            "casual_leave": 0.5,
            "sick_leave": 0.5,
            "earned_leave": 0.5,
            "casual_balance": 0.5,
            "sick_balance": 0.5,
            "paid_balance": 0.5,
            "earned_balance": 0.5,
            "total_balance": 1.5,
            "total_remaining": 1.5,
        }
        return {"success": True, "message": str(e), "data": defaults, "balance": defaults, "summary": defaults, "balances": [], "rows": [], "total_remaining": 1.5}


# Leave approve / reject routes live in app.py (_set_leave_status: paid-first, then unpaid)

@router.get("/api/leave/pending")
async def get_pending_leaves():
    """Return all PENDING leave requests with employee name and department."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT lr.*,
                   e.full_name  AS employee_name,
                   d.name       AS department
            FROM leave_requests lr
            LEFT JOIN employees  e ON lr.employee_id = e.employee_code
            LEFT JOIN departments d ON e.department_id = d.id
            WHERE lr.status = 'PENDING'
            ORDER BY lr.created_at DESC
        """)

        leaves = cursor.fetchall()
        for r in leaves:
             for key in ['start_date', 'end_date', 'created_at', 'approved_at']:
                  if r.get(key) and hasattr(r[key], 'isoformat'):
                       r[key] = r[key].isoformat()

        cursor.close()
        conn.close()
        return {"success": True, "data": leaves}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/leave_requests/all")
async def get_all_leave_requests():
    """Return all leave requests."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM leave_requests ORDER BY created_at DESC")
        leaves = cursor.fetchall()
        for r in leaves:
             for key in ['start_date', 'end_date', 'created_at', 'approved_at']:
                  if r.get(key) and hasattr(r[key], 'isoformat'):
                       r[key] = r[key].isoformat()
        cursor.close()
        conn.close()
        return {"success": True, "leave_requests": leaves}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/leave_requests/employee/{employee_id}")
async def get_employee_leave_requests(employee_id: str):
    """Return leave requests for a specific employee."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM leave_requests WHERE employee_id = %s ORDER BY created_at DESC", (employee_id,))
        leaves = cursor.fetchall()
        for r in leaves:
             for key in ['start_date', 'end_date', 'created_at', 'approved_at']:
                  if r.get(key) and hasattr(r[key], 'isoformat'):
                       r[key] = r[key].isoformat()
        cursor.close()
        conn.close()
        return {"success": True, "requests": leaves}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/leave/calendar/{employee_id}")
async def get_leave_calendar(employee_id: str, year: int, month: int):
    """Return leave requests + holidays for a specific month/employee, for calendar rendering."""
    import calendar as _cal

    days_in_month = _cal.monthrange(year, month)[1]
    all_sats = [
        d for d in range(1, days_in_month + 1)
        if datetime(year, month, d).weekday() == 5
    ]
    # Mark 2nd and 4th Saturdays as company holidays
    second_and_fourth_saturdays = []
    if len(all_sats) >= 2:
        second_and_fourth_saturdays.append(all_sats[1])
    if len(all_sats) >= 4:
        second_and_fourth_saturdays.append(all_sats[3])

    # Mark all Sundays as holidays / weekly off
    sundays = [
        d for d in range(1, days_in_month + 1)
        if datetime(year, month, d).weekday() == 6
    ]

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        if str(employee_id).lower() in ("all", "", "0", "undefined", "null", "admin", "hr"):
            cursor.execute("""
                SELECT lr.id, lr.employee_id, lr.leave_type, lr.start_date, lr.end_date, lr.status, lr.reason,
                       e.full_name AS employee_name
                FROM leave_requests lr
                LEFT JOIN employees e ON lr.employee_id = e.employee_code
                WHERE YEAR(lr.start_date) = %s AND MONTH(lr.start_date) = %s
                ORDER BY lr.start_date
            """, (year, month))
        else:
            cursor.execute("""
                SELECT id, employee_id, leave_type, start_date, end_date, status, reason
                FROM leave_requests
                WHERE employee_id = %s
                  AND YEAR(start_date) = %s
                  AND MONTH(start_date) = %s
                ORDER BY start_date
            """, (employee_id, year, month))

        leaves = cursor.fetchall()
        for r in leaves:
            for key in ('start_date', 'end_date'):
                if r.get(key) and hasattr(r[key], 'isoformat'):
                    r[key] = r[key].isoformat()

        cursor.execute("""
            SELECT
                name                                   AS holiday_name,
                DATE_FORMAT(`date`, '%%Y-%%m-%%d')      AS holiday_date,
                COALESCE(description, '')               AS description
            FROM holidays
            WHERE YEAR(`date`) = %s
              AND MONTH(`date`) = %s
            ORDER BY `date`
        """, (year, month))
        holidays = cursor.fetchall()

        cursor.close()
        conn.close()

        return {
            "success": True,
            "year": year,
            "month": month,
            "leaves": leaves,
            "holidays": holidays,
            "saturdays": second_and_fourth_saturdays,
            "second_and_fourth_saturdays": second_and_fourth_saturdays,
            "sundays": sundays,
            "all_saturdays": all_sats,
        }
    except Exception as e:
        # Never crash the calendar widget — return calculated holidays/saturdays/sundays
        return {
            "success": True,
            "year": year,
            "month": month,
            "leaves": [],
            "holidays": [],
            "saturdays": second_and_fourth_saturdays,
            "second_and_fourth_saturdays": second_and_fourth_saturdays,
            "sundays": sundays,
            "all_saturdays": all_sats,
            "message": str(e),
        }

@router.get("/api/leave/all-balances")
async def get_all_leave_balances():
    """Return leave balances for all employees."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT lb.*, e.full_name AS employee_name, e.full_name AS name,
                   COALESCE(e.department, '') AS department,
                   COALESCE(e.title, '') AS title,
                   COALESCE(e.status, 'active') AS status
            FROM leave_balance lb
            JOIN employees e ON (lb.employee_id = e.employee_code OR lb.employee_id = e.employee_id)
            ORDER BY e.full_name
        """)
        balances = cursor.fetchall()
        for r in balances:
            if hasattr(r.get('updated_at'), 'isoformat'):
                r['updated_at'] = r['updated_at'].isoformat()
        cursor.close()
        conn.close()
        return {"success": True, "employees": balances}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/leave/holidays")
async def get_leave_holidays():
    """Return company holidays."""
    return {"success": True, "holidays": []}


# ═══════════════════════════════════════════════════════════════════════════════
# Work Mode Commitment Endpoints (Onboarding-Based, Not Daily Selection)
# ═══════════════════════════════════════════════════════════════════════════════

class WorkModeCommitmentResponse(BaseModel):
    employee_id: str
    default_work_mode: str | None
    biometric_enroll_id: str | None


@router.get("/api/employee/work-mode/{employee_id}", response_model=WorkModeCommitmentResponse)
async def get_employee_committed_work_mode(employee_id: str):
    """
    Return the employee committed work mode from onboarding.
    This is a ONE-TIME commitment made during signup, NOT a daily selection.
    """
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT employee_code, default_work_mode, biometric_enroll_id
            FROM employees
            WHERE employee_code = %s
            LIMIT 1
        """, (employee_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Employee not found")
        return {
            "employee_id": row["employee_code"],
            "default_work_mode": row["default_work_mode"],
            "biometric_enroll_id": row["biometric_enroll_id"]
        }
    except mysql.connector.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        cursor.close()
        conn.close()


class DailyWorkModeAutoCreate(BaseModel):
    employee_id: str
    mode: str  # WFO or WFH


@router.post("/api/attendance/work-mode/auto")
async def auto_create_daily_work_mode(payload: DailyWorkModeAutoCreate):
    """
    Auto-create today daily_work_mode row based on the employee committed work mode.
    Called by the frontend when employee visits the attendance page.
    """
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    today = datetime.now().strftime("%Y-%m-%d")
    try:
        # Check if today row already exists
        cursor.execute("""
            SELECT id FROM daily_work_mode
            WHERE employee_id = %s AND work_date = %s
            LIMIT 1
        """, (payload.employee_id, today))
        existing = cursor.fetchone()
        if existing:
            return {"success": True, "data": {"id": existing["id"], "message": "Today work mode already set"}}

        # Get committed biometric_id for WFO employees
        cursor.execute("""
            SELECT biometric_enroll_id FROM employees
            WHERE employee_code = %s
            LIMIT 1
        """, (payload.employee_id,))
        emp = cursor.fetchone()
        biometric_id = emp["biometric_enroll_id"] if emp else None

        # Insert today row based on committed mode
        cursor.execute("""
            INSERT INTO daily_work_mode
                (employee_id, work_date, mode, biometric_user_id, status)
            VALUES (%s, %s, %s, %s, 'PENDING')
        """, (payload.employee_id, today, payload.mode, biometric_id))
        conn.commit()
        new_id = cursor.lastrowid
        return {"success": True, "data": {"id": new_id, "message": "Today work mode auto-created"}}
    except mysql.connector.IntegrityError:
        conn.rollback()
        return {"success": True, "data": {"message": "Already exists"}}
    except mysql.connector.Error as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        cursor.close()
        conn.close()
