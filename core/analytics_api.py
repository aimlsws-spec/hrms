"""
Analytics Aggregate API
Provides real DB-backed aggregate analytics for the React frontend.

Schema notes (from actual DB inspection):
  attendance(id, employee_id, date, status, check_in, check_out, created_at)
    - status: 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'ON_LEAVE'
    - check_in / check_out: MySQL TIME columns (Python timedelta via connector)
  leave_requests(id, employee_id, leave_type, start_date, end_date, days_count,
                 reason, status, approved_by, approved_at, created_at, ...)
    - status: 'Approved' | 'Pending' | 'Rejected'
  employees(id, employee_id, full_name, name, department, joining_date, status, created_at)
  monthly_payroll: table exists but is currently empty — not used here
  documents: NO table — document generation is file-based only, no DB tracking

DB limitations documented:
  - No document generation history table → /analytics/documents returns data_available: false
  - monthly_payroll.days_worked / days_absent would give better attendance data but table is empty
  - No pre-computed work_hours column in attendance → overtime computed from check_in/check_out delta
  - Some employees may have NULL joining_date → fallback to created_at for growth analytics

SQL notes:
  - mysql-connector does NOT use Python % string formatting on query text — only %s placeholders
    are substituted. DATE_FORMAT format strings use single % (e.g. '%Y-%m'), not %%.
  - MySQL sql_mode=only_full_group_by is active — non-aggregated SELECT columns not in GROUP BY
    must be wrapped in ANY_VALUE().
"""

from fastapi import APIRouter, Query
import mysql.connector

from config import DB_CONFIG

router = APIRouter()


def _db():
    return mysql.connector.connect(**DB_CONFIG)


# ---------------------------------------------------------------------------
# GET /api/analytics/attendance?months=6
# ---------------------------------------------------------------------------

@router.get("/api/analytics/attendance")
def get_attendance_analytics(months: int = Query(default=6, ge=1, le=24)):
    """
    Aggregate attendance stats grouped by month.
    Computes real PRESENT/ABSENT/HALF_DAY/ON_LEAVE counts from the attendance table.
    Attendance rate = PRESENT / total_marked_days * 100.
    """
    try:
        conn = _db()
        cursor = conn.cursor(dictionary=True)

        # Monthly breakdown for last N months
        # Use single % in DATE_FORMAT — mysql-connector does not do Python % substitution
        cursor.execute("""
            SELECT
                DATE_FORMAT(date, '%Y-%m')           AS month,
                COUNT(*)                              AS total_marked,
                SUM(status = 'PRESENT')               AS present,
                SUM(status = 'ABSENT')                AS absent,
                SUM(status = 'HALF_DAY')              AS half_day,
                SUM(status = 'ON_LEAVE')              AS on_leave
            FROM attendance
            WHERE date >= DATE_SUB(CURDATE(), INTERVAL %s MONTH)
            GROUP BY DATE_FORMAT(date, '%Y-%m')
            ORDER BY month ASC
        """, (months,))
        monthly_rows = cursor.fetchall()

        monthly_trend = []
        for r in monthly_rows:
            total   = int(r["total_marked"] or 0)
            present = int(r["present"] or 0)
            absent  = int(r["absent"] or 0)
            half    = int(r["half_day"] or 0)
            leave   = int(r["on_leave"] or 0)
            rate    = round((present / total) * 100, 1) if total > 0 else 0.0
            monthly_trend.append({
                "month":    r["month"],
                "present":  present,
                "absent":   absent,
                "half_day": half,
                "on_leave": leave,
                "total":    total,
                "rate":     rate,
            })

        # Overall totals across the period
        cursor.execute("""
            SELECT
                COUNT(*)                 AS total_marked,
                SUM(status = 'PRESENT')  AS present,
                SUM(status = 'ABSENT')   AS absent,
                SUM(status = 'HALF_DAY') AS half_day,
                SUM(status = 'ON_LEAVE') AS on_leave
            FROM attendance
            WHERE date >= DATE_SUB(CURDATE(), INTERVAL %s MONTH)
        """, (months,))
        ov = cursor.fetchone()

        total   = int(ov["total_marked"] or 0)
        present = int(ov["present"] or 0)
        overall_rate = round((present / total) * 100, 1) if total > 0 else 0.0

        # Per-department attendance (join employees table)
        # ANY_VALUE on non-grouped cols to satisfy only_full_group_by
        cursor.execute("""
            SELECT
                COALESCE(e.department, 'Unknown')   AS department,
                COUNT(*)                             AS total_days,
                SUM(a.status = 'PRESENT')            AS present_days,
                ROUND(
                    SUM(a.status = 'PRESENT') / COUNT(*) * 100,
                1)                                   AS rate
            FROM attendance a
            LEFT JOIN employees e ON a.employee_id = e.employee_id
            WHERE a.date >= DATE_SUB(CURDATE(), INTERVAL %s MONTH)
            GROUP BY COALESCE(e.department, 'Unknown')
            ORDER BY rate DESC
        """, (months,))
        dept_rows = cursor.fetchall()

        dept_breakdown = [
            {
                "department":   r["department"],
                "total_days":   int(r["total_days"]),
                "present_days": int(r["present_days"] or 0),
                "rate":         float(r["rate"] or 0),
            }
            for r in dept_rows
        ]

        conn.close()
        return {
            "success":        True,
            "period_months":  months,
            "monthly_trend":  monthly_trend,
            "overall": {
                "total_marked":    total,
                "present":         present,
                "absent":          int(ov["absent"] or 0),
                "half_day":        int(ov["half_day"] or 0),
                "on_leave":        int(ov["on_leave"] or 0),
                "attendance_rate": overall_rate,
            },
            "by_department": dept_breakdown,
            "data_note": (
                "Computed from the attendance table. "
                "Rate = PRESENT / total_marked * 100. "
                "Days not recorded in attendance are not counted."
            ),
        }
    except Exception as e:
        return {
            "success": False, "message": str(e),
            "monthly_trend": [], "overall": {}, "by_department": [],
        }


# ---------------------------------------------------------------------------
# GET /api/analytics/overtime?months=3
# ---------------------------------------------------------------------------

@router.get("/api/analytics/overtime")
def get_overtime_analytics(months: int = Query(default=3, ge=1, le=12)):
    """
    Overtime computed from check_in / check_out TIME columns in the attendance table.
    Standard working hours = 8 per day (matches PayrollAutomation.standard_hours_per_day).
    Rows where check_out <= check_in (invalid/night-shift data) are excluded via WHERE.
    ANY_VALUE() used for employee name/dept to satisfy MySQL only_full_group_by.
    """
    try:
        conn = _db()
        cursor = conn.cursor(dictionary=True)

        # Monthly overtime totals
        cursor.execute("""
            SELECT
                DATE_FORMAT(date, '%Y-%m')   AS month,
                COUNT(*)                      AS days_with_data,
                COUNT(DISTINCT employee_id)   AS unique_employees,
                ROUND(SUM(
                    GREATEST(
                        (TIME_TO_SEC(check_out) - TIME_TO_SEC(check_in)) / 3600.0 - 8,
                        0
                    )
                ), 2)                         AS total_overtime_hours,
                ROUND(SUM(
                    (TIME_TO_SEC(check_out) - TIME_TO_SEC(check_in)) / 3600.0
                ), 2)                         AS total_work_hours
            FROM attendance
            WHERE status IN ('PRESENT', 'HALF_DAY')
              AND check_in  IS NOT NULL
              AND check_out IS NOT NULL
              AND check_out > check_in
              AND date >= DATE_SUB(CURDATE(), INTERVAL %s MONTH)
            GROUP BY DATE_FORMAT(date, '%Y-%m')
            ORDER BY month ASC
        """, (months,))
        monthly_rows = cursor.fetchall()

        monthly_overtime = [
            {
                "month":                r["month"],
                "days_with_data":       int(r["days_with_data"]),
                "unique_employees":     int(r["unique_employees"]),
                "total_overtime_hours": float(r["total_overtime_hours"] or 0),
                "total_work_hours":     float(r["total_work_hours"] or 0),
            }
            for r in monthly_rows
        ]

        # Top employees by overtime — ANY_VALUE for non-grouped name/dept columns
        cursor.execute("""
            SELECT
                a.employee_id,
                ANY_VALUE(COALESCE(e.full_name, e.name, a.employee_id)) AS employee_name,
                ANY_VALUE(COALESCE(e.department, 'Unknown'))            AS department,
                COUNT(*)                                                  AS days_worked,
                ROUND(SUM(
                    (TIME_TO_SEC(a.check_out) - TIME_TO_SEC(a.check_in)) / 3600.0
                ), 2)                                                     AS total_hours,
                ROUND(SUM(
                    GREATEST(
                        (TIME_TO_SEC(a.check_out) - TIME_TO_SEC(a.check_in)) / 3600.0 - 8,
                        0
                    )
                ), 2)                                                     AS overtime_hours
            FROM attendance a
            LEFT JOIN employees e ON a.employee_id = e.employee_id
            WHERE a.status IN ('PRESENT', 'HALF_DAY')
              AND a.check_in  IS NOT NULL
              AND a.check_out IS NOT NULL
              AND a.check_out > a.check_in
              AND a.date >= DATE_SUB(CURDATE(), INTERVAL %s MONTH)
            GROUP BY a.employee_id
            ORDER BY overtime_hours DESC
            LIMIT 10
        """, (months,))
        emp_rows = cursor.fetchall()

        per_employee = [
            {
                "employee_id":    r["employee_id"],
                "employee_name":  r["employee_name"],
                "department":     r["department"],
                "days_worked":    int(r["days_worked"]),
                "total_hours":    float(r["total_hours"] or 0),
                "overtime_hours": float(r["overtime_hours"] or 0),
            }
            for r in emp_rows
        ]

        conn.close()
        return {
            "success":                True,
            "period_months":          months,
            "standard_hours_per_day": 8,
            "monthly_overtime":       monthly_overtime,
            "top_by_overtime":        per_employee,
            "data_note": (
                "Overtime = hours_worked - 8 per day. "
                "Only days where check_out > check_in are included. "
                "Rows with missing or invalid check_out are excluded."
            ),
        }
    except Exception as e:
        return {
            "success": False, "message": str(e),
            "monthly_overtime": [], "top_by_overtime": [],
        }


# ---------------------------------------------------------------------------
# GET /api/analytics/documents
# ---------------------------------------------------------------------------

@router.get("/api/analytics/documents")
def get_document_analytics():
    """
    Document generation analytics.

    SCHEMA LIMITATION: Document generation in this system is entirely file-based
    (PDF/HTML written to disk by document_generator.py). There is no 'documents'
    table in the database and admin_activity_logs contains no document events.
    This endpoint returns data_available: false unless audit log entries exist.

    To enable real analytics, add a DB insert to document_generator.py each time
    a document is created (e.g. into a new 'document_generations' table).
    """
    try:
        conn = _db()
        cursor = conn.cursor(dictionary=True)

        # Best-effort: check admin_activity_logs for any document-related events
        cursor.execute("""
            SELECT action, COUNT(*) AS cnt
            FROM admin_activity_logs
            WHERE LOWER(action) LIKE '%document%'
               OR LOWER(action) LIKE '%salary slip%'
               OR LOWER(action) LIKE '%offer letter%'
               OR LOWER(action) LIKE '%experience%'
               OR LOWER(action) LIKE '%relieving%'
            GROUP BY action
        """)
        log_rows = cursor.fetchall()
        conn.close()

        if log_rows:
            by_type = {r["action"]: int(r["cnt"]) for r in log_rows}
            return {
                "success":         True,
                "data_available":  True,
                "data_source":     "admin_activity_logs (partial — only logged events)",
                "by_type":         by_type,
                "total_generated": sum(by_type.values()),
                "data_note":       "Only document events logged since audit logging was enabled.",
            }

        return {
            "success":         True,
            "data_available":  False,
            "by_type":         {},
            "total_generated": 0,
            "reason": (
                "No document tracking table exists. Document generation is file-based "
                "(document_generator.py writes PDFs/HTML to disk). "
                "admin_activity_logs contains no document events. "
                "Add a DB insert to document_generator.py to enable this analytics."
            ),
        }
    except Exception as e:
        return {"success": False, "data_available": False, "message": str(e)}


# ---------------------------------------------------------------------------
# GET /api/analytics/employees/growth?months=12
# ---------------------------------------------------------------------------

@router.get("/api/analytics/employees/growth")
def get_employee_growth(months: int = Query(default=12, ge=1, le=36)):
    """
    Employee growth analytics.
    Uses joining_date; falls back to DATE(created_at) when joining_date IS NULL.
    Returns new hires per month, cumulative headcount, and department breakdown.
    """
    try:
        conn = _db()
        cursor = conn.cursor(dictionary=True)

        # New hires per month within the window
        cursor.execute("""
            SELECT
                DATE_FORMAT(
                    COALESCE(joining_date, DATE(created_at)),
                    '%Y-%m'
                )                     AS month,
                COUNT(*)              AS new_hires
            FROM employees
            WHERE COALESCE(joining_date, DATE(created_at)) IS NOT NULL
              AND COALESCE(joining_date, DATE(created_at))
                    >= DATE_SUB(CURDATE(), INTERVAL %s MONTH)
            GROUP BY DATE_FORMAT(COALESCE(joining_date, DATE(created_at)), '%Y-%m')
            ORDER BY month ASC
        """, (months,))
        hire_rows = cursor.fetchall()

        # Employees that joined before the window (baseline for cumulative)
        cursor.execute("""
            SELECT COUNT(*) AS cnt
            FROM employees
            WHERE COALESCE(joining_date, DATE(created_at)) < DATE_SUB(CURDATE(), INTERVAL %s MONTH)
               OR (joining_date IS NULL AND created_at IS NULL)
        """, (months,))
        baseline_row = cursor.fetchone()
        baseline = int(baseline_row["cnt"] or 0)

        # Build cumulative growth
        cumulative = baseline
        monthly_growth = []
        for r in hire_rows:
            new_hires   = int(r["new_hires"])
            cumulative += new_hires
            monthly_growth.append({
                "month":      r["month"],
                "new_hires":  new_hires,
                "cumulative": cumulative,
            })

        # Department headcount (all employees, no date filter)
        cursor.execute("""
            SELECT
                COALESCE(department, 'Unknown')  AS department,
                COUNT(*)                          AS total,
                SUM(LOWER(COALESCE(status,'')) = 'active') AS active
            FROM employees
            GROUP BY COALESCE(department, 'Unknown')
            ORDER BY total DESC
        """)
        dept_rows = cursor.fetchall()
        dept_breakdown = [
            {
                "department": r["department"],
                "total":      int(r["total"]),
                "active":     int(r["active"] or 0),
            }
            for r in dept_rows
        ]

        # Overall employee status summary
        cursor.execute("""
            SELECT
                COUNT(*)                                         AS total,
                SUM(LOWER(COALESCE(status,'')) = 'active')       AS active,
                SUM(LOWER(COALESCE(status,'')) != 'active')      AS inactive
            FROM employees
        """)
        status_row = cursor.fetchone()

        conn.close()
        return {
            "success":        True,
            "period_months":  months,
            "monthly_growth": monthly_growth,
            "dept_breakdown": dept_breakdown,
            "totals": {
                "total":    int(status_row["total"] or 0),
                "active":   int(status_row["active"] or 0),
                "inactive": int(status_row["inactive"] or 0),
            },
            "data_note": (
                f"Joining date used as hire date; falls back to created_at when NULL. "
                f"Baseline (employees before {months}-month window): {baseline}."
            ),
        }
    except Exception as e:
        return {
            "success": False, "message": str(e),
            "monthly_growth": [], "dept_breakdown": [], "totals": {},
        }
