"""
relieving_letter_generator.py
================================
Generates the official Seawind Solution Pvt. Ltd. Relieving Letter from the
company-approved Word template.

Template : templates/relieving_letter_template.docx
Placeholders:
  {{DATE}}              – letter date            (e.g. "04 June 2026")
  {{NAME}}              – employee full name
  {{ADDRESS}}           – employee address
  {{CONTACT_NO}}        – phone / mobile
  {{EMAIL}}             – email id
  {{RESIGNATION_DATE}}  – date of resignation letter (DD-MM-YYYY)
  {{POSITION}}          – job title / designation
  {{LAST_DATE}}         – last working day / effective date (DD-MM-YYYY)

Raises TemplateNotConfiguredError if the template is missing.
No fallback to any generic generator.
"""

from __future__ import annotations

import logging
from datetime import datetime
from pathlib import Path

log = logging.getLogger(__name__)

OUTPUT_DIR    = Path("generated_docs")
_HERE         = Path(__file__).resolve().parent
_BACKEND_ROOT = _HERE.parent
_TEMPLATE_DIR = _BACKEND_ROOT / "templates" / "templates"
TEMPLATE_PATH = _TEMPLATE_DIR / "relieving_letter_template.docx"

OUTPUT_DIR.mkdir(exist_ok=True)


class TemplateNotConfiguredError(RuntimeError):
    """Raised when the approved relieving letter template is missing."""


def _replace_in_paragraph(paragraph, replacements: dict) -> None:
    text = paragraph.text
    for key, value in replacements.items():
        if key in text:
            text = text.replace(key, str(value))
            if "Employee Name:" in key:
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


def generate(data: dict) -> str:
    """
    Generate a Relieving Letter PDF.

    Required keys: employee_name, position, resignation_date, last_date
    Optional keys: employee_code, employee_id, address, contact_no, email, letter_date

    Returns the filename inside generated_docs/.
    Raises TemplateNotConfiguredError if the template is not present.
    """
    if not TEMPLATE_PATH.exists():
        raise TemplateNotConfiguredError(
            "Relieving Letter Template Not Configured. "
            f"Place the approved template at: {TEMPLATE_PATH.resolve()}"
        )

    from docx import Document

    emp_code  = (data.get("employee_code") or data.get("employee_id") or "EMP").strip()
    ts        = datetime.now().strftime("%Y%m%d%H%M%S")
    docx_path = OUTPUT_DIR / f"relieving_letter_{emp_code}_{ts}.docx"
    pdf_name  = f"relieving_letter_{emp_code}_{ts}.pdf"
    pdf_path  = OUTPUT_DIR / pdf_name

    letter_date = data.get("letter_date") or datetime.now().strftime("%d %B %Y")

    replacements = {
        "{{DATE}}":             letter_date,
        "Date:":                f"Date: {letter_date}",
        "Employee Name: Address:- Contact No: Email id:": (
            f"Employee\nName: {data.get('employee_name') or ''}\n"
            f"Address: {data.get('address') or ''}\n"
            f"Contact No: {data.get('contact_no') or ''}\n"
            f"Email id: {data.get('email') or ''}"
        ),
        "{{NAME}}":             data.get("employee_name")    or "",
        "{{ADDRESS}}":          data.get("address")          or "",
        "{{CONTACT_NO}}":       data.get("contact_no")       or "",
        "{{EMAIL}}":            data.get("email")            or "",
        "{{RESIGNATION_DATE}}": data.get("resignation_date") or "",
        "( Resignation Date )": data.get("last_date") or "",
        "{{POSITION}}":         data.get("position")         or "",
        "(Position )":          data.get("position")         or "",
        "{{LAST_DATE}}":        data.get("last_date")        or "",
        "(Date)":               data.get("resignation_date") or "",
    }

    doc = Document(str(TEMPLATE_PATH))
    _replace_all(doc, replacements)
    doc.save(str(docx_path))
    log.info("Relieving letter docx saved: %s", docx_path)

    try:
        import pythoncom
        from docx2pdf import convert
        pythoncom.CoInitialize()
        try:
            convert(str(docx_path.absolute()), str(pdf_path.absolute()))
        finally:
            pythoncom.CoUninitialize()
        log.info("Relieving letter PDF saved: %s", pdf_path)
        try:
            docx_path.unlink()
        except Exception:
            pass
        return pdf_name
    except Exception as exc:
        log.warning("docx2pdf failed (%s) — serving docx", exc)
        return docx_path.name
