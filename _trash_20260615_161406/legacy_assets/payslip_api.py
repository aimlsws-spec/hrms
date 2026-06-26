"""
Payslip API — /api/payslip/* endpoints

Attendance-based pay slip calculation:
  Monthly Salary  = employee's active gross_salary
  Per Day Salary  = Monthly Salary ÷ total calendar days in month
  Gross Earnings  = Present Days × Per Day Salary
  Net Salary      = Gross Earnings − Professional Tax (₹200)
"""

from fastapi import APIRouter
import logging
import mysql.connector
import calendar
from datetime import datetime
from config import DB_CONFIG
import payroll_engine

log = logging.getLogger(__name__)
router = APIRouter()

_PT = payroll_engine.PROFESSIONAL_TAX  # 200.0 — sourced from payroll_engine


def _db():
    return mysql.connector.connect(**DB_CONFIG)


def _sf(v) -> float:
    if v is None:
        return 0.0
    try:
        return float(str(v).replace(',', ''))
    except (ValueError, TypeError):
        return 0.0


def _company_name() -> str:
    try:
        conn = _db()
        cur  = conn.cursor(dictionary=True)
        cur.execute("SELECT company_name FROM accountant_settings WHERE id = 1")
        row = cur.fetchone()
        cur.close(); conn.close()
        return (row["company_name"] or "Company") if row else "Company"
    except Exception:
        return "Company"


# ── HTML template ──────────────────────────────────────────────────────────

def _build_html(d: dict) -> str:
    # Pre-compute conditional deduction rows (avoids nested quotes in f-strings)
    unpaid_leave_ded  = d.get('unpaid_leave_deduction', 0) or 0
    late_ded          = d.get('late_arrival_deduction', 0) or 0
    grace_count       = d.get('grace_late_count', 0) or 0
    deductions_applied = d.get('late_deductions_applied', 0) or 0
    unpaid_days       = d.get('unpaid_leave_days', 0) or 0
    total_deductions  = round(d['professional_tax'] + unpaid_leave_ded + late_ded, 2)

    def _day_s(n): return 's' if n != 1.0 else ''

    leave_row = (
        '<div class="row">'
        '<span class="lbl">Unpaid Leave ('
        + f'{unpaid_days:.2f} day{_day_s(unpaid_days)})'
        + '</span><span class="val red">&#8377;'
        + f'{unpaid_leave_ded:,.2f}</span></div>'
    ) if unpaid_leave_ded > 0 else ''

    occ_s    = 's' if grace_count != 1 else ''
    late_row = (
        '<div class="row">'
        '<span class="lbl">Late Arrival ('
        + f'{grace_count} occurrence{occ_s}'
        + f' — {deductions_applied} × ½ day)'
        + '</span><span class="val red">&#8377;'
        + f'{late_ded:,.2f}</span></div>'
    ) if late_ded > 0 else ''

    return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Pay Slip — {d['payroll_month']}</title>
<style>
*{{box-sizing:border-box;margin:0;padding:0}}
body{{font-family:Arial,sans-serif;color:#1e293b;background:#fff;padding:32px}}
.wrap{{max-width:760px;margin:0 auto}}
.hdr{{text-align:center;border-bottom:3px solid #1e3a8a;padding-bottom:16px;margin-bottom:24px}}
.co{{font-size:22px;font-weight:700;color:#1e3a8a}}
.doc-title{{font-size:16px;font-weight:600;color:#475569;margin-top:6px}}
.period{{font-size:12px;color:#94a3b8;margin-top:3px}}
.info{{display:grid;grid-template-columns:1fr 1fr;gap:8px 28px;background:#f8fafc;padding:16px;border-radius:8px;margin-bottom:20px}}
.kv{{display:flex;flex-direction:column}}
.k{{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#64748b}}
.v{{font-size:13px;font-weight:600;color:#1e293b;margin-top:2px}}
.sec{{margin-bottom:18px}}
.sec-hd{{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;padding-bottom:6px;border-bottom:1px solid #e2e8f0;margin-bottom:8px}}
.row{{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:13px}}
.row:last-child{{border-bottom:none}}
.lbl{{color:#64748b}}
.val{{font-weight:600;color:#1e293b}}
.val.red{{color:#ef4444}}
.tot{{font-size:13px;font-weight:700;color:#1e293b}}
.net{{background:#1e3a8a;color:#fff;padding:14px 20px;border-radius:8px;display:flex;justify-content:space-between;align-items:center;margin-top:20px}}
.net-lbl{{font-size:14px;font-weight:600}}
.net-val{{font-size:22px;font-weight:700}}
.foot{{text-align:center;margin-top:28px;font-size:11px;color:#94a3b8;padding-top:14px;border-top:1px solid #e2e8f0}}
.print-btn{{position:fixed;top:16px;right:16px;background:#3b82f6;color:#fff;border:none;padding:9px 18px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;z-index:99}}
@media print{{.print-btn{{display:none}}}}
</style>
</head>
<body>
<button class="print-btn" onclick="window.print()">&#128424; Print / Save PDF</button>
<div class="wrap">
<div class="hdr">
  <div class="co">{d['company_name']}</div>
  <div class="doc-title">Pay Slip</div>
  <div class="period">{d['payroll_month']}</div>
</div>
<div class="info">
  <div class="kv"><span class="k">Employee Name</span><span class="v">{d['employee_name']}</span></div>
  <div class="kv"><span class="k">Employee ID</span><span class="v">{d['employee_id']}</span></div>
  <div class="kv"><span class="k">Department</span><span class="v">{d['department']}</span></div>
  <div class="kv"><span class="k">Job Title</span><span class="v">{d['job_title']}</span></div>
</div>
<div class="sec">
  <div class="sec-hd">Earnings</div>
  <div class="row"><span class="lbl">Monthly Salary (Gross)</span><span class="val">&#8377;{d['monthly_salary']:,.2f}</span></div>
</div>
<div class="sec">
  <div class="sec-hd">Deductions</div>
  <div class="row"><span class="lbl">Professional Tax (PT)</span><span class="val red">&#8377;{d['professional_tax']:,.2f}</span></div>
  {leave_row}
  {late_row}
  <div class="row"><span class="lbl tot">Total Deductions</span><span class="val red tot">&#8377;{total_deductions:,.2f}</span></div>
</div>
<div class="net">
  <span class="net-lbl">Net Salary</span>
  <span class="net-val">&#8377;{d['net_salary']:,.2f}</span>
</div>
<div class="foot">This is a computer-generated document. No signature required.</div>
</div>
</body>
</html>"""


# ── Core computation ───────────────────────────────────────────────────────

def _compute(employee_id: str, month: int, year: int) -> dict | None:
    try:
        conn = _db()
        cur  = conn.cursor(dictionary=True)

        cur.execute("""
            SELECT full_name,
                   COALESCE(department, 'N/A') AS department,
                   COALESCE(title,      'N/A') AS title
            FROM employees
            WHERE employee_code = %s
        """, (employee_id,))
        emp = cur.fetchone()
        if not emp:
            cur.close(); conn.close()
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

        month_start = f"{year:04d}-{month:02d}-01"
        # Use the stored unpaid_days column (set at HR approval time) — accurate for partial
        # unpaid days (e.g. 2.5).  The old date-overlap + is_unpaid=1 approach counted all
        # days of a leave request as unpaid rather than just the unpaid portion.
        cur.execute("""
            SELECT COALESCE(SUM(COALESCE(lr.unpaid_days, 0)), 0) AS unpaid_days
            FROM leave_requests lr
            WHERE lr.employee_id = %s
              AND lr.status = 'Approved'
              AND lr.start_date >= %s
              AND lr.start_date <  DATE_ADD(%s, INTERVAL 1 MONTH)
        """, (employee_id, month_start, month_start))
        unpaid_leave_days = float((cur.fetchone() or {}).get('unpaid_days', 0) or 0)

        # Late-arrival deduction (beyond-grace occurrences)
        cur2 = conn.cursor(dictionary=True)
        late_info = payroll_engine.get_late_arrival_summary(
            employee_id, month, year, monthly_salary, cur2
        )
        cur2.close()

        # Paid leave days = total approved days - unpaid days (same connection, before close)
        cur.execute("""
            SELECT COALESCE(SUM(GREATEST(COALESCE(lr.days_count,0) - COALESCE(lr.unpaid_days,0), 0)), 0)
                   AS paid_leave_used
            FROM leave_requests lr
            WHERE lr.employee_id = %s
              AND lr.status = 'Approved'
              AND lr.start_date >= %s
              AND lr.start_date <  DATE_ADD(%s, INTERVAL 1 MONTH)
        """, (employee_id, month_start, month_start))
        paid_leave_used = float((cur.fetchone() or {}).get('paid_leave_used', 0) or 0)

        cur.close(); conn.close()

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
            "payslip _compute: emp=%s %02d/%d gross=%.2f days=%d/%d present=%d "
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
            "company_name":           _company_name(),
        }
        d["html"] = _build_html(d)
        return d
    except Exception as exc:
        log.exception("payslip _compute failed for emp=%s %02d/%d: %s", employee_id, month, year, exc)
        return None


# ── GET /api/payslip/slip-url ─────────────────────────────────────────────

@router.get("/api/payslip/slip-url")
def payslip_slip_url(employee_id: str = "", month: int = 0, year: int = 0):
    """
    Look up whether a salary slip PDF has already been generated for an employee+month
    via the Accountant module.  Returns the download URL if found, so the caller can
    open the official Seawind PDF instead of a generic HTML template.

    Response:
        { found: bool, file_url: str | null, payroll_month: str }
    """
    if not employee_id:
        return {"found": False, "file_url": None, "payroll_month": None}
    now = datetime.now()
    if not month: month = now.month
    if not year:  year  = now.year

    month_str     = f"{year:04d}-{month:02d}"
    payroll_month = datetime(year, month, 1).strftime('%B %Y')

    log.info("payslip_slip_url: lookup emp=%s month=%s", employee_id, month_str)

    try:
        conn = _db()
        cur  = conn.cursor(dictionary=True)
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
        rec = cur.fetchone()
        cur.close(); conn.close()

        if rec and rec.get("file_url"):
            log.info(
                "payslip_slip_url: found %s for emp=%s month=%s (generated_at=%s)",
                rec["file_url"], employee_id, month_str, rec.get("updated_at"),
            )
            return {"found": True, "file_url": rec["file_url"], "payroll_month": payroll_month}

        log.info("payslip_slip_url: no generated slip for emp=%s month=%s", employee_id, month_str)
        return {"found": False, "file_url": None, "payroll_month": payroll_month}

    except Exception as exc:
        log.exception("payslip_slip_url error emp=%s month=%s: %s", employee_id, month_str, exc)
        return {"found": False, "file_url": None, "payroll_month": payroll_month}


# ── GET /api/payslip/generate ──────────────────────────────────────────────

@router.get("/api/payslip/generate")
def payslip_generate(employee_id: str = "", month: int = 0, year: int = 0):
    if not employee_id:
        return {"success": False, "message": "employee_id is required"}
    now = datetime.now()
    if not month: month = now.month
    if not year:  year  = now.year

    d = _compute(employee_id, month, year)
    if d is None:
        return {"success": False, "message": "Employee not found or no salary record"}
    return {"success": True, **d}


# ── GET /api/payslip/all ───────────────────────────────────────────────────

@router.get("/api/payslip/all")
def payslip_all(month: int = 0, year: int = 0):
    """Payslip summary for every active employee (no HTML to keep payload small)."""
    now = datetime.now()
    if not month: month = now.month
    if not year:  year  = now.year

    try:
        conn = _db()
        cur  = conn.cursor(dictionary=True)
        cur.execute("SELECT employee_code AS eid FROM employees WHERE status='active' ORDER BY full_name")
        ids = [r['eid'] for r in cur.fetchall()]
        cur.close(); conn.close()
    except Exception:
        return []

    result = []
    for eid in ids:
        d = _compute(eid, month, year)
        if d:
            result.append({k: v for k, v in d.items() if k != 'html' and k != 'company_name'})
    return result
