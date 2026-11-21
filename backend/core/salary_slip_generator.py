"""
Salary Slip Generator

Loads the official company template (Salary Slip New.docx), populates all
fields from HRMS data, converts to PDF via docx2pdf (MS Word), and saves
to generated_docs/.

Template location: templates/Salary Slip New.docx
"""

import logging
import os
import calendar
import shutil
from datetime import datetime

from docx import Document
from docx.shared import Pt

from backend.config import DB_CONFIG
import mysql.connector

# Payslip computation migrated to MVC — backend/services/payslip_service.py
from backend.services.payslip_service import compute as _compute

logger = logging.getLogger(__name__)

# This module lives in core/; templates/ and generated_docs/ are at the project
# root (one level up), so anchor paths there rather than next to this file.
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEMPLATE_PATH = os.path.join(_PROJECT_ROOT, "templates", "templates", "Salary Slip New.docx")
OUTPUT_DIR = os.path.join(_PROJECT_ROOT, "generated_docs")

_MONTHLY_ALLOC = 0.5   # leave days accrued per month per type
_YEARLY_ALLOC  = 6.0   # 0.5 × 12


# ── DB helpers ────────────────────────────────────────────────────────────────

def _db():
    return mysql.connector.connect(**DB_CONFIG)


# ── Leave data ────────────────────────────────────────────────────────────────

def _get_leave_data(employee_id: str, month: int, year: int) -> dict:
    """
    Returns per-type breakdown:
      {
        "Earned Leave":  {"monthly": 0.5, "used": X, "balance": Y, "unpaid": Z},
        "Sick Leave":    {...},
        "Casual Leave":  {...},
        "total_used":    N,
        "total_balance": M,
        "total_unpaid":  U,
      }
    """
    month_start = f"{year:04d}-{month:02d}-01"
    TYPES = ["Earned Leave", "Sick Leave", "Casual Leave"]

    earned_bal = sick_bal = casual_bal = 0.0
    used_by_type: dict = {}

    try:
        conn = _db()
        cur  = conn.cursor(dictionary=True)

        cur.execute(
            "INSERT IGNORE INTO leave_balance (employee_id) VALUES (%s)",
            (employee_id,)
        )
        cur.execute(
            "SELECT * FROM leave_balance WHERE employee_id = %s",
            (employee_id,)
        )
        bal_row = cur.fetchone() or {}
        earned_bal = float(bal_row.get("earned_leave", 0) or 0)
        sick_bal   = float(bal_row.get("sick_leave",   0) or 0)
        casual_bal = float(bal_row.get("casual_leave", 0) or 0)

        from backend.core import payroll_engine
        part = payroll_engine.leave_portion_for_month(
            employee_id, int(month_start[5:7]), int(month_start[:4]), cur)
        for lt_, row in part["by_type"].items():
            used_by_type[lt_] = {"days_used": row["days_used"], "unpaid_days": row["unpaid_days"]}

        cur.close()
        conn.close()
    except Exception as exc:
        logger.warning("leave_data error for %s: %s", employee_id, exc)

    balances = {
        "Earned Leave": earned_bal,
        "Sick Leave":   sick_bal,
        "Casual Leave": casual_bal,
    }

    result = {}
    for lt in TYPES:
        row    = used_by_type.get(lt, {})
        used   = float(row.get("days_used",   0) or 0)
        unpaid = float(row.get("unpaid_days", 0) or 0)
        result[lt] = {
            "monthly": _MONTHLY_ALLOC,
            "used":    used,
            "balance": balances[lt],
            "unpaid":  unpaid,
        }

    result["total_used"]    = sum(result[lt]["used"]    for lt in TYPES)
    result["total_balance"] = sum(result[lt]["balance"] for lt in TYPES)
    result["total_unpaid"]  = sum(result[lt]["unpaid"]  for lt in TYPES)
    return result


# ── Validation ────────────────────────────────────────────────────────────────

def validate_data(employee_id: str, month: int, year: int) -> list:
    errors = []
    try:
        conn = _db()
        cur  = conn.cursor(dictionary=True)

        cur.execute(
            "SELECT employee_code FROM employees WHERE employee_code = %s",
            (employee_id,)
        )
        if not cur.fetchone():
            errors.append(f"Employee '{employee_id}' not found")

        cur.execute(
            "SELECT id FROM employee_salaries WHERE employee_id = %s AND status = 'active'",
            (employee_id,)
        )
        if not cur.fetchone():
            errors.append(f"No active salary record for '{employee_id}'")

        cur.execute(
            """SELECT COUNT(*) AS cnt FROM attendance
               WHERE employee_id = %s AND MONTH(date) = %s AND YEAR(date) = %s""",
            (employee_id, month, year)
        )
        row = cur.fetchone() or {}
        if int(row.get("cnt", 0) or 0) == 0:
            errors.append(
                f"No attendance records for "
                f"{datetime(year, month, 1).strftime('%B %Y')}"
            )

        cur.close()
        conn.close()
    except Exception as exc:
        errors.append(f"Validation error: {exc}")
    return errors


# ── DOCX helpers ──────────────────────────────────────────────────────────────

def _set_run_text(para, text: str):
    """
    Set paragraph text, handling split runs.
    Puts all text into run[0] and clears the rest.
    Preserves font size and bold from run[0].
    """
    if not para.runs:
        para.add_run(text)
        return
    r0 = para.runs[0]
    r0.text = text
    for r in para.runs[1:]:
        r.text = ""


def _cell_set(cell, value: str):
    """
    Write value into a cell that currently has no content (empty value cells).
    Adds a run to the first paragraph.
    """
    para = cell.paragraphs[0] if cell.paragraphs else cell.add_paragraph()
    if para.runs:
        para.runs[0].text = str(value)
        for r in para.runs[1:]:
            r.text = ""
    else:
        para.add_run(str(value))


def _fmt_currency(v: float) -> str:
    return f"Rs. {v:,.2f}"


def _fmt_days(v: float) -> str:
    if v == int(v):
        return str(int(v))
    return f"{v:.1f}"


# ── Template population ───────────────────────────────────────────────────────

def _populate_docx(template_path: str, output_path: str,
                   payroll: dict, leave: dict):
    """
    Load template, fill all fields, save populated copy to output_path.

    Template cell map (all 0-indexed):
      Row 2,  cols 2-9  : "Pay Slip ← (Month )2026"
                           run[5] = ' {month_name}', run[6] = str(year)
      Row 5,  cols 3-4  : "( Name )"   → employee name
      Row 5,  col  9    : "( Position)"→ designation
      Row 7,  col  2    : total days in month
      Row 7,  cols 7-8  : total balance leave
      Row 8,  col  2    : present (working) days
      Row 8,  cols 7-8  : total taken leave this month
      Rows 12-14 per leave type (PL/SL/CL):
        col 1 : yearly allocation (6)
        col 4 : monthly allocation (0.5)
        col 6 : used this month
        col 8 : balance remaining
        col 9 : unpaid days
      Row 16, col  2    : gross salary
      Row 16, cols 7-8  : PT + LWP/LOP deduction
      Row 17, cols 7-8  : other deduction (leave deduction if separate)
      Row 18, col  2    : total earnings
      Row 18, cols 7-8  : total deductions
      Row 19, cols 5-9  : net salary
    """
    shutil.copy2(template_path, output_path)
    doc = Document(output_path)
    tbl = doc.tables[0]

    emp_name    = payroll["employee_name"]
    designation = payroll["job_title"]
    month_name  = datetime(
        int(payroll["payroll_month"].split()[-1]),
        list(__import__("calendar").month_name).index(payroll["payroll_month"].split()[0]),
        1
    ).strftime("%B")
    year_str    = payroll["payroll_month"].split()[-1]
    total_days  = payroll["working_days"]
    present     = payroll["present_days"]
    gross       = payroll["monthly_salary"]
    pt          = payroll["professional_tax"]
    unpaid_ded  = payroll["unpaid_leave_deduction"]
    net         = payroll["net_salary"]
    total_ded   = round(pt + unpaid_ded, 2)

    total_balance = leave["total_balance"]
    total_used    = leave["total_used"]

    logger.info("Populating template: emp=%s month=%s year=%s", emp_name, month_name, year_str)

    # ── Row 2: "Pay Slip ← (Month )2026" ─────────────────────────────────────
    row2_cell = tbl.rows[2].cells[2]
    para = row2_cell.paragraphs[0]
    runs = para.runs
    # run[5] = ' (Month )', run[6] = '2026'
    if len(runs) >= 6:
        runs[5].text = f" {month_name} "
        logger.info("  [Row2] month → '%s'", month_name)
    if len(runs) >= 7:
        runs[6].text = year_str
        logger.info("  [Row2] year → '%s'", year_str)

    # ── Row 5: Employee Name and Designation ──────────────────────────────────
    # Name cell: cols 3-4 merged — runs: ['  ', '( Name', ' ) ']
    name_cell = tbl.rows[5].cells[3]
    para_name = name_cell.paragraphs[0]
    if len(para_name.runs) >= 3:
        para_name.runs[0].text = "  "
        para_name.runs[1].text = emp_name
        para_name.runs[2].text = ""
    elif len(para_name.runs) == 2:
        para_name.runs[0].text = emp_name
        para_name.runs[1].text = ""
    else:
        _set_run_text(para_name, emp_name)
    logger.info("  [Row5] name → '%s'", emp_name)

    # Designation cell: col 9 — runs: ['   ', '( Position', ' )']
    pos_cell = tbl.rows[5].cells[9]
    para_pos = pos_cell.paragraphs[0]
    if len(para_pos.runs) >= 3:
        para_pos.runs[0].text = "  "
        para_pos.runs[1].text = designation
        para_pos.runs[2].text = ""
    elif len(para_pos.runs) == 2:
        para_pos.runs[0].text = designation
        para_pos.runs[1].text = ""
    else:
        _set_run_text(para_pos, designation)
    logger.info("  [Row5] designation → '%s'", designation)

    # ── Row 7: Total days | Balance Leave ────────────────────────────────────
    _cell_set(tbl.rows[7].cells[2], _fmt_days(total_days))
    _cell_set(tbl.rows[7].cells[7], _fmt_days(total_balance))
    logger.info("  [Row7] total_days=%d balance_leave=%.2f", total_days, total_balance)

    # ── Row 8: Working Days | Taken Leave ────────────────────────────────────
    _cell_set(tbl.rows[8].cells[2], _fmt_days(present))
    _cell_set(tbl.rows[8].cells[7], _fmt_days(total_used))
    logger.info("  [Row8] present=%d taken_leave=%.2f", present, total_used)

    # ── Rows 12-14: PL / SL / CL leave breakdown ─────────────────────────────
    leave_rows = [
        (12, "Earned Leave"),   # PL
        (13, "Sick Leave"),     # SL
        (14, "Casual Leave"),   # CL
    ]
    for row_idx, lt in leave_rows:
        lv = leave[lt]
        row = tbl.rows[row_idx]
        # col 1 : yearly allocation
        _cell_set(row.cells[1], _fmt_days(_YEARLY_ALLOC))
        # col 4 : monthly allocation
        _cell_set(row.cells[4], _fmt_days(_MONTHLY_ALLOC))
        # col 6 : used this month
        _cell_set(row.cells[6], _fmt_days(lv["used"]))
        # col 8 : balance remaining
        _cell_set(row.cells[8], _fmt_days(lv["balance"]))
        # col 9 : unpaid days
        _cell_set(row.cells[9], _fmt_days(lv["unpaid"]))
        logger.info(
            "  [Row%d] %s: yearly=6 monthly=0.5 used=%.1f balance=%.2f unpaid=%.1f",
            row_idx, lt, lv["used"], lv["balance"], lv["unpaid"]
        )

    # ── Row 16: Gross Salary | Professional Tax LWP/LOP ──────────────────────
    _cell_set(tbl.rows[16].cells[2], _fmt_currency(gross))
    # PT column shows combined PT + unpaid leave deduction
    pt_lwp_label = f"{_fmt_currency(pt)}"
    if unpaid_ded > 0:
        pt_lwp_label = f"PT: {_fmt_currency(pt)}  LWP: {_fmt_currency(unpaid_ded)}"
    _cell_set(tbl.rows[16].cells[7], pt_lwp_label)
    logger.info("  [Row16] gross=%s PT+LWP=%s", _fmt_currency(gross), pt_lwp_label)

    # ── Row 17: Other Deduction (0) ───────────────────────────────────────────
    _cell_set(tbl.rows[17].cells[7], _fmt_currency(0))
    logger.info("  [Row17] other_deduction=0")

    # ── Row 18: Total Earnings | Total Deductions ─────────────────────────────
    _cell_set(tbl.rows[18].cells[2], _fmt_currency(gross))
    _cell_set(tbl.rows[18].cells[7], _fmt_currency(total_ded))
    logger.info(
        "  [Row18] total_earnings=%s total_deductions=%s",
        _fmt_currency(gross), _fmt_currency(total_ded)
    )

    # ── Row 19: Net Salary ────────────────────────────────────────────────────
    _cell_set(tbl.rows[19].cells[5], _fmt_currency(net))
    logger.info("  [Row19] net_salary=%s", _fmt_currency(net))

    doc.save(output_path)
    logger.info("Populated DOCX saved: %s", output_path)


# ── PDF conversion ────────────────────────────────────────────────────────────

def _convert_to_pdf(docx_path: str, pdf_path: str):
    """
    Convert DOCX to PDF using docx2pdf (MS Word via COM automation).

    FastAPI runs sync route handlers in a thread pool. Each worker thread
    must initialize COM independently before any win32com/Word call, otherwise
    docx2pdf raises: (-2147221008, 'CoInitialize has not been called.', ...)
    """
    import pythoncom
    from docx2pdf import convert

    if not os.path.isfile(docx_path):
        raise FileNotFoundError(f"DOCX not found before conversion: {docx_path}")

    logger.info("COM initialize — thread-local COM for Word automation")
    pythoncom.CoInitialize()
    try:
        logger.info("PDF conversion started: %s", docx_path)
        convert(docx_path, pdf_path)
        logger.info("PDF conversion completed")
    finally:
        pythoncom.CoUninitialize()
        logger.info("COM uninitialized")

    if not os.path.isfile(pdf_path):
        raise RuntimeError(f"PDF was not created at expected path: {pdf_path}")

    logger.info("PDF saved: %s (%d bytes)", pdf_path, os.path.getsize(pdf_path))


# ── Public entry point ────────────────────────────────────────────────────────

def generate(employee_id: str, month: int, year: int) -> dict:
    """
    Generate an official salary slip for the given employee and period.

    Returns:
      {
        "success":  bool,
        "errors":   list[str],
        "filename": str,     # e.g. salary_slip_EMP0009_202606.pdf
        "filepath": str,     # absolute path to PDF
        "html":     None,    # always None — PDF only (no HTML fallback)
      }
    """
    logger.info(
        "salary_slip_generator.generate(%s, %d/%d) — template: %s",
        employee_id, month, year, TEMPLATE_PATH
    )

    # 1. Verify template exists
    if not os.path.isfile(TEMPLATE_PATH):
        msg = f"Salary Slip New template not found at: {TEMPLATE_PATH}"
        logger.error(msg)
        return {"success": False, "errors": [msg], "filename": None, "filepath": None, "html": None}
    logger.info("Template found: %s", TEMPLATE_PATH)

    # 2. Validate HRMS data
    errors = validate_data(employee_id, month, year)
    if errors:
        logger.warning("Validation failed for %s: %s", employee_id, errors)
        return {"success": False, "errors": errors, "filename": None, "filepath": None, "html": None}

    # 3. Compute payroll
    payroll = _compute(employee_id, month, year)
    if payroll is None:
        msg = f"Payroll computation failed for {employee_id} ({month}/{year})"
        logger.error(msg)
        return {"success": False, "errors": [msg], "filename": None, "filepath": None, "html": None}

    logger.info(
        "Payroll: gross=%.2f PT=%.2f unpaid_ded=%.2f net=%.2f present=%d",
        payroll["monthly_salary"], payroll["professional_tax"],
        payroll["unpaid_leave_deduction"], payroll["net_salary"],
        payroll["present_days"]
    )

    # 4. Fetch leave breakdown
    leave = _get_leave_data(employee_id, month, year)
    logger.info(
        "Leave: PL(used=%.1f bal=%.2f) SL(used=%.1f bal=%.2f) CL(used=%.1f bal=%.2f) total_used=%.1f",
        leave["Earned Leave"]["used"],  leave["Earned Leave"]["balance"],
        leave["Sick Leave"]["used"],    leave["Sick Leave"]["balance"],
        leave["Casual Leave"]["used"],  leave["Casual Leave"]["balance"],
        leave["total_used"]
    )

    # 5. Populate DOCX template
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    base     = f"salary_slip_{employee_id}_{year:04d}{month:02d}"
    docx_out = os.path.join(OUTPUT_DIR, base + ".docx")
    pdf_out  = os.path.join(OUTPUT_DIR, base + ".pdf")

    try:
        _populate_docx(TEMPLATE_PATH, docx_out, payroll, leave)
    except Exception as exc:
        logger.exception("DOCX population failed: %s", exc)
        return {
            "success": False,
            "errors": [f"Template population failed: {exc}"],
            "filename": None, "filepath": None, "html": None
        }

    # 6. Convert to PDF (with DOCX fallback for deployment environments
    # without MS Word / pythoncom)
    pdf_created = False
    try:
        _convert_to_pdf(docx_out, pdf_out)
        pdf_created = True
    except ImportError as exc:
        logger.warning("PDF conversion unavailable (pythoncom/pywin32 missing): %s", exc)
    except Exception as exc:
        logger.warning("PDF conversion failed (MS Word may not be installed): %s", exc)

    if pdf_created:
        # 7a. Keep only PDF -- clean up intermediate DOCX
        try:
            os.remove(docx_out)
        except Exception:
            pass
        filename = base + ".pdf"
        filepath = pdf_out
        logger.info("Salary slip PDF ready: %s", filepath)
    else:
        # 7b. Fallback -- return DOCX when PDF conversion is unavailable
        filename = base + ".docx"
        filepath = docx_out
        logger.info("Salary slip DOCX ready (PDF conversion unavailable): %s", filepath)

    return {
        "success":  True,
        "errors":   [],
        "filename": filename,
        "filepath": filepath,
        "html":     None,
    } 
