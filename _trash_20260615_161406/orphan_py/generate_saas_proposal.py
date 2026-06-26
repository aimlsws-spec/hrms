"""
HRMS SaaS Proposal Generator
Generates:
1. A professional Word document proposal (HRMS_SaaS_Proposal.docx)
2. A professional PowerPoint presentation (HRMS_SaaS_Presentation.pptx)
Both include 3 subscription plans: Starter, Professional, Enterprise
"""

from docx import Document
from docx.shared import Pt, Cm, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
import copy

from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor as PPTXColor
from pptx.enum.text import PP_ALIGN
from pptx.util import Inches, Pt
import datetime

# ── Colour Palette ────────────────────────────────────────────────────────────
NAVY       = RGBColor(0x0D, 0x2B, 0x55)   # #0D2B55
BLUE       = RGBColor(0x1A, 0x6B, 0xC4)   # #1A6BC4
ACCENT     = RGBColor(0x00, 0xC9, 0xA7)   # #00C9A7  teal
GOLD       = RGBColor(0xF5, 0xA6, 0x23)   # #F5A623
WHITE      = RGBColor(0xFF, 0xFF, 0xFF)
LIGHT_GRAY = RGBColor(0xF4, 0xF6, 0xF9)
DARK_GRAY  = RGBColor(0x3A, 0x3A, 0x4A)
MID_GRAY   = RGBColor(0x88, 0x88, 0x99)

PNAV  = PPTXColor(0x0D, 0x2B, 0x55)
PBLU  = PPTXColor(0x1A, 0x6B, 0xC4)
PACC  = PPTXColor(0x00, 0xC9, 0xA7)
PGOLD = PPTXColor(0xF5, 0xA6, 0x23)
PWHT  = PPTXColor(0xFF, 0xFF, 0xFF)
PLGT  = PPTXColor(0xF4, 0xF6, 0xF9)
PDRK  = PPTXColor(0x3A, 0x3A, 0x4A)
PMID  = PPTXColor(0x88, 0x88, 0x99)

TODAY = datetime.date.today().strftime("%d %B %Y")
COMPANY = "Seawind Solution Pvt. Ltd."
PRODUCT = "HRMS Pro – AI-Powered Human Resource Management System"

# ─────────────────────────────────────────────────────────────────────────────
#  Helper utilities for python-docx
# ─────────────────────────────────────────────────────────────────────────────

def set_cell_bg(cell, hex_color: str):
    """Fill a table cell background with a hex colour."""
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), hex_color)
    tcPr.append(shd)

def set_cell_border(cell, **kwargs):
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    tcBorders = OxmlElement('w:tcBorders')
    for edge in ('top','left','bottom','right'):
        tag = OxmlElement(f'w:{edge}')
        tag.set(qn('w:val'), kwargs.get(edge, {}).get('val','single'))
        tag.set(qn('w:sz'), str(kwargs.get(edge, {}).get('sz', 4)))
        tag.set(qn('w:color'), kwargs.get(edge, {}).get('color','auto'))
        tcBorders.append(tag)
    tcPr.append(tcBorders)

def add_heading(doc, text, level=1, color=None, space_before=14, space_after=6, size=None):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(space_before)
    p.paragraph_format.space_after  = Pt(space_after)
    run = p.add_run(text)
    run.bold = True
    if size is None:
        size = {1: 22, 2: 16, 3: 13}.get(level, 12)
    run.font.size = Pt(size)
    run.font.color.rgb = color or NAVY
    return p

def add_para(doc, text, size=11, color=None, bold=False, italic=False,
             space_before=2, space_after=4, indent=0, align=WD_ALIGN_PARAGRAPH.LEFT):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(space_before)
    p.paragraph_format.space_after  = Pt(space_after)
    if indent:
        p.paragraph_format.left_indent = Cm(indent)
    p.alignment = align
    run = p.add_run(text)
    run.font.size  = Pt(size)
    run.bold       = bold
    run.italic     = italic
    if color:
        run.font.color.rgb = color
    return p

def add_bullet(doc, text, size=11, level=0, color=None):
    p = doc.add_paragraph(style='List Bullet')
    p.paragraph_format.space_after = Pt(2)
    if level:
        p.paragraph_format.left_indent = Cm(level * 0.7)
    run = p.add_run(text)
    run.font.size = Pt(size)
    if color:
        run.font.color.rgb = color
    return p

def add_horizontal_rule(doc, color_hex="1A6BC4"):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(4)
    p.paragraph_format.space_after  = Pt(4)
    pPr = p._p.get_or_add_pPr()
    pBdr = OxmlElement('w:pBdr')
    bottom = OxmlElement('w:bottom')
    bottom.set(qn('w:val'), 'single')
    bottom.set(qn('w:sz'), '6')
    bottom.set(qn('w:space'), '1')
    bottom.set(qn('w:color'), color_hex)
    pBdr.append(bottom)
    pPr.append(pBdr)
    return p

def add_cover_page(doc):
    # Navy background block via shading a table
    cover = doc.add_table(rows=1, cols=1)
    cover.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = cover.cell(0, 0)
    set_cell_bg(cell, "0D2B55")
    cell.width = Cm(16)
    p = cell.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(30)
    p.paragraph_format.space_after  = Pt(6)
    run = p.add_run("HRMS Pro")
    run.bold = True
    run.font.size = Pt(38)
    run.font.color.rgb = WHITE

    p2 = cell.add_paragraph()
    p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p2.paragraph_format.space_before = Pt(2)
    p2.paragraph_format.space_after  = Pt(6)
    r2 = p2.add_run("AI-Powered Human Resource Management System")
    r2.font.size = Pt(16)
    r2.font.color.rgb = RGBColor(0x00, 0xC9, 0xA7)
    r2.bold = True

    p3 = cell.add_paragraph()
    p3.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p3.paragraph_format.space_before = Pt(4)
    p3.paragraph_format.space_after  = Pt(4)
    r3 = p3.add_run("━" * 42)
    r3.font.color.rgb = BLUE
    r3.font.size = Pt(10)

    p4 = cell.add_paragraph()
    p4.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p4.paragraph_format.space_before = Pt(8)
    p4.paragraph_format.space_after  = Pt(2)
    r4 = p4.add_run("SaaS Business Proposal")
    r4.bold = True
    r4.font.size = Pt(18)
    r4.font.color.rgb = GOLD

    p5 = cell.add_paragraph()
    p5.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p5.paragraph_format.space_before = Pt(2)
    p5.paragraph_format.space_after  = Pt(30)
    r5 = p5.add_run(f"Prepared by: {COMPANY}  |  Date: {TODAY}")
    r5.font.size = Pt(11)
    r5.font.color.rgb = RGBColor(0xCC, 0xD6, 0xF1)
    r5.italic = True

    doc.add_page_break()

def build_plan_table(doc, plans):
    """
    plans = list of dicts: name, price, color_hex, features
    """
    headers = ["Feature / Service"] + [p["name"] for p in plans]
    num_cols = len(headers)

    # Gather all unique feature rows
    feature_groups = [
        ("Core HR", [
            "Employee Profiles & Database",
            "Department & Designation Management",
            "Role-Based Access Control",
            "Multi-admin Support",
        ]),
        ("Attendance & Leave", [
            "GPS Geo-fenced Attendance",
            "Attendance Regularization",
            "Leave Management (all types)",
            "Sandwich Leave Policy",
            "Shift Management",
        ]),
        ("Payroll & Finance", [
            "Payroll Processing & Salary Slips",
            "Tax / PF / ESI Computation",
            "Bonus & Overtime Management",
            "Full & Final Settlement",
            "Accountant Dashboard",
        ]),
        ("Performance & Tasks", [
            "KPI & Performance Reviews",
            "Task Assignment & Tracking",
            "Performance Reports",
            "Goal Setting",
        ]),
        ("Communication & Support", [
            "Company Announcements",
            "Helpdesk Ticket System",
            "Document Generation (Offer/Exp letters)",
        ]),
        ("AI & Analytics", [
            "AI Chat Assistant (24/7)",
            "Real-time Analytics Dashboard",
            "Custom Reports & Exports",
            "Predictive Attrition Insights",
        ]),
        ("Platform", [
            "Cloud Hosting (managed)",
            "Mobile App (iOS & Android)",
            "API Access",
            "Custom Branding / White-label",
            "Dedicated Account Manager",
            "SLA Uptime Guarantee",
        ]),
        ("Limits", [
            "Max Employees",
            "Storage",
            "Support Type",
            "Onboarding Assistance",
        ]),
    ]

    # Starter / Professional / Enterprise availability
    availability = {
        "Employee Profiles & Database":              ["✔","✔","✔"],
        "Department & Designation Management":       ["✔","✔","✔"],
        "Role-Based Access Control":                 ["✔","✔","✔"],
        "Multi-admin Support":                       ["2","5","Unlimited"],
        "GPS Geo-fenced Attendance":                 ["✔","✔","✔"],
        "Attendance Regularization":                 ["✗","✔","✔"],
        "Leave Management (all types)":              ["Basic","Full","Full + Custom"],
        "Sandwich Leave Policy":                     ["✗","✔","✔"],
        "Shift Management":                          ["✗","✔","✔"],
        "Payroll Processing & Salary Slips":         ["✔","✔","✔"],
        "Tax / PF / ESI Computation":                ["Basic","✔","✔"],
        "Bonus & Overtime Management":               ["✗","✔","✔"],
        "Full & Final Settlement":                   ["✗","✔","✔"],
        "Accountant Dashboard":                      ["✗","✔","✔"],
        "KPI & Performance Reviews":                 ["✗","✔","✔"],
        "Task Assignment & Tracking":                ["✗","✔","✔"],
        "Performance Reports":                       ["✗","✔","✔"],
        "Goal Setting":                              ["✗","✗","✔"],
        "Company Announcements":                     ["✔","✔","✔"],
        "Helpdesk Ticket System":                    ["Email","✔","✔"],
        "Document Generation (Offer/Exp letters)":   ["✗","✔","✔"],
        "AI Chat Assistant (24/7)":                  ["✗","✔","✔"],
        "Real-time Analytics Dashboard":             ["Basic","✔","✔"],
        "Custom Reports & Exports":                  ["✗","✔","✔"],
        "Predictive Attrition Insights":             ["✗","✗","✔"],
        "Cloud Hosting (managed)":                   ["✔","✔","✔"],
        "Mobile App (iOS & Android)":                ["✗","✔","✔"],
        "API Access":                                ["✗","REST","Full + Webhooks"],
        "Custom Branding / White-label":             ["✗","✗","✔"],
        "Dedicated Account Manager":                 ["✗","✗","✔"],
        "SLA Uptime Guarantee":                      ["99.5%","99.7%","99.9%"],
        "Max Employees":                             ["Up to 50","Up to 250","Unlimited"],
        "Storage":                                   ["5 GB","25 GB","Unlimited"],
        "Support Type":                              ["Email","Email + Chat","24×7 Priority"],
        "Onboarding Assistance":                     ["Self-serve","Guided","White-glove"],
    }

    col_widths = [Cm(6.5), Cm(3.0), Cm(3.2), Cm(3.5)]

    tbl = doc.add_table(rows=1, cols=num_cols)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl.style = 'Table Grid'

    # Header row
    hdr_cells = tbl.rows[0].cells
    hdr_cells[0].text = ""
    set_cell_bg(hdr_cells[0], "0D2B55")
    for i, plan in enumerate(plans):
        cell = hdr_cells[i+1]
        set_cell_bg(cell, plan["color_hex"])
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_before = Pt(4)
        p.paragraph_format.space_after  = Pt(2)
        r = p.add_run(plan["name"])
        r.bold = True
        r.font.size = Pt(11)
        r.font.color.rgb = WHITE
        p2 = cell.add_paragraph()
        p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r2 = p2.add_run(plan["price"])
        r2.font.size = Pt(9)
        r2.font.color.rgb = RGBColor(0xDD, 0xEE, 0xFF)

    # Set column widths
    for row in tbl.rows:
        for i, cell in enumerate(row.cells):
            cell.width = col_widths[i]

    # Data rows
    for group_name, features in feature_groups:
        # Group header row
        row = tbl.add_row()
        for i, cell in enumerate(row.cells):
            set_cell_bg(cell, "E8EEF6")
            if i == 0:
                p = cell.paragraphs[0]
                r = p.add_run(f"  {group_name}")
                r.bold = True
                r.font.size = Pt(10)
                r.font.color.rgb = NAVY
            else:
                cell.text = ""
            cell.width = col_widths[i]

        for feat in features:
            row = tbl.add_row()
            cells = row.cells
            # Feature name
            cells[0].text = f"  {feat}"
            cells[0].paragraphs[0].runs[0].font.size = Pt(9.5)
            cells[0].width = col_widths[0]

            vals = availability.get(feat, ["","",""])
            for i, v in enumerate(vals):
                c = cells[i+1]
                c.width = col_widths[i+1]
                p = c.paragraphs[0]
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                r = p.add_run(v)
                r.font.size = Pt(9.5)
                if v in ("✔", "Full", "Full + Custom"):
                    r.font.color.rgb = RGBColor(0x1A, 0x8A, 0x4A)
                    r.bold = True
                elif v == "✗":
                    r.font.color.rgb = RGBColor(0xCC, 0x33, 0x33)
                elif v in ("Basic", "Email"):
                    r.font.color.rgb = RGBColor(0xC8, 0x7D, 0x00)

    return tbl

# ─────────────────────────────────────────────────────────────────────────────
#  WORD DOCUMENT
# ─────────────────────────────────────────────────────────────────────────────

def generate_word_proposal():
    doc = Document()

    # Page margins
    for section in doc.sections:
        section.top_margin    = Cm(2.0)
        section.bottom_margin = Cm(2.0)
        section.left_margin   = Cm(2.5)
        section.right_margin  = Cm(2.0)

    # ── Cover Page ─────────────────────────────────────────────────────────
    add_cover_page(doc)

    # ── Table of Contents placeholder ─────────────────────────────────────
    add_heading(doc, "Table of Contents", level=1, color=NAVY, space_before=6)
    toc_items = [
        ("1.", "Executive Summary"),
        ("2.", "About Seawind Solution Pvt. Ltd."),
        ("3.", "Problem Statement"),
        ("4.", "Our Solution: HRMS Pro"),
        ("5.", "Key Features & Modules"),
        ("6.", "Subscription Plans & Pricing"),
        ("7.", "Implementation & Onboarding"),
        ("8.", "Security & Compliance"),
        ("9.", "Return on Investment (ROI)"),
        ("10.", "Why Choose HRMS Pro?"),
        ("11.", "Next Steps & Call to Action"),
        ("12.", "Terms & Conditions"),
    ]
    tbl_toc = doc.add_table(rows=len(toc_items), cols=2)
    tbl_toc.alignment = WD_TABLE_ALIGNMENT.LEFT
    for i, (num, title) in enumerate(toc_items):
        tbl_toc.cell(i,0).text = num
        tbl_toc.cell(i,0).paragraphs[0].runs[0].font.size = Pt(11)
        tbl_toc.cell(i,0).paragraphs[0].runs[0].bold = True
        tbl_toc.cell(i,0).paragraphs[0].runs[0].font.color.rgb = BLUE
        tbl_toc.cell(i,1).text = title
        tbl_toc.cell(i,1).paragraphs[0].runs[0].font.size = Pt(11)
    doc.add_page_break()

    # ── 1. Executive Summary ───────────────────────────────────────────────
    add_heading(doc, "1. Executive Summary", level=1)
    add_horizontal_rule(doc)
    add_para(doc,
        f"We are pleased to present this formal business proposal for HRMS Pro — an AI-Powered "
        f"Human Resource Management System developed by {COMPANY}. This document outlines our "
        f"Software-as-a-Service (SaaS) offering, subscription plans, and how HRMS Pro can transform "
        f"your organisation's HR operations.", size=11)
    add_para(doc,
        "HRMS Pro is a cloud-hosted, enterprise-grade platform that consolidates employee management, "
        "GPS attendance, payroll, leave, performance, task tracking, and AI-powered assistance into a "
        "single unified portal — accessible from any device, anywhere.", size=11)

    highlights = [
        ("🎯 Audience:",     "HR Managers, CFOs, CEOs, and Business Owners looking to modernise HR."),
        ("💼 Delivery:",     "100% cloud-based SaaS — no installation required. Go live in 48 hours."),
        ("📈 ROI:",          "Clients report 40–60% reduction in HR administrative overhead."),
        ("🔒 Security:",     "End-to-end encryption, role-based access, and audit trail logging."),
        ("🤖 AI-Powered:",   "Built-in AI Assistant handles employee queries round-the-clock."),
    ]
    tbl_hl = doc.add_table(rows=len(highlights), cols=2)
    tbl_hl.alignment = WD_TABLE_ALIGNMENT.LEFT
    tbl_hl.style = 'Table Grid'
    for i, (label, desc) in enumerate(highlights):
        c0 = tbl_hl.cell(i, 0)
        c1 = tbl_hl.cell(i, 1)
        set_cell_bg(c0, "0D2B55")
        set_cell_bg(c1, "F4F6F9")
        c0.width = Cm(4.5)
        p0 = c0.paragraphs[0]
        r0 = p0.add_run(label)
        r0.bold = True
        r0.font.size = Pt(10)
        r0.font.color.rgb = WHITE
        c1.text = desc
        c1.paragraphs[0].runs[0].font.size = Pt(10)

    doc.add_paragraph()

    # ── 2. About the Company ───────────────────────────────────────────────
    add_heading(doc, "2. About Seawind Solution Pvt. Ltd.", level=1)
    add_horizontal_rule(doc)
    add_para(doc,
        "Seawind Solution Pvt. Ltd. is a technology company specialising in enterprise software, "
        "AI integration, and cloud solutions. Our team of experienced developers and HR technology "
        "consultants have built HRMS Pro from the ground up based on real-world HR pain-points.", size=11)
    for item in [
        "Established with a mission to democratise enterprise HR technology for businesses of all sizes.",
        "15+ enterprise clients across manufacturing, IT, education, and services sectors.",
        "Dedicated support team available Monday to Saturday, 9 AM – 7 PM.",
        "ISO-compliant development processes with rigorous QA and data security standards.",
    ]:
        add_bullet(doc, item)

    # ── 3. Problem Statement ───────────────────────────────────────────────
    add_heading(doc, "3. Problem Statement", level=1)
    add_horizontal_rule(doc)
    add_para(doc, "Modern organisations face the following HR challenges:", size=11)
    problems = [
        ("Manual & Error-Prone Processes",
         "Spreadsheet-driven HR leads to payroll errors, attendance discrepancies, and compliance risks."),
        ("Fragmented Systems",
         "HR data spread across multiple tools (attendance, payroll, leave) causes data silos and inefficiency."),
        ("High Administrative Overhead",
         "HR teams spend 60–70% of their time on repetitive administrative tasks instead of strategic work."),
        ("Poor Employee Experience",
         "Employees lack a self-service portal, leading to constant HR interruptions for basic queries."),
        ("No Real-time Visibility",
         "Leadership lacks real-time dashboards to make informed workforce decisions."),
        ("Compliance Risks",
         "Manual payroll is prone to PF/ESI/TDS computation errors, creating legal exposure."),
    ]
    tbl_prob = doc.add_table(rows=len(problems), cols=2)
    tbl_prob.style = 'Table Grid'
    tbl_prob.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, (title_p, desc_p) in enumerate(problems):
        c0 = tbl_prob.cell(i, 0)
        c1 = tbl_prob.cell(i, 1)
        set_cell_bg(c0, "1A6BC4")
        c0.width = Cm(5.0)
        p0 = c0.paragraphs[0]
        r0 = p0.add_run(title_p)
        r0.bold = True
        r0.font.size = Pt(10)
        r0.font.color.rgb = WHITE
        c1.text = desc_p
        c1.paragraphs[0].runs[0].font.size = Pt(10)
    doc.add_paragraph()

    # ── 4. Our Solution ────────────────────────────────────────────────────
    add_heading(doc, "4. Our Solution: HRMS Pro", level=1)
    add_horizontal_rule(doc)
    add_para(doc,
        "HRMS Pro is a next-generation, cloud-native Human Resource Management System that replaces "
        "fragmented tools with a single, intelligent platform. Built on a modern technology stack "
        "(Python FastAPI, MySQL, REST APIs), it is fast, reliable, and infinitely scalable.", size=11)
    add_para(doc, "Core Pillars:", bold=True, color=NAVY, size=12, space_before=8)
    pillars = [
        ("🗂  Centralised Employee Data", "Single source of truth for all employee information."),
        ("📍  GPS Smart Attendance",      "Geo-fenced check-in/out with live maps and automated timesheets."),
        ("🤖  AI Assistant",             "24/7 intelligent chat for leave, payroll, and policy queries."),
        ("💰  Automated Payroll",         "Error-free salary processing with statutory compliance."),
        ("📊  Analytics & Insights",      "Real-time dashboards and custom reports for leadership."),
        ("📱  Mobile-First Access",       "Native iOS & Android apps for on-the-go HR management."),
    ]
    for label, desc in pillars:
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(3)
        r1 = p.add_run(f"{label}  ")
        r1.bold = True
        r1.font.size = Pt(11)
        r1.font.color.rgb = BLUE
        r2 = p.add_run(desc)
        r2.font.size = Pt(11)
    doc.add_paragraph()

    # ── 5. Key Features ────────────────────────────────────────────────────
    add_heading(doc, "5. Key Features & Modules", level=1)
    add_horizontal_rule(doc)

    modules = [
        ("👤  Employee Management",
         ["Complete employee lifecycle management (hire to retire)",
          "Custom fields: personal, professional, emergency contacts, documents",
          "Role-based portal access for Admin, HR, Employee, Accountant"]),
        ("📍  GPS Attendance System",
         ["Geo-fenced check-in / check-out with location validation",
          "Attendance regularization and correction requests",
          "Automated monthly attendance reports"]),
        ("🗓  Leave Management",
         ["Multi-type leave: Casual, Sick, Earned, Maternity, Comp-off",
          "Sandwich Leave Policy enforcement",
          "Leave balance tracking and auto-approval workflows"]),
        ("💵  Payroll & Salary Processing",
         ["Automatic CTC-to-in-hand computation",
          "PF, ESI, Professional Tax, and TDS deductions",
          "Digital payslip generation and distribution"]),
        ("📈  Performance Management",
         ["KPI definition and real-time tracking",
          "360° performance reviews with manager and peer feedback",
          "AI-powered performance insights and trend analysis"]),
        ("✅  Task Management",
         ["Assign tasks with priorities, deadlines, and dependencies",
          "Kanban-style board view for team and individual tasks",
          "SLA-based escalation and completion tracking"]),
        ("🎫  Helpdesk / Support",
         ["Employee ticket submission and real-time status",
          "Escalation matrix with resolution SLA",
          "Admin dashboard for ticket analytics"]),
        ("📄  Document Generation",
         ["Auto-generate offer letters, experience certificates, NOCs",
          "Full & Final Settlement documents",
          "Company announcement distribution system"]),
        ("🤖  AI Chat Assistant",
         ["Natural language understanding for HR policy queries",
          "Instant answers on leave balance, payslips, and policies",
          "24/7 availability — no HR intervention needed"]),
        ("📊  Analytics Dashboard",
         ["Real-time workforce strength and attendance analytics",
          "Department-wise payroll and cost centre reports",
          "Predictive attrition risk scoring (Enterprise plan)"]),
    ]

    for mod_name, mod_features in modules:
        add_heading(doc, mod_name, level=2, color=BLUE, space_before=10, space_after=2, size=12)
        for feat in mod_features:
            add_bullet(doc, feat, size=10.5)

    doc.add_page_break()

    # ── 6. Subscription Plans ──────────────────────────────────────────────
    add_heading(doc, "6. Subscription Plans & Pricing", level=1)
    add_horizontal_rule(doc)
    add_para(doc,
        "HRMS Pro is available in three subscription tiers designed to grow with your business. "
        "All plans are billed annually. Monthly billing available at a 15% premium.", size=11)

    plans = [
        {"name": "🌱 Starter",       "price": "₹4,999 / month",  "color_hex": "1A6BC4"},
        {"name": "🚀 Professional",  "price": "₹11,999 / month", "color_hex": "00896F"},
        {"name": "🏆 Enterprise",    "price": "Custom Pricing",   "color_hex": "8B2FC9"},
    ]

    build_plan_table(doc, plans)
    doc.add_paragraph()

    # Plan highlight boxes
    plan_details = [
        {
            "name":   "🌱 Starter Plan — ₹4,999/month",
            "color":  "E8F4FD",
            "border": "1A6BC4",
            "ideal":  "Ideal for: Startups and small businesses (up to 50 employees)",
            "desc":   "Get started with core HR digitisation. Covers employee database, basic payroll, "
                      "GPS attendance, and leave tracking. Perfect for businesses taking their first step "
                      "away from spreadsheets.",
        },
        {
            "name":   "🚀 Professional Plan — ₹11,999/month",
            "color":  "E8F8EF",
            "border": "00896F",
            "ideal":  "Ideal for: Growing companies (up to 250 employees)",
            "desc":   "Full-featured HRMS with AI Assistant, mobile app, performance management, "
                      "task tracking, and advanced payroll. Our most popular plan — chosen by 70% of our clients.",
        },
        {
            "name":   "🏆 Enterprise Plan — Custom Pricing",
            "color":  "F3E8FD",
            "border": "8B2FC9",
            "ideal":  "Ideal for: Large enterprises with 250+ employees or custom requirements",
            "desc":   "Everything in Professional plus: custom branding / white-labelling, unlimited employees, "
                      "predictive AI analytics, dedicated account manager, 99.9% SLA uptime, custom integrations "
                      "(ERP, SAP, Tally), and a full white-glove onboarding experience.",
        },
    ]

    for pd in plan_details:
        tbl_pd = doc.add_table(rows=1, cols=1)
        tbl_pd.alignment = WD_TABLE_ALIGNMENT.CENTER
        cell = tbl_pd.cell(0, 0)
        set_cell_bg(cell, pd["color"].replace("#",""))
        p_name = cell.paragraphs[0]
        p_name.paragraph_format.space_before = Pt(6)
        rn = p_name.add_run(pd["name"])
        rn.bold = True
        rn.font.size = Pt(12)
        rn.font.color.rgb = NAVY

        p_ideal = cell.add_paragraph()
        ri = p_ideal.add_run(pd["ideal"])
        ri.italic = True
        ri.font.size = Pt(10)
        ri.font.color.rgb = DARK_GRAY

        p_desc = cell.add_paragraph()
        p_desc.paragraph_format.space_after = Pt(8)
        rd = p_desc.add_run(pd["desc"])
        rd.font.size = Pt(10)
        doc.add_paragraph()

    add_para(doc,
        "* All prices exclusive of applicable taxes (GST @ 18%). "
        "Volume discounts available for multi-year contracts. "
        "Contact our sales team for a custom quote.",
        size=9.5, italic=True, color=MID_GRAY)

    doc.add_page_break()

    # ── 7. Implementation & Onboarding ────────────────────────────────────
    add_heading(doc, "7. Implementation & Onboarding", level=1)
    add_horizontal_rule(doc)
    add_para(doc,
        "We ensure a smooth, zero-disruption go-live through our structured onboarding process:", size=11)

    phases = [
        ("Phase 1", "Discovery & Configuration (Day 1–2)",
         "Requirements gathering, company structure setup, role configuration, and branding."),
        ("Phase 2", "Data Migration (Day 2–5)",
         "Employee data import, historical attendance, and payroll records migration."),
        ("Phase 3", "Training (Day 5–7)",
         "Admin and HR team training sessions (online), user manuals, and video tutorials."),
        ("Phase 4", "Go-Live & Hypercare (Day 7–30)",
         "Live system monitoring, immediate support, and real-time query resolution."),
        ("Phase 5", "Steady State & Optimisation (Month 2+)",
         "Monthly review calls, feature requests, and continuous platform improvements."),
    ]

    tbl_ph = doc.add_table(rows=len(phases), cols=3)
    tbl_ph.style = 'Table Grid'
    for i, (ph, title_ph, desc_ph) in enumerate(phases):
        c0 = tbl_ph.cell(i, 0)
        c1 = tbl_ph.cell(i, 1)
        c2 = tbl_ph.cell(i, 2)
        set_cell_bg(c0, "0D2B55")
        c0.width = Cm(1.8)
        p0 = c0.paragraphs[0]
        r0 = p0.add_run(ph)
        r0.bold = True
        r0.font.size = Pt(10)
        r0.font.color.rgb = WHITE
        p0.alignment = WD_ALIGN_PARAGRAPH.CENTER

        c1.width = Cm(4.8)
        r1 = c1.paragraphs[0].add_run(title_ph)
        r1.bold = True
        r1.font.size = Pt(10)
        r1.font.color.rgb = BLUE

        c2.text = desc_ph
        c2.paragraphs[0].runs[0].font.size = Pt(10)

    doc.add_paragraph()

    # ── 8. Security & Compliance ───────────────────────────────────────────
    add_heading(doc, "8. Security & Compliance", level=1)
    add_horizontal_rule(doc)
    for item in [
        "🔑  Role-based access control — every user sees only what they are permitted to.",
        "🔒  AES-256 encryption for data at rest; TLS 1.3 for data in transit.",
        "📋  Complete audit trail — every action is logged with user, timestamp, and IP.",
        "☁️   Cloud infrastructure hosted on dedicated servers with automated daily backups.",
        "🛡️   GDPR-aligned data policies; data residency options available on Enterprise plan.",
        "📊  Statutory compliance: automated PF, ESI, PT, TDS calculations and reports.",
    ]:
        add_bullet(doc, item, size=10.5)

    # ── 9. ROI ────────────────────────────────────────────────────────────
    add_heading(doc, "9. Return on Investment (ROI)", level=1)
    add_horizontal_rule(doc)
    add_para(doc,
        "Based on data from our existing clients, organisations typically achieve full ROI within "
        "3–6 months of going live:", size=11)

    roi_data = [
        ("Metric",                             "Before HRMS Pro",   "After HRMS Pro",    "Improvement"),
        ("HR admin hours per week",            "40–50 hours",       "10–15 hours",       "↓ 70%"),
        ("Payroll processing time",            "3–5 days",          "< 2 hours",         "↓ 95%"),
        ("Attendance discrepancy incidents",   "15–20/month",       "< 2/month",         "↓ 90%"),
        ("Employee query resolution time",     "24–48 hours",       "< 5 minutes (AI)",  "↓ 97%"),
        ("Compliance errors",                  "5–10/quarter",      "Near zero",         "↓ 98%"),
        ("HR cost as % of payroll",            "8–12%",             "3–5%",              "↓ 55%"),
    ]

    tbl_roi = doc.add_table(rows=len(roi_data), cols=4)
    tbl_roi.style = 'Table Grid'
    for i, row_data in enumerate(roi_data):
        for j, val in enumerate(row_data):
            c = tbl_roi.cell(i, j)
            p = c.paragraphs[0]
            r = p.add_run(val)
            r.font.size = Pt(10)
            if i == 0:
                set_cell_bg(c, "0D2B55")
                r.bold = True
                r.font.color.rgb = WHITE
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            elif j == 3:
                set_cell_bg(c, "E8F8EF")
                r.bold = True
                r.font.color.rgb = RGBColor(0x1A, 0x8A, 0x4A)
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            elif i % 2 == 0:
                set_cell_bg(c, "F4F6F9")

    doc.add_paragraph()

    # ── 10. Why Choose HRMS Pro ────────────────────────────────────────────
    add_heading(doc, "10. Why Choose HRMS Pro?", level=1)
    add_horizontal_rule(doc)
    differentiators = [
        ("🇮🇳 Made for India",
         "Built with Indian payroll laws, PF/ESI/PT compliance, and multilingual support in mind."),
        ("⚡ Rapid Deployment",
         "Go live in 48 hours — not months. No infrastructure setup required."),
        ("🤖 AI-Native",
         "Not an add-on — AI is embedded throughout: assistant, analytics, and recommendations."),
        ("📱 True Mobile-First",
         "Native mobile apps (not just a mobile website) for a premium employee experience."),
        ("📞 Dedicated Support",
         "Real humans available via call, email, and chat — not just a ticketing bot."),
        ("🔄 Continuous Updates",
         "Monthly feature releases and compliance updates at no additional cost."),
        ("💲 Transparent Pricing",
         "No hidden fees, no per-module charges — one price covers everything in your plan."),
    ]
    for label, desc in differentiators:
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(4)
        r1 = p.add_run(f"{label}:  ")
        r1.bold = True
        r1.font.size = Pt(11)
        r1.font.color.rgb = NAVY
        r2 = p.add_run(desc)
        r2.font.size = Pt(11)

    # ── 11. Next Steps ────────────────────────────────────────────────────
    doc.add_page_break()
    add_heading(doc, "11. Next Steps & Call to Action", level=1)
    add_horizontal_rule(doc)
    add_para(doc,
        "We invite you to take the next step towards modernising your HR operations:", size=11)
    steps = [
        "📅  Schedule a FREE 45-minute live demo — see HRMS Pro in action with your own data.",
        "🆓  Start a FREE 30-day trial — no credit card required, full Professional plan access.",
        "📞  Speak with our HR Technology Consultant: +91 XXXXX XXXXX",
        "📧  Email us: sales@seawindsolution.com",
        "🌐  Visit: www.seawindsolution.com/hrms-pro",
    ]
    for step in steps:
        add_bullet(doc, step, size=11)

    add_para(doc,
        "\nOur team is ready to provide a personalised proposal tailored to your company's size, "
        "industry, and budget. We look forward to partnering with you.",
        size=11, space_before=10)

    # ── 12. Terms & Conditions ────────────────────────────────────────────
    add_heading(doc, "12. Terms & Conditions", level=1)
    add_horizontal_rule(doc)
    tc_items = [
        "Pricing is valid for 30 days from the date of this proposal.",
        "Annual subscription is payable in advance; monthly billing attracts a 15% premium.",
        "Data portability: clients can export all their data at any time in standard formats (CSV/PDF).",
        "Cancellation: 30-day notice period required; data retained for 60 days post-cancellation.",
        "Uptime SLA credits: 5% credit for every 0.1% below guaranteed uptime (applies to Enterprise plan).",
        "All prices are exclusive of GST (18%). GST invoice will be issued on payment.",
        "Custom development requests are scoped and quoted separately.",
    ]
    for item in tc_items:
        add_bullet(doc, item, size=10)

    # Footer
    add_horizontal_rule(doc, "0D2B55")
    add_para(doc,
        f"HRMS Pro — Confidential Business Proposal  |  {COMPANY}  |  {TODAY}",
        size=9, color=MID_GRAY, italic=True, align=WD_ALIGN_PARAGRAPH.CENTER)

    output_path = r"d:\hrms_agent\HRMS_SaaS_Proposal.docx"
    doc.save(output_path)
    print(f"Word proposal saved -> {output_path}")
    return output_path


# ─────────────────────────────────────────────────────────────────────────────
#  POWERPOINT PRESENTATION
# ─────────────────────────────────────────────────────────────────────────────

def px(val):
    """Convert inches to EMU."""
    return int(val * 914400)

def add_rect(slide, left, top, width, height, fill_color, line_color=None, line_width=0):
    from pptx.util import Pt as PPt
    from pptx.enum.shapes import MSO_SHAPE_TYPE
    shape = slide.shapes.add_shape(1, px(left), px(top), px(width), px(height))
    shape.fill.solid()
    shape.fill.fore_color.rgb = fill_color
    if line_color:
        shape.line.color.rgb = line_color
        shape.line.width = PPt(line_width) if line_width else 0
    else:
        shape.line.fill.background()
    return shape

def add_text_box(slide, text, left, top, width, height,
                 font_size=18, bold=False, italic=False,
                 color=PWHT, align=PP_ALIGN.LEFT,
                 wrap=True, font_name="Calibri"):
    from pptx.util import Pt as PPt
    txBox = slide.shapes.add_textbox(px(left), px(top), px(width), px(height))
    tf = txBox.text_frame
    tf.word_wrap = wrap
    p = tf.paragraphs[0]
    p.alignment = align
    run = p.add_run()
    run.text = text
    run.font.size = PPt(font_size)
    run.font.bold = bold
    run.font.italic = italic
    run.font.color.rgb = color
    run.font.name = font_name
    return txBox

def slide_bg(slide, color):
    background = slide.background
    fill = background.fill
    fill.solid()
    fill.fore_color.rgb = color

def generate_pptx():
    prs = Presentation()
    prs.slide_width  = px(13.33)
    prs.slide_height = px(7.5)

    blank_layout = prs.slide_layouts[6]   # completely blank

    # ── Slide 1: Title / Cover ─────────────────────────────────────────────
    slide = prs.slides.add_slide(blank_layout)
    slide_bg(slide, PNAV)

    # Teal accent bar left
    add_rect(slide, 0, 0, 0.12, 7.5, PACC)

    # Product name
    add_text_box(slide, "HRMS Pro", 0.35, 1.2, 9.0, 1.4,
                 font_size=64, bold=True, color=PWHT, align=PP_ALIGN.LEFT)

    # Subtitle
    add_text_box(slide, "AI-Powered Human Resource Management System",
                 0.35, 2.6, 9.5, 0.7,
                 font_size=22, bold=False, color=PACC, align=PP_ALIGN.LEFT)

    # Divider
    add_rect(slide, 0.35, 3.4, 6.0, 0.04, PBLU)

    # Tag line
    add_text_box(slide, "SaaS Business Proposal  •  Powered by Seawind Solution Pvt. Ltd.",
                 0.35, 3.55, 9.5, 0.5,
                 font_size=16, italic=True, color=PMID, align=PP_ALIGN.LEFT)

    add_text_box(slide, TODAY,
                 0.35, 4.2, 4.0, 0.4,
                 font_size=14, color=PMID, align=PP_ALIGN.LEFT)

    # Gold badge
    add_rect(slide, 9.5, 1.5, 3.5, 1.8, PGOLD)
    add_text_box(slide, "🏆 ENTERPRISE\nGRADE HRMS", 9.55, 1.65, 3.3, 1.4,
                 font_size=18, bold=True, color=PNAV, align=PP_ALIGN.CENTER)

    # ── Slide 2: Agenda ────────────────────────────────────────────────────
    slide = prs.slides.add_slide(blank_layout)
    slide_bg(slide, PLGT)
    add_rect(slide, 0, 0, 13.33, 1.2, PNAV)
    add_text_box(slide, "Agenda", 0.4, 0.2, 10, 0.8,
                 font_size=32, bold=True, color=PWHT, align=PP_ALIGN.LEFT)

    items = [
        ("01", "Problem Statement",           "The HR challenges facing modern organisations"),
        ("02", "Our Solution: HRMS Pro",      "Unified, AI-powered HR platform"),
        ("03", "Key Modules & Features",      "10 powerful HR modules"),
        ("04", "Subscription Plans",          "Starter | Professional | Enterprise"),
        ("05", "Implementation Roadmap",      "48-hour go-live process"),
        ("06", "ROI & Business Impact",       "Measurable results from day one"),
        ("07", "Why HRMS Pro?",              "Our competitive differentiators"),
        ("08", "Next Steps",                  "Demo, trial, and partnership"),
    ]

    cols = [(0.3, 4.5), (6.8, 5.8)]
    for idx, (num, title_ag, sub) in enumerate(items):
        col_x, col_w = cols[idx // 4]
        row_y = 1.4 + (idx % 4) * 1.45

        add_rect(slide, col_x, row_y, 0.7, 0.7, PBLU)
        add_text_box(slide, num, col_x, row_y, 0.7, 0.7,
                     font_size=17, bold=True, color=PWHT, align=PP_ALIGN.CENTER)
        add_text_box(slide, title_ag, col_x + 0.8, row_y - 0.05, col_w - 0.9, 0.45,
                     font_size=16, bold=True, color=PNAV, align=PP_ALIGN.LEFT)
        add_text_box(slide, sub, col_x + 0.8, row_y + 0.38, col_w - 0.9, 0.4,
                     font_size=11, color=PMID, align=PP_ALIGN.LEFT)

    # ── Slide 3: Problem Statement ─────────────────────────────────────────
    slide = prs.slides.add_slide(blank_layout)
    slide_bg(slide, PWHT)
    add_rect(slide, 0, 0, 13.33, 1.2, PNAV)
    add_text_box(slide, "The Problem", 0.4, 0.1, 10, 0.9,
                 font_size=36, bold=True, color=PWHT)
    add_text_box(slide, "Why traditional HR is broken", 0.4, 0.85, 10, 0.45,
                 font_size=16, italic=True, color=PACC)

    problems_ppt = [
        ("📋", "Manual & Error-Prone",    "Spreadsheets = payroll errors & compliance risk"),
        ("🔀", "Fragmented Systems",       "Attendance, payroll, leave in separate tools"),
        ("⏰", "High Admin Overhead",     "HR spends 70% of time on repetitive tasks"),
        ("😞", "Poor Employee Experience","No self-service → constant HR interruptions"),
        ("📉", "No Real-time Visibility", "Leaders lack data for workforce decisions"),
        ("⚖️", "Compliance Risk",          "Manual PF/ESI/TDS errors create legal exposure"),
    ]

    for i, (icon, title_pb, desc_pb) in enumerate(problems_ppt):
        col = i % 3
        row = i // 3
        x = 0.25 + col * 4.35
        y = 1.45 + row * 2.7

        add_rect(slide, x, y, 4.1, 2.4, PPTXColor(0xF4, 0xF6, 0xF9), PBLU, 1)
        add_text_box(slide, icon,    x + 0.15, y + 0.15, 0.6, 0.6, font_size=24, color=PBLU)
        add_text_box(slide, title_pb, x + 0.15, y + 0.65, 3.8, 0.5,
                     font_size=14, bold=True, color=PNAV)
        add_text_box(slide, desc_pb, x + 0.15, y + 1.15, 3.8, 0.9,
                     font_size=11, color=PDRK, wrap=True)

    # ── Slide 4: HRMS Pro Overview ─────────────────────────────────────────
    slide = prs.slides.add_slide(blank_layout)
    slide_bg(slide, PNAV)
    add_rect(slide, 0, 0, 13.33, 1.4, PPTXColor(0x08, 0x1A, 0x3C))
    add_text_box(slide, "HRMS Pro — One Platform. Everything HR.",
                 0.4, 0.15, 12, 0.9, font_size=34, bold=True, color=PWHT)
    add_text_box(slide, "Cloud-native • AI-powered • Mobile-first",
                 0.4, 0.95, 10, 0.45, font_size=16, color=PACC)

    pillars_ppt = [
        ("🗂", "Centralised\nEmployee Data"),
        ("📍", "GPS Smart\nAttendance"),
        ("🤖", "AI Chat\nAssistant"),
        ("💰", "Automated\nPayroll"),
        ("📊", "Analytics\nDashboard"),
        ("📱", "Mobile\nApp"),
    ]
    for i, (icon_p, label_p) in enumerate(pillars_ppt):
        x = 0.3 + i * 2.12
        add_rect(slide, x, 1.7, 1.9, 2.2, PPTXColor(0x1A, 0x3B, 0x70))
        add_text_box(slide, icon_p, x + 0.15, 1.8, 1.6, 0.6, font_size=26, color=PACC)
        add_text_box(slide, label_p, x + 0.05, 2.45, 1.8, 0.9,
                     font_size=13, bold=True, color=PWHT, align=PP_ALIGN.CENTER)

    add_rect(slide, 0.3, 4.15, 12.7, 0.04, PACC)
    add_text_box(slide,
                 "🚀 Go live in 48 hours • No installation required • Used by 15+ enterprises across India",
                 0.3, 4.25, 12.7, 0.6, font_size=14, bold=True, color=PGOLD, align=PP_ALIGN.CENTER)

    stats = [
        ("15+", "Enterprise Clients"),
        ("19+", "API Endpoints"),
        ("10",  "HR Modules"),
        ("99.9%","Uptime SLA"),
        ("48h",  "Go-Live Time"),
    ]
    for i, (val, lbl) in enumerate(stats):
        x = 0.6 + i * 2.45
        add_rect(slide, x, 5.1, 2.1, 1.8, PPTXColor(0x1A, 0x3B, 0x70))
        add_text_box(slide, val, x, 5.2, 2.1, 0.85,
                     font_size=28, bold=True, color=PACC, align=PP_ALIGN.CENTER)
        add_text_box(slide, lbl, x, 6.0, 2.1, 0.55,
                     font_size=11, color=PWHT, align=PP_ALIGN.CENTER)

    # ── Slide 5: Key Modules ───────────────────────────────────────────────
    slide = prs.slides.add_slide(blank_layout)
    slide_bg(slide, PLGT)
    add_rect(slide, 0, 0, 13.33, 1.2, PNAV)
    add_text_box(slide, "10 Powerful Modules", 0.4, 0.1, 12, 0.9,
                 font_size=36, bold=True, color=PWHT)

    mods = [
        ("👤", "Employee\nManagement",       "Hire-to-retire lifecycle & documents"),
        ("📍", "GPS Attendance",              "Geo-fenced, real-time tracking"),
        ("🗓", "Leave Management",            "All leave types + policy enforcement"),
        ("💵", "Payroll Processing",          "Auto CTC computation + payslips"),
        ("📈", "Performance Mgmt.",           "KPI, 360° reviews, AI insights"),
        ("✅", "Task Management",             "Kanban board, SLA escalation"),
        ("🎫", "Helpdesk / Support",          "Ticket system with escalation matrix"),
        ("📄", "Document Generation",         "Offer letters, FnF, certificates"),
        ("🤖", "AI Chat Assistant",           "24/7 natural language HR support"),
        ("📊", "Analytics Dashboard",         "Real-time reports & predictive AI"),
    ]

    for i, (icon_m, name_m, desc_m) in enumerate(mods):
        col = i % 5
        row = i // 5
        x = 0.18 + col * 2.58
        y = 1.4 + row * 2.85

        bg_color = PBLU if i % 2 == 0 else PPTXColor(0x00, 0x89, 0x6F)
        add_rect(slide, x, y, 2.38, 2.55, bg_color)
        add_text_box(slide, icon_m, x + 0.7, y + 0.15, 1.0, 0.55, font_size=22, color=PWHT)
        add_text_box(slide, name_m, x + 0.05, y + 0.75, 2.28, 0.65,
                     font_size=12, bold=True, color=PWHT, align=PP_ALIGN.CENTER)
        add_text_box(slide, desc_m, x + 0.05, y + 1.45, 2.28, 0.8,
                     font_size=9.5, color=PPTXColor(0xCC, 0xEE, 0xFF), align=PP_ALIGN.CENTER, wrap=True)

    # ── Slide 6: Subscription Plans ────────────────────────────────────────
    slide = prs.slides.add_slide(blank_layout)
    slide_bg(slide, PWHT)
    add_rect(slide, 0, 0, 13.33, 1.2, PNAV)
    add_text_box(slide, "Subscription Plans", 0.4, 0.1, 12, 0.9,
                 font_size=36, bold=True, color=PWHT)
    add_text_box(slide, "Choose the plan that scales with your business",
                 0.4, 0.88, 12, 0.4, font_size=14, italic=True, color=PACC)

    plan_cards = [
        {
            "name":    "🌱 Starter",
            "price":   "₹4,999",
            "period":  "/ month",
            "ideal":   "Up to 50 employees",
            "bullets": ["Core HR & Employee DB","GPS Attendance","Basic Payroll","Leave Management",
                        "Company Announcements","Email Support","5 GB Storage"],
            "bg":      PBLU,
            "badge":   "",
        },
        {
            "name":    "🚀 Professional",
            "price":   "₹11,999",
            "period":  "/ month",
            "ideal":   "Up to 250 employees",
            "bullets": ["Everything in Starter +","AI Chat Assistant","Mobile App (iOS & Android)",
                        "Full Payroll Suite + FnF","Performance & Task Mgmt","Advanced Analytics",
                        "25 GB Storage"],
            "bg":      PPTXColor(0x00, 0x89, 0x6F),
            "badge":   "⭐ MOST POPULAR",
        },
        {
            "name":    "🏆 Enterprise",
            "price":   "Custom",
            "period":  "pricing",
            "ideal":   "Unlimited employees",
            "bullets": ["Everything in Professional +","Custom Branding / White-label",
                        "Predictive AI Analytics","Dedicated Account Manager",
                        "99.9% SLA Uptime","ERP / SAP Integration","White-glove Onboarding"],
            "bg":      PPTXColor(0x8B, 0x2F, 0xC9),
            "badge":   "🏆 ENTERPRISE",
        },
    ]

    for i, card in enumerate(plan_cards):
        x = 0.35 + i * 4.28
        add_rect(slide, x, 1.35, 4.0, 5.8, card["bg"])

        if card["badge"]:
            add_rect(slide, x + 0.05, 1.35, 3.9, 0.42, PGOLD)
            add_text_box(slide, card["badge"], x + 0.05, 1.36, 3.9, 0.38,
                         font_size=12, bold=True, color=PNAV, align=PP_ALIGN.CENTER)
            name_y = 1.82
        else:
            name_y = 1.45

        add_text_box(slide, card["name"], x + 0.1, name_y, 3.8, 0.65,
                     font_size=20, bold=True, color=PWHT, align=PP_ALIGN.CENTER)
        add_text_box(slide, card["price"], x + 0.1, name_y + 0.65, 3.8, 0.85,
                     font_size=34, bold=True, color=PGOLD, align=PP_ALIGN.CENTER)
        add_text_box(slide, card["period"], x + 0.1, name_y + 1.45, 3.8, 0.35,
                     font_size=13, color=PPTXColor(0xCC, 0xEE, 0xFF), align=PP_ALIGN.CENTER)
        add_text_box(slide, card["ideal"], x + 0.1, name_y + 1.85, 3.8, 0.38,
                     font_size=12, italic=True, color=PPTXColor(0xDD, 0xFF, 0xEE), align=PP_ALIGN.CENTER)

        add_rect(slide, x + 0.2, name_y + 2.3, 3.6, 0.03, PPTXColor(0xFF,0xFF,0xFF))

        bullet_text = "\n".join(["  ✔  " + b for b in card["bullets"]])
        add_text_box(slide, bullet_text, x + 0.1, name_y + 2.42, 3.8, 2.8,
                     font_size=10.5, color=PWHT, wrap=True)

    add_text_box(slide,
                 "* Prices excl. GST (18%)  •  Annual billing  •  30-day free trial available",
                 0.3, 7.2, 12.7, 0.35,
                 font_size=10, italic=True, color=PMID, align=PP_ALIGN.CENTER)

    # ── Slide 7: Implementation Roadmap ───────────────────────────────────
    slide = prs.slides.add_slide(blank_layout)
    slide_bg(slide, PNAV)
    add_rect(slide, 0, 0, 13.33, 1.2, PPTXColor(0x08, 0x1A, 0x3C))
    add_text_box(slide, "Implementation Roadmap", 0.4, 0.1, 12, 0.9,
                 font_size=36, bold=True, color=PWHT)
    add_text_box(slide, "Go live in as little as 48 hours", 0.4, 0.9, 10, 0.4,
                 font_size=15, color=PACC)

    roadmap = [
        ("Day 1–2",  "Discovery &\nConfiguration",   "Requirements, roles, branding setup"),
        ("Day 2–5",  "Data\nMigration",              "Employee data, attendance, payroll import"),
        ("Day 5–7",  "Training",                     "Admin, HR & employee training sessions"),
        ("Day 7–30", "Go-Live &\nHypercare",         "Live monitoring & instant support"),
        ("Month 2+", "Optimisation\n& Growth",        "Reviews, feature requests, upgrades"),
    ]

    # Arrow line
    add_rect(slide, 0.35, 3.8, 12.6, 0.08, PACC)

    for i, (period, phase, desc_road) in enumerate(roadmap):
        x = 0.35 + i * 2.52
        add_rect(slide, x + 0.5, 1.4, 1.4, 1.4, PACC)
        add_text_box(slide, str(i+1), x + 0.5, 1.4, 1.4, 1.4,
                     font_size=32, bold=True, color=PNAV, align=PP_ALIGN.CENTER)
        add_text_box(slide, period, x, 2.95, 2.4, 0.45,
                     font_size=11, bold=True, color=PGOLD, align=PP_ALIGN.CENTER)
        add_text_box(slide, phase, x, 3.45, 2.4, 0.7,
                     font_size=13, bold=True, color=PWHT, align=PP_ALIGN.CENTER)

        # dot on the line
        add_rect(slide, x + 0.85, 3.68, 0.22, 0.22, PGOLD)

        add_rect(slide, x + 0.05, 4.1, 2.3, 2.5, PPTXColor(0x1A, 0x3B, 0x70))
        add_text_box(slide, desc_road, x + 0.1, 4.2, 2.2, 2.2,
                     font_size=11, color=PPTXColor(0xCC, 0xEE, 0xFF), wrap=True)

    # ── Slide 8: ROI ───────────────────────────────────────────────────────
    slide = prs.slides.add_slide(blank_layout)
    slide_bg(slide, PLGT)
    add_rect(slide, 0, 0, 13.33, 1.2, PNAV)
    add_text_box(slide, "ROI & Business Impact", 0.4, 0.1, 12, 0.9,
                 font_size=36, bold=True, color=PWHT)

    roi_items = [
        ("70%",  "Reduction in\nHR admin hours"),
        ("95%",  "Faster payroll\nprocessing"),
        ("90%",  "Fewer attendance\ndiscrepancy issues"),
        ("97%",  "Faster employee\nquery resolution"),
        ("55%",  "Lower HR cost\nas % of payroll"),
    ]

    for i, (pct, label_roi) in enumerate(roi_items):
        x = 0.3 + i * 2.55
        add_rect(slide, x, 1.4, 2.35, 2.4, PNAV)
        add_text_box(slide, f"↓{pct}", x, 1.55, 2.35, 1.0,
                     font_size=34, bold=True, color=PACC, align=PP_ALIGN.CENTER)
        add_text_box(slide, label_roi, x, 2.55, 2.35, 0.9,
                     font_size=12, color=PWHT, align=PP_ALIGN.CENTER)

    add_text_box(slide,
                 "\"Our HR team now focuses on strategy instead of paperwork.\nPayroll that used to take 3 days is done in under 2 hours.\"",
                 0.5, 4.0, 12.3, 1.0, font_size=16, italic=True, color=PNAV, align=PP_ALIGN.CENTER)
    add_text_box(slide, "— HR Director, Manufacturing Company (120 employees)",
                 0.5, 4.9, 12.3, 0.45, font_size=13, color=PMID, align=PP_ALIGN.CENTER)

    add_rect(slide, 0.3, 5.55, 12.7, 1.6, PNAV)
    add_text_box(slide, "💡 Typical ROI achieved within 3–6 months of going live",
                 0.6, 5.65, 12.2, 0.6, font_size=18, bold=True, color=PGOLD, align=PP_ALIGN.CENTER)
    add_text_box(slide, "Contact our team for a personalised ROI calculator based on your headcount and industry.",
                 0.6, 6.2, 12.2, 0.55, font_size=12, color=PPTXColor(0xCC,0xDD,0xFF), align=PP_ALIGN.CENTER)

    # ── Slide 9: Why HRMS Pro ──────────────────────────────────────────────
    slide = prs.slides.add_slide(blank_layout)
    slide_bg(slide, PWHT)
    add_rect(slide, 0, 0, 13.33, 1.2, PNAV)
    add_text_box(slide, "Why Choose HRMS Pro?", 0.4, 0.1, 12, 0.9,
                 font_size=36, bold=True, color=PWHT)

    why_items = [
        ("🇮🇳", "Made for India",    "Indian payroll laws, PF/ESI/PT built-in"),
        ("⚡",  "48-Hour Go-Live",   "No infrastructure setup or long procurement"),
        ("🤖", "AI-Native",          "AI assistant embedded, not bolted on"),
        ("📱", "True Mobile-First",  "Native iOS & Android apps"),
        ("📞", "Real Human Support", "Not just bots — real people, real answers"),
        ("🔄", "Monthly Updates",    "New features every month at no extra cost"),
        ("💲", "Transparent Pricing","One price, no hidden per-module charges"),
        ("🔒", "Enterprise Security","AES-256 encryption + complete audit trail"),
    ]

    for i, (icon_w, title_w, desc_w) in enumerate(why_items):
        col = i % 4
        row = i // 4
        x = 0.25 + col * 3.25
        y = 1.35 + row * 2.85

        add_rect(slide, x, y, 3.0, 2.55, PLGT, PBLU, 1)
        add_text_box(slide, icon_w, x + 0.1, y + 0.12, 0.65, 0.55, font_size=22, color=PBLU)
        add_text_box(slide, title_w, x + 0.1, y + 0.72, 2.8, 0.45,
                     font_size=13, bold=True, color=PNAV)
        add_text_box(slide, desc_w, x + 0.1, y + 1.2, 2.8, 0.9,
                     font_size=10.5, color=PDRK, wrap=True)

    # ── Slide 10: Next Steps / CTA ─────────────────────────────────────────
    slide = prs.slides.add_slide(blank_layout)
    slide_bg(slide, PNAV)
    add_rect(slide, 0, 0, 13.33, 7.5, PNAV)
    add_rect(slide, 0, 0, 13.33, 1.5, PPTXColor(0x08, 0x1A, 0x3C))

    add_text_box(slide, "Ready to Transform Your HR?", 0.4, 0.18, 12.5, 1.0,
                 font_size=38, bold=True, color=PWHT, align=PP_ALIGN.CENTER)

    add_text_box(slide, "Here's how to get started today", 0.4, 1.1, 12.5, 0.45,
                 font_size=18, italic=True, color=PACC, align=PP_ALIGN.CENTER)

    cta_items = [
        ("📅", "Book a FREE Demo",  "45-min live walkthrough with your real data"),
        ("🆓", "Start Free Trial",   "30-day full Professional access — no credit card"),
        ("📞", "Talk to Sales",      "+91 XXXXX XXXXX  (Mon–Sat, 9AM–7PM)"),
        ("📧", "Email Us",           "sales@seawindsolution.com"),
    ]

    for i, (icon_cta, label_cta, desc_cta) in enumerate(cta_items):
        col = i % 2
        row = i // 2
        x = 0.5 + col * 6.5
        y = 1.85 + row * 2.1

        add_rect(slide, x, y, 6.0, 1.8, PPTXColor(0x1A, 0x3B, 0x70))
        add_text_box(slide, icon_cta, x + 0.15, y + 0.2, 0.7, 0.7, font_size=26, color=PACC)
        add_text_box(slide, label_cta, x + 0.95, y + 0.18, 4.9, 0.55,
                     font_size=17, bold=True, color=PGOLD)
        add_text_box(slide, desc_cta, x + 0.95, y + 0.75, 4.9, 0.6,
                     font_size=12, color=PPTXColor(0xCC, 0xDD, 0xFF))

    add_rect(slide, 0.3, 6.2, 12.7, 0.04, PACC)
    add_text_box(slide,
                 f"HRMS Pro by Seawind Solution Pvt. Ltd.  •  www.seawindsolution.com  •  {TODAY}",
                 0.3, 6.3, 12.7, 0.5, font_size=12, color=PMID, align=PP_ALIGN.CENTER)

    output_path = r"d:\hrms_agent\HRMS_SaaS_Presentation.pptx"
    prs.save(output_path)
    print(f"PowerPoint presentation saved -> {output_path}")
    return output_path


# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import sys, io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

    print("\n[1/2] Generating HRMS SaaS Word Proposal...")
    w = generate_word_proposal()

    print("\n[2/2] Generating HRMS SaaS PowerPoint Presentation...")
    p = generate_pptx()

    print("\n" + "="*60)
    print("  ALL FILES GENERATED SUCCESSFULLY")
    print("="*60)
    print(f"  Word Proposal    -> {w}")
    print(f"  PPT Presentation -> {p}")
    print("="*60)
