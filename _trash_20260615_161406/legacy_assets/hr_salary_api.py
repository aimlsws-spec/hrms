"""
HR Salary Management API — /api/hr/salary/* endpoints
"""

from fastapi import APIRouter
from datetime import date
import mysql.connector
from config import DB_CONFIG

router = APIRouter()


def _db():
    return mysql.connector.connect(**DB_CONFIG)


def _safe_float(v) -> float:
    if v is None:
        return 0.0
    try:
        return float(str(v).replace(',', ''))
    except (ValueError, TypeError):
        return 0.0


# ── GET /api/hr/salary ─────────────────────────────────────────────────────

@router.get("/api/hr/salary")
def hr_get_all_salaries():
    """Return all active employees with their latest active salary (if any)."""
    try:
        conn = _db()
        cur  = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT
                e.employee_code                              AS employee_id,
                e.full_name                                  AS name,
                COALESCE(e.department, 'N/A')               AS department,
                es.id                                        AS salary_id,
                es.ctc,
                COALESCE(es.basic_salary, 0)                 AS basic_salary,
                COALESCE(es.hra, 0)                          AS hra,
                COALESCE(es.da, 0)                           AS da,
                COALESCE(es.transport_allowance, 0)          AS transport_allowance,
                COALESCE(es.medical_allowance, 0)            AS medical_allowance,
                COALESCE(es.special_allowance, 0)            AS special_allowance,
                COALESCE(es.gross_salary, 0)                 AS gross_salary,
                COALESCE(es.pf_deduction, 0)                 AS pf_deduction,
                COALESCE(es.esi_deduction, 0)                AS esi_deduction,
                COALESCE(es.professional_tax, 0)             AS professional_tax,
                COALESCE(es.income_tax, 0)                   AS income_tax,
                COALESCE(es.total_deductions, 0)             AS total_deductions,
                COALESCE(es.net_salary, 0)                   AS net_salary,
                es.effective_from
            FROM employees e
            LEFT JOIN employee_salaries es
                   ON es.employee_id = e.employee_code
                  AND es.id = (
                      SELECT MAX(id)
                      FROM employee_salaries
                      WHERE employee_id = e.employee_code AND status = 'active'
                  )
            WHERE e.status = 'active'
            ORDER BY e.full_name
        """)
        rows = cur.fetchall()
        cur.close()
        conn.close()

        result = []
        for r in rows:
            eff = r["effective_from"]
            result.append({
                "employee_id":        r["employee_id"],
                "name":               r["name"],
                "department":         r["department"] or "N/A",
                "has_salary":         r["salary_id"] is not None,
                "ctc":                _safe_float(r["ctc"]),
                "basic_salary":       _safe_float(r["basic_salary"]),
                "hra":                _safe_float(r["hra"]),
                "da":                 _safe_float(r["da"]),
                "transport_allowance": _safe_float(r["transport_allowance"]),
                "medical_allowance":  _safe_float(r["medical_allowance"]),
                "special_allowance":  _safe_float(r["special_allowance"]),
                "gross_salary":       _safe_float(r["gross_salary"]),
                "pf_deduction":       _safe_float(r["pf_deduction"]),
                "esi_deduction":      _safe_float(r["esi_deduction"]),
                "professional_tax":   _safe_float(r["professional_tax"]),
                "income_tax":         _safe_float(r["income_tax"]),
                "total_deductions":   _safe_float(r["total_deductions"]),
                "net_salary":         _safe_float(r["net_salary"]),
                "effective_from":     eff.strftime("%Y-%m-%d") if hasattr(eff, "strftime") else (str(eff) if eff else ""),
            })
        return result
    except Exception as ex:
        return []


# ── GET /api/hr/salary/{employee_id} ──────────────────────────────────────

@router.get("/api/hr/salary/{employee_id}")
def hr_get_employee_salary(employee_id: str):
    """Return the latest active salary record for a single employee."""
    try:
        conn = _db()
        cur  = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT es.*
            FROM employee_salaries es
            JOIN (
                SELECT employee_id, MAX(id) AS max_id
                FROM employee_salaries
                WHERE status = 'active'
                GROUP BY employee_id
            ) _lat ON es.id = _lat.max_id
            WHERE es.employee_id = %s
        """, (employee_id,))
        row = cur.fetchone()
        cur.close()
        conn.close()

        if not row:
            return None

        eff = row.get("effective_from")
        return {
            "employee_id":        row["employee_id"],
            "ctc":                _safe_float(row["ctc"]),
            "basic_salary":       _safe_float(row["basic_salary"]),
            "hra":                _safe_float(row.get("hra") or 0),
            "da":                 _safe_float(row.get("da") or 0),
            "transport_allowance": _safe_float(row.get("transport_allowance") or 0),
            "medical_allowance":  _safe_float(row.get("medical_allowance") or 0),
            "special_allowance":  _safe_float(row.get("special_allowance") or 0),
            "gross_salary":       _safe_float(row["gross_salary"]),
            "pf_deduction":       _safe_float(row.get("pf_deduction") or 0),
            "esi_deduction":      _safe_float(row.get("esi_deduction") or 0),
            "professional_tax":   _safe_float(row.get("professional_tax") or 0),
            "income_tax":         _safe_float(row.get("income_tax") or 0),
            "total_deductions":   _safe_float(row["total_deductions"]),
            "net_salary":         _safe_float(row["net_salary"]),
            "effective_from":     eff.strftime("%Y-%m-%d") if hasattr(eff, "strftime") else (str(eff) if eff else ""),
        }
    except Exception:
        return None


# ── POST /api/hr/salary ─────────────────────────────────────────────────────

@router.post("/api/hr/salary")
async def hr_set_salary(data: dict):
    """Create or update the active salary record for an employee.

    Marks any existing 'active' record as 'revised', then inserts (or updates
    on same effective_from date) the new active record.
    """
    emp_id = (data.get("employee_id") or "").strip()
    if not emp_id:
        return {"success": False, "message": "employee_id is required"}

    try:
        ctc              = float(data.get("ctc") or 0)
        basic_salary     = float(data.get("basic_salary") or 0)
        hra              = float(data.get("hra") or 0)
        da               = float(data.get("da") or 0)
        transport        = float(data.get("transport_allowance") or 0)
        medical          = float(data.get("medical_allowance") or 0)
        special          = float(data.get("special_allowance") or 0)
        pf_deduction     = float(data.get("pf_deduction") or 0)
        esi_deduction    = float(data.get("esi_deduction") or 0)
        professional_tax = float(data.get("professional_tax") or 0)
        income_tax       = float(data.get("income_tax") or 0)
    except (ValueError, TypeError) as ex:
        return {"success": False, "message": f"Invalid numeric value: {ex}"}

    # Auto-calculate component breakdown from CTC when not provided
    if basic_salary == 0 and ctc > 0:
        monthly          = round(ctc / 12, 2)
        basic_salary     = round(monthly * 0.40, 2)
        hra              = round(basic_salary * 0.50, 2)
        transport        = 1600.0
        medical          = 1250.0
        special          = round(monthly - basic_salary - hra - transport - medical, 2)
        da               = 0.0
        pf_deduction     = round(basic_salary * 0.12, 2)
        esi_deduction    = round(monthly * 0.0075, 2) if monthly <= 21000 else 0.0
        professional_tax = 200.0
        income_tax       = 0.0

    gross            = round(basic_salary + hra + da + transport + medical + special, 2)
    total_deductions = round(pf_deduction + esi_deduction + professional_tax + income_tax, 2)
    net_salary       = round(gross - total_deductions, 2)

    if gross <= 0:
        return {"success": False, "message": "Gross salary must be greater than zero"}
    if net_salary < 0:
        return {"success": False, "message": "Net salary cannot be negative — check deductions"}

    effective_from = (data.get("effective_from") or "").strip()
    if not effective_from:
        effective_from = date.today().replace(day=1).strftime("%Y-%m-%d")

    try:
        conn = _db()
        cur  = conn.cursor()

        # Try updating an existing record with the exact same effective_from date
        cur.execute("""
            UPDATE employee_salaries
            SET ctc = %s, basic_salary = %s, hra = %s, da = %s,
                transport_allowance = %s, medical_allowance = %s, special_allowance = %s,
                gross_salary = %s, pf_deduction = %s, esi_deduction = %s,
                professional_tax = %s, income_tax = %s, total_deductions = %s,
                net_salary = %s, status = 'active'
            WHERE employee_id = %s AND effective_from = %s
        """, (ctc, basic_salary, hra, da, transport, medical, special,
              gross, pf_deduction, esi_deduction, professional_tax, income_tax,
              total_deductions, net_salary, emp_id, effective_from))

        if cur.rowcount > 0:
            # Record updated — revise any OTHER active records for this employee
            cur.execute("""
                UPDATE employee_salaries
                SET status = 'revised'
                WHERE employee_id = %s AND status = 'active' AND effective_from != %s
            """, (emp_id, effective_from))
        else:
            # No existing record for this date — revise current active, then insert
            cur.execute("""
                UPDATE employee_salaries
                SET status = 'revised'
                WHERE employee_id = %s AND status = 'active'
            """, (emp_id,))
            cur.execute("""
                INSERT INTO employee_salaries
                    (employee_id, ctc, basic_salary, hra, da, transport_allowance,
                     medical_allowance, special_allowance, gross_salary, pf_deduction,
                     esi_deduction, professional_tax, income_tax, total_deductions,
                     net_salary, effective_from, status)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'active')
            """, (emp_id, ctc, basic_salary, hra, da, transport, medical, special,
                  gross, pf_deduction, esi_deduction, professional_tax, income_tax,
                  total_deductions, net_salary, effective_from))

        conn.commit()
        cur.close()
        conn.close()
        return {"success": True}
    except Exception as ex:
        return {"success": False, "message": str(ex)}
