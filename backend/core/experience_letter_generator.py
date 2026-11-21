"""
experience_letter_generator.py
================================
Generates the official Seawind Solution Pvt. Ltd. Experience Letter from the
company-approved Word template.

Template : templates/experience_letter_template.docx
Placeholders (must exist as exact text inside individual runs):
  {{DATE}}        – letter date        (e.g. "04 June 2026")
  {{NAME}}        – employee full name
  {{ADDRESS}}     – employee address
  {{CONTACT_NO}}  – phone / mobile number
  {{EMAIL}}       – email id
  {{POSITION}}    – job title / designation
  {{START_DATE}}  – employment start date  (DD-MM-YYYY)
  {{END_DATE}}    – employment end date    (DD-MM-YYYY)
  {{DEPARTMENT}}  – department name

If the template file is missing, TemplateNotConfiguredError is raised.
No fallback to any generic generator.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from pathlib import Path

log = logging.getLogger(__name__)

OUTPUT_DIR    = Path("generated_docs")
_HERE         = Path(__file__).resolve().parent
_BACKEND_ROOT = _HERE.parent
_TEMPLATE_DIR = _BACKEND_ROOT / "templates" / "templates"
TEMPLATE_PATH = _TEMPLATE_DIR / "New Experience Letter Format.docx"

OUTPUT_DIR.mkdir(exist_ok=True)


class TemplateNotConfiguredError(RuntimeError):
    """Raised when the approved experience letter template is missing."""


# ── Placeholder substitution (identical logic to offer_letter_generator) ──────

def _replace_in_paragraph(paragraph, replacements: dict) -> None:
    text = paragraph.text
    for key, value in replacements.items():
        if key in text:
            text = text.replace(key, str(value))
            if 'Employee Name:' in key:
                paragraph.paragraph_format.right_indent = None
    if text != paragraph.text and len(paragraph.runs) > 0:
        paragraph.runs[0].text = text
        for i in range(1, len(paragraph.runs)):
            paragraph.runs[i].text = ""


def _replace_all(doc, replacements: dict) -> None:
    for para in doc.paragraphs:
        _replace_in_paragraph(para, replacements)
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                for para in cell.paragraphs:
                    _replace_in_paragraph(para, replacements)


# ── Public API ─────────────────────────────────────────────────────────────────

def generate(data: dict) -> str:
    """
    Generate an Experience Letter PDF.

    Required keys: employee_name, position, department, start_date, end_date
    Optional keys: employee_code, employee_id, address, contact_no, email, letter_date

    Returns the filename inside generated_docs/.
    Raises TemplateNotConfiguredError if the template is not present.
    """
    if not TEMPLATE_PATH.exists():
        raise TemplateNotConfiguredError(
            "Experience Letter Template Not Configured. "
            f"Place the approved template at: {TEMPLATE_PATH.resolve()}"
        )

    from docx import Document

    emp_code  = (data.get("employee_code") or data.get("employee_id") or "EMP").strip()
    ts        = datetime.now().strftime("%Y%m%d%H%M%S")
    docx_path = OUTPUT_DIR / f"experience_letter_{emp_code}_{ts}.docx"
    pdf_name  = f"experience_letter_{emp_code}_{ts}.pdf"
    pdf_path  = OUTPUT_DIR / pdf_name

    # Format letter date as "DD Month YYYY" (e.g. "04 June 2026")
    letter_date = data.get("letter_date") or datetime.now().strftime("%d %B %Y")

    replacements = {
        "{{DATE}}":       letter_date,
        "Date:":          f"Date: {letter_date}",
        "Employee Name: Address: Contact No: Email id:": (
            f"Employee\nName: {data.get('employee_name') or ''}\n"
            f"Address: {data.get('address') or ''}\n"
            f"Contact No: {data.get('contact_no') or ''}\n"
            f"Email id: {data.get('email') or ''}"
        ),
        "{{NAME}}":       data.get("employee_name") or "",
        "( Name )":       data.get("employee_name") or "",
        "{{ADDRESS}}":    data.get("address") or "",
        "{{CONTACT_NO}}": data.get("contact_no") or "",
        "{{EMAIL}}":      data.get("email") or "",
        "{{POSITION}}":   data.get("position") or "",
        "( Position )":   data.get("position") or "",
        "{{START_DATE}}": data.get("start_date") or "",
        "(Starting Date)": data.get("start_date") or "",
        "{{END_DATE}}":   data.get("end_date") or "",
        "(Ending Date)":  data.get("end_date") or "",
        "{{DEPARTMENT}}": data.get("department") or "",
        "(Department)":   data.get("department") or "",
    }

    doc = Document(str(TEMPLATE_PATH))
    _replace_all(doc, replacements)
    doc.save(str(docx_path))
    log.info("Experience letter docx saved: %s", docx_path)

    try:
        import pythoncom
        from docx2pdf import convert
        pythoncom.CoInitialize()
        try:
            convert(str(docx_path.absolute()), str(pdf_path.absolute()))
        finally:
            pythoncom.CoUninitialize()
        log.info("Experience letter PDF conversion finished for: %s", pdf_path)
        if pdf_path.exists():
            try:
                docx_path.unlink()
            except Exception:
                pass
            return pdf_name
        else:
            log.warning("docx2pdf finished but PDF not found — returning docx")
            return docx_path.name
    except Exception as exc:
        log.warning("docx2pdf failed (%s) — serving docx", exc)
        return docx_path.name
