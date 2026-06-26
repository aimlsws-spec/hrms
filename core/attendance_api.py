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

from config import DB_CONFIG

# ---------------------------------------------------------------------------
# Office hours constants (minutes from midnight)
# ---------------------------------------------------------------------------
OFFICE_START_MINS = 9 * 60 + 30    # 09:30 → 570
GRACE_TIME_MINS   = 9 * 60 + 45    # 09:45 → 585  (late-beyond-grace threshold)
OFFICE_END_MINS   = 18 * 60 + 30   # 18:30 → 1110


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
      beyond_grace     – 1 if check_in > 09:45, else 0
      overtime_minutes – minutes after 18:30  (0 if no checkout or on leave)
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
        if checkout_mins is not None and checkout_mins > OFFICE_END_MINS:
            ot = max(0, checkout_mins - OFFICE_END_MINS)

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

        # TINYINT flag: 1 when check_in > 09:45
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
        # OFFICE_START=570  GRACE=585  OFFICE_END=1110
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
                    WHEN CAST(TIME_TO_SEC(check_in) / 60 AS SIGNED) > 585 THEN 1
                    ELSE 0
                END,
                overtime_minutes = CASE
                    WHEN status = 'ON_LEAVE' OR check_out IS NULL THEN 0
                    WHEN CAST(TIME_TO_SEC(check_out) / 60 AS SIGNED) > 1110
                    THEN GREATEST(0, CAST(TIME_TO_SEC(check_out) / 60 AS SIGNED) - 1110)
                    ELSE 0
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
    """Mark or update attendance for an employee (upsert on employee_id + date)."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        is_on_leave = record.status == "ON_LEAVE"
        m = _calc_attendance_metrics(record.check_in, record.check_out, is_on_leave)

        cursor.execute("""
            INSERT INTO attendance
                (employee_id, date, check_in, check_out, status,
                 late_minutes, early_minutes, beyond_grace, overtime_minutes)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
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

        conn.commit()
        cursor.close()
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
        

        safe_select = """
                SELECT id, employee_id, date, status,
                       CASE WHEN check_in  IS NOT NULL THEN CAST(check_in  AS CHAR) ELSE NULL END AS check_in,
                       CASE WHEN check_out IS NOT NULL THEN CAST(check_out AS CHAR) ELSE NULL END AS check_out,
                       COALESCE(late_minutes,     0) AS late_minutes,
                       COALESCE(early_minutes,    0) AS early_minutes,
                       COALESCE(beyond_grace,     0) AS beyond_grace,
                       COALESCE(overtime_minutes, 0) AS overtime_minutes,
                       created_at
                FROM attendance
        """
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
        cursor.close()
        conn.close()
        return {"success": True, "data": records}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Late-arrival summary endpoint
# ---------------------------------------------------------------------------

@router.get("/api/attendance/late-summary/{employee_id}")
async def get_late_summary(employee_id: str, month: Optional[str] = None):
    """Return monthly late/early/overtime summary and deduction info.

    month = 'YYYY-MM' (defaults to current month).
    """
    try:
        from datetime import date as _date
        now = _date.today()
        if month:
            year_int  = int(month.split('-')[0])
            month_int = int(month.split('-')[1])
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


# ---------------------------------------------------------------------------
# Leave endpoints
# ---------------------------------------------------------------------------

@router.post("/api/leave/request")
async def request_leave(leave: LeaveRequest):
    """Submit a leave request."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        start = datetime.strptime(leave.start_date, "%Y-%m-%d")
        end   = datetime.strptime(leave.end_date,   "%Y-%m-%d")
        days  = (end - start).days + 1

        cursor.execute("""
            INSERT INTO leave_requests
                (employee_id, leave_type, start_date, end_date, days_count, reason, status)
            VALUES (%s, %s, %s, %s, %s, %s, 'PENDING')
        """, (leave.employee_id, leave.leave_type,
              leave.start_date, leave.end_date, days, leave.reason))

        conn.commit()
        cursor.close()
        conn.close()
        return {"success": True, "message": "Leave request submitted", "days": days}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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


@router.put("/api/leave/approve/{leave_id}")
async def approve_leave(leave_id: int, approved_by: str, action: str):
    """Deprecated — use POST /api/leave/approve/{leave_id} instead."""
    raise HTTPException(
        status_code=410,
        detail=(
            "This endpoint is deprecated and has been disabled. "
            "Use POST /api/leave/approve/{leave_id} which correctly calculates "
            "unpaid_days, updates leave balances, and refreshes payroll."
        ),
    )


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
        cursor.close()
        conn.close()
        return {"success": True, "data": leaves}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
