"""
Accountant Panel API — /api/accountant/* endpoints
"""

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse, HTMLResponse
from datetime import datetime, date
import mysql.connector
import json
import os
import io
import csv
import logging

from backend.config import DB_CONFIG
from backend.core import payroll_engine

router = APIRouter()
logger = logging.getLogger(__name__)
SETTINGS_FILE = "data/system_settings.json"

# Default CTC used when an employee has no salary record yet
_DEFAULT_CTC = 500_000.0  # ₹5 LPA

_VALID_CURRENCIES = {"INR", "USD", "EUR", "GBP", "AED"}


def _ensure_settings_table():
    """Create accountant_settings table and seed one row from JSON file if needed."""
    try:
        conn = _db()
        cur  = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS accountant_settings (
                id                       INT          PRIMARY KEY DEFAULT 1,
                company_name             VARCHAR(200) NOT NULL DEFAULT 'Seawind Solutions',
                fiscal_year_start        VARCHAR(20)  NOT NULL DEFAULT 'april',
                currency                 VARCHAR(10)  NOT NULL DEFAULT 'INR',
                payroll_cycle            VARCHAR(20)  NOT NULL DEFAULT 'monthly',
                pay_day                  VARCHAR(10)  NOT NULL DEFAULT '25',
                notify_payroll_processed TINYINT(1)   NOT NULL DEFAULT 1,
                notify_expense_requests  TINYINT(1)   NOT NULL DEFAULT 1,
                created_at               TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
                updated_at               TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
                                                      ON UPDATE CURRENT_TIMESTAMP
            )
        """)
        conn.commit()

        # Seed row id=1 if it doesn't exist yet
        cur.execute("SELECT id FROM accountant_settings WHERE id = 1")
        if not cur.fetchone():
            # Try to pull values from legacy JSON file
            company_name   = "Seawind Solutions"
            fiscal_year    = "april"
            currency       = "INR"
            payroll_cycle  = "monthly"
            pay_day        = "25"
            notify_payroll = 1
            notify_expense = 1

            try:
                if os.path.exists(SETTINGS_FILE):
                    with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                        saved = json.load(f)
                    acc = saved.get("accountant", {})
                    company_name   = acc.get("companyName",     saved.get("company_name", company_name))
                    fiscal_year    = acc.get("fiscalYearStart",  fiscal_year)
                    currency       = acc.get("currency",         saved.get("currency", currency))
                    payroll_cycle  = acc.get("payrollCycle",     payroll_cycle)
                    pay_day        = str(acc.get("payDay",        pay_day))
                    notify_payroll = 1 if acc.get("notifyOnPayroll", True) else 0
                    notify_expense = 1 if acc.get("notifyOnExpense", True) else 0
            except Exception:
                pass

            cur.execute("""
                INSERT INTO accountant_settings
                    (id, company_name, fiscal_year_start, currency, payroll_cycle,
                     pay_day, notify_payroll_processed, notify_expense_requests)
                VALUES (1, %s, %s, %s, %s, %s, %s, %s)
            """, (company_name, fiscal_year, currency, payroll_cycle,
                  pay_day, notify_payroll, notify_expense))
            conn.commit()

        cur.close()
        conn.close()
    except Exception:
        pass


_ensure_settings_table()


def _ensure_monthly_payroll_columns():
    """Ensure monthly_payroll table has paid_leave_used and leave_deduction columns."""
    try:
        conn = _db()
        cur  = conn.cursor()
        
        # Add paid_leave_used column if it doesn't exist
        try:
            cur.execute("ALTER TABLE monthly_payroll ADD COLUMN paid_leave_used INT DEFAULT 0")
        except mysql.connector.Error:
            pass  # Column already exists
        
        # Add leave_deduction column if it doesn't exist
        try:
            cur.execute("ALTER TABLE monthly_payroll ADD COLUMN leave_deduction DECIMAL(10, 2) DEFAULT 0.00")
        except mysql.connector.Error:
            pass  # Column already exists
        
        conn.commit()
        cur.close()
        conn.close()
    except Exception:
        pass


_ensure_monthly_payroll_columns()


def _db():
    return mysql.connector.connect(**DB_CONFIG)


# ── helpers ──────────────────────────────────────────────────────────────


def _current_month() -> str:
    return datetime.now().strftime('%Y-%m')


def _parse_month(s: str) -> str:
    """'May 2025' → '2025-05'  (falls back to current month)"""
    for fmt in ('%B %Y', '%b %Y', '%Y-%m'):
        try:
            return datetime.strptime(s, fmt).strftime('%Y-%m')
        except ValueError:
            continue
    return _current_month()


def _fmt_month(ym: str) -> str:
    """'2025-05' → 'May 2025'"""
    try:
        return datetime.strptime(ym, '%Y-%m').strftime('%B %Y')
    except ValueError:
        return ym


def _safe_float(val) -> float:
    if val is None:
        return 0.0
    try:
        return float(str(val).replace(',', ''))
    except (ValueError, TypeError):
        return 0.0


# ── seed helpers ─────────────────────────────────────────────────────────


def _seed_salary_data(conn, cur):
    """Create an active employee_salaries record for any employee that has none."""
    cur.execute("""
        SELECT e.employee_code AS emp_code
        FROM employees e
        LEFT JOIN employee_salaries es ON es.employee_id = e.employee_code
        WHERE e.status = 'active' AND es.id IS NULL
    """)
    missing = [r['emp_code'] for r in cur.fetchall()]
    if not missing:
        return

    # First day of current month as effective date
    effective = date.today().replace(day=1).strftime('%Y-%m-%d')

    for emp_code in missing:
        monthly     = round(_DEFAULT_CTC / 12, 2)
        basic       = round(monthly * 0.40, 2)
        hra         = round(basic * 0.50, 2)
        transport   = 1_600.0
        medical     = 1_250.0
        special     = round(monthly - basic - hra - transport - medical, 2)
        gross       = monthly
        pf          = round(basic * 0.12, 2)
        # ESI applies only when gross ≤ ₹21,000
        esi         = round(gross * 0.0075, 2) if gross <= 21_000 else 0.0
        pt          = 200.0
        total_ded   = round(pf + esi + pt, 2)
        net         = round(gross - total_ded, 2)

        cur.execute("""
            INSERT IGNORE INTO employee_salaries
                (employee_id, ctc, basic_salary, hra, transport_allowance,
                 medical_allowance, special_allowance, gross_salary,
                 pf_deduction, esi_deduction, professional_tax,
                 total_deductions, net_salary, effective_from, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'active')
        """, (emp_code, _DEFAULT_CTC, basic, hra, transport, medical, special,
              gross, pf, esi, pt, total_ded, net, effective))

    conn.commit()


# ── GET /api/accountant/dashboard ──────────────────────────────────────────

@router.get("/api/accountant/dashboard")
def accountant_dashboard():
    try:
        now       = datetime.now()
        month_str = _current_month()

        # Seed salary records for any employee that has none yet
        conn = _db()
        cur  = conn.cursor(dictionary=True)
        _seed_salary_data(conn, cur)
        cur.close()
        conn.close()

        # Total payroll cost — canonical formula from payroll_engine
        # (same source as payslips, salary slips, and payroll page)
        emp_rows      = payroll_engine.compute_all(now.month, now.year)
        total_payroll = round(sum(r["net_salary"] for r in emp_rows), 2)
        active        = len(emp_rows)

        # Paid / pending counts from monthly_payroll.status
        conn = _db()
        cur  = conn.cursor(dictionary=True)
        cur.execute(
            "SELECT COUNT(*) AS cnt FROM monthly_payroll WHERE month_year = %s AND status = 'paid'",
            (month_str,)
        )
        paid    = int(cur.fetchone()['cnt'])
        pending = max(0, active - paid)

        try:
            cur.execute("SELECT COUNT(*) AS cnt FROM reimbursements WHERE status = 'pending'")
            reimb = int(cur.fetchone()['cnt'])
        except Exception:
            reimb = 0

        cur.close()
        conn.close()

        logger.info("accountant_dashboard: month=%s total=%.2f active=%d paid=%d pending=%d",
                    month_str, total_payroll, active, paid, pending)
        return {
            "totalPayroll":          total_payroll,
            "pendingSalaries":       pending,
            "paidSalaries":          paid,
            "pendingReimbursements": reimb,
        }
    except Exception:
        logger.exception("accountant_dashboard: failed")
        return {
            "totalPayroll": 0, "pendingSalaries": 0,
            "paidSalaries": 0, "pendingReimbursements": 0,
        }


# ── GET /api/accountant/payroll ────────────────────────────────────────────

@router.get("/api/accountant/payroll")
def accountant_payroll(month: str = Query(default=None)):
    try:
        now = datetime.now()
        if month:
            month_str = _parse_month(month)
            try:
                dt = datetime.strptime(month_str, '%Y-%m')
                pay_month, pay_year = dt.month, dt.year
            except ValueError:
                pay_month, pay_year = now.month, now.year
                month_str = _current_month()
        else:
            pay_month, pay_year = now.month, now.year
            month_str = _current_month()

        logger.info("accountant_payroll: computing for month=%s", month_str)

        # Seed missing salary records
        conn = _db()
        cur  = conn.cursor(dictionary=True)
        _seed_salary_data(conn, cur)
        cur.close()
        conn.close()

        # Canonical payroll from engine (identical to payslips)
        emp_rows = payroll_engine.compute_all(pay_month, pay_year)
        logger.info("accountant_payroll: engine returned %d employees for %s", len(emp_rows), month_str)

        # Paid/unpaid status from monthly_payroll
        conn = _db()
        cur  = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT employee_id, status, paid_at, created_at
            FROM monthly_payroll
            WHERE month_year = %s
        """, (month_str,))
        status_map = {r['employee_id']: r for r in cur.fetchall()}
        cur.close()
        conn.close()

        result = []
        for pr in emp_rows:
            sr      = status_map.get(pr['employee_id'], {})
            is_paid = sr.get('status') == 'paid'
            logger.info(
                "accountant_payroll row: emp=%s gross=%.2f paid_leave=%.2f "
                "unpaid_days=%.2f leave_ded=%.2f pt=%.2f net=%.2f",
                pr["employee_id"], pr["monthly_salary"],
                float(pr["paid_leave_used"]), float(pr["unpaid_days"]),
                pr["leave_deduction"], payroll_engine.PROFESSIONAL_TAX, pr["net_salary"],
            )
            result.append({
                "id":               pr["employee_id"],
                "name":             pr["employee_name"],
                "dept":             pr["department"],
                "monthly_salary":   pr["monthly_salary"],
                "paid_leave_used":  round(float(pr["paid_leave_used"]), 2),
                "unpaid_days":      round(float(pr["unpaid_days"]), 2),
                "pt_deduction":     payroll_engine.PROFESSIONAL_TAX,
                "leave_deduction":  pr["leave_deduction"],
                "net_payable":      pr["net_salary"],
                "salary":           pr["net_salary"],   # alias for dashboard frontend
                "status":           "Paid" if is_paid else "Pending",
                "transaction_date": sr.get('paid_at') or sr.get('created_at'),
                "month":            pr["payroll_month"],
            })

        # Paid entries first (by name), then pending alphabetically
        result.sort(key=lambda r: (0 if r["status"] == "Paid" else 1, r["name"]))
        logger.info("accountant_payroll: returning %d rows (paid=%d pending=%d)",
                    len(result),
                    sum(1 for r in result if r["status"] == "Paid"),
                    sum(1 for r in result if r["status"] == "Pending"))
        return result
    except Exception:
        logger.exception("accountant_payroll: failed")
        return []


# ── POST /api/accountant/payroll/pay ───────────────────────────────────────

@router.post("/api/accountant/payroll/pay")
def accountant_mark_paid(data: dict):
    try:
        employee_id = data.get("employeeId", "")
        month_raw   = data.get("month", "")
        month_year  = _parse_month(month_raw)

        if not employee_id:
            return {"success": False, "message": "employeeId is required"}

        logger.info("accountant_mark_paid: marking emp=%s month=%s as paid", employee_id, month_year)

        # Parse month/year integers for payroll_engine
        try:
            dt        = datetime.strptime(month_year, '%Y-%m')
            pay_month = dt.month
            pay_year  = dt.year
        except ValueError:
            now       = datetime.now()
            pay_month = now.month
            pay_year  = now.year

        # Use payroll_engine for authoritative values (includes leave deductions)
        pr = payroll_engine.compute(employee_id, pay_month, pay_year)

        conn = _db()
        cur  = conn.cursor(dictionary=True)

        if pr:
            # Salary breakdown from employee_salaries for storage detail
            cur.execute("""
                SELECT basic_salary, hra,
                       COALESCE(transport_allowance, 0)
                           + COALESCE(medical_allowance, 0)
                           + COALESCE(special_allowance, 0) AS allowances
                FROM employee_salaries
                WHERE employee_id = %s AND status = 'active'
                ORDER BY effective_from DESC, id DESC
                LIMIT 1
            """, (employee_id,))
            sal = cur.fetchone() or {}
            cur.execute("""
                INSERT INTO monthly_payroll
                    (employee_id, month_year, basic_salary, hra, allowances,
                     gross_salary, deductions, net_salary,
                     paid_leave_used, leave_deduction, status, paid_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'paid', NOW())
                ON DUPLICATE KEY UPDATE
                    status         = 'paid',
                    paid_at        = NOW(),
                    gross_salary   = VALUES(gross_salary),
                    deductions     = VALUES(deductions),
                    net_salary     = VALUES(net_salary),
                    paid_leave_used = VALUES(paid_leave_used),
                    leave_deduction = VALUES(leave_deduction)
            """, (
                employee_id, month_year,
                _safe_float(sal.get('basic_salary')),
                _safe_float(sal.get('hra')),
                _safe_float(sal.get('allowances')),
                pr["monthly_salary"],
                payroll_engine.PROFESSIONAL_TAX + pr["leave_deduction"],
                pr["net_salary"],
                int(pr["paid_leave_used"]),
                pr["leave_deduction"],
            ))
            logger.info("accountant_mark_paid: emp=%s month=%s gross=%.2f leave_ded=%.2f net=%.2f",
                        employee_id, month_year, pr["monthly_salary"],
                        pr["leave_deduction"], pr["net_salary"])
        else:
            # Fallback: no computed record (no active salary), just record status
            cur.execute("""
                INSERT INTO monthly_payroll (employee_id, month_year, status, paid_at)
                VALUES (%s, %s, 'paid', NOW())
                ON DUPLICATE KEY UPDATE status = 'paid', paid_at = NOW()
            """, (employee_id, month_year))
            logger.warning("accountant_mark_paid: no engine record for emp=%s month=%s — stored status only",
                           employee_id, month_year)

        conn.commit()
        cur.close()
        conn.close()
        return {"success": True}
    except Exception as e:
        logger.exception("accountant_mark_paid: failed for emp=%s", data.get("employeeId", "?"))
        return {"success": False, "message": str(e)}


# ── GET /api/accountant/employees ──────────────────────────────────────────

@router.get("/api/accountant/employees")
def accountant_employees():
    try:
        now       = datetime.now()
        month_str = _current_month()

        logger.info("accountant_employees: loading finance view for month=%s", month_str)

        # Seed missing salary records
        conn = _db()
        cur  = conn.cursor(dictionary=True)
        _seed_salary_data(conn, cur)
        cur.close()
        conn.close()

        # Current month payroll from engine — canonical, same source as payroll page
        current_rows = payroll_engine.compute_all(now.month, now.year)
        logger.info("accountant_employees: engine returned %d employees for %s",
                    len(current_rows), month_str)

        # Paid status for current month
        conn = _db()
        cur  = conn.cursor(dictionary=True)
        cur.execute(
            "SELECT employee_id, status, paid_at FROM monthly_payroll WHERE month_year = %s",
            (month_str,)
        )
        curr_status = {r['employee_id']: r for r in cur.fetchall()}

        result = []
        for pr in current_rows:
            eid     = pr['employee_id']
            sr      = curr_status.get(eid, {})
            is_paid = sr.get('status') == 'paid'

            # Payment history from monthly_payroll (newest first, up to 12 months)
            cur.execute("""
                SELECT month_year, gross_salary, leave_deduction, net_salary, status, paid_at
                FROM monthly_payroll
                WHERE employee_id = %s
                ORDER BY month_year DESC
                LIMIT 12
            """, (eid,))
            history = []
            for h in cur.fetchall():
                history.append({
                    "month":            _fmt_month(h['month_year']),
                    "month_raw":        h['month_year'],
                    "monthly_salary":   _safe_float(h['gross_salary']),
                    "professional_tax": payroll_engine.PROFESSIONAL_TAX,
                    "leave_deduction":  _safe_float(h.get('leave_deduction') or 0),
                    "net_payable":      _safe_float(h['net_salary']),
                    "amount":           _safe_float(h['net_salary']),   # legacy alias
                    "status":           "Paid" if h['status'] == 'paid' else "Pending",
                    "paid_at":          h['paid_at'].strftime('%d %b %Y') if h.get('paid_at') else None,
                })

            logger.info("accountant_employees: emp=%s month=%s gross=%.2f leave_ded=%.2f net=%.2f status=%s history=%d",
                        eid, month_str, pr['monthly_salary'], pr['leave_deduction'],
                        pr['net_salary'], "Paid" if is_paid else "Pending", len(history))

            result.append({
                "id":               eid,
                "name":             pr['employee_name'],
                "dept":             pr['department'],
                "title":            pr['job_title'],
                "monthly_salary":   pr['monthly_salary'],
                "professional_tax": payroll_engine.PROFESSIONAL_TAX,
                "leave_deduction":  pr['leave_deduction'],
                "unpaid_days":      pr['unpaid_days'],
                "paid_leave_used":  int(pr['paid_leave_used']),
                "net_payable":      pr['net_salary'],
                "salary":           pr['net_salary'],   # legacy alias
                "payroll_month":    pr['payroll_month'],
                "status":           "Paid" if is_paid else "Pending",
                "history":          history,
            })

        cur.close()
        conn.close()

        logger.info("accountant_employees: returning %d employees", len(result))
        return result
    except Exception:
        logger.exception("accountant_employees: failed")
        return []


# ── GET /api/accountant/reimbursements ─────────────────────────────────────

@router.get("/api/accountant/reimbursements")
def accountant_reimbursements():
    try:
        conn = _db()
        cur  = conn.cursor(dictionary=True)

        cur.execute("""
            SELECT
                r.id,
                COALESCE(e.full_name, r.employee_id)           AS employee,
                COALESCE(e.department, 'N/A')                   AS dept,
                r.amount,
                COALESCE(r.description, r.category, 'Expense') AS reason,
                DATE_FORMAT(COALESCE(r.expense_date, DATE(r.submitted_at)), '%d %b %Y') AS date,
                CASE
                    WHEN r.status = 'approved' THEN 'Approved'
                    WHEN r.status = 'rejected' THEN 'Rejected'
                    ELSE 'Pending'
                END                                             AS status
            FROM reimbursements r
            LEFT JOIN employees e ON e.employee_code = r.employee_id
            ORDER BY r.submitted_at DESC
        """)
        rows = cur.fetchall()
        cur.close()
        conn.close()

        return [
            {
                "id":       r["id"],
                "employee": r["employee"],
                "dept":     r["dept"] or "N/A",
                "amount":   _safe_float(r["amount"]),
                "reason":   r["reason"],
                "date":     r["date"] or "",
                "status":   r["status"],
            }
            for r in rows
        ]
    except Exception as e:
        return []


# ── POST /api/accountant/reimbursements/update-status ──────────────────────

@router.post("/api/accountant/reimbursements/update-status")
async def accountant_update_reimbursement(data: dict):
    try:
        rid    = int(data.get("id", 0))
        status = data.get("status", "").lower()

        if status not in ("approved", "rejected"):
            return {"success": False, "message": "Invalid status"}

        conn = _db()
        cur  = conn.cursor()
        cur.execute(
            "UPDATE reimbursements SET status = %s, reviewed_at = NOW() WHERE id = %s",
            (status, rid)
        )
        conn.commit()
        cur.close()
        conn.close()
        return {"success": True}
    except Exception as e:
        return {"success": False, "message": str(e)}


# ── GET /api/accountant/reports ────────────────────────────────────────────

@router.get("/api/accountant/reports")
def accountant_reports():
    try:
        # Delegate to the canonical dedicated endpoints so the data is always identical
        monthly   = report_monthly_payroll()
        dept_data = report_department_cost()
        return {"monthly": monthly, "deptCosts": dept_data}
    except Exception:
        logger.exception("accountant_reports: failed")
        return {"monthly": [], "deptCosts": []}


# ── helpers ───────────────────────────────────────────────────────────────────

def _settings_defaults() -> dict:
    return {
        "companyName":     "Seawind Solutions",
        "payrollCycle":    "monthly",
        "currency":        "INR",
        "payDay":          "25",
        "fiscalYearStart": "april",
        "notifyOnPayroll": True,
        "notifyOnExpense": True,
    }


def _row_to_settings(row: dict) -> dict:
    return {
        "companyName":     row["company_name"],
        "payrollCycle":    row["payroll_cycle"],
        "currency":        row["currency"],
        "payDay":          row["pay_day"],
        "fiscalYearStart": row["fiscal_year_start"],
        "notifyOnPayroll": bool(row["notify_payroll_processed"]),
        "notifyOnExpense": bool(row["notify_expense_requests"]),
    }


def _validate_settings(data: dict) -> str | None:
    company = (data.get("companyName") or "").strip()
    if not company:
        return "Company name is required"

    currency = (data.get("currency") or "").strip()
    if currency not in _VALID_CURRENCIES:
        return "Please select a valid currency"

    cycle   = data.get("payrollCycle", "monthly")
    pay_day = str(data.get("payDay", "")).strip()

    if cycle == "monthly":
        if pay_day != "last":
            try:
                d = int(pay_day)
                if not (1 <= d <= 28):
                    raise ValueError
            except ValueError:
                return "Pay day must be 1–28 or Last day of month for monthly payroll"
    elif cycle == "biweekly":
        if pay_day != "last":
            try:
                d = int(pay_day)
                if not (1 <= d <= 14):
                    raise ValueError
            except ValueError:
                return "Pay day must be 1–14 or Last day for bi-weekly payroll"

    return None


def _get_company_name() -> str:
    """Read company name from DB settings (used by report generation)."""
    try:
        conn = _db()
        cur  = conn.cursor(dictionary=True)
        cur.execute("SELECT company_name FROM accountant_settings WHERE id = 1")
        row = cur.fetchone()
        cur.close()
        conn.close()
        return (row["company_name"] or "Seawind Solutions") if row else "Seawind Solutions"
    except Exception:
        return "Seawind Solutions"


# ── GET /api/accountant/settings ───────────────────────────────────────────

@router.get("/api/accountant/settings")
def accountant_get_settings():
    try:
        conn = _db()
        cur  = conn.cursor(dictionary=True)
        cur.execute("SELECT * FROM accountant_settings WHERE id = 1")
        row = cur.fetchone()
        cur.close()
        conn.close()
        return _row_to_settings(row) if row else _settings_defaults()
    except Exception:
        return _settings_defaults()


# ── POST & PUT /api/accountant/settings ────────────────────────────────────

async def _save_settings(data: dict) -> dict:
    err = _validate_settings(data)
    if err:
        return {"success": False, "message": err}
    try:
        conn = _db()
        cur  = conn.cursor()
        params = (
            data.get("companyName",     "").strip(),
            data.get("fiscalYearStart", "april"),
            data.get("currency",        "INR"),
            data.get("payrollCycle",    "monthly"),
            str(data.get("payDay",      "25")),
            1 if data.get("notifyOnPayroll", True) else 0,
            1 if data.get("notifyOnExpense", True) else 0,
        )
        cur.execute("""
            UPDATE accountant_settings
            SET company_name             = %s,
                fiscal_year_start        = %s,
                currency                 = %s,
                payroll_cycle            = %s,
                pay_day                  = %s,
                notify_payroll_processed = %s,
                notify_expense_requests  = %s
            WHERE id = 1
        """, params)
        conn.commit()
        cur.close()
        conn.close()
        return {"success": True}
    except Exception as ex:
        return {"success": False, "message": str(ex)}


@router.post("/api/accountant/settings")
async def accountant_save_settings_post(data: dict):
    return await _save_settings(data)


@router.put("/api/accountant/settings")
async def accountant_save_settings_put(data: dict):
    return await _save_settings(data)


# ── Dedicated report-data endpoints ──────────────────────────────────────────

@router.get("/api/accountant/reports/monthly-payroll")
def report_monthly_payroll():
    try:
        now        = datetime.now()
        current_ym = _current_month()

        logger.info("report_monthly_payroll: computing for current month=%s", current_ym)

        # Seed missing salary records so all active employees are included
        conn = _db()
        cur  = conn.cursor(dictionary=True)
        _seed_salary_data(conn, cur)
        cur.close()
        conn.close()

        # Current month — canonical calculation from payroll_engine (matches payroll page)
        current_rows  = payroll_engine.compute_all(now.month, now.year)
        current_total = round(sum(r["net_salary"] for r in current_rows), 2)
        current_count = len(current_rows)
        result = [{
            "month":     _fmt_month(current_ym),
            "month_raw": current_ym,
            "total":     current_total,
            "employees": current_count,
            "avg":       round(current_total / max(1, current_count), 2),
        }]
        logger.info("report_monthly_payroll: current month total=%.2f employees=%d",
                    current_total, current_count)

        # Previous months — use monthly_payroll records (historical paid records)
        conn = _db()
        cur  = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT month_year,
                   COUNT(DISTINCT employee_id) AS employees,
                   SUM(net_salary)             AS total
            FROM monthly_payroll
            WHERE month_year != %s
            GROUP BY month_year
            ORDER BY month_year DESC
            LIMIT 4
        """, (current_ym,))
        for r in cur.fetchall():
            total = _safe_float(r["total"])
            emps  = int(r["employees"])
            result.append({
                "month":     _fmt_month(r["month_year"]),
                "month_raw": r["month_year"],
                "total":     total,
                "employees": emps,
                "avg":       round(total / max(1, emps), 2),
            })
        cur.close()
        conn.close()

        logger.info("report_monthly_payroll: returning %d month rows", len(result))
        return result
    except Exception:
        logger.exception("report_monthly_payroll: failed")
        return []


@router.get("/api/accountant/reports/department-cost")
def report_department_cost():
    try:
        now        = datetime.now()
        month_str  = _current_month()
        logger.info("report_department_cost: computing for month=%s", month_str)

        rows = payroll_engine.compute_all(now.month, now.year)

        dept_map: dict[str, dict] = {}
        for r in rows:
            dept = (r["department"] or "").strip() or "Other"
            if dept not in dept_map:
                dept_map[dept] = {"headcount": 0, "total": 0.0}
            dept_map[dept]["headcount"] += 1
            dept_map[dept]["total"]     += r["net_salary"]

        grand = sum(v["total"] for v in dept_map.values()) or 1
        result = [
            {
                "dept":      dept,
                "headcount": v["headcount"],
                "total":     round(v["total"], 2),
                "pct":       round(v["total"] / grand * 100),
            }
            for dept, v in sorted(dept_map.items(), key=lambda x: -x[1]["total"])
        ]
        logger.info("report_department_cost: %d departments total=%.2f",
                    len(result), sum(v["total"] for v in dept_map.values()))
        return result
    except Exception:
        logger.exception("report_department_cost: failed")
        return []


@router.get("/api/accountant/reports/tax-summary")
def report_tax_summary():
    """
    Tax/Deduction summary — uses payroll_engine as the single source of truth so
    gross, deductions, and net exactly match the Payroll page and Payslips page.

    Columns:
      gross = monthly_salary          (from engine)
      tax   = PT (200) + leave_deduction  (total deductions per engine)
      net   = net_salary              (from engine; always gross − tax)
    """
    try:
        now       = datetime.now()
        month_str = _current_month()
        logger.info("report_tax_summary: computing for month=%s", month_str)

        rows = payroll_engine.compute_all(now.month, now.year)
        result = []
        for r in rows:
            gross    = r["monthly_salary"]
            pt       = payroll_engine.PROFESSIONAL_TAX
            leave_d  = r["leave_deduction"]
            total_d  = round(pt + leave_d, 2)
            net      = r["net_salary"]
            result.append({
                "name":  r["employee_name"],
                "dept":  r["department"] or "N/A",
                "gross": gross,
                "tax":   total_d,
                "net":   net,
            })

        logger.info("report_tax_summary: returning %d rows", len(result))
        return result
    except Exception:
        logger.exception("report_tax_summary: failed")
        return []


@router.get("/api/accountant/reports/overtime")
def report_overtime():
    try:
        now  = datetime.now()
        logger.info("report_overtime: computing overtime for last 30 days")

        conn = _db()
        cur  = conn.cursor(dictionary=True)
        # Overtime = hours worked beyond 8 h per day with valid check-in/out
        cur.execute("""
            SELECT
                a.employee_id,
                e.full_name                     AS name,
                COALESCE(e.department, 'N/A')   AS dept,
                SUM(
                    GREATEST(
                        (TIME_TO_SEC(a.check_out) - TIME_TO_SEC(a.check_in)) / 3600.0 - 8,
                        0
                    )
                ) AS ot_hours
            FROM attendance a
            JOIN employees e ON e.employee_code = a.employee_id
            WHERE a.date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
              AND a.check_in  IS NOT NULL
              AND a.check_out IS NOT NULL
              AND a.check_out > a.check_in
            GROUP BY a.employee_id, e.full_name, e.department
            HAVING ot_hours > 0
            ORDER BY ot_hours DESC
        """)
        rows = cur.fetchall()
        cur.close(); conn.close()

        result = []
        for r in rows:
            ot_hours = float(r["ot_hours"] or 0)
            # Use payroll_engine for net monthly (same as payslip/payroll page)
            pr = payroll_engine.compute(r["employee_id"], now.month, now.year)
            net_monthly = pr["net_salary"] if pr else 0.0
            hourly_rate = net_monthly / (22 * 8) if net_monthly else 0.0
            payout      = round(ot_hours * hourly_rate * 1.5, 2)
            result.append({
                "name":   r["name"],
                "dept":   r["dept"] or "N/A",
                "hours":  round(ot_hours, 2),
                "payout": payout,
            })

        logger.info("report_overtime: returning %d employees with overtime", len(result))
        return result
    except Exception:
        logger.exception("report_overtime: failed")
        return []


@router.get("/api/accountant/reports/reimbursements")
def report_reimbursements():
    try:
        logger.info("report_reimbursements: loading approved reimbursements")

        conn = _db()
        cur  = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT
                COALESCE(e.full_name, r.employee_id)                   AS employee,
                COALESCE(e.department, 'N/A')                          AS dept,
                r.amount,
                COALESCE(r.description, r.category, 'Expense')        AS reason,
                DATE_FORMAT(COALESCE(r.reviewed_at, r.submitted_at),
                            '%d %b %Y')                                AS approval_date
            FROM reimbursements r
            LEFT JOIN employees e ON e.employee_code = r.employee_id
            WHERE r.status = 'approved'
            ORDER BY COALESCE(r.reviewed_at, r.submitted_at) DESC
        """)
        rows = cur.fetchall()
        cur.close(); conn.close()

        result = [
            {
                "employee":      r["employee"],
                "dept":          r["dept"] or "N/A",
                "amount":        _safe_float(r["amount"]),
                "reason":        r["reason"] or "Expense",
                "approval_date": r["approval_date"] or "",
            }
            for r in rows
        ]
        logger.info("report_reimbursements: returning %d approved records", len(result))
        return result
    except Exception:
        logger.exception("report_reimbursements: failed")
        return []


# ── Report download helpers ───────────────────────────────────────────────────

_REPORT_META = {
    "monthly-payroll": {
        "label":   "Monthly Payroll Summary",
        "headers": ["Month", "Total Payroll (₹)", "Employees", "Avg Salary (₹)"],
        "fields":  ["month", "total", "employees", "avg"],
        "money":   {"total", "avg"},
    },
    "department-cost": {
        "label":   "Department Cost Summary",
        "headers": ["Department", "Headcount", "Total Cost (₹)", "% of Total"],
        "fields":  ["dept", "headcount", "total", "pct"],
        "money":   {"total"},
    },
    "tax-summary": {
        "label":   "Tax & Deductions Summary",
        "headers": ["Employee", "Department", "Monthly Salary (₹)", "Total Deductions (₹)", "Net Salary (₹)"],
        "fields":  ["name", "dept", "gross", "tax", "net"],
        "money":   {"gross", "tax", "net"},
    },
    "overtime": {
        "label":   "Overtime Report",
        "headers": ["Employee", "Department", "Overtime Hours", "Overtime Payout (₹)"],
        "fields":  ["name", "dept", "hours", "payout"],
        "money":   {"payout"},
    },
    "reimbursements": {
        "label":   "Reimbursements Report",
        "headers": ["Employee", "Department", "Amount (₹)", "Reason", "Approval Date"],
        "fields":  ["employee", "dept", "amount", "reason", "approval_date"],
        "money":   {"amount"},
    },
}

_REPORT_FNS = {
    "monthly-payroll": report_monthly_payroll,
    "department-cost": report_department_cost,
    "tax-summary":     report_tax_summary,
    "overtime":        report_overtime,
    "reimbursements":  report_reimbursements,
}


def _build_report_html(title: str, headers: list, fields: list,
                       money_fields: set, rows: list) -> str:
    today        = datetime.now().strftime("%d %b %Y, %H:%M")
    company_name = _get_company_name()
    th_html  = "".join(f"<th>{h}</th>" for h in headers)
    rows_html = ""
    for r in rows:
        tds = ""
        for f in fields:
            val = r.get(f, "")
            if f in money_fields and isinstance(val, (int, float)):
                val = f"₹{val:,.2f}"
            elif f == "pct":
                val = f"{val}%"
            tds += f"<td>{val}</td>"
        rows_html += f"<tr>{tds}</tr>"

    if not rows_html:
        cols = len(headers)
        rows_html = (
            f"<tr><td colspan='{cols}' style='text-align:center;"
            f"color:#9ca3af;padding:24px'>No data available</td></tr>"
        )

    return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>{title}</title>
<style>
  *{{box-sizing:border-box;margin:0;padding:0}}
  body{{font-family:Arial,sans-serif;color:#1e293b;background:#fff;padding:32px}}
  .hdr{{text-align:center;border-bottom:3px solid #1e3a8a;padding-bottom:16px;margin-bottom:20px}}
  .co{{font-size:22px;font-weight:700;color:#1e3a8a}}
  .doc-title{{font-size:16px;font-weight:600;color:#64748b;margin-top:6px}}
  .meta{{text-align:right;font-size:12px;color:#94a3b8;margin-bottom:16px}}
  table{{width:100%;border-collapse:collapse;font-size:13px}}
  th{{background:#1e3a8a;color:#fff;padding:9px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.05em}}
  td{{padding:9px 12px;border-bottom:1px solid #e2e8f0}}
  tr:nth-child(even) td{{background:#f8fafc}}
  .print-btn{{position:fixed;top:16px;right:16px;background:#3b82f6;color:#fff;
              border:none;padding:10px 20px;border-radius:8px;font-size:14px;
              font-weight:600;cursor:pointer}}
  @media print{{.print-btn{{display:none}}}}
</style>
</head>
<body>
<button class="print-btn" onclick="window.print()">&#128424; Print / Save PDF</button>
<div class="hdr">
  <div class="co">{company_name}</div>
  <div class="doc-title">{title}</div>
</div>
<div class="meta">Generated on: {today}</div>
<table>
  <thead><tr>{th_html}</tr></thead>
  <tbody>{rows_html}</tbody>
</table>
</body>
</html>"""


@router.get("/api/accountant/reports/{report_type}/download")
def download_report(report_type: str, format: str = "csv"):
    if report_type not in _REPORT_META:
        return {"error": "Unknown report type"}

    meta   = _REPORT_META[report_type]
    data   = _REPORT_FNS[report_type]()
    title  = meta["label"]
    hdrs   = meta["headers"]
    fields = meta["fields"]
    money  = meta["money"]

    if format == "pdf":
        html = _build_report_html(title, hdrs, fields, money, data)
        return HTMLResponse(content=html)

    # CSV
    buf = io.StringIO()
    w   = csv.writer(buf)
    w.writerow([title])
    w.writerow([f"Generated: {datetime.now().strftime('%d %b %Y %H:%M')}"])
    w.writerow([])
    w.writerow(hdrs)
    for row in data:
        w.writerow([row.get(f, "") for f in fields])
    buf.seek(0)
    filename = f"{report_type}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
