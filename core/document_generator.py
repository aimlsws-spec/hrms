#!/usr/bin/env python3
"""
Document Generator for HRMS
Generates various HR documents like salary slips, certificates, etc.
"""

import os
from datetime import datetime
from pathlib import Path
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

class DocumentGenerator:
    def __init__(self):
        self.output_dir = Path("generated_docs")
        self.output_dir.mkdir(exist_ok=True)
    
    def generate_salary_slip(self, salary_data: dict) -> str:
        """Generate salary slip PDF document"""
        filename = f"salary_slip_{salary_data['employee_id']}_{datetime.now().strftime('%Y%m')}.pdf"
        filepath = self.output_dir / filename
        
        doc = SimpleDocTemplate(str(filepath), pagesize=A4)
        styles = getSampleStyleSheet()
        story = []
        
        # Title
        title_style = ParagraphStyle('CustomTitle', parent=styles['Heading1'], alignment=TA_CENTER, fontSize=18, spaceAfter=30)
        story.append(Paragraph("SALARY SLIP", title_style))
        
        # Employee Details
        emp_data = [
            ['Employee Name:', salary_data['employee_name']],
            ['Employee ID:', salary_data['employee_id']],
            ['Department:', salary_data['department']],
            ['Position:', salary_data['position']],
            ['Month/Year:', salary_data['month_year']]
        ]
        emp_table = Table(emp_data, colWidths=[2*inch, 3*inch])
        emp_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6)
        ]))
        story.append(emp_table)
        story.append(Spacer(1, 20))
        
        # Earnings Section
        story.append(Paragraph("EARNINGS", ParagraphStyle('SectionHeader', parent=styles['Heading2'], alignment=TA_CENTER, fontSize=14)))
        earnings_data = [
            ['Basic Salary:', f"₹{salary_data['basic_salary']:,}"],
            ['HRA:', f"₹{salary_data['hra']:,}"],
            ['Transport Allowance:', f"₹{salary_data['transport']:,}"],
            ['Medical Allowance:', f"₹{salary_data['medical']:,}"]
        ]
        
        # Add bonus/special allowance if present
        if salary_data.get('bonus', 0) > 0:
            earnings_data.append(['Bonus/Special Allowance:', f"₹{salary_data['bonus']:,}"])
        
        earnings_data.extend([
            ['', ''],
            ['Gross Salary:', f"₹{salary_data['gross_salary']:,}"]
        ])
        earnings_table = Table(earnings_data, colWidths=[3*inch, 2*inch])
        earnings_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('FONTNAME', (0, -1), (1, -1), 'Helvetica-Bold'),
            ('LINEABOVE', (0, -1), (1, -1), 1, colors.black),
            ('FONTSIZE', (0, 0), (-1, -1), 10)
        ]))
        story.append(earnings_table)
        story.append(Spacer(1, 20))
        
        # Deductions Section
        story.append(Paragraph("DEDUCTIONS", ParagraphStyle('SectionHeader', parent=styles['Heading2'], alignment=TA_CENTER, fontSize=14)))
        deductions_data = [
            ['PF Contribution:', f"₹{salary_data['pf_deduction']:,}"],
            ['Tax Deduction:', f"₹{salary_data['tax_deduction']:,}"],
            ['', ''],
            ['Total Deductions:', f"₹{salary_data['total_deductions']:,}"]
        ]
        deductions_table = Table(deductions_data, colWidths=[3*inch, 2*inch])
        deductions_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('FONTNAME', (0, -1), (1, -1), 'Helvetica-Bold'),
            ('LINEABOVE', (0, -1), (1, -1), 1, colors.black),
            ('FONTSIZE', (0, 0), (-1, -1), 10)
        ]))
        story.append(deductions_table)
        story.append(Spacer(1, 20))
        
        # Net Salary
        story.append(Paragraph("NET SALARY", ParagraphStyle('SectionHeader', parent=styles['Heading2'], alignment=TA_CENTER, fontSize=14)))
        net_data = [['Net Pay:', f"₹{salary_data['net_salary']:,}"]]
        net_table = Table(net_data, colWidths=[3*inch, 2*inch])
        net_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 12),
            ('BOX', (0, 0), (-1, -1), 2, colors.black)
        ]))
        story.append(net_table)
        
        # Footer
        story.append(Spacer(1, 30))
        footer_text = f"Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        story.append(Paragraph(footer_text, ParagraphStyle('Footer', parent=styles['Normal'], alignment=TA_CENTER, fontSize=8)))
        
        doc.build(story)
        return filename
    
    def generate_experience_certificate(self, emp_data: dict) -> str:
        """Generate experience certificate PDF"""
        filename = f"experience_cert_{emp_data['employee_id']}_{datetime.now().strftime('%Y%m%d')}.pdf"
        filepath = self.output_dir / filename
        
        doc = SimpleDocTemplate(str(filepath), pagesize=A4)
        styles = getSampleStyleSheet()
        story = []
        
        # Title
        title_style = ParagraphStyle('CustomTitle', parent=styles['Heading1'], alignment=TA_CENTER, fontSize=18, spaceAfter=30)
        story.append(Paragraph("EXPERIENCE CERTIFICATE", title_style))
        story.append(Spacer(1, 30))
        
        # Certificate content
        content_style = ParagraphStyle('Content', parent=styles['Normal'], fontSize=12, spaceAfter=12, alignment=TA_LEFT)
        
        story.append(Paragraph(f"This is to certify that <b>{emp_data['employee_name']}</b> (Employee ID: {emp_data['employee_id']}) has worked with our organization from {emp_data.get('join_date', 'N/A')} to {emp_data.get('end_date', 'Present')}.", content_style))
        
        story.append(Paragraph(f"During the tenure, the employee worked as <b>{emp_data.get('position', 'Employee')}</b> in the <b>{emp_data.get('department', 'General')}</b> department.", content_style))
        
        story.append(Paragraph("We wish them all the best for future endeavors.", content_style))
        
        story.append(Spacer(1, 50))
        
        # Footer
        footer_style = ParagraphStyle('Footer', parent=styles['Normal'], fontSize=10, alignment=TA_RIGHT)
        story.append(Paragraph(f"Generated on: {datetime.now().strftime('%Y-%m-%d')}<br/>HR Department", footer_style))
        
        doc.build(story)
        return filename
    
    def generate_offer_letter(self, offer_data: dict) -> str:
        """Generate offer letter PDF document with real salary data"""
        filename = f"offer_letter_{offer_data['employee_id']}_{datetime.now().strftime('%Y%m%d')}.pdf"
        filepath = self.output_dir / filename
        
        doc = SimpleDocTemplate(str(filepath), pagesize=A4)
        styles = getSampleStyleSheet()
        story = []
        
        # Title
        title_style = ParagraphStyle('CustomTitle', parent=styles['Heading1'], alignment=TA_CENTER, fontSize=18, spaceAfter=30)
        story.append(Paragraph("OFFER LETTER", title_style))
        story.append(Spacer(1, 20))
        
        # Date
        date_style = ParagraphStyle('Date', parent=styles['Normal'], fontSize=12, alignment=TA_RIGHT)
        story.append(Paragraph(f"Date: {datetime.now().strftime('%Y-%m-%d')}", date_style))
        story.append(Spacer(1, 20))
        
        # Greeting
        content_style = ParagraphStyle('Content', parent=styles['Normal'], fontSize=12, spaceAfter=12)
        story.append(Paragraph(f"Dear {offer_data['candidate_name']},", content_style))
        
        story.append(Paragraph(f"We are pleased to offer you the position of <b>{offer_data['position']}</b> in our <b>{offer_data['department']}</b> department.", content_style))
        story.append(Spacer(1, 20))
        
        # Employment Details with real salary breakdown
        story.append(Paragraph("EMPLOYMENT DETAILS", ParagraphStyle('SectionHeader', parent=styles['Heading2'], fontSize=14, alignment=TA_CENTER)))
        
        # Format salary properly
        annual_ctc = offer_data.get('annual_ctc', offer_data.get('salary', 0))
        if isinstance(annual_ctc, str):
            # Remove currency symbols and commas
            annual_ctc = float(''.join(filter(str.isdigit, annual_ctc)))
        
        emp_details = [
            ['Position:', offer_data['position']],
            ['Department:', offer_data['department']],
            ['Annual CTC:', f"₹{annual_ctc:,.2f}"],
            ['Joining Date:', offer_data.get('joining_date', 'To be confirmed')]
        ]
        details_table = Table(emp_details, colWidths=[2*inch, 3*inch])
        details_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6)
        ]))
        story.append(details_table)
        story.append(Spacer(1, 20))
        
        # Add salary breakdown if available
        if offer_data.get('basic_salary'):
            story.append(Paragraph("SALARY BREAKDOWN (Annual)", ParagraphStyle('SectionHeader', parent=styles['Heading2'], fontSize=14, alignment=TA_CENTER)))
            salary_breakdown = [
                ['Basic Salary:', f"₹{offer_data.get('basic_salary', 0):,.2f}"],
                ['HRA:', f"₹{offer_data.get('hra', 0):,.2f}"],
                ['Gross Salary:', f"₹{offer_data.get('gross_salary', 0):,.2f}"],
                ['Net Salary (Annual):', f"₹{offer_data.get('net_salary', 0):,.2f}"]
            ]
            salary_table = Table(salary_breakdown, colWidths=[2*inch, 3*inch])
            salary_table.setStyle(TableStyle([
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
                ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6)
            ]))
            story.append(salary_table)
            story.append(Spacer(1, 20))
        
        # Terms & Conditions
        story.append(Paragraph("TERMS & CONDITIONS", ParagraphStyle('SectionHeader', parent=styles['Heading2'], fontSize=14, alignment=TA_CENTER)))
        
        terms = [
            "1. This offer is subject to satisfactory background verification.",
            "2. You will be on probation for 6 months.",
            "3. Notice period: 30 days after confirmation.",
            "4. Benefits include health insurance and PF."
        ]
        
        for term in terms:
            story.append(Paragraph(term, content_style))
        
        story.append(Spacer(1, 20))
        story.append(Paragraph("Please confirm your acceptance by signing and returning this letter.", content_style))
        story.append(Paragraph("Welcome to our team!", content_style))
        story.append(Spacer(1, 30))
        
        # Signature
        signature_style = ParagraphStyle('Signature', parent=styles['Normal'], fontSize=12, alignment=TA_RIGHT)
        story.append(Paragraph("Best Regards,<br/>HR Department", signature_style))
        
        # Footer
        story.append(Spacer(1, 30))
        footer_style = ParagraphStyle('Footer', parent=styles['Normal'], fontSize=8, alignment=TA_CENTER)
        story.append(Paragraph(f"Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", footer_style))

        doc.build(story)
        return filename

    def generate_appointment_letter(self, data: dict) -> str:
        """
        Generate the Seawind Solution Pvt. Ltd. appointment letter PDF.
        Keeps all company text, terms and legal content fixed.
        Only placeholders populated from `data`:
          employee_name, address, email, position, salary,
          joining_date, letter_date, employee_code
        """
        from reportlab.platypus import PageBreak, HRFlowable
        from reportlab.lib.units import mm

        emp_code = data.get('employee_code', 'EMP')
        filename = f"appointment_letter_{emp_code}_{datetime.now().strftime('%Y%m%d%H%M%S')}.pdf"
        filepath = self.output_dir / filename

        doc = SimpleDocTemplate(
            str(filepath), pagesize=A4,
            topMargin=18*mm, bottomMargin=18*mm,
            leftMargin=20*mm, rightMargin=20*mm,
        )
        S = getSampleStyleSheet()

        def sty(name, **kw):
            base = kw.pop('parent', 'Normal')
            return ParagraphStyle(name, parent=S[base], **kw)

        co_name_sty = sty('ALCoName', fontSize=15, fontName='Helvetica-Bold', alignment=TA_CENTER, spaceAfter=2)
        co_addr_sty = sty('ALCoAddr', fontSize=8,  alignment=TA_CENTER, spaceAfter=3)
        title_sty   = sty('ALTitle',  fontSize=13, fontName='Helvetica-Bold', alignment=TA_CENTER, spaceAfter=10, spaceBefore=4)
        field_sty   = sty('ALField',  fontSize=10, spaceAfter=3)
        body_sty    = sty('ALBody',   fontSize=10, spaceAfter=6,  leading=15)
        clause_sty  = sty('ALClause', fontSize=10, spaceAfter=7,  leading=15)
        footer_sty  = sty('ALFooter', fontSize=9,  alignment=TA_CENTER, spaceBefore=12)
        sign_sty    = sty('ALSign',   fontSize=10, spaceAfter=3)

        def letterhead():
            return [
                Paragraph("<b>Seawind Solution Pvt. Ltd.</b>", co_name_sty),
                Paragraph(
                    "B-1102 Mondeal Heights, Near Novotel Hotel, "
                    "Ramdev Nagar, Ahmedabad, Gujarat 380015",
                    co_addr_sty),
                HRFlowable(width="100%", thickness=1.5, color=colors.black, spaceAfter=4),
            ]

        story = []

        # ── PAGE 1 ────────────────────────────────────────────────────────────
        story.extend(letterhead())
        story.append(Paragraph("<b>Appointment Letter</b>", title_sty))
        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.grey, spaceAfter=8))

        story.append(Paragraph(f"<b>Date:</b>    {data.get('letter_date', datetime.now().strftime('%d-%m-%Y'))}", field_sty))
        story.append(Paragraph(f"<b>Name:</b>    {data.get('employee_name', '')}", field_sty))
        story.append(Paragraph(f"<b>Address:</b> {data.get('address', '')}", field_sty))
        story.append(Paragraph(f"<b>Email Id:</b> {data.get('email', '')}", field_sty))
        story.append(Spacer(1, 6))

        story.append(Paragraph("<b>Sub: Appointment Letter from Seawind Solution Pvt. Ltd.</b>", body_sty))
        story.append(Spacer(1, 4))
        story.append(Paragraph("Greetings from <b>Seawind Solution Pvt. Ltd.</b>", body_sty))
        story.append(Paragraph(
            f"With reference to your application and subsequent interview with us, we are pleased to "
            f"appoint you as <b>{data.get('position', 'Position')}</b> in our organization on the "
            f"following terms and conditions.", body_sty))

        story.append(Paragraph(f"<b>Date of Joining:</b> {data.get('joining_date', '')}", field_sty))
        story.append(Paragraph(f"<b>Salary:</b> {data.get('salary', '')}", field_sty))
        story.append(Spacer(1, 6))

        story.append(Paragraph(
            "<b>Probation/Confirmation.</b> You will be on a probation period of <b>6 (six) months</b> based "
            "on your performance your services will be confirmed in the present position, and thereafter, "
            "your services can be confirmed with the Company.", body_sty))

        story.append(Paragraph(
            "During the probation period, your services can be terminated with seven days' notice "
            "without any reason whatsoever; if your services are found satisfactory during the probation "
            "period, you will be confirmed in the present position and, thereafter, your services can be "
            "terminated with one month's notice.", body_sty))

        story.append(Paragraph(
            "Absence for a continuous period of ten days without prior approval of your superior "
            "(including overstay on leave/training) would result in your services being treated as on "
            "the same shall automatically come to an end without any notice or intimation.", body_sty))

        story.append(Paragraph(
            "During the period of your employment with the Company, you will devote full time to the "
            "work of the Company. Further, you will not take up any other employment or assignment "
            "or any office, honorary or for any consideration, in cash or in kind or otherwise, without "
            "the written permission of the Company.", body_sty))

        story.append(Paragraph(
            "1. You will not (except in the normal course of the Company's business) publish any article "
            "or statement or deliver any lecture or broadcast or make any communication to the press, "
            "including magazine editors, about the Company or its products or to any matter with "
            "which the Company may be concerned, unless you have previously applied to and obtained "
            "the written permission from the Company.", clause_sty))

        story.append(Spacer(1, 10))
        story.append(Paragraph("<b>www.seawindsolution.com</b>", footer_sty))

        # ── PAGE 2 ────────────────────────────────────────────────────────────
        story.append(PageBreak())
        story.extend(letterhead())
        story.append(Spacer(1, 6))

        page2_clauses = [
            ("2.", "You will be required to maintain strict secrecy in respect of Project documents, "
                   "commercial offers, design documents, Project cost & Estimation, Technology, Software "
                   "packages licenses, Company's policies, Company's patterns & Trade Mark, and Company's "
                   "Human assets profile."),
            ("3.", "You will be required to comply with all such rules and regulations as the Company may "
                   "frame from time to time."),
            ("4.", "Any of our technical or other important information which might come into your "
                   "possession during the continuance of your service with us shall not be disclosed, "
                   "divulged or made public by you even thereafter."),
            ("5.", "If at any time in our opinion, which is final in this matter you are found "
                   "non-performer or guilty of fraud, dishonesty, neglect of duty, negligence or any "
                   "other act considered by us to be against our interest or any other conduct that "
                   "amounts to a breach of the terms of this letter, your services may be terminated "
                   "without notice and on account of reason of any of the acts or omission the company "
                   "shall be entitled to recover the same from you."),
            ("6.", "You will not accept any present, commission or any sort of gratification in cash or "
                   "kind from any person, party or firm or Company having to deal with the company and "
                   "if you are offered any, you should immediately report the same to the Management."),
            ("7.", "This letter is issued to you in the basis of the information and particulars "
                   "furnished by you in your application (including the data) at the time of your "
                   "interview and appointment and any false information (If it comes to our notice that "
                   "you have made a false statement or have disclosed a material fact) resulting in your "
                   "being offered this appointment, the Management shall at such action as it in its "
                   "absolute discretion, including termination of your employment."),
            ("8.", "You will be responsible for the safekeeping and return in good condition and order "
                   "of all Company property, which may be in your use, custody, or charge."),
        ]
        for num, text in page2_clauses:
            story.append(Paragraph(f"<b>{num}</b> {text}", clause_sty))

        story.append(Spacer(1, 8))
        story.append(Paragraph(
            "Please sign and return to the undersigned the duplicate copy of this letter signifying "
            "your acceptance.", body_sty))
        story.append(Spacer(1, 6))
        story.append(Paragraph(
            "We welcome you to the <b>Seawind family</b> and look forward to a fruitful collaboration "
            "&amp; <b>long-term relationship.</b>", body_sty))
        story.append(Spacer(1, 16))

        story.append(Paragraph("<b>With best wishes,</b>",              sign_sty))
        story.append(Paragraph("<b>Seawind Solution Pvt. Ltd.</b>",     sign_sty))
        story.append(Paragraph("HR Department",                          sign_sty))
        story.append(Paragraph("hr@seawindsolution.com",                 sign_sty))
        story.append(Spacer(1, 18))
        story.append(Paragraph("<b>www.seawindsolution.com</b>",         footer_sty))

        doc.build(story)
        return filename