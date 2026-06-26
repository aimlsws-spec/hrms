"""
appointment_letter_generator.py
================================
Generates the official Seawind Solution Pvt. Ltd. Appointment Letter.

Completely separate from document_generator.py / salary slip engine.
Uses python-docx for Word-faithful formatting and docx2pdf (MS Word PDF
engine) for pixel-perfect PDF output.

Keyword substitution map:
  {{DATE}}         – letter date (DD-MM-YYYY)
  {{NAME}}         – employee full name
  {{ADDRESS}}      – employee address
  {{EMAIL}}        – employee email
  {{POSITION}}     – job title / designation
  {{JOINING_DATE}} – date of joining (DD-MM-YYYY)
  {{SALARY}}       – salary string (e.g. "Rs. 41,667/- per month …")
"""

from __future__ import annotations

import logging
import os
import shutil
from datetime import datetime
from pathlib import Path
from typing import Optional

from docx import Document
from docx.shared import Pt, RGBColor, Inches, Mm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

log = logging.getLogger(__name__)

OUTPUT_DIR = Path("generated_docs")
OUTPUT_DIR.mkdir(exist_ok=True)

TEMPLATE_PATH = Path("templates") / "appointment_letter_template.docx"


# ── Low-level helpers ─────────────────────────────────────────────────────────

def _set_font(run, name: str = "Times New Roman", size: int = 11,
              bold: bool = False, italic: bool = False,
              color: Optional[tuple] = None) -> None:
    run.font.name = name
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.italic = italic
    if color:
        run.font.color.rgb = RGBColor(*color)


def _para(doc: Document, text: str = "", align=WD_ALIGN_PARAGRAPH.LEFT,
          space_before: int = 0, space_after: int = 6) -> None:
    """Add a plain paragraph."""
    p = doc.add_paragraph()
    p.alignment = align
    p.paragraph_format.space_before = Pt(space_before)
    p.paragraph_format.space_after  = Pt(space_after)
    if text:
        run = p.add_run(text)
        _set_font(run, size=11)
    return p


def _bold_para(doc: Document, text: str, align=WD_ALIGN_PARAGRAPH.LEFT,
               size: int = 11, space_before: int = 0, space_after: int = 4):
    p = doc.add_paragraph()
    p.alignment = align
    p.paragraph_format.space_before = Pt(space_before)
    p.paragraph_format.space_after  = Pt(space_after)
    run = p.add_run(text)
    _set_font(run, size=size, bold=True)
    return p


def _mixed_para(doc: Document, parts: list[tuple[str, bool]],
                align=WD_ALIGN_PARAGRAPH.LEFT,
                space_before: int = 0, space_after: int = 6):
    """
    parts = [(text, bold), ...]
    e.g. [("Greetings from ", False), ("Seawind Solution Pvt. Ltd.", True)]
    """
    p = doc.add_paragraph()
    p.alignment = align
    p.paragraph_format.space_before = Pt(space_before)
    p.paragraph_format.space_after  = Pt(space_after)
    for text, bold in parts:
        run = p.add_run(text)
        _set_font(run, size=11, bold=bold)
    return p


def _add_horizontal_line(doc: Document, thickness: str = "6") -> None:
    """Add a full-width horizontal rule paragraph."""
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after  = Pt(2)
    pPr = p._p.get_or_add_pPr()
    pBdr = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), thickness)
    bottom.set(qn("w:space"), "1")
    bottom.set(qn("w:color"), "000000")
    pBdr.append(bottom)
    pPr.append(pBdr)


def _add_page_break(doc: Document) -> None:
    p   = doc.add_paragraph()
    run = p.add_run()
    br  = OxmlElement("w:br")
    br.set(qn("w:type"), "page")
    run._r.append(br)


# ── Template builder ──────────────────────────────────────────────────────────

def _build_template() -> None:
    """Create appointment_letter_template.docx with {{KEYWORD}} placeholders."""
    from docx.shared import Cm

    doc = Document()

    # Page margins
    for section in doc.sections:
        section.top_margin    = Mm(20)
        section.bottom_margin = Mm(18)
        section.left_margin   = Mm(22)
        section.right_margin  = Mm(22)

    def letterhead():
        # Company name
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after  = Pt(2)
        run = p.add_run("Seawind Solution Pvt. Ltd.")
        _set_font(run, size=16, bold=True)

        # Address
        p2 = doc.add_paragraph()
        p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p2.paragraph_format.space_before = Pt(0)
        p2.paragraph_format.space_after  = Pt(3)
        run2 = p2.add_run(
            "B-1102 Mondeal Heights, Near Novotel Hotel, "
            "Ramdev Nagar, Ahmedabad, Gujarat 380015"
        )
        _set_font(run2, size=9)

        _add_horizontal_line(doc, thickness="12")

    # ── PAGE 1 ────────────────────────────────────────────────────────────────
    letterhead()

    # Title
    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title.paragraph_format.space_before = Pt(10)
    p_title.paragraph_format.space_after  = Pt(4)
    run_t = p_title.add_run("Appointment Letter")
    _set_font(run_t, size=14, bold=True)
    run_t.underline = True

    _add_horizontal_line(doc, thickness="6")

    # Spacer
    _para(doc, space_after=4)

    # Dynamic fields
    fields = [
        ("Date:",     "{{DATE}}"),
        ("Name:",     "{{NAME}}"),
        ("Address:",  "{{ADDRESS}}"),
        ("Email Id:", "{{EMAIL}}"),
    ]
    for label, placeholder in fields:
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after  = Pt(3)
        r_lbl = p.add_run(f"{label}    ")
        _set_font(r_lbl, size=11, bold=True)
        r_val = p.add_run(placeholder)
        _set_font(r_val, size=11)

    _para(doc, space_after=6)

    # Subject
    _bold_para(doc,
               "Sub: Appointment Letter from Seawind Solution Pvt. Ltd.",
               space_after=8)

    # Greeting
    _mixed_para(doc,
                [("Greetings from ", False), ("Seawind Solution Pvt. Ltd.", True)],
                space_after=6)

    # Opening sentence with position placeholder
    _mixed_para(doc, [
        ("With reference to your application and subsequent interview with us, we are pleased to "
         "appoint you as ", False),
        ("{{POSITION}}", True),
        (" in our organization on the following terms and conditions.", False),
    ], space_after=8)

    # Joining / Salary
    p_jd = doc.add_paragraph()
    p_jd.paragraph_format.space_after = Pt(3)
    r1 = p_jd.add_run("Date of Joining:    ")
    _set_font(r1, size=11, bold=True)
    r2 = p_jd.add_run("{{JOINING_DATE}}")
    _set_font(r2, size=11)

    p_sal = doc.add_paragraph()
    p_sal.paragraph_format.space_after = Pt(8)
    rs1 = p_sal.add_run("Salary:    ")
    _set_font(rs1, size=11, bold=True)
    rs2 = p_sal.add_run("{{SALARY}}")
    _set_font(rs2, size=11)

    # Probation clause
    _mixed_para(doc, [
        ("Probation/Confirmation. ", True),
        ("You will be on a probation period of ", False),
        ("6 (six) months", True),
        (" based on your performance your services will be confirmed in the present "
         "position, and thereafter, your services can be confirmed with the Company.", False),
    ], space_after=6)

    for body_text in [
        ("During the probation period, your services can be terminated with seven days' notice "
         "without any reason whatsoever; if your services are found satisfactory during the "
         "probation period, you will be confirmed in the present position and, thereafter, "
         "your services can be terminated with one month's notice."),
        ("Absence for a continuous period of ten days without prior approval of your superior "
         "(including overstay on leave/training) would result in your services being treated as "
         "on the same shall automatically come to an end without any notice or intimation."),
        ("During the period of your employment with the Company, you will devote full time to the "
         "work of the Company. Further, you will not take up any other employment or assignment "
         "or any office, honorary or for any consideration, in cash or in kind or otherwise, "
         "without the written permission of the Company."),
    ]:
        _para(doc, body_text, space_after=6)

    # Clause 1
    _para(doc,
          "1.  You will not (except in the normal course of the Company's business) publish any "
          "article or statement or deliver any lecture or broadcast or make any communication "
          "to the press, including magazine editors, about the Company or its products or to "
          "any matter with which the Company may be concerned, unless you have previously "
          "applied to and obtained the written permission from the Company.",
          space_after=8)

    # Footer website
    _para(doc, space_after=2)
    _bold_para(doc, "www.seawindsolution.com",
               align=WD_ALIGN_PARAGRAPH.CENTER, space_after=0)

    # ── PAGE BREAK → PAGE 2 ───────────────────────────────────────────────────
    _add_page_break(doc)
    letterhead()
    _para(doc, space_after=6)

    page2_clauses = [
        ("2.", "You will be required to maintain strict secrecy in respect of Project documents, "
               "commercial offers, design documents, Project cost & Estimation, Technology, "
               "Software packages licenses, Company's policies, Company's patterns & Trade Mark, "
               "and Company's Human assets profile."),
        ("3.", "You will be required to comply with all such rules and regulations as the Company "
               "may frame from time to time."),
        ("4.", "Any of our technical or other important information which might come into your "
               "possession during the continuance of your service with us shall not be disclosed, "
               "divulged or made public by you even thereafter."),
        ("5.", "If at any time in our opinion, which is final in this matter you are found "
               "non-performer or guilty of fraud, dishonesty, neglect of duty, negligence or any "
               "other act considered by us to be against our interest or any other conduct that "
               "amounts to a breach of the terms of this letter, your services may be terminated "
               "without notice and on account of reason of any of the acts or omission the "
               "company shall be entitled to recover the same from you."),
        ("6.", "You will not accept any present, commission or any sort of gratification in cash "
               "or kind from any person, party or firm or Company having to deal with the company "
               "and if you are offered any, you should immediately report the same to the Management."),
        ("7.", "This letter is issued to you in the basis of the information and particulars "
               "furnished by you in your application (including the data) at the time of your "
               "interview and appointment and any false information (if it comes to our notice "
               "that you have made a false statement or have disclosed a material fact) resulting "
               "in your being offered this appointment, the Management shall at such action as it "
               "in its absolute discretion, including termination of your employment."),
        ("8.", "You will be responsible for the safekeeping and return in good condition and order "
               "of all Company property, which may be in your use, custody, or charge."),
    ]
    for num, text in page2_clauses:
        _mixed_para(doc, [(f"{num}  ", True), (text, False)], space_after=7)

    _para(doc, space_after=6)
    _para(doc,
          "Please sign and return to the undersigned the duplicate copy of this letter "
          "signifying your acceptance.",
          space_after=6)
    _mixed_para(doc, [
        ("We welcome you to the ", False),
        ("Seawind family", True),
        (" and look forward to a fruitful collaboration & ", False),
        ("long-term relationship.", True),
    ], space_after=16)

    # Signature block
    for sig_text, bold in [
        ("With best wishes,",               False),
        ("Seawind Solution Pvt. Ltd.",       True),
        ("HR Department",                    False),
        ("+91-9979870089",                   False),
        ("hr@seawindsolution.com",           False),
    ]:
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after  = Pt(2)
        run = p.add_run(sig_text)
        _set_font(run, size=11, bold=bold)

    _para(doc, space_after=12)
    _bold_para(doc, "www.seawindsolution.com",
               align=WD_ALIGN_PARAGRAPH.CENTER)

    Path("templates").mkdir(exist_ok=True)
    doc.save(str(TEMPLATE_PATH))
    log.info("Appointment letter template created: %s", TEMPLATE_PATH)


def _ensure_template() -> None:
    if not TEMPLATE_PATH.exists():
        _build_template()


# ── Keyword substitution in a Word document ───────────────────────────────────

def _replace_in_paragraph(paragraph, replacements: dict[str, str]) -> None:
    """Replace {{KEY}} tokens in a paragraph, preserving run formatting."""
    for run in paragraph.runs:
        for key, value in replacements.items():
            if key in run.text:
                run.text = run.text.replace(key, value)


def _replace_all(doc: Document, replacements: dict[str, str]) -> None:
    """Replace tokens in all paragraphs and table cells of a document."""
    for para in doc.paragraphs:
        _replace_in_paragraph(para, replacements)
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                for para in cell.paragraphs:
                    _replace_in_paragraph(para, replacements)


# ── Public API ────────────────────────────────────────────────────────────────

def generate(data: dict) -> str:
    """
    Generate an Appointment Letter PDF for `data`.

    Required keys: employee_code, employee_name, address, email,
                   position, joining_date, salary
    Optional:      letter_date  (defaults to today)

    Returns the filename of the generated PDF (inside generated_docs/).
    """
    _ensure_template()

    emp_code   = (data.get("employee_code") or "EMP").strip()
    ts         = datetime.now().strftime("%Y%m%d%H%M%S")
    docx_name  = f"appointment_letter_{emp_code}_{ts}.docx"
    pdf_name   = f"appointment_letter_{emp_code}_{ts}.pdf"
    docx_path  = OUTPUT_DIR / docx_name
    pdf_path   = OUTPUT_DIR / pdf_name

    # Load the template and substitute keywords
    doc = Document(str(TEMPLATE_PATH))
    replacements = {
        "{{DATE}}":         data.get("letter_date", datetime.now().strftime("%d-%m-%Y")),
        "{{NAME}}":         data.get("employee_name", ""),
        "{{ADDRESS}}":      data.get("address", ""),
        "{{EMAIL}}":        data.get("email", ""),
        "{{POSITION}}":     data.get("position", ""),
        "{{JOINING_DATE}}": data.get("joining_date", ""),
        "{{SALARY}}":       data.get("salary", ""),
    }
    _replace_all(doc, replacements)
    doc.save(str(docx_path))
    log.info("Appointment letter docx saved: %s", docx_path)

    # Convert to PDF using MS Word (via docx2pdf)
    try:
        import pythoncom
        from docx2pdf import convert
        pythoncom.CoInitialize()
        try:
            convert(str(docx_path.absolute()), str(pdf_path.absolute()))
        finally:
            pythoncom.CoUninitialize()
        log.info("Converted to PDF: %s", pdf_path)
        # Clean up the intermediate docx
        try:
            docx_path.unlink()
        except Exception:
            pass
        return pdf_name
    except Exception as exc:
        log.warning("docx2pdf conversion failed (%s) — returning docx instead", exc)
        # Fall back: serve the docx as a PDF-named file isn't ideal;
        # rename to .docx and return that
        docx_final = OUTPUT_DIR / f"appointment_letter_{emp_code}_{ts}.docx"
        if not docx_final.exists():
            shutil.copy(str(docx_path), str(docx_final))
        return docx_name
