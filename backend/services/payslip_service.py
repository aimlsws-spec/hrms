"""
Payslip business logic.

Owns the attendance-based pay calculation (using payroll_engine's pure helpers),
orchestrates the model + view, and shapes the API responses. No SQL here.

  Monthly Salary  = employee's active gross_salary
  Per Day Salary  = Monthly Salary ÷ total calendar days in month
  Gross Earnings  = Present Days × Per Day Salary
  Net Salary      = Monthly Salary − PT − unpaid-leave ded − late-arrival ded
"""

import logging
from datetime import datetime

from backend.core import payroll_engine
from ..models import payslip_model
from ..views import payslip_view

log = logging.getLogger(__name__)

_PT = payroll_engine.PROFESSIONAL_TAX  # 200.0 — sourced from payroll_engine


def _default_month_year(month: int, year: int):
    now = datetime.now()
    return (month or now.month), (year or now.year)


def compute(employee_id: str, month: int, year: int):
    """Full payslip dict (incl. rendered HTML), or None if employee/salary missing."""
    try:
        inp = payslip_model.fetch_payslip_inputs(employee_id, month, year)
        if inp is None:
            return None

        emp               = inp["emp"]
        monthly_salary    = inp["monthly_salary"]
        present_days      = inp["present_days"]
        unpaid_leave_days = inp["unpaid_leave_days"]
        paid_leave_used   = inp["paid_leave_used"]
        late_info         = inp["late_info"]

        total_days  = payroll_engine.total_days_in_month(year, month)
        absent_days = max(0, total_days - present_days)
        per_day     = round(payroll_engine.calc_daily_salary(monthly_salary, year, month), 2)
        gross_earn  = round(present_days * per_day, 2)
        unpaid_leave_deduction = payroll_engine.calc_leave_deduction(
            monthly_salary, unpaid_leave_days, year, month
        )
        late_arrival_deduction = late_info["late_arrival_deduction"]
        net = round(max(0.0,
                    monthly_salary - _PT - unpaid_leave_deduction - late_arrival_deduction), 2)

        log.info(
            "payslip compute: emp=%s %02d/%d gross=%.2f days=%d/%d present=%d "
            "paid_leave=%.2f unpaid_days=%.2f leave_ded=%.2f pt=%.2f net=%.2f",
            employee_id, month, year, monthly_salary, present_days, total_days,
            present_days, paid_leave_used, unpaid_leave_days, unpaid_leave_deduction, _PT, net,
        )

        d = {
            "employee_id":            employee_id,
            "employee_name":          emp['full_name'],
            "department":             emp['department'],
            "job_title":              emp['title'],
            "payroll_month":          datetime(year, month, 1).strftime('%B %Y'),
            "monthly_salary":         monthly_salary,
            "working_days":           total_days,
            "present_days":           present_days,
            "absent_days":            absent_days,
            "per_day_salary":         per_day,
            "gross_earnings":         gross_earn,
            "professional_tax":       _PT,
            "paid_leave_used":        paid_leave_used,
            "unpaid_leave_days":      unpaid_leave_days,
            "unpaid_leave_deduction": unpaid_leave_deduction,
            "grace_late_count":       late_info["grace_late_count"],
            "late_deductions_applied": late_info["deductions_applied"],
            "late_arrival_deduction": late_arrival_deduction,
            "net_salary":             net,
            "company_name":           payslip_model.company_name(),
        }
        d["html"] = payslip_view.build_html(d)
        return d
    except Exception as exc:
        log.exception("payslip compute failed for emp=%s %02d/%d: %s", employee_id, month, year, exc)
        return None


def generate(employee_id: str, month: int, year: int) -> dict:
    if not employee_id:
        return {"success": False, "message": "employee_id is required"}
    month, year = _default_month_year(month, year)
    d = compute(employee_id, month, year)
    if d is None:
        return {"success": False, "message": "Employee not found or no salary record"}
    return {"success": True, **d}


def slip_url(employee_id: str, month: int, year: int) -> dict:
    """Whether an accountant-generated PDF exists for employee+month (official Seawind slip)."""
    if not employee_id:
        return {"found": False, "file_url": None, "payroll_month": None}
    month, year = _default_month_year(month, year)
    month_str     = f"{year:04d}-{month:02d}"
    payroll_month = datetime(year, month, 1).strftime('%B %Y')

    log.info("payslip slip_url: lookup emp=%s month=%s", employee_id, month_str)
    try:
        rec = payslip_model.fetch_generated_slip(employee_id, month_str)
        if rec and rec.get("file_url"):
            log.info("payslip slip_url: found %s for emp=%s month=%s (generated_at=%s)",
                     rec["file_url"], employee_id, month_str, rec.get("updated_at"))
            return {"found": True, "file_url": rec["file_url"], "payroll_month": payroll_month}
        log.info("payslip slip_url: no generated slip for emp=%s month=%s", employee_id, month_str)
        return {"found": False, "file_url": None, "payroll_month": payroll_month}
    except Exception as exc:
        log.exception("payslip slip_url error emp=%s month=%s: %s", employee_id, month_str, exc)
        return {"found": False, "file_url": None, "payroll_month": payroll_month}


def list_all(month: int, year: int) -> list:
    """Payslip summary for every active employee (no HTML, to keep payload small)."""
    month, year = _default_month_year(month, year)
    try:
        ids = payslip_model.list_active_employee_ids()
    except Exception:
        return []
    result = []
    for eid in ids:
        d = compute(eid, month, year)
        if d:
            result.append({k: v for k, v in d.items() if k not in ('html', 'company_name')})
    return result
