"""
Salary business logic.

Orchestrates the model layer and owns all rules: serialization,
CTC -> component breakdown auto-calculation, gross/net computation and
validation. Returns plain JSON-able structures; knows nothing about HTTP.
"""

from datetime import date
from ..models import salary_model


def _safe_float(v) -> float:
    if v is None:
        return 0.0
    try:
        return float(str(v).replace(',', ''))
    except (ValueError, TypeError):
        return 0.0


def list_salaries() -> list:
    """All active employees with a `has_salary` flag and their salary figures."""
    rows = salary_model.fetch_all_with_latest_salary()
    result = []
    for r in rows:
        eff = r["effective_from"]
        result.append({
            "employee_id":         r["employee_id"],
            "name":                r["name"],
            "department":          r["department"] or "N/A",
            "has_salary":          r["salary_id"] is not None,
            "joined_on":           r["joined_on"].isoformat() if r.get("joined_on") else None,
            "work_mode":           r.get("work_mode"),
            "designation":         r.get("designation") or "",
            "ctc":                 _safe_float(r["ctc"]),
            "basic_salary":        _safe_float(r["basic_salary"]),
            "hra":                 _safe_float(r["hra"]),
            "da":                  _safe_float(r["da"]),
            "transport_allowance": _safe_float(r["transport_allowance"]),
            "medical_allowance":   _safe_float(r["medical_allowance"]),
            "special_allowance":   _safe_float(r["special_allowance"]),
            "gross_salary":        _safe_float(r["gross_salary"]),
            "pf_deduction":        _safe_float(r["pf_deduction"]),
            "esi_deduction":       _safe_float(r["esi_deduction"]),
            "professional_tax":    _safe_float(r["professional_tax"]),
            "income_tax":          _safe_float(r["income_tax"]),
            "total_deductions":    _safe_float(r["total_deductions"]),
            "net_salary":          _safe_float(r["net_salary"]),
            "effective_from":      eff.strftime("%Y-%m-%d") if hasattr(eff, "strftime") else (str(eff) if eff else ""),
        })
    return result


def get_employee_salary(employee_id: str):
    """Latest active salary for one employee, or None."""
    row = salary_model.fetch_latest_active(employee_id)
    if not row:
        return None
    eff = row.get("effective_from")
    return {
        "employee_id":         row["employee_id"],
        "ctc":                 _safe_float(row["ctc"]),
        "basic_salary":        _safe_float(row["basic_salary"]),
        "hra":                 _safe_float(row.get("hra") or 0),
        "da":                  _safe_float(row.get("da") or 0),
        "transport_allowance": _safe_float(row.get("transport_allowance") or 0),
        "medical_allowance":   _safe_float(row.get("medical_allowance") or 0),
        "special_allowance":   _safe_float(row.get("special_allowance") or 0),
        "gross_salary":        _safe_float(row["gross_salary"]),
        "pf_deduction":        _safe_float(row.get("pf_deduction") or 0),
        "esi_deduction":       _safe_float(row.get("esi_deduction") or 0),
        "professional_tax":    _safe_float(row.get("professional_tax") or 0),
        "income_tax":          _safe_float(row.get("income_tax") or 0),
        "total_deductions":    _safe_float(row["total_deductions"]),
        "net_salary":          _safe_float(row["net_salary"]),
        "effective_from":      eff.strftime("%Y-%m-%d") if hasattr(eff, "strftime") else (str(eff) if eff else ""),
    }


def set_salary(data: dict) -> dict:
    """
    Create/update an employee's active salary.

    Accepts a partial payload; when only `ctc` is given the full component
    breakdown is auto-calculated. Computes gross/net, validates, then persists.
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
        salary_model.upsert_active_salary(emp_id, {
            "ctc": ctc, "basic_salary": basic_salary, "hra": hra, "da": da,
            "transport": transport, "medical": medical, "special": special,
            "gross": gross, "pf_deduction": pf_deduction, "esi_deduction": esi_deduction,
            "professional_tax": professional_tax, "income_tax": income_tax,
            "total_deductions": total_deductions, "net_salary": net_salary,
        }, effective_from)
        designation = (data.get("designation") or "").strip()
        if designation:
            salary_model.update_designation(emp_id, designation[:100])
        return {"success": True}
    except Exception as ex:
        return {"success": False, "message": str(ex)}
