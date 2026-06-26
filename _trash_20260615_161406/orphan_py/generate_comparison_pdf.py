#!/usr/bin/env python3
"""
Generate HRMS Comparison PDF
Compares Your HRMS vs PetPooja HRMS
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from datetime import datetime

def generate_comparison_pdf():
    filename = f"HRMS_Comparison_Report_{datetime.now().strftime('%Y%m%d')}.pdf"
    doc = SimpleDocTemplate(filename, pagesize=A4, topMargin=0.5*inch, bottomMargin=0.5*inch)
    styles = getSampleStyleSheet()
    story = []
    
    # Title
    title_style = ParagraphStyle('CustomTitle', parent=styles['Heading1'], fontSize=24, textColor=colors.HexColor('#1e3a8a'), alignment=TA_CENTER, spaceAfter=30)
    story.append(Paragraph("HRMS Comparison Report", title_style))
    story.append(Paragraph("Your HRMS vs PetPooja HRMS", ParagraphStyle('Subtitle', parent=styles['Normal'], fontSize=14, textColor=colors.grey, alignment=TA_CENTER, spaceAfter=20)))
    story.append(Paragraph(f"Generated: {datetime.now().strftime('%B %d, %Y')}", ParagraphStyle('Date', parent=styles['Normal'], fontSize=10, alignment=TA_CENTER, spaceAfter=30)))
    
    # Executive Summary
    story.append(Paragraph("Executive Summary", ParagraphStyle('Heading', parent=styles['Heading2'], fontSize=16, textColor=colors.HexColor('#1e3a8a'), spaceAfter=12)))
    summary_text = """Your HRMS platform offers advanced enterprise features including AI-powered assistance, comprehensive task management, 
    and performance tracking that PetPooja lacks. However, PetPooja excels in operational HR with biometric attendance, 
    automated payroll processing, and mobile-first design. This report provides a detailed feature comparison to guide strategic development."""
    story.append(Paragraph(summary_text, ParagraphStyle('Body', parent=styles['Normal'], fontSize=10, alignment=TA_JUSTIFY, spaceAfter=20)))
    
    # Feature Comparison Table
    story.append(Paragraph("Detailed Feature Comparison", ParagraphStyle('Heading', parent=styles['Heading2'], fontSize=16, textColor=colors.HexColor('#1e3a8a'), spaceAfter=12)))
    
    comparison_data = [
        ['Feature Category', 'Your HRMS', 'PetPooja', 'Winner'],
        ['AI Assistant', '✓ Advanced NLP', '✗ None', 'YOU'],
        ['Biometric Attendance', '✗ None', '✓ Fingerprint', 'PetPooja'],
        ['GPS Attendance', '✗ None', '✓ Geo-fencing', 'PetPooja'],
        ['Mobile Apps', '✗ Web only', '✓ iOS/Android', 'PetPooja'],
        ['Automated Payroll', '⚠ Partial', '✓ Full automation', 'PetPooja'],
        ['Shift Management', '✗ None', '✓ Advanced', 'PetPooja'],
        ['Task Management', '✓ Advanced', '✗ None', 'YOU'],
        ['Performance Reviews', '✓ KPIs/OKRs', '✗ None', 'YOU'],
        ['Support Tickets', '✓ Full system', '✗ None', 'YOU'],
        ['Document Generation', '✓ Multiple types', '✓ Payslips only', 'YOU'],
        ['Leave Management', '✓ Complete', '✓ Complete', 'TIE'],
        ['Overtime Calculation', '✗ Manual', '✓ Automatic', 'PetPooja'],
        ['Loan/Advance Tracking', '⚠ F&F only', '✓ Full tracking', 'PetPooja'],
        ['Audit & Security', '✓ Enterprise-grade', '⚠ Basic', 'YOU'],
        ['Multi-location Support', '✗ Single org', '✓ Multi-outlet', 'PetPooja'],
        ['WhatsApp Notifications', '✗ None', '✓ Integrated', 'PetPooja'],
        ['Reporting & Analytics', '✓ Advanced', '✓ Standard', 'YOU'],
        ['Department Management', '✓ Full hierarchy', '⚠ Basic', 'YOU'],
        ['3D Interface', '✓ Unique UI', '✗ None', 'YOU'],
    ]
    
    table = Table(comparison_data, colWidths=[2.2*inch, 1.8*inch, 1.8*inch, 1*inch])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e3a8a')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.lightgrey]),
    ]))
    story.append(table)
    story.append(Spacer(1, 20))
    
    # Score Summary
    story.append(Paragraph("Overall Score", ParagraphStyle('Heading', parent=styles['Heading2'], fontSize=16, textColor=colors.HexColor('#1e3a8a'), spaceAfter=12)))
    score_data = [
        ['Platform', 'Features Won', 'Score', 'Percentage'],
        ['Your HRMS', '8', '8/20', '40%'],
        ['PetPooja', '10', '10/20', '50%'],
        ['Tie', '2', '2/20', '10%'],
    ]
    score_table = Table(score_data, colWidths=[2*inch, 1.5*inch, 1.5*inch, 1.5*inch])
    score_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#059669')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('BACKGROUND', (0, 1), (0, 1), colors.HexColor('#dbeafe')),
        ('BACKGROUND', (0, 2), (0, 2), colors.HexColor('#fef3c7')),
    ]))
    story.append(score_table)
    story.append(PageBreak())
    
    # Your HRMS Advantages
    story.append(Paragraph("✓ Your HRMS - Key Advantages", ParagraphStyle('Heading', parent=styles['Heading2'], fontSize=16, textColor=colors.HexColor('#059669'), spaceAfter=12)))
    
    advantages = [
        ("AI-Powered Assistant", "Natural language processing for HR queries - unique competitive advantage that PetPooja completely lacks."),
        ("Task & Performance Management", "Comprehensive task tracking with KPIs, OKRs, performance cycles, and manager reviews - enterprise-grade feature."),
        ("Support Ticket System", "Internal helpdesk with ticket assignment, status tracking, and priority management - improves employee experience."),
        ("Advanced Document Generation", "Automated generation of salary slips, experience letters, offer letters, and relieving letters."),
        ("Enterprise Security & Audit", "Comprehensive activity logging, login history, force logout, and role-based access control."),
        ("Department Hierarchy", "Full organizational structure management with department heads and reporting managers."),
        ("3D Interface", "Unique and modern user interface that stands out from traditional HRMS platforms."),
        ("Customizable Reporting", "Advanced analytics with employee summaries, performance reports, and payroll analytics."),
    ]
    
    for title, desc in advantages:
        story.append(Paragraph(f"<b>{title}</b>", ParagraphStyle('AdvTitle', parent=styles['Normal'], fontSize=11, textColor=colors.HexColor('#059669'), spaceAfter=4)))
        story.append(Paragraph(desc, ParagraphStyle('AdvDesc', parent=styles['Normal'], fontSize=9, leftIndent=20, spaceAfter=10)))
    
    story.append(PageBreak())
    
    # Your HRMS Disadvantages
    story.append(Paragraph("✗ Your HRMS - Critical Gaps", ParagraphStyle('Heading', parent=styles['Heading2'], fontSize=16, textColor=colors.HexColor('#dc2626'), spaceAfter=12)))
    
    disadvantages = [
        ("No Biometric Attendance", "Missing fingerprint/face recognition hardware integration - critical for manufacturing/retail."),
        ("No GPS/Geo-fencing", "Cannot track field employee locations or enforce geo-fenced attendance zones."),
        ("No Native Mobile Apps", "Web-only interface limits mobile user experience compared to native iOS/Android apps."),
        ("Manual Payroll Processing", "Lacks automated monthly payroll runs with overtime and penalty calculations."),
        ("No Shift Management", "Cannot handle rotating shifts, overnight shifts, or complex scheduling scenarios."),
        ("No Loan/Advance Tracking", "Missing ongoing loan management with automatic EMI deductions from salary."),
        ("No Attendance Regularization", "Employees cannot request corrections to punch-in/out errors."),
        ("No WhatsApp Integration", "Missing instant notifications via WhatsApp for approvals and alerts."),
        ("Single Organization Only", "Cannot manage multiple branches/outlets from centralized dashboard."),
        ("No Offline Mode", "Requires constant internet connectivity - problematic for remote locations."),
    ]
    
    for title, desc in disadvantages:
        story.append(Paragraph(f"<b>{title}</b>", ParagraphStyle('DisTitle', parent=styles['Normal'], fontSize=11, textColor=colors.HexColor('#dc2626'), spaceAfter=4)))
        story.append(Paragraph(desc, ParagraphStyle('DisDesc', parent=styles['Normal'], fontSize=9, leftIndent=20, spaceAfter=10)))
    
    story.append(PageBreak())
    
    # PetPooja Advantages
    story.append(Paragraph("✓ PetPooja HRMS - Key Advantages", ParagraphStyle('Heading', parent=styles['Heading2'], fontSize=16, textColor=colors.HexColor('#059669'), spaceAfter=12)))
    
    petpooja_adv = [
        ("Biometric Hardware Integration", "Industrial-grade fingerprint scanners with rugged sensors for wet/oily fingers."),
        ("GPS & Geo-fencing", "Location-based attendance with geo-fence boundaries for field employees."),
        ("Native Mobile Apps", "Dedicated iOS and Android apps with offline punch storage and push notifications."),
        ("Automated Payroll Engine", "Complete automation of monthly/hourly payroll with overtime and late penalties."),
        ("Advanced Shift Management", "Support for rotating, overnight, 24-hour, and alternate week-off shifts."),
        ("Loan & Advance Management", "Full tracking with automatic deduction from monthly payroll."),
        ("Multi-location Support", "Centralized management of multiple outlets/branches from single dashboard."),
        ("WhatsApp Notifications", "Instant alerts for punch-ins, approvals, and attendance issues."),
        ("Offline Attendance Storage", "Biometric devices store data locally when network is unavailable."),
        ("Real-time Manager Dashboard", "Live monitoring of staff activity and device status remotely."),
    ]
    
    for title, desc in petpooja_adv:
        story.append(Paragraph(f"<b>{title}</b>", ParagraphStyle('PetAdvTitle', parent=styles['Normal'], fontSize=11, textColor=colors.HexColor('#059669'), spaceAfter=4)))
        story.append(Paragraph(desc, ParagraphStyle('PetAdvDesc', parent=styles['Normal'], fontSize=9, leftIndent=20, spaceAfter=10)))
    
    story.append(PageBreak())
    
    # PetPooja Disadvantages
    story.append(Paragraph("✗ PetPooja HRMS - Limitations", ParagraphStyle('Heading', parent=styles['Heading2'], fontSize=16, textColor=colors.HexColor('#dc2626'), spaceAfter=12)))
    
    petpooja_dis = [
        ("No AI Assistant", "Lacks intelligent conversational interface for HR queries and automation."),
        ("No Task Management", "Cannot track projects, tasks, or employee productivity beyond attendance."),
        ("No Performance Management", "Missing KPIs, OKRs, performance reviews, and appraisal cycles."),
        ("No Support Ticket System", "No internal helpdesk for employee queries and issue resolution."),
        ("Limited Document Generation", "Only generates payslips - no experience letters or offer letters."),
        ("Basic Security Features", "Lacks comprehensive audit trails and advanced access controls."),
        ("No Recruitment Module", "Cannot manage job postings, candidates, or hiring pipeline."),
        ("No Training Management", "Missing LMS, course enrollment, and certification tracking."),
        ("Limited Reporting", "Standard reports only - no custom report builder or advanced analytics."),
        ("SME-focused Only", "Designed for small/medium businesses, not enterprise-scale organizations."),
    ]
    
    for title, desc in petpooja_dis:
        story.append(Paragraph(f"<b>{title}</b>", ParagraphStyle('PetDisTitle', parent=styles['Normal'], fontSize=11, textColor=colors.HexColor('#dc2626'), spaceAfter=4)))
        story.append(Paragraph(desc, ParagraphStyle('PetDisDesc', parent=styles['Normal'], fontSize=9, leftIndent=20, spaceAfter=10)))
    
    story.append(PageBreak())
    
    # Strategic Recommendations
    story.append(Paragraph("Strategic Recommendations", ParagraphStyle('Heading', parent=styles['Heading2'], fontSize=16, textColor=colors.HexColor('#1e3a8a'), spaceAfter=12)))
    
    story.append(Paragraph("<b>Phase 1: Critical Gaps (Next 2 Weeks)</b>", ParagraphStyle('Phase', parent=styles['Normal'], fontSize=12, textColor=colors.HexColor('#7c3aed'), spaceAfter=8)))
    phase1 = ["GPS-based attendance with geo-fencing", "Mobile-responsive attendance interface", "Automated payroll processing engine", "Overtime calculation automation"]
    for item in phase1:
        story.append(Paragraph(f"• {item}", ParagraphStyle('ListItem', parent=styles['Normal'], fontSize=10, leftIndent=20, spaceAfter=4)))
    story.append(Spacer(1, 10))
    
    story.append(Paragraph("<b>Phase 2: High Priority (Next Month)</b>", ParagraphStyle('Phase', parent=styles['Normal'], fontSize=12, textColor=colors.HexColor('#7c3aed'), spaceAfter=8)))
    phase2 = ["Shift management system", "Attendance regularization requests", "Loan/advance tracking module", "WhatsApp/Email notifications", "Real-time dashboard updates"]
    for item in phase2:
        story.append(Paragraph(f"• {item}", ParagraphStyle('ListItem', parent=styles['Normal'], fontSize=10, leftIndent=20, spaceAfter=4)))
    story.append(Spacer(1, 10))
    
    story.append(Paragraph("<b>Phase 3: Medium Priority (Next Quarter)</b>", ParagraphStyle('Phase', parent=styles['Normal'], fontSize=12, textColor=colors.HexColor('#7c3aed'), spaceAfter=8)))
    phase3 = ["Native mobile apps (iOS/Android)", "Biometric device integration", "Late entry penalties automation", "Multi-location support"]
    for item in phase3:
        story.append(Paragraph(f"• {item}", ParagraphStyle('ListItem', parent=styles['Normal'], fontSize=10, leftIndent=20, spaceAfter=4)))
    story.append(Spacer(1, 20))
    
    # Conclusion
    story.append(Paragraph("Conclusion", ParagraphStyle('Heading', parent=styles['Heading2'], fontSize=16, textColor=colors.HexColor('#1e3a8a'), spaceAfter=12)))
    conclusion = """Your HRMS excels in enterprise features (AI, task management, performance tracking) while PetPooja dominates 
    operational HR (biometric attendance, automated payroll, mobile apps). To surpass PetPooja, prioritize attendance automation 
    and payroll processing while maintaining your unique AI and performance management advantages. The combination of both 
    operational efficiency and enterprise intelligence will create an unbeatable HRMS platform."""
    story.append(Paragraph(conclusion, ParagraphStyle('Conclusion', parent=styles['Normal'], fontSize=10, alignment=TA_JUSTIFY, spaceAfter=20)))
    
    # Build PDF
    doc.build(story)
    print(f"PDF generated successfully: {filename}")
    return filename

if __name__ == "__main__":
    generate_comparison_pdf()
