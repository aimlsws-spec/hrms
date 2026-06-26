"""
payroll_engine.py — Canonical payroll calculation for HRMS.

Single source of truth for all payroll computations.  Every payroll-related
screen (dashboard, payroll page, payslips, reports, salary slip PDF) must use
the functions defined here so every number is identical everywhere.

Canonical formula (confirmed with management):
    total_days      = calendar days in the payroll month  (e.g. June → 30)
    daily_salary    = monthly_salary  ÷  total_days
    leave_deduction = unpaid_leave_days  ×  daily_salary
    net_salary      = monthly_salary  −  PROFESSIONAL_TAX  −  leave_deduction

Rules:
    • PROFESSIONAL_TAX is always ₹200/month, fixed for all employees.
    • Only APPROVED unpaid leave records (leave_requests.unpaid_days) contribute
      to the leave deduction.  Pending / rejected leaves are ignored.
    • Net salary floor is ₹0 (cannot go negative).
"""
from __future__ import annotations

import calendar
import logging
from datetime import datetime

import mysql.connector
from config import DB_CONFIG

log = logging.getLogger(__name__)

PROFESSIONAL_TAX: float = 200.0   # ₹200 / month — fixed for all employees


# ── Pure-formula helpers (no DB, always deterministic) ───────────────────────

def total_days_in_month(year: int, month: int) -> int:
    """Calendar days in the given month (28 – 31)."""
    return calendar.monthrange(year, month)[1]


def calc_daily_salary(monthly_salary: float, year: int, month: int) -> float:
    """daily_salary = monthly_salary / total_days_in_month."""
    days = total_days_in_month(year, month)
    return monthly_salary / days if days else 0.0


def calc_leave_deduction(monthly_salary: float, unpaid_days: float,
                          year: int, month: int) -> float:
    """leave_deduction = unpaid_days × daily_salary.  Zero when unpaid_days == 0."""
    if not unpaid_days:
        return 0.0
    return round(calc_daily_salary(monthly_salary, year, month) * unpaid_days, 2)


def calc_net_salary(monthly_salary: float, unpaid_days: float,
                     year: int, month: int) -> float:
    """net = monthly_salary − PT − leave_deduction  (floor 0)."""
    leave_ded = calc_leave_deduction(monthly_salary, unpaid_days, year, month)
    return round(max(0.0, monthly_salary - PROFESSIONAL_TAX - leave_ded), 2)


# ── DB helpers ────────────────────────────────────────────────────────────────

def _db():
    return mysql.connector.connect(**DB_CONFIG)


def _sf(v) -> float:
    if v is None:
        return 0.0
    try:
        return float(str(v).replace(',', ''))
    except (ValueError, TypeError):
        return 0.0


def get_employee_salary(employee_id: str, cur) -> float | None:
    """
    Latest active gross_salary from employee_salaries.
    Returns None when no active record exists.
    Caller owns the cursor lifecycle.
    """
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
    row = cur.fetchone()
    if row is None or row.get('gross_salary') is None:
        return None
    return _sf(row['gross_salary'])


def get_late_arrival_summary(employee_id: str, month: int, year: int,
                              monthly_salary: float, cur) -> dict:
    """Count beyond_grace occurrences for the month and return deduction info.

    Rule: every 3 beyond_grace occurrences = 0.5 day salary deduction.
    Idempotent — result is purely a function of current attendance records.
    """
    cur.execute("""
        SELECT COALESCE(SUM(CASE WHEN beyond_grace = 1 THEN 1 ELSE 0 END), 0) AS grace_late_count
        FROM attendance
        WHERE employee_id = %s
          AND YEAR(date)  = %s
          AND MONTH(date) = %s
          AND status NOT IN ('ON_LEAVE', 'ABSENT')
    """, (employee_id, year, month))
    row = cur.fetchone() or {}
    grace_late_count  = int(_sf(row.get('grace_late_count', 0)))
    deductions_applied = grace_late_count // 3
    total_days_m  = total_days_in_month(year, month)
    daily         = monthly_salary / total_days_m if total_days_m else 0.0
    half_day_val  = round(daily / 2, 2)
    deduction_amt = round(deductions_applied * half_day_val, 2)
    return {
        "grace_late_count":       grace_late_count,
        "deductions_applied":     deductions_applied,
        "late_arrival_deduction": deduction_amt,
    }


def get_leave_summary(employee_id: str, month: int, year: int, cur) -> dict:
    """
    Approved leave totals for the given month from leave_requests.

    Returns:
        unpaid_days     — days with no pay  (leave_requests.unpaid_days)
        paid_leave_used — paid leave taken   (days_count − unpaid_days)
    """
    month_start = f"{year:04d}-{month:02d}-01"
    cur.execute("""
        SELECT
            COALESCE(SUM(COALESCE(lr.unpaid_days, 0)), 0)                                        AS unpaid_days,
            COALESCE(SUM(GREATEST(COALESCE(lr.days_count,0) - COALESCE(lr.unpaid_days,0), 0)), 0) AS paid_leave_used,
            COUNT(*)                                                                               AS record_count
        FROM leave_requests lr
        WHERE lr.employee_id = %s
          AND lr.status      = 'Approved'
          AND lr.start_date  >= %s
          AND lr.start_date  <  DATE_ADD(%s, INTERVAL 1 MONTH)
    """, (employee_id, month_start, month_start))
    row = cur.fetchone() or {}
    unpaid   = _sf(row.get('unpaid_days', 0))
    paid     = _sf(row.get('paid_leave_used', 0))
    records  = int(row.get('record_count') or 0)
    log.debug(
        "get_leave_summary: emp=%s %02d/%d approved_records=%d "
        "paid_leave_days=%.2f unpaid_leave_days=%.2f",
        employee_id, month, year, records, paid, unpaid,
    )
    return {
        "unpaid_days":     unpaid,
        "paid_leave_used": paid,
    }


def compute(employee_id: str, month: int, year: int,
            conn=None, cur=None) -> dict | None:
    """
    Canonical payroll record for one employee in the given month/year.

    Returns a dict with all payroll fields, or None if the employee or salary
    record is not found.

    Pass conn + cur to reuse an existing DB connection; the cursor must be a
    fresh dictionary cursor (not mid-iteration).  Omit both to open and close
    a connection automatically.
    """
    owned = conn is None
    if owned:
        conn = _db()
        cur  = conn.cursor(dictionary=True)
    try:
        cur.execute("""
            SELECT full_name,
                   COALESCE(department, 'N/A') AS department,
                   COALESCE(title,      'N/A') AS title
            FROM employees
            WHERE employee_code = %s
        """, (employee_id,))
        emp = cur.fetchone()
        if not emp:
            return None

        monthly = get_employee_salary(employee_id, cur)
        if monthly is None:
            log.warning("payroll_engine.compute: no active salary for %s", employee_id)
            return None

        leave      = get_leave_summary(employee_id, month, year, cur)
        late_info  = get_late_arrival_summary(employee_id, month, year, monthly, cur)
        total_days = total_days_in_month(year, month)
        daily      = calc_daily_salary(monthly, year, month)
        leave_ded  = calc_leave_deduction(monthly, leave["unpaid_days"], year, month)
        late_ded   = late_info["late_arrival_deduction"]
        net        = round(max(0.0,
                       monthly - PROFESSIONAL_TAX - leave_ded - late_ded), 2)

        log.info(
            "payroll_engine COMPUTE: emp=%s %02d/%d gross=%.2f days=%d "
            "paid_leave_days=%.2f unpaid_leave_days=%.2f daily=%.4f "
            "leave_deduction=%.2f late_deduction=%.2f pt=%.2f net=%.2f",
            employee_id, month, year, monthly, total_days,
            leave["paid_leave_used"], leave["unpaid_days"],
            daily, leave_ded, late_ded, PROFESSIONAL_TAX, net,
        )

        return {
            "employee_id":            employee_id,
            "employee_name":          emp["full_name"],
            "department":             emp["department"],
            "job_title":              emp["title"],
            "payroll_month":          datetime(year, month, 1).strftime('%B %Y'),
            "month":                  month,
            "year":                   year,
            "monthly_salary":         monthly,
            "total_days":             total_days,
            "daily_salary":           round(daily, 4),
            "professional_tax":       PROFESSIONAL_TAX,
            "unpaid_days":            leave["unpaid_days"],
            "paid_leave_used":        leave["paid_leave_used"],
            "leave_deduction":        leave_ded,
            "grace_late_count":       late_info["grace_late_count"],
            "late_deductions_applied": late_info["deductions_applied"],
            "late_arrival_deduction": late_ded,
            "net_salary":             net,
        }
    finally:
        if owned:
            cur.close()
            conn.close()


def compute_all(month: int, year: int) -> list[dict]:
    """
    Payroll for all active employees in the given month/year.

    Uses a single DB connection with one fresh cursor per employee so
    cursor state never leaks between iterations.  All results are computed
    with the same canonical formula as compute().
    """
    conn = _db()
    try:
        cur_ids = conn.cursor(dictionary=True)
        cur_ids.execute(
            "SELECT employee_code FROM employees WHERE status = 'active' ORDER BY full_name"
        )
        ids = [r['employee_code'] for r in cur_ids.fetchall()]
        cur_ids.close()

        results: list[dict] = []
        for eid in ids:
            cur_emp = conn.cursor(dictionary=True)
            d = compute(eid, month, year, conn, cur_emp)
            cur_emp.close()
            if d:
                results.append(d)
        return results
    finally:
        conn.close()
