"""
Payslip data-access layer.

All SQL for payslip computation lives here. `fetch_payslip_inputs` gathers every
DB-sourced value for one employee/month in a single connection (matching the old
_compute), so the service can do the pure calculations without touching the DB.
"""

import logging
from backend.core import payroll_engine
from .db import get_connection

log = logging.getLogger(__name__)


def _sf(v) -> float:
    if v is None:
        return 0.0
    try:
        return float(str(v).replace(',', ''))
    except (ValueError, TypeError):
        return 0.0


def fetch_payslip_inputs(employee_id: str, month: int, year: int):
    """Raw inputs for a payslip, or None if the employee doesn't exist."""
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
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
        monthly_salary = _sf(sal_row['gross_salary']) if sal_row else 0.0

        cur.execute("""
            SELECT COUNT(DISTINCT date) AS cnt
            FROM attendance
            WHERE employee_id = %s
              AND MONTH(date) = %s
              AND YEAR(date)  = %s
        """, (employee_id, month, year))
        present_days = int((cur.fetchone() or {}).get('cnt', 0) or 0)

        # Leave inside this month only (a leave crossing a month end is split by calendar day)
        lv_part = payroll_engine.leave_portion_for_month(employee_id, month, year, cur)
        unpaid_leave_days = lv_part["unpaid_days"]

        # Late-arrival summary (needs a live cursor — payroll_engine queries through it)
        cur2 = conn.cursor(dictionary=True)
        late_info = payroll_engine.get_late_arrival_summary(
            employee_id, month, year, monthly_salary, cur2
        )
        cur2.close()

        paid_leave_used = lv_part["paid_leave_used"]

        return {
            "emp":               emp,
            "monthly_salary":    monthly_salary,
            "present_days":      present_days,
            "unpaid_leave_days": unpaid_leave_days,
            "paid_leave_used":   paid_leave_used,
            "late_info":         late_info,
        }
    finally:
        cur.close()
        conn.close()


def company_name() -> str:
    try:
        conn = get_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT company_name FROM accountant_settings WHERE id = 1")
        row = cur.fetchone()
        cur.close(); conn.close()
        return (row["company_name"] or "Company") if row else "Company"
    except Exception:
        return "Company"


def list_active_employee_ids() -> list:
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute("SELECT employee_code AS eid FROM employees WHERE status='active' ORDER BY full_name")
        return [r['eid'] for r in cur.fetchall()]
    finally:
        cur.close()
        conn.close()


def fetch_generated_slip(employee_id: str, month_str: str):
    """Latest accountant-generated salary-slip PDF record for employee+month, or None."""
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute("""
            SELECT file_url, updated_at
            FROM document_requests
            WHERE employee_id     = %s
              AND document_type   IN ('salary-slip', 'payslip')
              AND status          = 'generated'
              AND requested_month = %s
            ORDER BY updated_at DESC
            LIMIT 1
        """, (employee_id, month_str))
        return cur.fetchone()
    finally:
        cur.close()
        conn.close()
