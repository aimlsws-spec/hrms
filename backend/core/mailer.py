"""
Mailer module for Seawind Solution HRMS.
Handles dispatching email notifications, invitations, and OTPs via SMTP with the official company logo.
"""

import os
import smtplib
import threading
import logging
from email.message import EmailMessage
from email.utils import make_msgid, formatdate
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("hrms.mailer")

SMTP_SERVER = os.getenv("SMTP_SERVER", "mail.seawindsolution.in")
SMTP_PORT = int(os.getenv("SMTP_PORT", "465"))
EMAIL_USER = os.getenv("EMAIL_USER", "info@seawindsolution.in")
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD", "$w$InfO2026")
APP_URL = os.getenv("APP_URL", os.getenv("FRONTEND_URL", "http://localhost:3000"))

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGO_PATH = os.path.join(BASE_DIR, "images", "seawind_logo.png")
COMPANY_LOGO_URL = "https://www.seawindsolution.com/assets/front/images/Seawind-logo-1.png"


def send_raw_email(to_email: str, subject: str, html_content: str, text_content: str = "", attach_logo: bool = False) -> dict:
    """Send an email using SMTP (SSL for 465, STARTTLS for 587) with clean hosted logo (no noname attachment chips)."""
    if not to_email or "@" not in to_email:
        return {"success": False, "error": f"Invalid recipient email: {to_email}"}

    try:
        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = f"Seawind Solution HRMS <{EMAIL_USER}>"
        msg["To"] = to_email
        msg["Message-ID"] = make_msgid()
        msg["Date"] = formatdate(localtime=True)

        if text_content:
            msg.set_content(text_content)
        else:
            msg.set_content("Please view this email in an HTML-compatible email reader.")

        msg.add_alternative(html_content, subtype="html")

        # Only attach inline logo if explicitly requested; hosted URL is preferred to avoid [noname] Gmail chips
        if attach_logo and os.path.exists(LOGO_PATH):
            try:
                with open(LOGO_PATH, "rb") as f:
                    logo_bytes = f.read()
                msg.get_payload()[1].add_related(
                    logo_bytes,
                    maintype="image",
                    subtype="png",
                    cid="<seawind_logo>",
                    filename="seawind-logo.png",
                    disposition="inline",
                )
            except Exception as att_err:
                logger.warning("Could not attach inline logo: %s", att_err)

        if SMTP_PORT == 465:
            with smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT, timeout=12) as server:
                server.login(EMAIL_USER, EMAIL_PASSWORD)
                server.send_message(msg)
        else:
            with smtplib.SMTP(SMTP_SERVER, SMTP_PORT, timeout=12) as server:
                server.starttls()
                server.login(EMAIL_USER, EMAIL_PASSWORD)
                server.send_message(msg)

        logger.info("Email '%s' successfully delivered to %s", subject, to_email)
        return {"success": True, "message": f"Email delivered to {to_email}"}
    except Exception as exc:
        logger.error("Failed to send email to %s: %s", to_email, exc, exc_info=True)
        return {"success": False, "error": str(exc)}


def build_invitation_html(
    full_name: str,
    email: str,
    employee_code: str,
    username: str,
    password: str,
    department: str = "",
    title: str = "",
    login_url: str = "",
) -> str:
    """Build a professional, modern invitation email HTML body with official company logo."""
    target_url = login_url or f"{APP_URL.rstrip('/')}/login"

    dept_row = f"""
    <tr>
        <td style="padding: 6px 0; color: #64748b; font-size: 13px; font-weight: 500;">Department:</td>
        <td style="padding: 6px 0; color: #1e293b; font-size: 13px; font-weight: 600; text-align: right;">{department}</td>
    </tr>
    """ if department else ""

    title_row = f"""
    <tr>
        <td style="padding: 6px 0; color: #64748b; font-size: 13px; font-weight: 500;">Designation:</td>
        <td style="padding: 6px 0; color: #1e293b; font-size: 13px; font-weight: 600; text-align: right;">{title}</td>
    </tr>
    """ if title else ""

    return f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Seawind Solution HRMS</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 30px 15px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
                    <!-- Brand Header with Official Logo -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%); padding: 28px 24px; text-align: center;">
                            <div style="background-color: #ffffff; display: inline-block; padding: 8px 16px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); margin-bottom: 12px;">
                                <img src="{COMPANY_LOGO_URL}" alt="SeaWind - Regeneration of IT Services" width="160" style="display: block; width: 160px; max-width: 100%; height: auto; border: 0;" />
                            </div>
                            <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.5px;">Seawind Solution HRMS</h1>
                            <p style="margin: 4px 0 0 0; color: #bfdbfe; font-size: 13px; font-weight: 500;">Regeneration of IT Services</p>
                        </td>
                    </tr>

                    <!-- Body Content -->
                    <tr>
                        <td style="padding: 32px 30px;">
                            <h2 style="margin: 0 0 12px 0; color: #0f172a; font-size: 18px; font-weight: 700;">Welcome to the Team, {full_name}!</h2>
                            <p style="margin: 0 0 20px 0; color: #475569; font-size: 14px; line-height: 1.6;">
                                An official employee account has been created for you on the <strong>Seawind Solution HRMS</strong> portal. You can now log in directly using the assigned credentials below.
                            </p>

                            <!-- Credentials Box -->
                            <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 20px; margin: 24px 0;">
                                <div style="border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 12px;">
                                    <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; font-weight: 700;">Your Login Credentials</span>
                                </div>
                                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                    <tr>
                                        <td style="padding: 6px 0; color: #64748b; font-size: 13px; font-weight: 500;">Employee ID:</td>
                                        <td style="padding: 6px 0; color: #1e40af; font-size: 13px; font-weight: 700; text-align: right; font-family: monospace;">{employee_code}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 6px 0; color: #64748b; font-size: 13px; font-weight: 500;">Login Email:</td>
                                        <td style="padding: 6px 0; color: #0f172a; font-size: 13px; font-weight: 600; text-align: right;">{email}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 6px 0; color: #64748b; font-size: 13px; font-weight: 500;">Username:</td>
                                        <td style="padding: 6px 0; color: #0f172a; font-size: 13px; font-weight: 600; text-align: right; font-family: monospace;">{username}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 6px 0; color: #64748b; font-size: 13px; font-weight: 500;">Assigned Password:</td>
                                        <td style="padding: 6px 0; color: #0f172a; font-size: 14px; font-weight: 700; text-align: right; font-family: monospace; letter-spacing: 0.5px; background: #e2e8f0; padding: 2px 8px; border-radius: 6px; display: inline-block;">{password}</td>
                                    </tr>
                                    {dept_row}
                                    {title_row}
                                </table>
                            </div>

                            <!-- CTA Button -->
                            <div style="text-align: center; margin: 28px 0 24px 0;">
                                <a href="{target_url}" target="_blank" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 12px 32px; border-radius: 10px; box-shadow: 0 2px 6px rgba(37,99,235,0.3);">
                                    Log In to HRMS Portal &rarr;
                                </a>
                            </div>

                            <!-- Onboarding Note -->
                            <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 14px 16px; border-radius: 0 8px 8px 0; margin-top: 24px;">
                                <p style="margin: 0; color: #1e40af; font-size: 12px; font-weight: 600;">First Login Instructions:</p>
                                <ul style="margin: 6px 0 0 0; padding-left: 18px; color: #1e3a8a; font-size: 12px; line-height: 1.5;">
                                    <li>Enter your email/employee ID and the assigned password shown above.</li>
                                    <li>On your first sign-in, you will be prompted to complete your onboarding details (Aadhaar, PAN, residential address, emergency contact, date of birth).</li>
                                    <li><strong>Password Policy:</strong> Your password is HR-managed and cannot be changed by employees.</li>
                                </ul>
                            </div>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f8fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                            <p style="margin: 0 0 4px 0; color: #64748b; font-size: 12px;">
                                Need help? Contact HR at <a href="mailto:{EMAIL_USER}" style="color: #2563eb; text-decoration: none;">{EMAIL_USER}</a>
                            </p>
                            <p style="margin: 0; color: #94a3b8; font-size: 11px;">
                                &copy; 2026 Seawind Solution. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>"""


def build_otp_html(otp: str) -> str:
    """Build a professional, branded OTP verification email HTML body."""
    return f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Seawind Solution HRMS - Your Login OTP</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 30px 15px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
                    <!-- Brand Header with Official Logo -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%); padding: 28px 24px; text-align: center;">
                            <div style="background-color: #ffffff; display: inline-block; padding: 8px 16px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); margin-bottom: 12px;">
                                <img src="{COMPANY_LOGO_URL}" alt="SeaWind - Regeneration of IT Services" width="150" style="display: block; width: 150px; max-width: 100%; height: auto; border: 0;" />
                            </div>
                            <h1 style="margin: 0; color: #ffffff; font-size: 19px; font-weight: 700; letter-spacing: -0.5px;">Seawind Solution HRMS</h1>
                            <p style="margin: 4px 0 0 0; color: #bfdbfe; font-size: 13px; font-weight: 500;">One-Time Password (OTP) Verification</p>
                        </td>
                    </tr>

                    <!-- Body Content -->
                    <tr>
                        <td style="padding: 32px 30px; text-align: center;">
                            <h2 style="margin: 0 0 10px 0; color: #0f172a; font-size: 18px; font-weight: 700;">Verify Your Sign In</h2>
                            <p style="margin: 0 0 24px 0; color: #475569; font-size: 14px; line-height: 1.6;">
                                Please use the following One-Time Password (OTP) to complete your secure sign-in to the portal:
                            </p>

                            <!-- OTP Box -->
                            <div style="background-color: #f8fafc; border: 2px dashed #93c5fd; border-radius: 12px; padding: 18px 24px; margin: 20px auto; display: inline-block;">
                                <span style="font-size: 34px; font-weight: 800; letter-spacing: 10px; color: #1e40af; font-family: monospace;">{otp}</span>
                            </div>

                            <p style="margin: 20px 0 0 0; color: #64748b; font-size: 12px; line-height: 1.5;">
                                This code is strictly confidential and will expire shortly. Do not share your OTP with anyone.
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f8fafc; padding: 16px 24px; text-align: center; border-top: 1px solid #e2e8f0;">
                            <p style="margin: 0; color: #94a3b8; font-size: 11px;">
                                This is an automated message from the Seawind Solution HRMS. Please do not reply.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>"""


def send_employee_invitation(
    full_name: str,
    email: str,
    employee_code: str,
    username: str,
    password: str,
    department: str = "",
    title: str = "",
    login_url: str = "",
) -> dict:
    """Send an employee invitation email with their assigned credentials and official logo."""
    subject = "Welcome to Seawind Solution - Your HRMS Login Credentials & Invitation"
    html_content = build_invitation_html(
        full_name=full_name,
        email=email,
        employee_code=employee_code,
        username=username,
        password=password,
        department=department,
        title=title,
        login_url=login_url,
    )
    text_content = (
        f"Welcome to Seawind Solution, {full_name}!\n\n"
        f"An employee account has been created for you on the Seawind Solution HRMS.\n\n"
        f"Login Portal: {login_url or f'{APP_URL.rstrip('/')}/login'}\n"
        f"Employee ID: {employee_code}\n"
        f"Email: {email}\n"
        f"Username: {username}\n"
        f"Assigned Password: {password}\n"
        f"Department: {department}\n"
        f"Designation: {title}\n\n"
        f"On your first sign-in, you will be prompted to enter your Aadhaar, PAN, residential address, emergency contact, and DOB.\n"
        f"Passwords are managed by HR.\n\n"
        f"Best regards,\nHR Department\nSeawind Solution\n{EMAIL_USER}"
    )

    return send_raw_email(to_email=email, subject=subject, html_content=html_content, text_content=text_content, attach_logo=False)


def send_otp_email(to_email: str, otp: str) -> dict:
    """Send an OTP email with the official company logo."""
    subject = "Seawind Solution HRMS - Your Login OTP"
    html_content = build_otp_html(otp=otp)
    text_content = f"Your Seawind Solution HRMS login OTP is: {otp}. This code is confidential."
    return send_raw_email(to_email=to_email, subject=subject, html_content=html_content, text_content=text_content, attach_logo=False)


def send_invitation_in_background(
    full_name: str,
    email: str,
    employee_code: str,
    username: str,
    password: str,
    department: str = "",
    title: str = "",
    login_url: str = "",
):
    """Dispatch the invitation email on a background thread so the HTTP request doesn't block."""
    thread = threading.Thread(
        target=send_employee_invitation,
        kwargs={
            "full_name": full_name,
            "email": email,
            "employee_code": employee_code,
            "username": username,
            "password": password,
            "department": department,
            "title": title,
            "login_url": login_url,
        },
        daemon=True,
    )
    thread.start()
    return thread
