"""
offer_letter_generator.py
=========================
Generates the official Seawind Solution Pvt. Ltd. Offer Letter from the
company-approved Word template.

Template: templates/offer_letter_template.docx
If the template is missing the error TemplateNotConfiguredError is raised.
No fallback to a generic generator — ever.

Placeholders in the template (must exist as exact text in runs):
  {{DATE}}         – letter date  (DD-MM-YYYY)
  {{NAME}}         – candidate full name
  {{ADDRESS}}      – candidate address
  {{EMAIL}}        – candidate email id
  {{POSITION}}     – job title / designation
  {{JOINING_DATE}} – date of joining  (DD-MM-YYYY)
  {{SALARY}}       – salary string  (e.g. "Rs. 41,667/- per month …")
  {{EMPLOYEE_ID}}  – employee code (optional)
"""

from __future__ import annotations

import logging
from datetime import datetime
from pathlib import Path

log = logging.getLogger(__name__)

OUTPUT_DIR    = Path("generated_docs")
TEMPLATE_PATH = Path("templates") / "offer_letter_template.docx"

OUTPUT_DIR.mkdir(exist_ok=True)


class TemplateNotConfiguredError(RuntimeError):
    """Raised when the approved offer letter template file is missing."""


def _replace_in_paragraph(paragraph, replacements: dict[str, str]) -> None:
    for run in paragraph.runs:
        for key, value in replacements.items():
            if key in run.text:
                run.text = run.text.replace(key, value)


def _replace_all(doc, replacements: dict[str, str]) -> None:
    for para in doc.paragraphs:
        _replace_in_paragraph(para, replacements)
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                for para in cell.paragraphs:
                    _replace_in_paragraph(para, replacements)


def generate(data: dict) -> str:
    """
    Generate an Offer Letter PDF for the given employee data.

    Required keys in data:
        employee_name, position, joining_date, salary
    Optional keys:
        employee_code, employee_id, address, email, letter_date

    Returns the filename of the generated file inside generated_docs/.
    Raises TemplateNotConfiguredError if the template is not present.
    """
    if not TEMPLATE_PATH.exists():
        raise TemplateNotConfiguredError(
            "Offer Letter Template Not Configured. "
            f"Place the approved template at: {TEMPLATE_PATH.resolve()}"
        )

    from docx import Document

    emp_code  = (data.get("employee_code") or data.get("employee_id") or "EMP").strip()
    ts        = datetime.now().strftime("%Y%m%d%H%M%S")
    docx_path = OUTPUT_DIR / f"offer_letter_{emp_code}_{ts}.docx"
    pdf_name  = f"offer_letter_{emp_code}_{ts}.pdf"
    pdf_path  = OUTPUT_DIR / pdf_name

    doc = Document(str(TEMPLATE_PATH))

    replacements = {
        "{{DATE}}":         data.get("letter_date") or datetime.now().strftime("%d-%m-%Y"),
        "{{NAME}}":         data.get("employee_name") or "",
        "{{ADDRESS}}":      data.get("address") or "",
        "{{EMAIL}}":        data.get("email") or "",
        "{{POSITION}}":     data.get("position") or "",
        "{{JOINING_DATE}}": data.get("joining_date") or "",
        "{{SALARY}}":       data.get("salary") or "",
        "{{EMPLOYEE_ID}}":  emp_code,
    }
    _replace_all(doc, replacements)
    doc.save(str(docx_path))
    log.info("Offer letter docx saved: %s", docx_path)

    try:
        import pythoncom
        from docx2pdf import convert
        pythoncom.CoInitialize()
        try:
            convert(str(docx_path.absolute()), str(pdf_path.absolute()))
        finally:
            pythoncom.CoUninitialize()
        log.info("Offer letter PDF saved: %s", pdf_path)
        try:
            docx_path.unlink()
        except Exception:
            pass
        return pdf_name
    except Exception as exc:
        log.warning("docx2pdf failed (%s) — returning docx", exc)
        return docx_path.name
