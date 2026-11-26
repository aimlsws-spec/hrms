import sys as _sys_early

# Windows consoles default to a legacy codepage (cp1252/cp437) that cannot
# encode many characters used in log/diagnostic messages (arrows, box-drawing,
# etc.), crashing with UnicodeEncodeError. Force UTF-8 on stdio before any
# other module prints or logs anything.
for _stream in (_sys_early.stdout, _sys_early.stderr):
    if hasattr(_stream, "reconfigure"):
        try:
            _stream.reconfigure(encoding="utf-8", errors="backslashreplace")
        except Exception:
            pass

import mysql.connector
import json
import math
import random
import urllib.request
import urllib.parse
import logging
from datetime import datetime, timedelta
from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from pathlib import Path
import os
import sys

# Flat backend modules live in core/ (pending MVC migration).
# Ensure both core/ and backend/ are on sys.path so flat imports
# (from config import ...) and sibling core imports continue working.
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
_CORE_DIR = os.path.join(_BACKEND_DIR, "core")
_PARENT_DIR = os.path.dirname(_BACKEND_DIR)
for _p in [_CORE_DIR, _BACKEND_DIR, _PARENT_DIR]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

from backend.core.remarks_api import router as remarks_router               # STEP 5: enabled
from backend.core.payroll_api import router as payroll_router               # STEP 4: enabled
from backend.core.attendance_api import router as attendance_router         # STEP 2: enabled
from backend.core.performance_api import router as performance_router       # STEP 3: enabled
from backend.core.task_manager_api import router as task_manager_router     # STEP 5: enabled
from backend.core.settings_api import router as settings_router             # STEP 5: enabled
from backend.core.team_management_api import router as team_management_router
from backend.core.analytics_api import router as analytics_router
from backend.core.accountant_routes import router as accountant_router
from backend.core.employee_routes import router as employee_router
# Migrated to MVC structure — see backend/controllers/salary_controller.py
from backend.controllers.salary_controller import router as hr_salary_router
# Migrated to MVC structure — see backend/controllers/payslip_controller.py
from backend.controllers.payslip_controller import router as payslip_router
from backend.core import salary_slip_generator
from backend.core.wfh_selfie_api import router as wfh_selfie_router
from backend.core.document_requests_api import router as document_requests_router
from backend.core.document_requests_api import _ensure_document_requests_table

logger = logging.getLogger(__name__)
from backend.core.wfh_geo_api import router as wfh_geo_router
from backend.core.time_tracking_api import router as time_tracking_router
from backend.core.time_tracking import ensure_time_tracking_tables
# LIVE-PUNCH DISABLED (biometric device integration paused — WFO moving to selfie + location).
# Search 'LIVE-PUNCH DISABLED' and uncomment these lines to re-enable.
# LIVE-PUNCH DISABLED: from backend.core.biometric_router import router as biometric_router
# LIVE-PUNCH DISABLED: from backend.core.biometric_live_api import router as biometric_live_router
# LIVE-PUNCH DISABLED: from backend.core.biometric_sync import start_biometric_scheduler, stop_biometric_scheduler
from backend.core.leave_accounting import credit_monthly_leaves, ensure_leave_ledger_table, record_leave_debit
from backend.core.hr_features_api import router as hr_features_router
from backend.core.hr_activity_logger import log_hr_activity


from backend.config import DB_CONFIG

def get_db_connection():
    return mysql.connector.connect(**DB_CONFIG)

def _migrate_schema():
    """Add backward-compat virtual columns so legacy queries work without rewrites."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        stmts = [
            # employees: virtual columns so first_name/last_name/employee_id/etc. queries work
            "ALTER TABLE employees ADD COLUMN employee_id  VARCHAR(50)  GENERATED ALWAYS AS (employee_code) VIRTUAL",
            "ALTER TABLE employees ADD COLUMN first_name   VARCHAR(100) GENERATED ALWAYS AS (SUBSTRING_INDEX(full_name,' ',1)) VIRTUAL",
            "ALTER TABLE employees ADD COLUMN last_name    VARCHAR(100) GENERATED ALWAYS AS (IF(LOCATE(' ',full_name)>0,TRIM(SUBSTRING(full_name,LOCATE(' ',full_name)+1)),'')) VIRTUAL",
            "ALTER TABLE employees ADD COLUMN name         VARCHAR(100) GENERATED ALWAYS AS (full_name) VIRTUAL",
            "ALTER TABLE employees ADD COLUMN date_of_joining DATE        GENERATED ALWAYS AS (joining_date) VIRTUAL",
            # real nullable columns for fields not in the original schema
            "ALTER TABLE employees ADD COLUMN department   VARCHAR(100) DEFAULT NULL",
            "ALTER TABLE employees ADD COLUMN title        VARCHAR(100) DEFAULT NULL",
            "ALTER TABLE employees ADD COLUMN city         VARCHAR(100) DEFAULT NULL",
            "ALTER TABLE employees ADD COLUMN state        VARCHAR(100) DEFAULT NULL",
            # leave_requests table
            """CREATE TABLE IF NOT EXISTS leave_requests (
                id INT AUTO_INCREMENT PRIMARY KEY,
                employee_id VARCHAR(50) NOT NULL,
                leave_type  VARCHAR(50) NOT NULL,
                start_date  DATE NOT NULL,
                end_date    DATE NOT NULL,
                days_count  INT NOT NULL,
                reason      TEXT,
                status      VARCHAR(20) DEFAULT 'PENDING',
                approved_by VARCHAR(50),
                approved_at TIMESTAMP NULL,
                created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )""",
            # unique key so attendance ON DUPLICATE KEY works
            "ALTER TABLE attendance ADD UNIQUE KEY uq_emp_date (employee_id, date)",

            # ── WFH core tables: create if they were never manually migrated ──
            """CREATE TABLE IF NOT EXISTS wfh_system_config (
                config_key   VARCHAR(100) NOT NULL,
                config_value VARCHAR(500) NOT NULL,
                description  TEXT         NULL,
                updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (config_key)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",

            # wfh_attendance: full schema including selfie + geo columns
            """CREATE TABLE IF NOT EXISTS wfh_attendance (
                id                  INT           NOT NULL AUTO_INCREMENT,
                employee_id         VARCHAR(50)   NOT NULL,
                attendance_id       INT           NULL,
                punch_in_at         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
                punch_out_at        TIMESTAMP     NULL,
                duration_minutes    SMALLINT UNSIGNED NULL,
                idempotency_key     VARCHAR(36)   NOT NULL DEFAULT '',
                status              ENUM('PENDING_SELFIE','AUTO_APPROVED','FLAGGED',
                                        'PENDING_REVIEW','APPROVED','REJECTED')
                                    NOT NULL DEFAULT 'PENDING_SELFIE',
                flag_reason         VARCHAR(500)  NULL,
                attendance_method   ENUM('SELFIE','GEO') NOT NULL DEFAULT 'SELFIE',
                geo_latitude        DECIMAL(10,8) NULL,
                geo_longitude       DECIMAL(11,8) NULL,
                geo_distance_meters DECIMAL(10,2) NULL,
                client_ip           VARCHAR(45)   NOT NULL DEFAULT '',
                user_agent          TEXT          NULL,
                client_timestamp    TIMESTAMP     NULL,
                created_at          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                INDEX idx_employee  (employee_id),
                INDEX idx_status    (status),
                INDEX idx_punch_in  (punch_in_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",

            # Safety ALTERs for existing installs that may be missing columns
            "ALTER TABLE wfh_attendance ADD COLUMN attendance_id       INT NULL",
            "ALTER TABLE wfh_attendance ADD COLUMN idempotency_key     VARCHAR(36) NOT NULL DEFAULT ''",
            "ALTER TABLE wfh_attendance ADD COLUMN flag_reason         VARCHAR(500) NULL",
            "ALTER TABLE wfh_attendance ADD COLUMN client_ip           VARCHAR(45) NOT NULL DEFAULT ''",
            "ALTER TABLE wfh_attendance ADD COLUMN user_agent          TEXT NULL",
            "ALTER TABLE wfh_attendance ADD COLUMN client_timestamp    TIMESTAMP NULL",

            # ── WFH Geo Attendance: new columns on wfh_attendance ──────────────
            "ALTER TABLE wfh_attendance ADD COLUMN attendance_method   ENUM('SELFIE','GEO') NOT NULL DEFAULT 'SELFIE' AFTER status",
            "ALTER TABLE wfh_attendance ADD COLUMN geo_latitude         DECIMAL(10,8) NULL AFTER attendance_method",
            "ALTER TABLE wfh_attendance ADD COLUMN geo_longitude        DECIMAL(11,8) NULL AFTER geo_latitude",
            "ALTER TABLE wfh_attendance ADD COLUMN geo_distance_meters  DECIMAL(10,2) NULL AFTER geo_longitude",

            # ── WFH Geo Attendance: employee home locations table ──────────────
            """CREATE TABLE IF NOT EXISTS employee_home_locations (
                id              INT           NOT NULL AUTO_INCREMENT,
                employee_id     VARCHAR(50)   NOT NULL,
                latitude        DECIMAL(10,8) NOT NULL,
                longitude       DECIMAL(11,8) NOT NULL,
                address_label   VARCHAR(500)  NULL,
                registered_via  ENUM('employee_gps','hr_manual','geocoded') NOT NULL DEFAULT 'hr_manual',
                updated_by      VARCHAR(50)   NULL,
                created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY uq_employee (employee_id),
                INDEX idx_employee (employee_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",

            # ── Home location audit log ────────────────────────────────────────
            """CREATE TABLE IF NOT EXISTS employee_home_location_audit (
                id             INT           NOT NULL AUTO_INCREMENT,
                employee_id    VARCHAR(50)   NOT NULL,
                latitude       DECIMAL(10,8) NOT NULL,
                longitude      DECIMAL(11,8) NOT NULL,
                address_label  VARCHAR(500)  NULL,
                registered_via ENUM('employee_gps','hr_manual','geocoded') NOT NULL,
                changed_by     VARCHAR(50)   NOT NULL,
                changed_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                INDEX idx_emp (employee_id),
                INDEX idx_changed_at (changed_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",

            # ── Home-location change-request workflow ─────────────────────────
            """CREATE TABLE IF NOT EXISTS home_location_change_requests (
                id                       INT           NOT NULL AUTO_INCREMENT,
                employee_id              VARCHAR(50)   NOT NULL,
                requested_latitude       DECIMAL(10,8) NOT NULL,
                requested_longitude      DECIMAL(11,8) NOT NULL,
                requested_address_label  VARCHAR(500)  NULL,
                request_reason           VARCHAR(500)  NULL,
                status  ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
                hr_comment               VARCHAR(500)  NULL,
                reviewed_by              VARCHAR(50)   NULL,
                reviewed_at              TIMESTAMP     NULL,
                created_at               TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                INDEX idx_emp_status (employee_id, status),
                INDEX idx_status     (status),
                INDEX idx_created    (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",

            # ── WFH geo radius config (safe INSERT IGNORE) ─────────────────────
            "INSERT IGNORE INTO wfh_system_config (config_key, config_value, description) VALUES ('wfh_geo_radius_meters','300','Radius in metres for WFH geo attendance validation')",

            # ── Geo attendance attempt log (all attempts, including failures) ──
            """CREATE TABLE IF NOT EXISTS geo_attendance_attempts (
                id              INT           NOT NULL AUTO_INCREMENT,
                employee_id     VARCHAR(50)   NOT NULL,
                attempted_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
                latitude        DECIMAL(10,8) NOT NULL,
                longitude       DECIMAL(11,8) NOT NULL,
                home_latitude   DECIMAL(10,8) NULL,
                home_longitude  DECIMAL(11,8) NULL,
                distance_meters DECIMAL(10,2) NULL,
                radius_meters   INT           NOT NULL DEFAULT 300,
                within_radius   BOOLEAN       NOT NULL DEFAULT FALSE,
                wfh_id          INT           NULL COMMENT 'wfh_attendance.id when successful',
                client_ip       VARCHAR(45)   NOT NULL DEFAULT '',
                PRIMARY KEY (id),
                INDEX idx_employee      (employee_id),
                INDEX idx_attempted_at  (attempted_at),
                INDEX idx_within_radius (within_radius)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",

            # ── Daily Work Mode: WFO / WFH selection per employee per day ────────
            """CREATE TABLE IF NOT EXISTS daily_work_mode (
                id                  INT           NOT NULL AUTO_INCREMENT,
                employee_id         VARCHAR(50)   NOT NULL,
                work_date           DATE          NOT NULL,
                mode                ENUM('WFO','WFH') NOT NULL,
                biometric_user_id   VARCHAR(50)   NULL,
                checked_in_at       DATETIME      NULL,
                check_in_method     ENUM('BIOMETRIC','MANUAL') NULL,
                status              ENUM('PENDING','PRESENT','ABSENT') NOT NULL DEFAULT 'PENDING',
                notes               TEXT          NULL,
                created_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY uq_emp_date (employee_id, work_date),
                INDEX idx_date (work_date),
                INDEX idx_mode (mode)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",

            # ── Attendance rules engine: late arrival flag columns ────────────────
            "ALTER TABLE attendance ADD COLUMN is_late BOOLEAN NOT NULL DEFAULT FALSE",
            "ALTER TABLE attendance ADD COLUMN late_flagged_at DATETIME NULL",
            # source column: 'BIOMETRIC' | 'MANUAL' | 'WFH_SELFIE' | 'WFH_GEO'
            "ALTER TABLE attendance ADD COLUMN check_in_source VARCHAR(20) DEFAULT NULL",
            # employee biometric enroll_id (registered once during onboarding)
            "ALTER TABLE employees ADD COLUMN biometric_enroll_id VARCHAR(50) DEFAULT NULL",
            # default work mode selected at signup
            "ALTER TABLE employees ADD COLUMN default_work_mode ENUM('WFO','WFH') DEFAULT NULL",

            # ── Monthly late summary (one row per employee per month) ─────────────
            """CREATE TABLE IF NOT EXISTS monthly_late_summary (
                id                  INT           NOT NULL AUTO_INCREMENT,
                employee_id         VARCHAR(50)   NOT NULL,
                year                SMALLINT      NOT NULL,
                month               TINYINT       NOT NULL,
                late_days           TINYINT       NOT NULL DEFAULT 0,
                deduction_triggered BOOLEAN       NOT NULL DEFAULT FALSE,
                updated_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY uq_emp_ym (employee_id, year, month),
                INDEX idx_ym (year, month)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",

            # ── Attendance deductions (written by rules engine, read by payroll) ───
            """CREATE TABLE IF NOT EXISTS attendance_deductions (
                id                  INT           NOT NULL AUTO_INCREMENT,
                employee_id         VARCHAR(50)   NOT NULL,
                year                SMALLINT      NOT NULL,
                month               TINYINT       NOT NULL,
                deduction_type      VARCHAR(50)   NOT NULL DEFAULT 'LATE_ARRIVAL',
                late_count          TINYINT       NOT NULL DEFAULT 0,
                half_days_deducted  TINYINT       NOT NULL DEFAULT 0,
                amount              DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                payroll_processed   BOOLEAN       NOT NULL DEFAULT FALSE,
                updated_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                created_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY uq_emp_ym_type (employee_id, year, month, deduction_type),
                INDEX idx_ym (year, month),
                INDEX idx_payroll (payroll_processed)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",

            # ── Session-based attendance: expand ENUM + add check_out ─────────────
            "ALTER TABLE attendance MODIFY COLUMN status ENUM('PRESENT','ABSENT','HALF_DAY','ON_LEAVE','FIRST_HALF_LEAVE','SECOND_HALF_LEAVE') DEFAULT NULL",
            "ALTER TABLE attendance ADD COLUMN check_out VARCHAR(10) DEFAULT NULL",

            # ── WFO now marks attendance via selfie / geo (office location) ───────
            "ALTER TABLE daily_work_mode MODIFY COLUMN check_in_method ENUM('BIOMETRIC','MANUAL','GEO','SELFIE','GEO_SELFIE') NULL",

            # user ids are text (e.g. 'hr001'); the selfie audit log column was INT, so HR could not open selfies
            "ALTER TABLE selfie_access_log MODIFY COLUMN accessed_by_user_id VARCHAR(50) NOT NULL",

            # ── Late arrival deduction review columns ──
            "ALTER TABLE attendance_deductions ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'PENDING_REVIEW'",
            "ALTER TABLE attendance_deductions ADD COLUMN reviewed_by VARCHAR(50) NULL",
            "ALTER TABLE attendance_deductions ADD COLUMN reviewed_at DATETIME NULL",
            "ALTER TABLE attendance_deductions ADD COLUMN review_notes TEXT NULL",

            # ── HR activity logs table ──
            """CREATE TABLE IF NOT EXISTS hr_activity_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                performed_by VARCHAR(50) NOT NULL,
                performed_name VARCHAR(100) NOT NULL,
                performed_role VARCHAR(50) DEFAULT 'hr',
                action VARCHAR(100) NOT NULL,
                target_employee_id VARCHAR(50) NULL,
                target_employee_name VARCHAR(100) NULL,
                details TEXT NOT NULL,
                ip_address VARCHAR(45) DEFAULT '127.0.0.1',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_hr_act_user (performed_by),
                INDEX idx_hr_act_target (target_employee_id),
                INDEX idx_hr_act_created (created_at)
            )""",
        ]
        for sql in stmts:
            try:
                cur.execute(sql)
            except Exception:
                pass  # column/key already exists or table already created
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"[schema migration] warning: {e}")


def _html_or_404(path: str):
    """Serve a legacy static page, or 404 when the file is not shipped."""
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Page not found")
    return FileResponse(path)

# Helper function to get all employees from database
def get_all_employees():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM employees")
        employees = cursor.fetchall()
        cursor.close()
        conn.close()
        return employees
    except:
        return []

from backend.core.retention_scheduler import start_scheduler, stop_scheduler
from backend.core import selfie_storage

app = FastAPI(title="HRMS AI Agent", version="0.1.0")

@app.on_event("startup")
def _startup():
    global profile_system, ticket_system, payroll_automation

    # ── Schema migrations (idempotent DDL) ────────────────────────────────────
    _migrate_schema()
    _ensure_leave_tables()
    _ensure_announcement_tables()
    _ensure_support_tables()
    ensure_time_tracking_tables()

    # ── Singletons that require a live DB connection ───────────────────────────
    # EmployeeProfileSystem.__init__ calls setup_database() which runs CREATE TABLE.
    profile_system = EmployeeProfileSystem()
    # TicketSystem stores db_config only; instantiated here for consistency.
    ticket_system = TicketSystem(DB_CONFIG)
    # PayrollAutomation.__init__ sets scalars only; instantiated here for consistency.
    payroll_automation = PayrollAutomation()

    # ── Storage + schedulers ──────────────────────────────────────────────────
    selfie_storage.ensure_storage_dir()
    start_scheduler()
    # LIVE-PUNCH DISABLED: start_biometric_scheduler()

@app.on_event("shutdown")
def _shutdown():
    stop_scheduler()
    # LIVE-PUNCH DISABLED: stop_biometric_scheduler()

app.include_router(remarks_router)
app.include_router(payroll_router)
# LIVE-PUNCH DISABLED: app.include_router(biometric_live_router)   # must be before attendance_router — /api/attendance/{id} wildcard would swallow /live and /debug-time
app.include_router(attendance_router)
app.include_router(performance_router)
app.include_router(task_manager_router)
app.include_router(settings_router)
app.include_router(team_management_router)
app.include_router(analytics_router)
app.include_router(accountant_router)
app.include_router(employee_router)
app.include_router(hr_salary_router)
app.include_router(payslip_router)
app.include_router(wfh_selfie_router)
app.include_router(wfh_geo_router)
app.include_router(time_tracking_router)
# LIVE-PUNCH DISABLED: app.include_router(biometric_router)
app.include_router(document_requests_router)
app.include_router(hr_features_router)

# Add CORS middleware
# Note: allow_origins=["*"] is incompatible with allow_credentials=True (browsers reject it).
# List every origin that will access the API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8004",
        "http://127.0.0.1:8004",
        "http://localhost:8003",
        "http://127.0.0.1:8003",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8002",
        "http://127.0.0.1:8002",
        "https://hrmsf.pro.seawindsolution.com",
    ] + [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Legacy /static mount + FRONTEND_DIR (frontend_backup_python) removed —
# the React app (frontend-react) is the only frontend now.
#
# SECURITY: this must point at the dedicated UI-assets folder only, never at
# "." (the backend working directory) — mounting "." previously served
# app.py, config.py, and every other backend file (including, in production,
# employee_data/ with Aadhaar/PAN scans) to any unauthenticated visitor.
app.mount("/images", StaticFiles(directory=os.path.join(BASE_DIR, "images", "images")), name="images")

# Templates
templates = Jinja2Templates(directory=os.path.join(os.path.dirname(os.path.abspath(__file__)), "templates", "templates"))


# Import EmployeeProfileSystem for profile handling
from backend.core.employee_profile_system import EmployeeProfileSystem
from fastapi import UploadFile, File, Form
from typing import Optional, List

# Deferred — instantiated in _startup() to avoid DB calls at import time.
profile_system: EmployeeProfileSystem | None = None

# Initialize Ticket System
from backend.core.ticket_system import TicketSystem
# Deferred — instantiated in _startup() to avoid DB calls at import time.
ticket_system: TicketSystem | None = None

# Import admin features backend
from backend.core import admin_features_backend as admin_features

# Import audit logger
from backend.core import audit_logger

# Import salary calculator
from backend.core.salary_calculator import SalaryCalculator

# Legacy salary_workflow + salary_structure_manager removed (they wrote the old
# salary_structures table). Superseded by the employee_salaries system —
# backend/ MVC salary feature (/api/hr/salary) + accountant_routes (/api/accountant/*).

# Import payroll automation
from backend.core.payroll_automation import PayrollAutomation
# Deferred — instantiated in _startup() (no DB call in __init__, but kept
# consistent with the other deferred singletons).
payroll_automation: PayrollAutomation | None = None

# Activity tracking middleware - DISABLED for performance
# @app.middleware("http")
# async def log_activity_middleware(request: Request, call_next):
#     response = await call_next(request)
#     return response

# Employee search endpoint that frontend calls (both /employees/search and /api/employees/search)
@app.get("/employees/search")
@app.get("/api/employees/search")
async def search_employees_endpoint(q: str = "", limit: int = 20, user_id: str = None, user_role: str = None):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Log search activity
        if user_id:
            if user_role == "admin":
                audit_logger.log_admin_activity(
                    admin_id=user_id,
                    admin_name="Administrator",
                    action="Employee Search",
                    details=f"Searched employees with query: '{q}'"
                )
            else:
                cursor.execute("SELECT name FROM employees WHERE employee_id = %s", (user_id,))
                emp = cursor.fetchone()
                emp_name = emp['name'] if emp else user_id
                audit_logger.log_employee_activity(
                    employee_id=user_id,
                    employee_name=emp_name,
                    action="Employee Search",
                    details=f"Searched employees with query: '{q}'"
                )

        # Get total count first
        if q:
            cursor.execute("""
                SELECT COUNT(*) as total FROM employees
                WHERE employee_id LIKE %s
                   OR name LIKE %s
                   OR email LIKE %s
                   OR department LIKE %s
            """, (f"%{q}%", f"%{q}%", f"%{q}%", f"%{q}%"))
        else:
            cursor.execute("SELECT COUNT(*) as total FROM employees")

        total_count = cursor.fetchone()['total']

        # Get employees with status, credentials, and profile details
        select_sql = """
            SELECT e.employee_id, e.name, e.title, e.email, e.department, e.city, e.state,
                   COALESCE(e.status, 'active') AS status,
                   e.phone, e.joining_date,
                   e.aadhaar_number, e.pan_number, e.emergency_contact_name, e.emergency_contact_relation,
                   ep.date_of_birth, ep.emergency_number, ep.current_address,
                   COALESCE((SELECT assigned_password FROM users u WHERE u.email = e.email OR u.user_id = e.employee_id LIMIT 1), '') AS assigned_password
            FROM employees e
            LEFT JOIN employee_profiles ep ON ep.employee_id = e.employee_id
        """
        if q:
            cursor.execute(select_sql + """
                WHERE e.employee_id LIKE %s
                   OR e.name LIKE %s
                   OR e.email LIKE %s
                   OR e.department LIKE %s
                ORDER BY e.id DESC
                LIMIT %s
            """, (f"%{q}%", f"%{q}%", f"%{q}%", f"%{q}%", limit))
        else:
            cursor.execute(select_sql + """
                ORDER BY e.id DESC
                LIMIT %s
            """, (limit,))

        employees = cursor.fetchall()
        cursor.close()
        conn.close()

        return {"success": True, "results": employees, "total": total_count}
    except Exception as e:
        return {"success": False, "results": [], "total": 0, "message": str(e)}

# Endpoint to load employees from DB to JSON and return them
@app.get("/api/employees/load")
async def load_and_get_employees():
    try:
        # Load employees from MySQL using the imported function
        employees = get_all_employees()
        
        # Also save to users_data.json for frontend compatibility
        users_data_path = "data/users_data.json"
        with open(users_data_path, 'w') as f:
            json.dump(employees, f, indent=2)
        
        return {"success": True, "employees": employees, "count": len(employees)}
    except Exception as e:
        return {"success": False, "message": str(e)}

# Debug endpoint
@app.get("/api/debug/db")
async def debug_db():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT COUNT(*) as count FROM employees")
        result = cursor.fetchone()
        cursor.close()
        conn.close()
        return {"success": True, "count": result['count']}
    except Exception as e:
        return {"success": False, "error": str(e)}

# Temporary simple tasks endpoint - shows all tasks
@app.get("/api/tasks/simple")
def get_tasks_simple():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM tasks ORDER BY created_at DESC")
        tasks = cursor.fetchall()
        conn.close()
        return {"success": True, "tasks": tasks}
    except Exception as e:
        return {"success": False, "message": str(e), "tasks": []}

# Get tasks for specific user
@app.get("/api/tasks/user/{user_id}")
def get_user_tasks(user_id: str):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # First try to get employee name from employee_id
        cursor.execute("SELECT CONCAT(first_name, ' ', last_name) as full_name FROM employees WHERE employee_id = %s", (user_id,))
        employee_result = cursor.fetchone()
        
        if employee_result:
            employee_name = employee_result['full_name']
            # Search by employee name
            cursor.execute("SELECT * FROM tasks WHERE TRIM(assigned_to) = TRIM(%s) ORDER BY created_at DESC", (employee_name,))
            tasks = cursor.fetchall()
        else:
            # Fallback: try direct match with user_id
            cursor.execute("SELECT * FROM tasks WHERE assigned_to = %s ORDER BY created_at DESC", (user_id,))
            tasks = cursor.fetchall()
            
            # If no tasks found, try trimmed match (handle trailing spaces)
            if not tasks:
                cursor.execute("SELECT * FROM tasks WHERE TRIM(assigned_to) = TRIM(%s) ORDER BY created_at DESC", (user_id,))
                tasks = cursor.fetchall()
        
        conn.close()
        return {"success": True, "tasks": tasks}
    except Exception as e:
        return {"success": False, "message": str(e), "tasks": []}

# Delete task endpoint
@app.delete("/api/tasks/{task_id}")
def delete_task(task_id: str):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM tasks WHERE task_id = %s", (task_id,))
        conn.commit()
        cursor.close()
        conn.close()
        return {"success": True, "message": "Task deleted successfully"}
    except Exception as e:
        return {"success": False, "message": str(e)}

# Main employees endpoint that frontend likely calls
@app.get("/api/employees/all")
async def get_all_employees_endpoint(user_id: str = None, user_role: str = None):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Log activity
        if user_id:
            if user_role == "admin":
                audit_logger.log_admin_activity(
                    admin_id=user_id,
                    admin_name="Administrator",
                    action="View All Employees",
                    details="Accessed complete employee directory"
                )
            else:
                cursor.execute("SELECT CONCAT(first_name, ' ', last_name) as name FROM employees WHERE employee_id = %s", (user_id,))
                emp = cursor.fetchone()
                emp_name = emp['name'] if emp else user_id
                audit_logger.log_employee_activity(
                    employee_id=user_id,
                    employee_name=emp_name,
                    action="View Employee Directory",
                    details="Accessed employee directory"
                )
        
        cursor.execute("SELECT * FROM employees")
        employees = cursor.fetchall()
        cursor.close()
        conn.close()
        return {"success": True, "data": employees}
    except Exception as e:
        return {"success": False, "message": str(e)}

# Endpoint to get all employees (updated to use the imported function)
@app.get("/api/employees")
async def get_all_employees_api():
    try:
        # Use the imported get_all_employees function that handles MySQL
        employees = get_all_employees()
        return {"success": True, "employees": employees, "count": len(employees)}
    except Exception as e:
        return {"success": False, "message": str(e)}

@app.get("/api/employees/list")
async def list_employees_for_team():
    """Lightweight employee list for team management dropdowns (user_id + full_name + role)."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT user_id AS employee_id, full_name, role, email
            FROM users
            WHERE COALESCE(is_active, 1) = 1
            ORDER BY full_name
        """)
        employees = cursor.fetchall()
        cursor.close()
        conn.close()
        return {"success": True, "employees": employees, "count": len(employees)}
    except Exception as e:
        return {"success": False, "employees": [], "message": str(e)}

# Endpoint to get employees grouped by department
@app.get("/api/departments/employees")
async def get_department_employees():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT e.employee_id, e.name, e.title, e.email, e.city, e.state,
                   d.department_name, d.department_id
            FROM employees e
            LEFT JOIN employee_departments ed ON e.employee_id = ed.employee_id
            LEFT JOIN departments d ON ed.department_id = d.department_id
            ORDER BY d.department_name, e.name
        """)
        
        employees = cursor.fetchall()
        cursor.close()
        conn.close()
        
        dept_employees = {}
        for emp in employees:
            dept_name = emp.get('department_name') or 'Unassigned'
            if dept_name not in dept_employees:
                dept_employees[dept_name] = []
            dept_employees[dept_name].append(emp)
        
        return {"success": True, "departments": dept_employees}
    except Exception as e:
        return {"success": False, "message": str(e)}

# Profile Completion Endpoint
@app.post("/api/profile/complete")
async def complete_profile(
    employee_id: str = Form(...),
    is_fresher: str = Form(...),
    date_of_birth: str = Form(...),
    gender: str = Form(...),
    marital_status: str = Form(...),
    nationality: str = Form(...),
    photograph: Optional[UploadFile] = File(None),
    current_address: str = Form(...),
    permanent_address: str = Form(...),
    emergency_number: str = Form(...),
    aadhaar_number: str = Form(...),
    aadhaar_image: Optional[UploadFile] = File(None),
    pan_number: str = Form(...),
    pan_image: Optional[UploadFile] = File(None),
    highest_qualification: str = Form(...),
    degree_certificates: Optional[List[UploadFile]] = File(None),
    university_name: str = Form(...),
    year_of_passing: str = Form(...),
    experience_letters: Optional[List[UploadFile]] = File(None),
    relieving_letter: Optional[UploadFile] = File(None),
    bank_name: str = Form(...),
    account_holder_name: str = Form(...),
    account_number: str = Form(...),
    ifsc_code: str = Form(...),
    branch_name: Optional[str] = Form(None),
    signature: Optional[UploadFile] = File(None),
):
    # Debug: Log all incoming form fields and files
    print("[DEBUG] Incoming profile completion request:")
    print("employee_id:", employee_id)
    print("is_fresher:", is_fresher)
    print("date_of_birth:", date_of_birth)
    print("gender:", gender)
    print("marital_status:", marital_status)
    print("nationality:", nationality)
    print("current_address:", current_address)
    print("permanent_address:", permanent_address)
    print("emergency_number:", emergency_number)
    print("aadhaar_number:", aadhaar_number)
    print("pan_number:", pan_number)
    print("highest_qualification:", highest_qualification)
    print("university_name:", university_name)
    print("year_of_passing:", year_of_passing)
    print("bank_name:", bank_name)
    print("account_holder_name:", account_holder_name)
    print("account_number:", account_number)
    print("ifsc_code:", ifsc_code)
    print("branch_name:", branch_name)
    print("Files:")
    print("photograph:", photograph.filename if photograph else None)
    print("aadhaar_image:", aadhaar_image.filename if aadhaar_image else None)
    print("pan_image:", pan_image.filename if pan_image else None)
    print("degree_certificates:", [f.filename for f in degree_certificates] if degree_certificates else None)
    print("signature:", signature.filename if signature else None)
    print("experience_letters:", [f.filename for f in experience_letters] if experience_letters else None)
    print("relieving_letter:", relieving_letter.filename if relieving_letter else None)

    errors = []
    is_fresher_bool = str(is_fresher) == "1"

    # Mandatory file checks
    if not photograph:
        errors.append("Photograph is required.")
    if not aadhaar_image:
        errors.append("Aadhaar image is required.")
    if not pan_image:
        errors.append("PAN image is required.")
    if not degree_certificates or not any(degree_certificates):
        errors.append("Degree certificates are required.")
    if not signature:
        errors.append("Signature is required.")

    # Experience document checks
    if not is_fresher_bool:
        if not experience_letters or not any(experience_letters):
            errors.append("Experience Letters are mandatory for experienced candidates.")
        if not relieving_letter:
            errors.append("Relieving Letter is mandatory for experienced candidates.")

    if errors:
        return {"success": False, "message": "Validation errors: " + "; ".join(errors), "errors": errors}

    if profile_system is None:
        raise HTTPException(status_code=503, detail="Service not ready")

    # Save files
    try:
        async def save_file(file: UploadFile, doc_type: str, idx: Optional[int] = None):
            try:
                fname = file.filename
                if idx is not None:
                    fname = f"{idx+1}_{fname}"
                content = await file.read()
                dir_path = os.path.join("employee_data", employee_id, doc_type)
                try:
                    os.makedirs(dir_path, exist_ok=True)
                except Exception as dir_err:
                    print(f"[ERROR] Failed to create directory {dir_path}: {dir_err}")
                    raise Exception(f"Directory creation failed: {dir_err}")
                if not os.access(dir_path, os.W_OK):
                    print(f"[ERROR] Directory not writable: {dir_path}")
                    raise Exception(f"Directory not writable: {dir_path}")
                try:
                    result = profile_system.save_uploaded_file(employee_id, content, doc_type, fname)
                except Exception as file_err:
                    print(f"[ERROR] File save failed for {fname}: {file_err}")
                    raise Exception(f"File save failed: {file_err}")
                return result
            except Exception as e:
                print(f"[EXCEPTION] save_file({doc_type}, {fname}): {e}")
                raise

        try:
            # Photograph
            photo_path = await save_file(photograph, "photograph") if photograph else None
            aadhaar_path = await save_file(aadhaar_image, "aadhaar") if aadhaar_image else None
            pan_path = await save_file(pan_image, "pan") if pan_image else None
            cert_paths = []
            if degree_certificates:
                for idx, cert in enumerate(degree_certificates):
                    if cert:
                        cert_paths.append(await save_file(cert, "degree_certificates", idx))
            signature_path = await save_file(signature, "signature") if signature else None
            exp_paths = []
            if experience_letters and not is_fresher_bool:
                for idx, exp in enumerate(experience_letters):
                    if exp:
                        exp_paths.append(await save_file(exp, "experience", idx))
            relieving_path = await save_file(relieving_letter, "relieving_letter") if relieving_letter and not is_fresher_bool else None
        except Exception as file_save_error:
            print(f"[EXCEPTION] During file save: {file_save_error}")
            return {"success": False, "message": f"File save error: {file_save_error}"}

        # Save profile data
        profile_data = {
            "date_of_birth": date_of_birth,
            "gender": gender,
            "marital_status": marital_status,
            "nationality": nationality,
            "photograph_path": photo_path,
            "current_address": current_address,
            "permanent_address": permanent_address,
            "emergency_number": emergency_number,
            "aadhaar_number": aadhaar_number,
            "aadhaar_image_path": aadhaar_path,
            "pan_number": pan_number,
            "pan_image_path": pan_path,
            "highest_qualification": highest_qualification,
            "degree_certificates_path": ",".join(cert_paths),
            "university_name": university_name,
            "year_of_passing": year_of_passing,
            "is_fresher": is_fresher_bool,
            "experience_letters_path": ",".join(exp_paths) if exp_paths else None,
            "relieving_letter_path": relieving_path,
            "bank_name": bank_name,
            "account_holder_name": account_holder_name,
            "account_number": account_number,
            "ifsc_code": ifsc_code,
            "branch_name": branch_name,
            "signature_path": signature_path,
        }
        try:
            result = profile_system.save_profile_data(employee_id, profile_data)
        except Exception as db_error:
            print(f"[EXCEPTION] Database save error: {db_error}")
            return {"success": False, "message": f"Database error: {db_error}"}
        if not result.get("success"):
            print(f"[ERROR] Profile data save failed: {result.get('message')}")
            return {"success": False, "message": result.get("message", "Failed to save profile data.")}
        return {"success": True, "message": "Profile completed successfully."}
    except Exception as e:
        import traceback
        print(f"[EXCEPTION] Unexpected error: {e}\n{traceback.format_exc()}")
        return {"success": False, "message": f"Unexpected error: {e}", "trace": traceback.format_exc()}


class ChatRequest(BaseModel):
    user_id: str
    message: str


class LoginRequest(BaseModel):
    username: str
    password: str


class SignupRequest(BaseModel):
    full_name: str
    username: str
    email: str
    password: str
    phone: str = ""
    department: str = ""
    work_mode: str = ""
    enroll_id: str = ""


@app.post("/api/employee/first-login-setup")
async def employee_first_login_setup(request: Request):
    """
    At first sign-in with HR-assigned credentials, employee enters:
    - Aadhaar number (12 digits)
    - PAN (10 characters)
    - Residential address
    - Emergency contact name and relationship
    - Emergency contact phone
    - Date of birth (YYYY-MM-DD)
    Employee cannot change the assigned password.
    """
    try:
        data = await request.json()
    except Exception:
        return {"success": False, "message": "Invalid JSON body"}

    emp_id = str(data.get("employee_id") or "").strip()
    if not emp_id:
        return {"success": False, "message": "Employee ID is required."}

    aadhaar = str(data.get("aadhaar_number") or "").replace(" ", "").replace("-", "").strip()
    pan = str(data.get("pan_number") or "").strip().upper()
    address = str(data.get("residential_address") or data.get("current_address") or "").strip()
    emerg_name = str(data.get("emergency_contact_name") or "").strip()
    emerg_relation = str(data.get("emergency_contact_relation") or "").strip()
    emerg_phone = str(data.get("emergency_number") or data.get("emergency_phone") or "").strip()
    dob = str(data.get("date_of_birth") or "").strip()

    if not aadhaar or len(aadhaar) != 12 or not aadhaar.isdigit():
        return {"success": False, "message": "Aadhaar number must be exactly 12 digits."}

    if not pan or len(pan) != 10 or not pan.isalnum():
        return {"success": False, "message": "PAN number must be 10 alphanumeric characters."}

    if not address:
        return {"success": False, "message": "Residential address is required."}

    if not emerg_name:
        return {"success": False, "message": "Emergency contact name is required."}

    if not emerg_relation:
        return {"success": False, "message": "Emergency contact relationship is required."}

    if not emerg_phone or len(emerg_phone) < 10:
        return {"success": False, "message": "Valid emergency contact phone number is required."}

    if not dob:
        return {"success": False, "message": "Date of birth is required."}

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # 1. Update/Insert in employee_profiles
        cursor.execute("""
            INSERT INTO employee_profiles
                (employee_id, aadhaar_number, pan_number, current_address, permanent_address,
                 emergency_contact_name, emergency_contact_relation, emergency_number,
                 date_of_birth, profile_completed, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 1, NOW())
            ON DUPLICATE KEY UPDATE
                aadhaar_number = VALUES(aadhaar_number),
                pan_number = VALUES(pan_number),
                current_address = VALUES(current_address),
                permanent_address = VALUES(permanent_address),
                emergency_contact_name = VALUES(emergency_contact_name),
                emergency_contact_relation = VALUES(emergency_contact_relation),
                emergency_number = VALUES(emergency_number),
                date_of_birth = VALUES(date_of_birth),
                profile_completed = 1,
                updated_at = NOW()
        """, (emp_id, aadhaar, pan, address, address, emerg_name, emerg_relation, emerg_phone, dob))

        # 2. Update employees table
        cursor.execute("""
            UPDATE employees
            SET aadhaar_number = %s,
                pan_number = %s,
                emergency_contact_name = %s,
                emergency_contact_relation = %s
            WHERE employee_code = %s OR employee_id = %s
        """, (aadhaar, pan, emerg_name, emerg_relation, emp_id, emp_id))

        # 3. Update users table (profile_completed = 1)
        email = str(data.get("email") or "").strip()
        cursor.execute("""
            UPDATE users
            SET profile_completed = 1
            WHERE user_id = %s OR (email != '' AND email = %s)
        """, (emp_id, email))

        conn.commit()
        cursor.close()
        conn.close()

        return {
            "success": True,
            "message": "First-login employee details saved successfully.",
            "profile_completed": True
        }
    except Exception as e:
        return {"success": False, "message": str(e)}


class LeaveApplicationRequest(BaseModel):
    leave_type: str
    start_date: str
    end_date: str
    reason: str = ""


class AdminLeaveOverrideRequest(BaseModel):
    request_id: str
    new_status: str
    reason: str = ""


@app.get("/health")
def health() -> str:
    return "ok"


@app.get("/health/db")
def health_db():
    """Database connectivity check: runs SELECT 1 and reports status."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT 1")
        cur.fetchone()
        cur.close()
        conn.close()
        return {"status": "success", "db": "connected"}
    except Exception as e:
        return {"status": "failed", "error": str(e)}




@app.post("/auth/login")
async def login(request: LoginRequest):
    """User login endpoint - Direct database authentication"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Check in users table
        cursor.execute("SELECT * FROM users WHERE username = %s", (request.username,))
        user = cursor.fetchone()
        conn.close()
        
        if not user:
            audit_logger.log_login_attempt(
                user_id=request.username,
                username=request.username,
                status="FAILED",
                ip_address="127.0.0.1",
                failure_reason="User not found"
            )
            return {"success": False, "message": "Invalid username or password"}

        if user.get('is_active') is False or user.get('is_active') == 0:
            audit_logger.log_login_attempt(
                user_id=user.get('user_id', request.username),
                username=request.username,
                status="FAILED",
                ip_address="127.0.0.1",
                failure_reason="Account is deactivated"
            )
            return {"success": False, "message": "Your account has been deactivated. Please contact HR."}
        
        # Support both bcrypt-hashed (new signups) and legacy plain-text passwords
        import bcrypt as _bcrypt
        stored = user['password']
        if stored.startswith('$2b$') or stored.startswith('$2a$'):
            password_ok = _bcrypt.checkpw(request.password.encode(), stored.encode())
        else:
            password_ok = (stored == request.password)
        if not password_ok:
            audit_logger.log_login_attempt(
                user_id=user['user_id'],
                username=request.username,
                status="FAILED",
                ip_address="127.0.0.1",
                failure_reason="Invalid password"
            )
            return {"success": False, "message": "Invalid username or password"}
        
        # Generate simple OTP
        import random
        import smtplib
        from email.message import EmailMessage
        import os
        
        otp = str(random.randint(100000, 999999))
        
        user_role = user.get('role', '').lower()
        if user_role == 'employee':
            user_email = user.get('email')
            if user_email:
                try:
                    from email.utils import make_msgid, formatdate
                    
                    msg = EmailMessage()
                    msg["Subject"] = "Seawind Solution HRMS - Your OTP"
                    msg["From"] = os.getenv("EMAIL_USER", "info@seawindsolution.in")
                    msg["To"] = user_email
                    msg["Message-ID"] = make_msgid()
                    msg["Date"] = formatdate(localtime=True)

                    
                    # Use HTML formatting to prevent webmail outgoing spam filters from blocking it
                    html_content = f"""
                    <html>
                        <body style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                            <h2 style="color: #1e40af;">Seawind Solution HRMS</h2>
                            <p>Hello,</p>
                            <p>You have requested to log in to your account. Please use the following One-Time Password (OTP) to complete your secure login:</p>
                            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center;">
                                <h1 style="letter-spacing: 5px; margin: 0; color: #1f2937;">{otp}</h1>
                            </div>
                            <p>This code is strictly confidential. Do not share it with anyone.</p>
                            <p style="margin-top: 30px; font-size: 12px; color: #6b7280;">
                                This is an automated message from the Seawind Solution HRMS system. Please do not reply to this email.
                            </p>
                        </body>
                    </html>
                    """
                    msg.set_content("Your OTP for login is: " + otp) # Plaintext fallback
                    msg.add_alternative(html_content, subtype='html')
                    
                    # Log to console so it can be used during local testing if SMTP isn't configured yet
                    print(f"\n==========================================")
                    print(f"OTP GENERATED FOR {user_email}: {otp}")
                    print(f"==========================================\n")
                    
                    smtp_host = os.getenv("SMTP_SERVER", os.getenv("SMTP_HOST", "localhost"))
                    smtp_port = int(os.getenv("SMTP_PORT", "587"))
                    smtp_user = os.getenv("EMAIL_USER", os.getenv("SMTP_USER", ""))
                    smtp_pass = os.getenv("EMAIL_PASSWORD", os.getenv("SMTP_PASS", ""))
                    
                    print(f"Attempting to send OTP via SMTP...")
                    print(f"Host: {smtp_host}, Port: {smtp_port}, User: {smtp_user}")
                    
                    if smtp_port == 465:
                        # Use direct SSL for port 465
                        with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=10) as server:
                            if smtp_user and smtp_pass:
                                server.login(smtp_user, smtp_pass)
                            server.send_message(msg)
                    else:
                        # Use STARTTLS for 587 or 25
                        with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
                            if smtp_user and smtp_pass:
                                server.starttls()
                                server.login(smtp_user, smtp_pass)
                            server.send_message(msg)
                    print("Email successfully dispatched to SMTP server!"); email_sent = True
                except Exception as e:
                    print(f"==========================================")
                    print(f"CRITICAL ERROR: Failed to send OTP email!")
                    print(f"Error Details: {e}")
                    print(f"==========================================")
            
            email_sent = 'email_sent' in locals() and email_sent
            resp = {
                "success": True,
                "requires_otp": True,
                "message": f"OTP sent to {user_email}" if email_sent else (f"Email dispatch failed. Fallback OTP: {otp}" if user_email else "OTP generated"),
            }
            # If email delivery failed or was not configured, provide OTP so employee is not blocked
            if not email_sent:
                resp["otp"] = otp
            return resp
        else:
            return {
                "success": True,
                "requires_otp": True,
                "otp": otp,
                "message": "OTP generated (Dev bypass)"
            }
    except Exception as e:
        return {"success": False, "message": str(e)}

@app.post("/auth/verify-otp")
async def verify_otp(request: dict):
    """Verify OTP and complete login - Simplified version"""
    try:
        username = request.get("username")
        otp = request.get("otp")
        
        # For simplicity, accept any 6-digit OTP
        if not otp or len(otp) != 6:
            return {"success": False, "message": "Invalid OTP"}
        
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM users WHERE username = %s", (username,))
        user = cursor.fetchone()
        conn.close()
        
        if not user:
            return {"success": False, "message": "User not found"}

        if user.get('is_active') is False or user.get('is_active') == 0:
            return {"success": False, "message": "Your account has been deactivated. Please contact HR."}
        
        # Log successful login
        audit_logger.log_login_attempt(
            user_id=user['user_id'],
            username=username,
            status="SUCCESS",
            ip_address="127.0.0.1"
        )
        
        # Return user data with role-based dashboard redirect
        role_dashboards = {
            'admin': '/dashboard',
            'hr': '/dashboard',
            'sub_hr': '/dashboard',
            'accountant': '/accountant',
            'support': '/support',
            'employee': '/employee/dashboard',
        }
        dashboard = role_dashboards.get(user.get('role', ''), '/dashboard')
        return {
            "success": True,
            "dashboard": dashboard,
            "token": f"token_{user['user_id']}",
            "user": {
                "user_id": user['user_id'],
                "username": user['username'],
                "email": user.get('email', ''),
                "full_name": user.get('full_name', ''),
                "role": user['role'],
                "profile_completed": bool(user.get('profile_completed', 0))
            }
        }
    except Exception as e:
        return {"success": False, "message": f"OTP verification error: {str(e)}"}



@app.post("/api/auth/login")
async def api_login(request: LoginRequest):
    """API alias for /auth/login — called by the frontend."""
    return await login(request)

@app.post("/api/auth/verify-otp")
async def api_verify_otp(request: dict):
    """API alias for /auth/verify-otp — called by the frontend."""
    return await verify_otp(request)


def generate_employee_code(cursor) -> str:
    """Unique, non-sequential employee ID like SWS26-K7M2 (company + joining year + 4 random chars)."""
    import secrets
    from datetime import date as _d
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"   # no 0/O/1/I to avoid misreading
    prefix = f"SWS{_d.today().strftime('%y')}"
    for _ in range(50):
        code = f"{prefix}-" + "".join(secrets.choice(alphabet) for _ in range(4))
        cursor.execute("SELECT 1 FROM employees WHERE employee_code = %s UNION SELECT 1 FROM users WHERE user_id = %s", (code, code))
        if not cursor.fetchall():
            return code
    raise RuntimeError("Could not generate a unique employee ID")


@app.post("/api/auth/signup")
async def employee_signup(request: SignupRequest):
    """Public self-registration is disabled per company policy. Employees can only be registered via HR invitation/creation."""
    return {
        "success": False,
        "message": "Self-registration is disabled. Employee accounts can only be created by HR in the admin portal."
    }
    if request.work_mode.strip().upper() not in ('WFO', 'WFH'):
        return {"success": False, "message": "Please choose a work mode (Work from Office or Work from Home)."}
    if not department:
        return {"success": False, "message": "Department is required."}
    if not phone:
        return {"success": False, "message": "Phone number is required."}

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Prevent duplicate username
        cursor.execute("SELECT user_id FROM users WHERE username = %s", (username,))
        if cursor.fetchone():
            cursor.close(); conn.close()
            return {"success": False, "message": "Username already taken."}

        # Prevent duplicate email (both tables)
        cursor.execute("SELECT user_id FROM users WHERE email = %s", (email,))
        if cursor.fetchone():
            cursor.close(); conn.close()
            return {"success": False, "message": "Email already registered."}

        cursor.execute("SELECT id FROM employees WHERE email = %s", (email,))
        if cursor.fetchone():
            cursor.close(); conn.close()
            return {"success": False, "message": "Email already registered."}

        employee_code = generate_employee_code(cursor)

        # Hash password
        pw_hash = _bcrypt.hashpw(password.encode(), _bcrypt.gensalt()).decode()

        work_mode = request.work_mode.strip().upper() if request.work_mode.strip().upper() in ('WFO', 'WFH') else None

        # Insert employees row
        cursor.execute("""
            INSERT INTO employees
                (employee_code, full_name, email, phone, department, joining_date, status, default_work_mode)
            VALUES (%s, %s, %s, %s, %s, CURDATE(), 'active', %s)
        """, (employee_code, full_name, email, phone, department, work_mode))
        conn.commit()

        # Insert users row — role forced to 'employee'
        cursor.execute("""
            INSERT INTO users
                (user_id, username, email, password, role, full_name, is_active, profile_completed)
            VALUES (%s, %s, %s, %s, 'employee', %s, 1, 0)
        """, (employee_code, username, email, pw_hash, full_name))
        conn.commit()

        # Tell every active HR/admin user that this employee needs salary details.
        try:
            cursor.execute("SELECT user_id FROM users WHERE LOWER(role) IN ('hr', 'admin', 'sub_hr') AND COALESCE(is_active, 1) = 1")
            recipients = [r["user_id"] for r in cursor.fetchall()]
            if recipients:
                cursor.executemany(
                    "INSERT INTO notifications (user_id, title, message, type) VALUES (%s, %s, %s, %s)",
                    [(uid, "New employee signed up - add salary",
                      f"{full_name} ({employee_code}, {department}, {work_mode}) has registered. "
                      f"Add their salary details so payroll and payslips can be generated.",
                      "new_employee_salary") for uid in recipients])
                conn.commit()
        except Exception as exc:
            logger.warning("signup: could not notify HR: %s", exc)

        cursor.close()
        conn.close()

        return {
            "success": True,
            "message": "Account created successfully. You can now log in.",
            "employee_id": employee_code,
        }
    except Exception as e:
        return {"success": False, "message": str(e)}


# Legacy HTML-serving routes removed (/, /login, /dashboard, /employees,
# /attendance, /payroll, /admin, /accountant, /kanban, /profile, /gps-attendance,
# /add-employee, …). They served the trashed frontend_backup_python UI and are
# fully replaced by the React app (frontend-react). All /api/* routes are unchanged.

@app.get("/api/tasks/kanban")
def get_tasks_kanban(user_id: str = None, user_role: str = None):
    """Get tasks formatted for Kanban board - uses existing tasks table"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Get tasks based on role
        if user_role == 'admin' or user_role == 'hr':
            cursor.execute("SELECT * FROM tasks ORDER BY created_at DESC")
        elif user_id:
            cursor.execute("SELECT CONCAT(first_name, ' ', last_name) as full_name FROM employees WHERE employee_id = %s", (user_id,))
            emp = cursor.fetchone()
            if emp:
                cursor.execute("SELECT * FROM tasks WHERE TRIM(assigned_to) = TRIM(%s) ORDER BY created_at DESC", (emp['full_name'],))
            else:
                cursor.execute("SELECT * FROM tasks WHERE TRIM(assigned_to) = TRIM(%s) ORDER BY created_at DESC", (user_id,))
        else:
            cursor.execute("SELECT * FROM tasks ORDER BY created_at DESC")
        
        tasks = cursor.fetchall()
        conn.close()
        
        # Map existing status to Kanban columns
        status_map = {
            'To Do': 'todo',
            'Pending': 'todo',
            'In Progress': 'in_progress',
            'Completed': 'done'
        }
        
        # Group tasks by Kanban status
        kanban_tasks = {'todo': [], 'in_progress': [], 'done': []}
        
        for task in tasks:
            original_status = task.get('status', 'To Do')
            kanban_status = status_map.get(original_status, 'todo')
            
            # Format task for Kanban
            kanban_task = {
                'id': task.get('id'),
                'task_id': task.get('task_id'),
                'title': task.get('title'),
                'description': task.get('description'),
                'status': kanban_status,
                'original_status': original_status,
                'priority': task.get('priority', 'Medium').lower(),
                'assigned_to': task.get('assigned_to'),
                'assigned_by': task.get('assigned_by'),
                'due_date': str(task.get('due_date')) if task.get('due_date') else None,
                'category': task.get('category'),
                'created_at': str(task.get('created_at'))
            }
            
            kanban_tasks[kanban_status].append(kanban_task)
        
        return {"success": True, "tasks": kanban_tasks}
    except Exception as e:
        return {"success": False, "message": str(e), "tasks": {'todo': [], 'in_progress': [], 'review': [], 'done': []}}

@app.put("/api/tasks/kanban/{task_id}")
def update_task_kanban(task_id: str, update: dict):
    """Update task from Kanban board - maps Kanban status back to original status"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Map Kanban status back to original status
        reverse_status_map = {
            'todo': 'To Do',
            'in_progress': 'In Progress',
            'done': 'Completed'
        }
        
        kanban_status = update.get('status')
        if kanban_status:
            original_status = reverse_status_map.get(kanban_status, 'To Do')
            
            # Set actual dates based on status
            if original_status == 'In Progress':
                cursor.execute("UPDATE tasks SET status=%s, actual_start_date=COALESCE(actual_start_date, NOW()), last_edited_at=NOW() WHERE task_id=%s", 
                             (original_status, task_id))
            elif original_status == 'Completed':
                cursor.execute("UPDATE tasks SET status=%s, actual_end_date=NOW(), last_edited_at=NOW() WHERE task_id=%s", 
                             (original_status, task_id))
            else:
                cursor.execute("UPDATE tasks SET status=%s, last_edited_at=NOW() WHERE task_id=%s", 
                             (original_status, task_id))
        
        conn.commit()
        conn.close()
        return {"success": True}
    except Exception as e:
        return {"success": False, "message": str(e)}

@app.get("/portal", response_class=HTMLResponse)
async def serve_portal_direct(request: Request):
    """Direct link to HRMS portal (cache bypass)"""
    return templates.TemplateResponse(request, "hrms_portal.html")

@app.get("/new")
def serve_new_portal():
    """Serve new portal directly"""
    return _html_or_404("new_portal.html")

@app.get("/new_portal.html")
def serve_new_portal_direct():
    """Serve new portal HTML file directly"""
    return _html_or_404("new_portal.html")

@app.get("/files/{filename}")
def download_file_direct(filename: str):
    """Direct file download without content-disposition"""
    # Reject any path separators to prevent directory traversal
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    file_path = Path("generated_docs") / filename

    # Resolve and confirm the file stays inside generated_docs
    try:
        resolved = file_path.resolve()
        base_resolved = Path("generated_docs").resolve()
        resolved.relative_to(base_resolved)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid filename")

    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {filename}")

    if not filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files allowed")

    return FileResponse(
        path=str(file_path.absolute()),
        media_type="application/pdf",
        filename=filename
    )

@app.get("/chat", response_class=HTMLResponse)
async def serve_chat(request: Request):
    """Serve the simple chat interface"""
    return templates.TemplateResponse(request, "chat.html")

@app.get("/3d")
def serve_3d_interface():
    """Serve the 3D HRMS interface"""
    html_path = Path("templates/hrms_3d_simple.html")
    print(f"DEBUG: Looking for 3D template at: {html_path.absolute()}")
    print(f"DEBUG: File exists: {html_path.exists()}")
    
    if html_path.exists():
        return FileResponse(str(html_path.absolute()), media_type="text/html")
    
    # Return simple HTML if file not found
    return HTMLResponse("""
    <!DOCTYPE html>
    <html><head><title>3D Interface</title></head>
    <body><h1>3D HRMS Interface</h1><p>Template not found, but route works!</p></body>
    </html>
    """, media_type="text/html")

@app.get("/test-3d")
def serve_test_3d():
    """Serve the 3D test page"""
    test_path = Path("test_3d.html")
    if test_path.exists():
        return FileResponse(test_path)
    return {"message": "Test page not found"}

@app.get("/demo")
def serve_demo():
    """Serve the old demo HTML page"""
    demo_path = Path("demo/chat.html")
    if demo_path.exists():
        return FileResponse(demo_path)
    return {"message": "Demo file not found"}

@app.get("/test-download")
def serve_test_download():
    """Serve the PDF download test page"""
    test_path = Path("test_download_page.html")
    if test_path.exists():
        return FileResponse(test_path)
    return {"message": "Test page not found"}

# Simple document download endpoints for action cards
@app.get("/download-salary-slip")
async def download_salary_slip_simple():
    """Simple salary slip download for action cards"""
    try:
        from backend.core.document_generator import DocumentGenerator
        doc_gen = DocumentGenerator()
        
        # Default to emp004 (Amit Shah) for action card
        user_id = 'emp004'
        
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Get employee and salary data from database
        cursor.execute("""
            SELECT e.employee_id, CONCAT(e.first_name, ' ', e.last_name) as name, 
                   e.department, e.title,
                   ss.basic_salary, ss.hra, ss.transport_allowance, ss.medical_allowance, ss.special_allowance,
                   ss.pf_employee, ss.professional_tax, ss.tds_deduction, ss.gross_salary, ss.net_salary
            FROM employees e
            LEFT JOIN salary_structures ss ON e.employee_id = ss.employee_id AND ss.status = 'active'
            WHERE e.employee_id = %s
        """, (user_id,))
        
        result = cursor.fetchone()
        conn.close()
        
        if not result:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        # Use database values or calculate if not present
        basic = result.get('basic_salary') or 0
        hra = result.get('hra') or 0
        transport = result.get('transport_allowance') or 0
        medical = result.get('medical_allowance') or 0
        bonus = result.get('special_allowance') or 0
        gross = result.get('gross_salary') or (basic + hra + transport + medical + bonus)
        
        pf = result.get('pf_employee') or 0
        tax = result.get('tds_deduction') or 0
        pt = result.get('professional_tax') or 0
        total_deductions = pf + tax + pt
        net = result.get('net_salary') or (gross - total_deductions)
        
        salary_data = {
            'employee_id': user_id,
            'employee_name': result['name'],
            'department': result['department'],
            'position': result['title'],
            'month_year': datetime.now().strftime('%Y-%m'),
            'basic_salary': basic,
            'hra': hra,
            'transport': transport,
            'medical': medical,
            'bonus': bonus,
            'gross_salary': gross,
            'pf_deduction': pf,
            'tax_deduction': tax,
            'total_deductions': total_deductions,
            'net_salary': net
        }
        
        filename = doc_gen.generate_salary_slip(salary_data)
        file_path = Path("generated_docs") / filename
        
        return FileResponse(
            path=str(file_path.absolute()),
            filename=filename,
            media_type="application/pdf"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/download-experience-letter")
async def download_experience_letter_simple():
    """Simple experience letter download for action cards"""
    try:
        from backend.core.document_generator import DocumentGenerator
        doc_gen = DocumentGenerator()
        
        exp_data = {
            'employee_name': 'Employee',
            'employee_id': 'emp004',
            'designation': 'Employee',
            'department': 'General',
            'joining_date': '2023-01-01',
            'relieving_date': datetime.now().strftime('%Y-%m-%d')
        }
        
        filename = doc_gen.generate_experience_certificate(exp_data)
        file_path = Path("generated_docs") / filename
        
        return FileResponse(
            path=str(file_path.absolute()),
            filename=filename,
            media_type="application/pdf"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/download-offer-letter")
async def download_offer_letter_simple():
    """Simple offer letter download for action cards"""
    try:
        from backend.core.document_generator import DocumentGenerator
        doc_gen = DocumentGenerator()
        
        user_id = 'emp004'  # Default for action card
        
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT e.employee_id, CONCAT(e.first_name, ' ', e.last_name) as name, 
                   e.department, e.title, e.date_of_joining,
                   ss.annual_ctc, ss.basic_salary, ss.hra, ss.gross_salary, ss.net_salary
            FROM employees e
            LEFT JOIN salary_structures ss ON e.employee_id = ss.employee_id AND ss.status = 'active'
            WHERE e.employee_id = %s
        """, (user_id,))
        
        result = cursor.fetchone()
        conn.close()
        
        if not result:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        offer_data = {
            'candidate_name': result['name'],
            'position': result['title'],
            'department': result['department'],
            'annual_ctc': result.get('annual_ctc') or 0,
            'basic_salary': (result.get('basic_salary') or 0) * 12,
            'hra': (result.get('hra') or 0) * 12,
            'gross_salary': (result.get('gross_salary') or 0) * 12,
            'net_salary': (result.get('net_salary') or 0) * 12,
            'joining_date': result.get('date_of_joining') or datetime.now().strftime('%Y-%m-%d'),
            'employee_id': user_id
        }
        
        filename = doc_gen.generate_offer_letter(offer_data)
        file_path = Path("generated_docs") / filename
        
        return FileResponse(
            path=str(file_path.absolute()),
            filename=filename,
            media_type="application/pdf"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Additional endpoint variations for frontend compatibility
@app.get("/api/download-salary-slip")
async def api_download_salary_slip():
    return await download_salary_slip_simple()

@app.get("/api/download-experience-letter")
async def api_download_experience_letter():
    return await download_experience_letter_simple()

@app.get("/api/download-offer-letter")
async def api_download_offer_letter():
    return await download_offer_letter_simple()

@app.get("/salary-slip")
async def salary_slip_short():
    return await download_salary_slip_simple()

@app.get("/experience-letter")
async def experience_letter_short():
    return await download_experience_letter_simple()

@app.get("/offer-letter")
async def offer_letter_short():
    return await download_offer_letter_simple()

# JSON response endpoints for action cards
@app.get("/api/documents/salary-slip")
async def get_salary_slip_info():
    """Return salary slip download info as JSON"""
    try:
        from backend.core.document_generator import DocumentGenerator
        doc_gen = DocumentGenerator()
        
        salary_data = {
            'employee_id': 'emp004',
            'employee_name': 'Employee',
            'department': 'General',
            'position': 'Employee',
            'month_year': datetime.now().strftime('%Y-%m'),
            'basic_salary': 25000,
            'hra': 10000,
            'transport': 2000,
            'medical': 1500,
            'gross_salary': 50000,
            'pf_deduction': 6000,
            'tax_deduction': 5000,
            'total_deductions': 11000,
            'net_salary': 39000
        }
        
        filename = doc_gen.generate_salary_slip(salary_data)
        return {
            "success": True,
            "message": "Salary slip generated",
            "download_url": f"/download-salary-slip",
            "filename": filename
        }
    except Exception as e:
        return {"success": False, "message": str(e)}

@app.get("/api/documents/experience-letter")
async def get_experience_letter_info():
    """Return experience letter download info as JSON"""
    try:
        from backend.core.document_generator import DocumentGenerator
        doc_gen = DocumentGenerator()
        
        exp_data = {
            'employee_name': 'Employee',
            'employee_id': 'emp004',
            'designation': 'Employee',
            'department': 'General',
            'joining_date': '2023-01-01',
            'relieving_date': datetime.now().strftime('%Y-%m-%d')
        }
        
        filename = doc_gen.generate_experience_certificate(exp_data)
        return {
            "success": True,
            "message": "Experience letter generated",
            "download_url": f"/download-experience-letter",
            "filename": filename
        }
    except Exception as e:
        return {"success": False, "message": str(e)}

@app.get("/api/documents/offer-letter")
async def get_offer_letter_info():
    """Return offer letter download info as JSON"""
    try:
        from backend.core.document_generator import DocumentGenerator
        doc_gen = DocumentGenerator()
        
        offer_data = {
            'candidate_name': 'New Employee',
            'position': 'Employee',
            'department': 'General',
            'salary': 'Rs. 5,00,000 per annum',
            'joining_date': (datetime.now() + timedelta(days=15)).strftime('%Y-%m-%d'),
            'employee_id': 'NEW001'
        }
        
        filename = doc_gen.generate_offer_letter(offer_data)
        return {
            "success": True,
            "message": "Offer letter generated",
            "download_url": f"/download-offer-letter",
            "filename": filename
        }
    except Exception as e:
        return {"success": False, "message": str(e)}

# Catch-all document endpoints
@app.get("/documents/{doc_type}")
async def download_any_document(doc_type: str):
    """Catch-all endpoint for any document type"""
    if "salary" in doc_type.lower():
        return await download_salary_slip_simple()
    elif "experience" in doc_type.lower():
        return await download_experience_letter_simple()
    elif "offer" in doc_type.lower():
        return await download_offer_letter_simple()
    else:
        return await download_salary_slip_simple()  # Default

@app.get("/api/documents/{doc_type}")
async def api_download_any_document(doc_type: str):
    """API catch-all endpoint for any document type"""
    if "salary" in doc_type.lower():
        return await download_salary_slip_simple()
    elif "experience" in doc_type.lower():
        return await download_experience_letter_simple()
    elif "offer" in doc_type.lower():
        return await download_offer_letter_simple()
    else:
        return await download_salary_slip_simple()  # Default

@app.get("/test-documents")
def serve_test_documents():
    """Serve document test page"""
    return _html_or_404("test_documents.html")

@app.get("/debug")
def serve_debug():
    """Serve the debug page"""
    debug_path = Path("debug_download.html")
    if debug_path.exists():
        return FileResponse(debug_path)
    return {"message": "Debug page not found"}


@app.get("/download/{filename}")
def download_file(filename: str, user_id: str = None, user_role: str = None):
    """Download generated documents (PDF files only)"""
    import os

    # Reject any path separators to prevent directory traversal
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    # Use current working directory + generated_docs
    file_path = Path("generated_docs") / filename

    # Resolve and confirm the file stays inside generated_docs
    try:
        resolved = file_path.resolve()
        base_resolved = Path("generated_docs").resolve()
        resolved.relative_to(base_resolved)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid filename")

    print(f"DEBUG: Looking for file at: {file_path.absolute()}")
    print(f"DEBUG: File exists: {file_path.exists()}")

    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {filename} at {file_path.absolute()}")

    # Only serve PDF files
    if not filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files can be downloaded")
    
    # Log document download activity
    if user_id:
        if user_role == "admin":
            audit_logger.log_admin_activity(
                admin_id=user_id,
                admin_name="Administrator",
                action="Document Downloaded",
                details=f"Downloaded document: {filename}"
            )
        else:
            try:
                conn = get_db_connection()
                cursor = conn.cursor(dictionary=True)
                cursor.execute("SELECT CONCAT(first_name, ' ', last_name) as name FROM employees WHERE employee_id = %s", (user_id,))
                emp = cursor.fetchone()
                emp_name = emp['name'] if emp else user_id
                conn.close()
                
                audit_logger.log_employee_activity(
                    employee_id=user_id,
                    employee_name=emp_name,
                    action="Document Downloaded",
                    details=f"Downloaded document: {filename}"
                )
            except:
                pass
    
    return FileResponse(
        path=str(file_path.absolute()),
        filename=filename,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Content-Type": "application/pdf"
        }
    )


@app.post("/chat")
def chat(req: ChatRequest):
    # Import enhanced assistant
    from backend.core.enhanced_ai_assistant import EnhancedHRMSAssistant
    ai_assistant = EnhancedHRMSAssistant()
    
    try:
        # Get user role from database
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT role FROM users WHERE user_id = %s", (req.user_id,))
        user_data = cursor.fetchone()
        conn.close()
        
        user_role = user_data['role'] if user_data else 'employee'
        
        # Check for document download requests
        message_lower = req.message.lower()
        
        # Handle salary slip download requests
        if any(keyword in message_lower for keyword in ['download salary slip', 'salary slip download', 'get salary slip', 'my salary slip']):
            try:
                # Get user info from session/token (you'll need to implement this)
                user_role = 'employee'  # Default to employee, get from actual session
                
                # Generate salary slip for current user
                conn = get_db_connection()
                cursor = conn.cursor(dictionary=True)
                
                # Get employee and salary data from database
                cursor.execute("""
                    SELECT e.employee_id, CONCAT(e.first_name, ' ', e.last_name) as name, 
                           e.department, e.title,
                           ss.basic_salary, ss.hra, ss.transport_allowance, ss.medical_allowance, ss.special_allowance,
                           ss.pf_employee, ss.professional_tax, ss.tds_deduction, ss.gross_salary, ss.net_salary
                    FROM employees e
                    LEFT JOIN salary_structures ss ON e.employee_id = ss.employee_id AND ss.status = 'active'
                    WHERE e.employee_id = %s
                """, (req.user_id,))
                
                emp = cursor.fetchone()
                conn.close()
                
                if emp:
                    from backend.core.document_generator import DocumentGenerator
                    doc_gen = DocumentGenerator()
                    
                    # Use database values or calculate if not present
                    basic = emp.get('basic_salary') or 0
                    hra = emp.get('hra') or 0
                    transport = emp.get('transport_allowance') or 0
                    medical = emp.get('medical_allowance') or 0
                    bonus = emp.get('special_allowance') or 0
                    gross = emp.get('gross_salary') or (basic + hra + transport + medical + bonus)
                    
                    pf = emp.get('pf_employee') or 0
                    tax = emp.get('tds_deduction') or 0
                    pt = emp.get('professional_tax') or 0
                    total_deductions = pf + tax + pt
                    net = emp.get('net_salary') or (gross - total_deductions)
                    
                    salary_data = {
                        'employee_id': req.user_id,
                        'employee_name': emp['name'],
                        'department': emp['department'],
                        'position': emp['title'],
                        'month_year': datetime.now().strftime('%Y-%m'),
                        'basic_salary': basic,
                        'hra': hra,
                        'transport': transport,
                        'medical': medical,
                        'bonus': bonus,
                        'gross_salary': gross,
                        'pf_deduction': pf,
                        'tax_deduction': tax,
                        'total_deductions': total_deductions,
                        'net_salary': net
                    }
                    
                    filename = doc_gen.generate_salary_slip(salary_data)
                    file_path = Path("generated_docs") / filename
                    
                    # Log activity
                    audit_logger.log_employee_activity(
                        employee_id=req.user_id,
                        employee_name=emp['name'],
                        action="Salary Slip Downloaded via AI",
                        details="Downloaded salary slip through AI assistant"
                    )
                    
                    # Return HTML with clickable download link for AI assistant
                    return {
                        "reply": f'✅ Your salary slip has been generated! <a href="http://localhost:8002/download/{filename}" target="_blank" style="color: #007bff; text-decoration: underline;">Click here to download</a>',
                        "intent": "document_download",
                        "download_url": f"http://localhost:8002/download/{filename}",
                        "filename": filename
                    }
                else:
                    return {
                        "reply": "❌ Sorry, I couldn't find your employee record. Please contact HR for assistance.",
                        "intent": "error",
                        "trace": {}
                    }
            except Exception as e:
                return {
                    "reply": f"❌ Sorry, there was an error generating your salary slip: {str(e)}",
                    "intent": "error",
                    "trace": {}
                }
        
        # Handle experience letter download requests
        elif any(keyword in message_lower for keyword in ['download experience letter', 'experience letter download', 'get experience letter', 'my experience letter']):
            try:
                conn = get_db_connection()
                cursor = conn.cursor(dictionary=True)
                cursor.execute("SELECT CONCAT(first_name, ' ', last_name) as name, title, department FROM employees WHERE employee_id = %s", (req.user_id,))
                emp = cursor.fetchone()
                conn.close()
                
                if emp:
                    from backend.core.document_generator import DocumentGenerator
                    doc_gen = DocumentGenerator()
                    
                    exp_data = {
                        'employee_name': emp['name'],
                        'employee_id': req.user_id,
                        'designation': emp.get('title', 'Employee'),
                        'department': emp.get('department', 'General'),
                        'joining_date': '2023-01-01',
                        'relieving_date': datetime.now().strftime('%Y-%m-%d')
                    }
                    
                    filename = doc_gen.generate_experience_certificate(exp_data)
                    file_path = Path("generated_docs") / filename
                    
                    # Log activity
                    audit_logger.log_employee_activity(
                        employee_id=req.user_id,
                        employee_name=emp['name'],
                        action="Experience Letter Downloaded via AI",
                        details="Downloaded experience letter through AI assistant"
                    )
                    
                    # Return HTML with clickable download link for AI assistant
                    return {
                        "reply": f'✅ Your experience letter has been generated! <a href="http://localhost:8002/download/{filename}" target="_blank" style="color: #007bff; text-decoration: underline;">Click here to download</a>',
                        "intent": "document_download",
                        "download_url": f"http://localhost:8002/download/{filename}",
                        "filename": filename
                    }
                else:
                    return {
                        "reply": "❌ Sorry, I couldn't find your employee record. Please contact HR for assistance.",
                        "intent": "error",
                        "trace": {}
                    }
            except Exception as e:
                return {
                    "reply": f"❌ Sorry, there was an error generating your experience letter: {str(e)}",
                    "intent": "error",
                    "trace": {}
                }
        
        # Get user role from database instead of hardcoding
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT role FROM users WHERE user_id = %s", (req.user_id,))
        user_data = cursor.fetchone()
        conn.close()
        
        user_role = user_data['role'] if user_data else 'employee'
        
        response = ai_assistant.process_message(
            message=req.message,
            user_id=req.user_id,
            user_role=user_role
        )
        return {"reply": response, "intent": "enhanced", "trace": {}}
    except Exception as e:
        print(f"Enhanced assistant error: {e}")
        return {"reply": "An error occurred. Please try again.", "intent": "error", "trace": {}}

# ── Document generation endpoints (return printable HTML) ────────────────────

def _get_emp(employee_id: str):
    """Fetch employee row from DB; raises ValueError if not found."""
    conn = get_db_connection()
    row = None
    try:
        cur = conn.cursor(dictionary=True)
        try:
            cur.execute("""
                SELECT e.employee_code AS employee_id,
                       e.full_name, e.department,
                       e.title, e.email, e.phone,
                       COALESCE(e.joining_date, e.date_of_joining) AS joining_date,
                       COALESCE(ss.basic_salary,0) AS basic_salary,
                       COALESCE(ss.hra,0) AS hra,
                       COALESCE(ss.transport_allowance,0) AS transport,
                       COALESCE(ss.medical_allowance,0) AS medical,
                       COALESCE(ss.special_allowance,0) AS bonus,
                       COALESCE(ss.gross_salary,0) AS gross_salary,
                       COALESCE(ss.pf_employee,0) AS pf,
                       COALESCE(ss.professional_tax,0) AS prof_tax,
                       COALESCE(ss.tds_deduction,0) AS tds,
                       COALESCE(ss.net_salary,0) AS net_salary
                FROM employees e
                LEFT JOIN salary_structures ss
                       ON e.employee_code = ss.employee_id AND ss.status = 'active'
                WHERE e.employee_code = %s OR e.id = %s LIMIT 1
            """, (employee_id, employee_id))
            row = cur.fetchone()
        except Exception:
            # salary_structures table may not exist — fall back to employees only
            try: conn.rollback()
            except Exception: pass
            cur2 = conn.cursor(dictionary=True)
            cur2.execute("""
                SELECT employee_code AS employee_id, full_name, department,
                       title, email, phone,
                       COALESCE(joining_date, date_of_joining) AS joining_date,
                       0 AS basic_salary, 0 AS hra, 0 AS transport, 0 AS medical,
                       0 AS bonus, 0 AS gross_salary, 0 AS pf, 0 AS prof_tax,
                       0 AS tds, 0 AS net_salary
                FROM employees
                WHERE employee_code = %s OR id = %s LIMIT 1
            """, (employee_id, employee_id))
            row = cur2.fetchone()
            cur2.close()
    finally:
        try: conn.close()
        except Exception: pass
    if not row:
        raise ValueError(f"Employee '{employee_id}' not found")
    return row

_CSS = """
<style>
 *{box-sizing:border-box;margin:0;padding:0}
 body{font-family:Arial,sans-serif;color:#1e293b;background:#fff;padding:32px}
 .hdr{text-align:center;border-bottom:3px solid #1e3a8a;padding-bottom:16px;margin-bottom:24px}
 .co{font-size:22px;font-weight:700;color:#1e3a8a}
 .doc-title{font-size:16px;font-weight:600;color:#64748b;margin-top:6px}
 .info{display:grid;grid-template-columns:1fr 1fr;gap:6px 20px;background:#f8fafc;padding:14px;border-radius:8px;margin-bottom:22px;font-size:13px}
 .info b{color:#374151}
 table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px}
 th{background:#1e3a8a;color:#fff;padding:9px 12px;text-align:left}
 td{padding:9px 12px;border-bottom:1px solid #e2e8f0}
 .tot{font-weight:700;background:#f1f5f9}
 .net{background:#1e3a8a;color:#fff;text-align:center;padding:14px;border-radius:8px;font-size:16px;font-weight:700}
 .body-text{line-height:1.8;font-size:14px;margin-bottom:16px}
 .sign{margin-top:40px;display:flex;justify-content:space-between}
 .sign div{text-align:center;min-width:160px}
 .sign p{border-top:1px solid #94a3b8;padding-top:6px;font-size:13px;color:#64748b}
 .print-btn{position:fixed;top:16px;right:16px;background:#3b82f6;color:#fff;border:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer}
 @media print{.print-btn{display:none}}
</style>
"""

def _doc_page(title: str, body: str) -> str:
    return f"""<!DOCTYPE html><html><head><meta charset="utf-8"><title>{title}</title>{_CSS}</head>
<body><button class="print-btn" onclick="window.print()">&#128424; Print / Save PDF</button>{body}</body></html>"""

@app.post("/api/documents/salary-slip")
async def salary_slip_endpoint(request: Request):
    try:
        body = await request.json()
        emp_id = (body.get("employee_id") or "").strip()
        month  = int(body.get("month", datetime.now().month))
        year   = int(body.get("year",  datetime.now().year))
        if not emp_id:
            return {"success": False, "message": "employee_id required"}
        emp = _get_emp(emp_id)
        month_name = datetime(year, month, 1).strftime("%B %Y")
        gross = emp["gross_salary"] or (emp["basic_salary"] + emp["hra"] + emp["transport"] + emp["medical"] + emp["bonus"])
        total_ded = emp["pf"] + emp["prof_tax"] + emp["tds"]
        net = emp["net_salary"] or (gross - total_ded)
        body_html = f"""
<div class="hdr"><div class="co">Seawind Solution Pvt. Ltd.</div><div class="doc-title">SALARY SLIP — {month_name}</div></div>
<div class="info">
 <div><b>Employee ID:</b> {emp["employee_id"]}</div><div><b>Name:</b> {emp["full_name"]}</div>
 <div><b>Designation:</b> {emp["title"] or "—"}</div><div><b>Department:</b> {emp["department"] or "—"}</div>
 <div><b>Email:</b> {emp["email"] or "—"}</div><div><b>Joining Date:</b> {emp["joining_date"] or "—"}</div>
</div>
<table>
 <tr><th>Earnings</th><th>Amount (₹)</th><th>Deductions</th><th>Amount (₹)</th></tr>
 <tr><td>Basic Salary</td><td>{emp["basic_salary"]:,.0f}</td><td>Provident Fund</td><td>{emp["pf"]:,.0f}</td></tr>
 <tr><td>HRA</td><td>{emp["hra"]:,.0f}</td><td>Professional Tax</td><td>{emp["prof_tax"]:,.0f}</td></tr>
 <tr><td>Transport Allowance</td><td>{emp["transport"]:,.0f}</td><td>TDS</td><td>{emp["tds"]:,.0f}</td></tr>
 <tr><td>Medical Allowance</td><td>{emp["medical"]:,.0f}</td><td></td><td></td></tr>
 <tr><td>Special Allowance</td><td>{emp["bonus"]:,.0f}</td><td></td><td></td></tr>
 <tr class="tot"><td>Gross Earnings</td><td>{gross:,.0f}</td><td>Total Deductions</td><td>{total_ded:,.0f}</td></tr>
</table>
<div class="net">Net Pay: ₹{net:,.0f}</div>
<div class="sign"><div><br><p>Employee Signature</p></div><div><br><p>HR Manager</p></div><div><br><p>Authorized Signatory</p></div></div>"""
        return {"success": True, "html": _doc_page(f"Salary Slip - {emp['full_name']}", body_html), "title": f"Salary Slip - {emp['full_name']} - {month_name}"}
    except ValueError as e:
        return {"success": False, "message": str(e)}
    except Exception as e:
        return {"success": False, "message": f"Error: {str(e)}"}

@app.get("/api/documents/salary-slip")
async def salary_slip_get():
    return await download_salary_slip_simple()

@app.post("/api/documents/offer-letter")
async def offer_letter_endpoint(request: Request):
    """
    Generate an Offer Letter PDF using the approved Seawind Solution template.
    docx2pdf (MS Word) may take 60+ seconds on first call (Word startup) — the
    frontend must use a 120-second timeout.  The conversion runs in a thread
    executor so other requests are not blocked.
    """
    import asyncio, logging as _log
    from backend.core import offer_letter_generator as olg
    _logger = _log.getLogger(__name__)

    try:
        body         = await request.json()
        emp_id       = (body.get("employee_id") or "").strip()
        position     = (body.get("position") or "").strip()
        salary_input = float(body.get("salary") or 0)
        joining_date = (body.get("joining_date") or datetime.now().strftime("%Y-%m-%d"))

        name_override    = (body.get("name") or body.get("employee_name") or "").strip()
        address_override = (body.get("address") or "").strip()
        email_override   = (body.get("email") or "").strip()

        skip_insert      = body.get("skip_insert", False)

        if not emp_id:
            return {"success": False, "message": "employee_id is required"}

        # ── Fetch employee ────────────────────────────────────────────────────
        try:
            emp = _get_emp(emp_id)
        except ValueError as ve:
            return {"success": False, "message": f"Employee not found: {emp_id}"}

        role = position or emp.get("title") or "Employee"
        _logger.info("Offer letter: emp=%s position=%s", emp_id, role)

        # ── Address ───────────────────────────────────────────────────────────
        if address_override:
            address = address_override
        else:
            address = ""
            try:
                conn   = get_db_connection()
                cursor = conn.cursor(dictionary=True)
                cursor.execute(
                    "SELECT current_address FROM employee_profiles WHERE employee_id = %s LIMIT 1",
                    (emp_id,)
                )
                prof    = cursor.fetchone()
                address = (prof or {}).get("current_address") or \
                          ", ".join(filter(None, [emp.get("city"), emp.get("state")])) or ""
                cursor.close(); conn.close()
            except Exception as ae:
                _logger.warning("address fetch failed: %s", ae)

        # ── Salary string ─────────────────────────────────────────────────────
        if salary_input > 0:
            monthly    = int(salary_input / 12)
            annual     = int(salary_input)
            salary_str = f"Rs. {monthly:,}/- per month (CTC Rs. {annual:,}/- per annum)"
        else:
            salary_str = ""
            try:
                conn   = get_db_connection()
                cursor = conn.cursor(dictionary=True)
                cursor.execute(
                    "SELECT basic_salary, annual_ctc FROM employee_salary WHERE employee_id = %s",
                    (emp_id,)
                )
                sal = cursor.fetchone()
                if sal:
                    ann = sal.get("annual_ctc")
                    mon = sal.get("basic_salary")
                    if mon and ann:
                        salary_str = f"Rs. {mon:,}/- per month (CTC Rs. {ann:,}/- per annum)"
                    elif ann:
                        salary_str = f"Rs. {ann:,}/- per annum"
                cursor.close(); conn.close()
            except Exception as se:
                _logger.warning("salary fetch failed: %s", se)

        if not salary_str:
            salary_str = "As per company standards"

        # ── Normalise joining date to DD-MM-YYYY ──────────────────────────────
        jd = joining_date
        if len(jd) == 10 and jd[4] == "-":
            try:
                jd = datetime.strptime(jd, "%Y-%m-%d").strftime("%d-%m-%Y")
            except ValueError:
                pass

        letter_data = {
            "employee_code": emp_id,
            "employee_name": name_override or emp.get("full_name") or "Candidate",
            "address":       address,
            "email":         email_override or emp.get("email") or "",
            "position":      role,
            "salary":        salary_str,
            "joining_date":  jd,
            "letter_date":   datetime.now().strftime("%d %B %Y"),
        }
        _logger.info("Offer letter data: %s", {k: v for k, v in letter_data.items() if k != 'salary'})

        # ── Generate PDF (docx2pdf runs Word — runs in thread to avoid blocking) ──
        try:
            loop     = asyncio.get_event_loop()
            filename = await loop.run_in_executor(None, olg.generate, letter_data)
            _logger.info("Offer letter file generated: %s", filename)
        except olg.TemplateNotConfiguredError as te:
            return {"success": False, "message": str(te)}
        except Exception as ge:
            _logger.exception("PDF generation failed")
            return {"success": False, "message": f"PDF generation failed: {ge}"}

        download_url = f"/api/documents/download/{filename}"

        # ── Persist in document_requests so employee can see it ───────────────
        try:
            _ensure_document_requests_table()
            conn2 = get_db_connection()
            cur2  = conn2.cursor()
            cur2.execute(
                """INSERT INTO document_requests
                       (employee_id, employee_name, document_type, reason, status, file_url)
                   VALUES (%s, %s, 'offer-letter', 'Generated by HR', 'generated', %s)""",
                (emp_id, letter_data["employee_name"], download_url)
            )
            conn2.commit()
            cur2.close(); conn2.close()
            _logger.info("Offer letter linked to employee %s in document_requests", emp_id)
        except Exception as dbe:
            _logger.warning("document_requests insert failed (non-fatal): %s", dbe)

        return {
            "success":      True,
            "filename":     filename,
            "filepath":     download_url,
            "download_url": download_url,
            "message":      f"Offer letter generated for {letter_data['employee_name']}",
        }

    except Exception as e:
        _logger.exception("offer_letter_endpoint unexpected error")
        return {"success": False, "message": f"Unexpected error: {e}"}

@app.get("/api/documents/offer-letter")
async def offer_letter_get():
    return await download_offer_letter_simple()

@app.post("/api/documents/experience-letter")
async def experience_letter_endpoint(request: Request):
    """
    Generate an Experience Letter PDF using the approved Seawind Solution template.
    Runs docx2pdf in a thread executor (blocks ~60s on first call).
    Frontend must use timeout >= 120 s.
    """
    import asyncio, logging as _log
    from backend.core import experience_letter_generator as elg
    _logger = _log.getLogger(__name__)

    try:
        body           = await request.json()
        emp_id         = (body.get("employee_id") or "").strip()
        position       = (body.get("position") or "").strip()
        department     = (body.get("department") or "").strip()
        start_date_raw = (body.get("start_date") or "").strip()
        end_date_raw   = (body.get("end_date") or datetime.now().strftime("%Y-%m-%d")).strip()
        skip_insert    = body.get("skip_insert", False)

        # Optional HR overrides
        name_override    = (body.get("name") or body.get("employee_name") or "").strip()
        address_override = (body.get("address") or "").strip()
        contact_override = (body.get("contact_no") or "").strip()
        email_override   = (body.get("email") or "").strip()

        if not emp_id:
            return {"success": False, "message": "employee_id is required"}
        if not start_date_raw:
            return {"success": False, "message": "start_date is required"}

        # ── Fetch employee ────────────────────────────────────────────────────
        try:
            emp = _get_emp(emp_id)
        except ValueError:
            return {"success": False, "message": f"Employee not found: {emp_id}"}

        role       = position   or emp.get("title")      or "Employee"
        dept       = department or emp.get("department") or ""
        _logger.info("Experience letter: emp=%s position=%s dept=%s", emp_id, role, dept)

        # ── Address ───────────────────────────────────────────────────────────
        if address_override:
            address = address_override
        else:
            address = ""
            try:
                conn   = get_db_connection()
                cursor = conn.cursor(dictionary=True)
                cursor.execute(
                    "SELECT current_address FROM employee_profiles WHERE employee_id = %s LIMIT 1",
                    (emp_id,)
                )
                prof    = cursor.fetchone()
                address = (prof or {}).get("current_address") or \
                          ", ".join(filter(None, [emp.get("city"), emp.get("state")])) or ""
                cursor.close(); conn.close()
            except Exception as ae:
                _logger.warning("address fetch failed: %s", ae)

        # ── Normalise dates to DD-MM-YYYY ─────────────────────────────────────
        def _to_dmy(raw: str) -> str:
            if len(raw) == 10 and raw[4] == "-":
                try:
                    return datetime.strptime(raw, "%Y-%m-%d").strftime("%d-%m-%Y")
                except ValueError:
                    pass
            return raw

        letter_data = {
            "employee_code": emp_id,
            "employee_name": name_override    or emp.get("full_name") or "",
            "address":       address,
            "contact_no":    contact_override or emp.get("phone")     or "",
            "email":         email_override   or emp.get("email")     or "",
            "position":      role,
            "department":    dept,
            "start_date":    _to_dmy(start_date_raw),
            "end_date":      _to_dmy(end_date_raw),
            "letter_date":   datetime.now().strftime("%d %B %Y"),
        }
        _logger.info("Experience letter data: emp=%s start=%s end=%s",
                     emp_id, letter_data["start_date"], letter_data["end_date"])

        # ── Generate PDF (blocking — run in thread) ───────────────────────────
        try:
            loop     = asyncio.get_event_loop()
            filename = await loop.run_in_executor(None, elg.generate, letter_data)
            _logger.info("Experience letter file: %s", filename)
        except elg.TemplateNotConfiguredError as te:
            return {"success": False, "message": str(te)}
        except Exception as ge:
            _logger.exception("Experience letter PDF generation failed")
            return {"success": False, "message": f"PDF generation failed: {ge}"}

        download_url = f"/api/documents/download/{filename}"

        # ── Persist in document_requests so employee sees it ─────────────────
        if not skip_insert:
            try:
                _ensure_document_requests_table()
                conn2 = get_db_connection()
                cur2  = conn2.cursor()
                cur2.execute(
                    """INSERT INTO document_requests
                           (employee_id, employee_name, document_type, reason, status, file_url)
                       VALUES (%s, %s, 'experience-letter', 'Generated by HR', 'generated', %s)""",
                    (emp_id, letter_data["employee_name"], download_url)
                )
                conn2.commit()
                cur2.close(); conn2.close()
                _logger.info("Experience letter linked to employee %s", emp_id)
            except Exception as dbe:
                _logger.warning("document_requests insert failed (non-fatal): %s", dbe)

        return {
            "success":      True,
            "filename":     filename,
            "filepath":     download_url,
            "download_url": download_url,
            "message":      f"Experience letter generated for {letter_data['employee_name']}",
        }

    except Exception as e:
        import logging as _lg2; _lg2.getLogger(__name__).exception("experience_letter_endpoint error")
        return {"success": False, "message": f"Unexpected error: {e}"}

@app.get("/api/documents/experience-letter")
async def experience_letter_get():
    return await download_experience_letter_simple()

@app.post("/api/documents/relieving-letter")
async def relieving_letter_endpoint(request: Request):
    """
    Generate a Relieving Letter PDF using the approved Seawind Solution template.
    Runs docx2pdf in a thread executor (blocks ~60s on first call).
    Frontend must use timeout >= 120 s.
    """
    import asyncio, logging as _log
    from backend.core import relieving_letter_generator as rlg
    _logger = _log.getLogger(__name__)

    try:
        body               = await request.json()
        emp_id             = (body.get("employee_id") or "").strip()
        position           = (body.get("position") or "").strip()
        resignation_date   = (body.get("resignation_date") or "").strip()
        last_date_raw      = (body.get("last_date") or body.get("last_working_date") or "").strip()

        name_override    = (body.get("name") or body.get("employee_name") or "").strip()
        address_override = (body.get("address") or "").strip()
        contact_override = (body.get("contact_no") or "").strip()
        email_override   = (body.get("email") or "").strip()

        if not emp_id:
            return {"success": False, "message": "employee_id is required"}
        if not last_date_raw:
            return {"success": False, "message": "last_date (last working date) is required"}

        # ── Fetch employee ────────────────────────────────────────────────────
        try:
            emp = _get_emp(emp_id)
        except ValueError:
            return {"success": False, "message": f"Employee not found: {emp_id}"}

        role = position or emp.get("title") or "Employee"
        _logger.info("Relieving letter: emp=%s position=%s last_date=%s", emp_id, role, last_date_raw)

        # ── Address ───────────────────────────────────────────────────────────
        if address_override:
            address = address_override
        else:
            address = ""
            try:
                conn   = get_db_connection()
                cursor = conn.cursor(dictionary=True)
                cursor.execute(
                    "SELECT current_address FROM employee_profiles WHERE employee_id = %s LIMIT 1",
                    (emp_id,)
                )
                prof    = cursor.fetchone()
                address = (prof or {}).get("current_address") or \
                          ", ".join(filter(None, [emp.get("city"), emp.get("state")])) or ""
                cursor.close(); conn.close()
            except Exception as ae:
                _logger.warning("address fetch failed: %s", ae)

        # ── Normalise dates to DD-MM-YYYY ─────────────────────────────────────
        def _to_dmy(raw: str) -> str:
            if len(raw) == 10 and raw[4] == "-":
                try:
                    return datetime.strptime(raw, "%Y-%m-%d").strftime("%d-%m-%Y")
                except ValueError:
                    pass
            return raw

        skip_insert      = body.get("skip_insert", False)

        if not emp_id:
            return {"success": False, "message": "employee_id is required"}

        # ── Fetch employee ────────────────────────────────────────────────────
        try:
            emp = _get_emp(emp_id)
        except ValueError:
            return {"success": False, "message": f"Employee not found: {emp_id}"}

        role = position or emp.get("title") or "Employee"
        _logger.info("Relieving letter data: emp=%s role=%s", emp_id, role)

        def _to_dmy(raw: str) -> str:
            if len(raw) == 10 and raw[4] == "-":
                try:
                    return datetime.strptime(raw, "%Y-%m-%d").strftime("%d-%m-%Y")
                except ValueError:
                    pass
            return raw

        letter_data = {
            "employee_code":     emp_id,
            "employee_name":     name_override    or emp.get("full_name") or "",
            "address":           address,
            "contact_no":        contact_override or emp.get("phone")     or "",
            "email":             email_override   or emp.get("email")     or "",
            "position":          role,
            "resignation_date":  _to_dmy(resignation_date) if resignation_date else "",
            "last_date":         _to_dmy(last_date_raw),
            "letter_date":       datetime.now().strftime("%d %B %Y"),
        }
        _logger.info("Relieving letter data: emp=%s last_date=%s", emp_id, letter_data["last_date"])

        # ── Generate PDF (blocking — run in thread) ───────────────────────────
        try:
            loop     = asyncio.get_event_loop()
            filename = await loop.run_in_executor(None, rlg.generate, letter_data)
            _logger.info("Relieving letter file: %s", filename)
        except rlg.TemplateNotConfiguredError as te:
            return {"success": False, "message": str(te)}
        except Exception as ge:
            _logger.exception("Relieving letter PDF generation failed")
            return {"success": False, "message": f"PDF generation failed: {ge}"}

        download_url = f"/api/documents/download/{filename}"

        # ── Persist in document_requests so employee sees it ─────────────────
        if not skip_insert:
            try:
                _ensure_document_requests_table()
                conn2 = get_db_connection()
                cur2  = conn2.cursor()
                cur2.execute(
                    """INSERT INTO document_requests
                           (employee_id, employee_name, document_type, reason, status, file_url)
                       VALUES (%s, %s, 'relieving-letter', 'Generated by HR', 'generated', %s)""",
                    (emp_id, letter_data["employee_name"], download_url)
                )
                conn2.commit()
                cur2.close(); conn2.close()
                _logger.info("Relieving letter linked to employee %s", emp_id)
            except Exception as dbe:
                _logger.warning("document_requests insert failed (non-fatal): %s", dbe)

        return {
            "success":      True,
            "filename":     filename,
            "filepath":     download_url,
            "download_url": download_url,
            "message":      f"Relieving letter generated for {letter_data['employee_name']}",
        }

    except Exception as e:
        import logging as _lg2; _lg2.getLogger(__name__).exception("relieving_letter_endpoint error")
        return {"success": False, "message": f"Unexpected error: {e}"}

@app.post("/api/generate-salary-slip")
@app.get("/api/generate-salary-slip")
async def generate_salary_endpoint():
    return await download_salary_slip_simple()

@app.post("/api/generate-experience-letter")
@app.get("/api/generate-experience-letter")
async def generate_experience_endpoint():
    return await download_experience_letter_simple()

@app.post("/api/generate-offer-letter")
@app.get("/api/generate-offer-letter")
async def generate_offer_endpoint():
    return await download_offer_letter_simple()

@app.get("/api/debug-cwd")
def debug_cwd():
    import os
    from backend.core.offer_letter_generator import OUTPUT_DIR
    try:
        files = os.listdir(OUTPUT_DIR)
    except Exception as e:
        files = str(e)
    return {
        "cwd": os.getcwd(),
        "output_dir": str(OUTPUT_DIR.absolute()),
        "files": files
    }

@app.get("/api/dashboard/stats")
def get_dashboard_stats():
    """Get dashboard statistics with real-time employee count"""
    try:
        employees = get_all_employees()
        total_employees = len(employees)
        active_employees = len([e for e in employees if e.get('status', '').lower() == 'active'])
    except:
        total_employees = 0
        active_employees = 0

    attendance_rate = 0.0
    pending_leaves = 0
    new_hires_month = 0
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        # Share of active employees who are present or on half-day today
        cur.execute("""SELECT COUNT(DISTINCT a.employee_id) FROM attendance a
                       JOIN employees e ON e.employee_code = a.employee_id AND e.status = 'active'
                       WHERE a.date = CURDATE() AND a.status IN ('PRESENT', 'HALF_DAY')""")
        present_today = int(cur.fetchone()[0] or 0)
        attendance_rate = round(present_today * 100.0 / active_employees, 1) if active_employees else 0.0
        cur.execute("SELECT COUNT(*) FROM leave_requests WHERE LOWER(status) = 'pending'")
        pending_leaves = int(cur.fetchone()[0] or 0)
        cur.execute("""SELECT COUNT(*) FROM employees
                       WHERE YEAR(joining_date) = YEAR(CURDATE()) AND MONTH(joining_date) = MONTH(CURDATE())""")
        new_hires_month = int(cur.fetchone()[0] or 0)
        cur.close(); conn.close()
    except Exception as exc:
        logger.warning("dashboard stats query failed: %s", exc)

    return {
        "total_employees": total_employees,
        "active_employees": active_employees,
        "attendance_rate": attendance_rate,
        "pending_leaves": pending_leaves,
        "new_hires_month": new_hires_month
    }

@app.get("/api/employees/summary")
def get_employees_summary():
    """Get employee summary by department"""
    employees = get_all_employees()
    
    dept_summary = {}
    for emp in employees:
        dept = emp.get('department', 'Unknown')
        if dept not in dept_summary:
            dept_summary[dept] = 0
        dept_summary[dept] += 1
    
    return dept_summary

@app.get("/api/employees/status-summary")
def get_employee_status_summary():
    """Get summary of employees by status: active, inactive, on_leave"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Get total employees by status from employees table
        cursor.execute("SELECT status, COUNT(*) as count FROM employees GROUP BY status")
        status_counts = cursor.fetchall()

        # Initialize counts
        active_count = 0
        inactive_count = 0

        for row in status_counts:
            if row['status'] == 'active':
                active_count = row['count']
            elif row['status'] == 'inactive':
                inactive_count = row['count']

        # Get on_leave count: active employees with approved leave for today
        cursor.execute("""
            SELECT COUNT(DISTINCT e.employee_id) as on_leave_count
            FROM employees e
            JOIN leave_requests lr ON e.employee_id = lr.employee_id
            WHERE e.status = 'active'
              AND lr.status = 'approved'
              AND CURDATE() BETWEEN lr.start_date AND lr.end_date
        """)
        on_leave_row = cursor.fetchone()
        on_leave_count = on_leave_row['on_leave_count'] if on_leave_row else 0

        # Adjust active count: subtract those on leave (since they are not actively working)
        active_count = active_count - on_leave_count
        # Ensure active count doesn't go negative
        if active_count < 0:
            active_count = 0

        cursor.close()
        conn.close()

        return {
            "success": True,
            "data": {
                "active": active_count,
                "inactive": inactive_count,
                "on_leave": on_leave_count
            }
        }
    except Exception as e:
        return {
            "success": False,
            "message": str(e),
            "data": {
                "active": 0,
                "inactive": 0,
                "on_leave": 0
            }
        }


def sync_auth_to_employee_db():
    """No-op: legacy hrms_agent.auth/db modules removed. MySQL is the canonical source."""
    pass

@app.get("/api/sync-users")
def sync_users_endpoint():
    """Manually sync auth users to employee database"""
    try:
        sync_auth_to_employee_db()
        return {"success": True, "message": "Users synced successfully"}
    except Exception as e:
        return {"success": False, "message": f"Sync failed: {str(e)}"}

@app.get("/api/reset-employees")
def reset_employees_endpoint():
    """Deprecated: legacy hrms_agent SQLite reset. MySQL is the canonical source."""
    return {"success": False, "message": "Endpoint deprecated. Employee data is managed in MySQL."}

def _leave_type_column(leave_type: str) -> str:
    normalized = (leave_type or "").strip().lower()
    if "sick" in normalized:
        return "sick_leave"
    if "earn" in normalized or "paid" in normalized or "annual" in normalized:
        return "earned_leave"
    return "casual_leave"


def _calculate_leave_days(start_date: str, end_date: str, leave_duration: str = "full_day") -> float:
    start = datetime.strptime(start_date, "%Y-%m-%d").date()
    end = datetime.strptime(end_date, "%Y-%m-%d").date()
    days = (end - start).days + 1
    if days <= 0:
        raise ValueError("end_date must be on or after start_date")
    if leave_duration in ("first_half", "second_half") and days == 1:
        return 0.5
    return float(days)


def _ensure_leave_tables():
    """Ensure leave tables have the columns used by the current APIs."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS leave_requests (
                id INT AUTO_INCREMENT PRIMARY KEY,
                employee_id VARCHAR(50) NOT NULL,
                leave_type VARCHAR(50) NOT NULL,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                days_count INT NOT NULL DEFAULT 0,
                reason TEXT,
                status VARCHAR(20) DEFAULT 'Pending',
                approved_by VARCHAR(50),
                approved_at TIMESTAMP NULL,
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_leave_employee (employee_id),
                INDEX idx_leave_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """)
        current_year = datetime.now().year
        cursor.execute(f"""
            CREATE TABLE IF NOT EXISTS leave_balance (
                id INT AUTO_INCREMENT PRIMARY KEY,
                employee_id VARCHAR(50) NOT NULL UNIQUE,
                year INT NOT NULL DEFAULT {current_year},
                casual_leave DECIMAL(5,2) DEFAULT 12.0,
                sick_leave DECIMAL(5,2) DEFAULT 12.0,
                earned_leave DECIMAL(5,2) DEFAULT 12.0,
                casual_total DECIMAL(5,2) DEFAULT 12.0,
                sick_total DECIMAL(5,2) DEFAULT 12.0,
                earned_total DECIMAL(5,2) DEFAULT 12.0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """)
        ensure_leave_ledger_table(cursor)
        try:
            cursor.execute("ALTER TABLE leave_balance MODIFY casual_leave DECIMAL(5,2) DEFAULT 12.0")
            cursor.execute("ALTER TABLE leave_balance MODIFY sick_leave DECIMAL(5,2) DEFAULT 12.0")
            cursor.execute("ALTER TABLE leave_balance MODIFY earned_leave DECIMAL(5,2) DEFAULT 12.0")
        except Exception:
            pass
        cursor.execute("""
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leave_requests'
        """)
        columns = {row[0] for row in cursor.fetchall()}
        required_columns = {
            "employee_id": "ALTER TABLE leave_requests ADD COLUMN employee_id VARCHAR(50) NOT NULL",
            "leave_type": "ALTER TABLE leave_requests ADD COLUMN leave_type VARCHAR(50) NOT NULL",
            "start_date": "ALTER TABLE leave_requests ADD COLUMN start_date DATE NOT NULL",
            "end_date": "ALTER TABLE leave_requests ADD COLUMN end_date DATE NOT NULL",
            "days_count": "ALTER TABLE leave_requests ADD COLUMN days_count INT NOT NULL DEFAULT 0",
            "reason": "ALTER TABLE leave_requests ADD COLUMN reason TEXT",
            "status": "ALTER TABLE leave_requests ADD COLUMN status VARCHAR(20) DEFAULT 'Pending'",
            "applied_at": "ALTER TABLE leave_requests ADD COLUMN applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
            "approved_by": "ALTER TABLE leave_requests ADD COLUMN approved_by VARCHAR(50)",
            "approved_at": "ALTER TABLE leave_requests ADD COLUMN approved_at TIMESTAMP NULL",
            "approval_comments": "ALTER TABLE leave_requests ADD COLUMN approval_comments TEXT",
            "approval_date": "ALTER TABLE leave_requests ADD COLUMN approval_date TIMESTAMP NULL",
            "is_unpaid": "ALTER TABLE leave_requests ADD COLUMN is_unpaid TINYINT(1) DEFAULT 0",
            "unpaid_days":     "ALTER TABLE leave_requests ADD COLUMN unpaid_days DECIMAL(5,2) DEFAULT 0.00",
            "paid_leave_days": "ALTER TABLE leave_requests ADD COLUMN paid_leave_days DECIMAL(5,2) DEFAULT 0.00",
            "created_at":      "ALTER TABLE leave_requests ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
            "leave_duration":  "ALTER TABLE leave_requests ADD COLUMN leave_duration ENUM('full_day','first_half','second_half') DEFAULT 'full_day'",
        }
        for column, statement in required_columns.items():
            if column not in columns:
                cursor.execute(statement)
        # Widen unpaid_days / paid_leave_days from INT to DECIMAL for fractional days
        try:
            cursor.execute("ALTER TABLE leave_requests MODIFY COLUMN unpaid_days DECIMAL(5,2) DEFAULT 0.00")
        except Exception:
            pass
        try:
            cursor.execute("ALTER TABLE leave_requests MODIFY COLUMN paid_leave_days DECIMAL(5,2) DEFAULT 0.00")
        except Exception:
            pass
        # ── Data migration: convert numeric employee_ids to EMP-format ──────────
        # Older leave requests stored user_id (e.g. '3') instead of employee_code
        # ('EMP0003').  payroll_engine.get_leave_summary queries by employee_code,
        # so numeric IDs cause leave deductions to silently show 0.
        try:
            cursor.execute("""
                UPDATE leave_requests
                SET employee_id = CONCAT('EMP', LPAD(CAST(employee_id AS UNSIGNED), 4, '0'))
                WHERE employee_id REGEXP '^[0-9]+$'
            """)
        except Exception:
            pass
        try:
            cursor.execute("""
                UPDATE leave_balance
                SET employee_id = CONCAT('EMP', LPAD(CAST(employee_id AS UNSIGNED), 4, '0'))
                WHERE employee_id REGEXP '^[0-9]+$'
            """)
        except Exception:
            pass
        # Back-fill paid_leave_days for Approved records that have days_count but no paid_leave_days
        try:
            cursor.execute("""
                UPDATE leave_requests
                SET paid_leave_days = GREATEST(0, COALESCE(days_count, 0) - COALESCE(unpaid_days, 0))
                WHERE status = 'Approved'
                  AND (paid_leave_days IS NULL OR paid_leave_days = 0)
                  AND days_count > 0
            """)
        except Exception:
            pass
        cursor.execute("""
            UPDATE leave_requests
            SET days_count = TIMESTAMPDIFF(DAY, start_date, end_date) + 1
            WHERE (days_count IS NULL OR days_count = 0)
              AND start_date IS NOT NULL
              AND end_date IS NOT NULL
              AND COALESCE(leave_duration, 'full_day') = 'full_day'
        """)
        cursor.execute("ALTER TABLE leave_requests MODIFY days_count DECIMAL(5,2) NOT NULL DEFAULT 1.00")
        # Create the triggers only when missing: re-creating them on every start would
        # drop them for good on a MySQL account without the TRIGGER/SUPER privilege
        # (binary logging on), e.g. a locked-down production app user.
        cursor.execute(
            "SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema = DATABASE() "
            "AND trigger_name IN ('leave_requests_days_count_bi', 'leave_requests_days_count_bu')"
        )
        if cursor.fetchone()[0] < 2:
            cursor.execute("DROP TRIGGER IF EXISTS leave_requests_days_count_bi")
            cursor.execute("DROP TRIGGER IF EXISTS leave_requests_days_count_bu")
            cursor.execute("""
                CREATE TRIGGER leave_requests_days_count_bi
                BEFORE INSERT ON leave_requests
                FOR EACH ROW
                BEGIN
                    IF NEW.start_date IS NOT NULL AND NEW.end_date IS NOT NULL THEN
                        IF NEW.leave_duration IN ('first_half', 'second_half')
                           AND NEW.start_date = NEW.end_date THEN
                            SET NEW.days_count = 0.5;
                        ELSE
                            SET NEW.days_count = TIMESTAMPDIFF(DAY, NEW.start_date, NEW.end_date) + 1;
                        END IF;
                    END IF;
                END
            """)
            cursor.execute("""
                CREATE TRIGGER leave_requests_days_count_bu
                BEFORE UPDATE ON leave_requests
                FOR EACH ROW
                BEGIN
                    IF NEW.start_date IS NOT NULL AND NEW.end_date IS NOT NULL THEN
                        IF NEW.leave_duration IN ('first_half', 'second_half')
                           AND NEW.start_date = NEW.end_date THEN
                            SET NEW.days_count = 0.5;
                        ELSE
                            SET NEW.days_count = TIMESTAMPDIFF(DAY, NEW.start_date, NEW.end_date) + 1;
                        END IF;
                    END IF;
                END
            """)
        conn.commit()
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"[leave schema] warning: {e}")


def _fetch_leave_requests(employee_id: str = None, pending_only: bool = False):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    where = []
    params = []
    if employee_id:
        where.append("UPPER(lr.employee_id) = UPPER(%s)")
        params.append(employee_id)
    if pending_only:
        where.append("LOWER(lr.status) = 'pending'")
    where_sql = f"WHERE {' AND '.join(where)}" if where else ""
    cursor.execute(f"""
        SELECT lr.*,
               COALESCE(lr.applied_at, lr.created_at) AS applied_at,
               COALESCE(lr.created_at, lr.applied_at) AS created_at,
               COALESCE(lr.days_count, 0) AS requested_days,
               COALESCE(lr.unpaid_days, 0) AS unpaid_days,
               GREATEST(COALESCE(lr.days_count, 0) - COALESCE(lr.unpaid_days, 0), 0) AS paid_days,
               COALESCE(NULLIF(TRIM(CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, ''))), ''), u.full_name, lr.employee_id) AS employee_name,
               COALESCE(e.department, 'HR') AS department
        FROM leave_requests lr
        LEFT JOIN employees e ON lr.employee_id = e.employee_id
        LEFT JOIN users u ON lr.employee_id = u.user_id
        {where_sql}
        ORDER BY COALESCE(lr.applied_at, lr.created_at) DESC, lr.id DESC
    """, tuple(params))
    requests = cursor.fetchall()
    cursor.close()
    conn.close()
    return requests


def _get_leave_balance_payload(cursor, employee_id: str):
    current_year = datetime.now().year

    # Check if employee is currently in probation
    cursor.execute(
        "SELECT status FROM employees WHERE employee_code = %s OR employee_id = %s LIMIT 1",
        (employee_id, employee_id)
    )
    st_row = cursor.fetchone() or {}
    emp_status = (st_row.get("status") or "").strip().lower()
    is_probation = (emp_status == "probation")

    if is_probation:
        # During probation, employees have no company-provided leave balance (0 CL, 0 SL, 0 PL)
        casual_total = 0.0
        sick_total   = 0.0
        earned_total = 0.0
        casual       = 0.0
        sick         = 0.0
        earned       = 0.0
    else:
        cursor.execute("""
            INSERT IGNORE INTO leave_balance
                (employee_id, year, casual_leave, sick_leave, earned_leave, casual_total, sick_total, earned_total)
            VALUES (%s, %s, 12.00, 12.00, 12.00, 12.00, 12.00, 12.00)
        """, (employee_id, current_year))
        cursor.execute("SELECT * FROM leave_balance WHERE employee_id = %s", (employee_id,))
        row = cursor.fetchone() or {}
        record_year = row.get("year") or current_year

        casual_total = float(row.get("casual_total") or 12.0)
        sick_total   = float(row.get("sick_total")   or 12.0)
        earned_total = float(row.get("earned_total") or 12.0)

        # Carry forward logic:
        # "Unused balances carry forward until the year changes and do not carry beyond the year change."
        if record_year < current_year:
            # Reset balances for the new year: unused from previous year do not carry beyond year change
            casual = casual_total
            sick   = sick_total
            earned = earned_total
            cursor.execute("""
                UPDATE leave_balance
                SET year = %s, casual_leave = %s, sick_leave = %s, earned_leave = %s
                WHERE employee_id = %s
            """, (current_year, casual, sick, earned, employee_id))
        else:
            casual = float(row.get("casual_leave") if row.get("casual_leave") is not None else casual_total)
            sick   = float(row.get("sick_leave")   if row.get("sick_leave") is not None else sick_total)
            earned = float(row.get("earned_leave") if row.get("earned_leave") is not None else earned_total)

    # Total unpaid days taken from approved leave requests in the current year
    cursor.execute("""
        SELECT COALESCE(SUM(COALESCE(unpaid_days, 0)), 0) AS total
        FROM leave_requests
        WHERE employee_id = %s AND LOWER(status) = 'approved' AND YEAR(start_date) = %s
    """, (employee_id, current_year))
    ut_row = cursor.fetchone() or {}
    unpaid_taken = float(ut_row.get("total") or 0)

    cl_used = max(0.0, round(casual_total - casual, 2))
    sl_used = max(0.0, round(sick_total - sick, 2))
    pl_used = max(0.0, round(earned_total - earned, 2))

    balance_rows = [
        {"leave_type": "Casual Leave", "code": "CL", "total_days": casual_total, "used_days": cl_used, "remaining_days": casual},
        {"leave_type": "Sick Leave",   "code": "SL", "total_days": sick_total,   "used_days": sl_used, "remaining_days": sick},
        {"leave_type": "Paid Leave",   "code": "PL", "total_days": earned_total, "used_days": pl_used, "remaining_days": earned},
    ]
    summary = {
        "employee_id":     employee_id,
        "year":            current_year,
        "is_probation":    is_probation,
        "employment_status": "probation" if is_probation else (emp_status or "active"),
        "casual_leave":    casual,
        "sick_leave":      sick,
        "earned_leave":    earned,
        "casual_balance":  casual,
        "sick_balance":    sick,
        "paid_balance":    earned,
        "earned_balance":  earned,
        "casual_total":    casual_total,
        "sick_total":      sick_total,
        "earned_total":    earned_total,
        "total_balance":   casual + sick + earned,
        "total_remaining": casual + sick + earned,
        "total_total":     casual_total + sick_total + earned_total,
        "total_used":      cl_used + sl_used + pl_used,
        "unpaid_taken":    unpaid_taken,
    }
    return summary, balance_rows


def _deduct_leave_balance(cursor, employee_id: str, leave_type: str, days_count: int):
    column = _leave_type_column(leave_type)
    cursor.execute("INSERT IGNORE INTO leave_balance (employee_id) VALUES (%s)", (employee_id,))
    cursor.execute(f"""
        UPDATE leave_balance
        SET {column} = GREATEST(0, COALESCE({column}, 0) - %s)
        WHERE employee_id = %s
    """, (days_count, employee_id))


def _notify_hr_leave_submitted(cursor, employee_id: str, leave_type: str, days_count: int, request_id: int):
    cursor.execute("SELECT user_id FROM users WHERE LOWER(role) IN ('hr', 'admin', 'sub_hr') AND COALESCE(is_active, 1) = 1")
    recipients = [row[0] for row in cursor.fetchall()]
    if not recipients:
        return
    title = "New leave request"
    message = f"{employee_id} submitted {days_count} day(s) of {leave_type}. Request #{request_id} is pending review."
    cursor.executemany("""
        INSERT INTO notifications (user_id, title, message, type)
        VALUES (%s, %s, %s, %s)
    """, [(user_id, title, message, "leave_request") for user_id in recipients])


def _refresh_employee_payroll(conn, cursor, employee_id: str):
    """Recalculate and upsert the current-month monthly_payroll row for one employee.
    Called right after leave approval so the accountant panel reflects the new deduction
    without waiting for the next seed cycle.
    """
    from datetime import date as _date
    month       = _date.today().strftime('%Y-%m')
    month_start = month + '-01'

    cursor.execute("""
        SELECT es.basic_salary, es.hra,
               COALESCE(es.transport_allowance, 0)
                   + COALESCE(es.medical_allowance, 0)
                   + COALESCE(es.special_allowance, 0) AS allowances,
               es.gross_salary, es.total_deductions, es.net_salary
        FROM employee_salaries es
        JOIN (
            SELECT employee_id, MAX(id) AS max_id
            FROM employee_salaries WHERE status = 'active'
            GROUP BY employee_id
        ) _l ON es.id = _l.max_id
        WHERE es.employee_id = %s
    """, (employee_id,))
    sal = cursor.fetchone()
    if not sal:
        logger.warning("_refresh_employee_payroll: no active salary for emp=%s — skipping", employee_id)
        return

    from backend.core import payroll_engine
    lv = payroll_engine.leave_portion_for_month(employee_id, _date.today().month, _date.today().year, cursor)

    from backend.core import payroll_engine
    today            = _date.today()  # _date imported above
    gross            = float(str(sal.get('gross_salary') or 0).replace(',', ''))
    unpaid_days      = float(lv.get('unpaid_days') or 0)
    paid_leave_used  = float(lv.get('paid_leave_used') or 0)
    # Canonical formula (daily = gross/total_days, not /30)
    unpaid_deduction = payroll_engine.calc_leave_deduction(gross, unpaid_days, today.year, today.month)
    final_net        = payroll_engine.calc_net_salary(gross, unpaid_days, today.year, today.month)
    final_deductions = round(payroll_engine.PROFESSIONAL_TAX + unpaid_deduction, 2)

    logger.info(
        "_refresh_employee_payroll: emp=%s month=%s gross=%.2f unpaid_days=%.2f "
        "leave_ded=%.2f net=%.2f",
        employee_id, month, gross, unpaid_days, unpaid_deduction, final_net,
    )

    cursor.execute("""
        INSERT INTO monthly_payroll
            (employee_id, month_year, basic_salary, hra, allowances,
             gross_salary, deductions, net_salary, days_absent, paid_leave_used, leave_deduction, status)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'draft')
        ON DUPLICATE KEY UPDATE
            deductions      = %s,
            net_salary      = %s,
            days_absent     = %s,
            paid_leave_used = %s,
            leave_deduction = %s
    """, (
        employee_id, month,
        float(str(sal.get('basic_salary') or 0).replace(',', '')),
        float(str(sal.get('hra') or 0).replace(',', '')),
        float(str(sal.get('allowances') or 0).replace(',', '')),
        gross, final_deductions, final_net, unpaid_days, paid_leave_used, unpaid_deduction,
        final_deductions, final_net, unpaid_days, paid_leave_used, unpaid_deduction,
    ))


def _set_leave_status(request_id: int, status: str, actor: str = "HR", comments: str = ""):
    """
    Update leave request status.
    If approving: calculate unpaid_days from current balance, deduct paid days, set is_unpaid.
    If rejecting: do not touch balance.
    Idempotent: re-approving an already-Approved request is a no-op (no double deduction).
    """
    try:
        conn   = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT id, employee_id, leave_type, days_count, start_date, end_date,
                   COALESCE(leave_duration, 'full_day') AS leave_duration,
                   status AS current_status
            FROM leave_requests WHERE id = %s
        """, (request_id,))
        leave = cursor.fetchone()

        if not leave:
            conn.rollback(); cursor.close(); conn.close()
            logger.warning("_set_leave_status: leave_id=%d not found", request_id)
            return {"success": False, "message": "Leave request not found"}

        emp_id = leave['employee_id']
        logger.info(
            "_set_leave_status: leave_id=%d emp=%s type=%s days=%s %s→%s actor=%s",
            request_id, emp_id, leave['leave_type'], leave['days_count'],
            leave['current_status'], status, actor,
        )

        is_unpaid         = 0
        unpaid_days       = 0.0
        available_balance = 0.0

        if status.lower() == "approved":
            # Idempotency: if already Approved, skip balance deduction to prevent double-deduction.
            if leave['current_status'] == 'Approved':
                logger.warning(
                    "_set_leave_status: leave_id=%d is already Approved — skipping balance deduction",
                    request_id,
                )
                cursor.execute("""
                    SELECT unpaid_days, is_unpaid FROM leave_requests WHERE id = %s
                """, (request_id,))
                existing = cursor.fetchone() or {}
                cursor.close(); conn.close()
                return {
                    "success":    True,
                    "message":    "Leave already approved (no change)",
                    "unpaid_days": float(existing.get('unpaid_days') or 0),
                    "is_unpaid":  int(existing.get('is_unpaid') or 0),
                }

            # Check if employee is in probation
            cursor.execute(
                "SELECT status, full_name FROM employees WHERE employee_code = %s OR employee_id = %s LIMIT 1",
                (emp_id, emp_id)
            )
            emp_info = cursor.fetchone() or {}
            emp_status = (emp_info.get("status") or "").strip().lower()
            emp_full_name = emp_info.get("full_name") or emp_id
            is_probation = (emp_status == "probation")

            days_requested = float(leave['days_count'] or 0)

            if is_probation:
                # During probation, employees have 0 company-provided leave balance; leave is unpaid/salary-deducted
                available_balance = 0.0
                paid_days = 0.0
                unpaid_days = days_requested
                is_unpaid = 1 if unpaid_days > 0 else 0
            else:
                col = _leave_type_column(leave['leave_type'])
                cursor.execute("INSERT IGNORE INTO leave_balance (employee_id) VALUES (%s)", (emp_id,))
                cursor.execute(f"SELECT {col} FROM leave_balance WHERE employee_id = %s", (emp_id,))
                bal_row           = cursor.fetchone()
                available_balance = float(bal_row[col] or 0) if bal_row else 0.0

                paid_days   = round(min(days_requested, available_balance), 2)
                unpaid_days = round(max(0.0, days_requested - available_balance), 2)
                is_unpaid   = 1 if unpaid_days > 0 else 0

                if paid_days > 0:
                    debit_result = record_leave_debit(
                        cursor,
                        employee_id=emp_id,
                        leave_type=leave['leave_type'],
                        days=paid_days,
                        reference_type="LEAVE_REQUEST",
                        reference_id=str(request_id),
                        remarks=f"Approved leave request #{request_id}",
                    )
                    logger.info(
                        "_set_leave_status: leave_id=%d ledger_debit=%s paid_days=%.2f from %s balance for emp=%s",
                        request_id, debit_result, paid_days, col, emp_id,
                    )

            logger.info(
                "_set_leave_status: leave_id=%d emp=%s leave_type=%s "
                "approved_days=%.2f available_balance=%.2f "
                "paid_leave_days=%.2f unpaid_leave_days=%.2f is_probation=%s",
                request_id, emp_id, leave['leave_type'],
                days_requested, available_balance, paid_days, unpaid_days, is_probation,
            )

            # When unpaid_days > 0, insert attendance_deductions record with PENDING_REVIEW
            # and notify HR for salary deduction approval (no automatic deduction)
            if unpaid_days > 0:
                try:
                    cursor.execute("""
                        SELECT gross_salary FROM employee_salaries
                        WHERE employee_id = %s AND status = 'active'
                        ORDER BY id DESC LIMIT 1
                    """, (emp_id,))
                    sal_row = cursor.fetchone()
                    monthly_sal = float(sal_row['gross_salary']) if sal_row and sal_row.get('gross_salary') else 0.0

                    l_date = leave.get('start_date')
                    l_year = l_date.year if hasattr(l_date, 'year') else datetime.now().year
                    l_month = l_date.month if hasattr(l_date, 'month') else datetime.now().month

                    import calendar as _cal
                    days_in_m = _cal.monthrange(l_year, l_month)[1]
                    daily_sal = monthly_sal / days_in_m if days_in_m else 0.0
                    deduction_amount = round(daily_sal * unpaid_days, 2)
                    half_days_count = int(round(unpaid_days * 2))

                    cursor.execute("""
                        INSERT INTO attendance_deductions
                            (employee_id, year, month, deduction_type, late_count, half_days_deducted,
                             amount, status, created_at, updated_at)
                        VALUES (%s, %s, %s, 'UNPAID_LEAVE', 0, %s, %s, 'PENDING_REVIEW', NOW(), NOW())
                    """, (emp_id, l_year, l_month, half_days_count, deduction_amount))

                    # Send notification to HR
                    cursor.execute("SELECT user_id FROM users WHERE LOWER(role) IN ('hr', 'admin', 'sub_hr') AND COALESCE(is_active, 1) = 1")
                    hr_users = [r['user_id'] for r in cursor.fetchall()]
                    prob_tag = " (Probation)" if is_probation else ""
                    notif_title = f"Salary Deduction Review: {emp_full_name}"
                    notif_msg = (
                        f"Employee {emp_full_name} ({emp_id}){prob_tag} has {unpaid_days} unpaid leave day(s) "
                        f"in {l_month:02d}/{l_year}. Estimated deduction amount: ₹{deduction_amount:.2f}. "
                        f"Awaiting HR approval in the Salary Deductions Review section."
                    )
                    for hr_uid in hr_users:
                        cursor.execute("""
                            INSERT INTO notifications (user_id, title, message, type, is_read, created_at)
                            VALUES (%s, %s, %s, 'SALARY_DEDUCTION_REVIEW', 0, NOW())
                        """, (hr_uid, notif_title, notif_msg))
                except Exception as ded_err:
                    logger.warning("_set_leave_status: failed to queue salary deduction review: %s", ded_err)

        # Update leave request — is_unpaid, unpaid_days, paid_leave_days guaranteed by _ensure_leave_tables
        cursor.execute("""
            UPDATE leave_requests
            SET status = %s, approved_by = %s, approved_at = NOW(),
                approval_date = NOW(), approval_comments = %s,
                is_unpaid = %s, unpaid_days = %s, paid_leave_days = %s
            WHERE id = %s
        """, (status, actor, comments, is_unpaid, unpaid_days,
              round(max(0.0, float(leave['days_count'] or 0) - unpaid_days), 2),
              request_id))

        # Immediately refresh this employee's payroll row so the accountant panel
        # reflects the new leave deduction without waiting for the next page load.
        if status.lower() == "approved":
            try:
                _refresh_employee_payroll(conn, cursor, emp_id)
            except Exception as refresh_err:
                logger.warning(
                    "_set_leave_status: payroll refresh failed for emp=%s (non-fatal): %s",
                    emp_id, refresh_err,
                )

        # Warn HR when the employee has already worked (punched in) on days this leave covers.
        worked_warning = None
        if status.lower() == "approved":
            try:
                cursor.execute("""
                    SELECT date FROM attendance
                    WHERE employee_id = %s AND date BETWEEN %s AND %s
                      AND check_in IS NOT NULL AND status IN ('PRESENT', 'HALF_DAY')
                    ORDER BY date
                """, (emp_id, leave['start_date'], leave['end_date']))
                worked = [r['date'].strftime('%d %b') for r in cursor.fetchall()]
                if worked:
                    worked_warning = (
                        f"Note: this employee has already worked on {', '.join(worked)} "
                        f"which this leave covers. Those days are still deducted as leave. "
                        f"If they should be paid, change the leave dates."
                    )
            except Exception as warn_err:
                logger.warning("_set_leave_status: worked-day check failed: %s", warn_err)

        conn.commit(); cursor.close(); conn.close()

        paid_leave_days_final = round(max(0.0, float(leave['days_count'] or 0) - unpaid_days), 2)
        try:
            log_hr_activity(
                performed_by=actor,
                performed_name=actor,
                action=f"LEAVE_{status.upper()}",
                target_employee_id=emp_id,
                details=f"{status.capitalize()} leave request #{request_id} ({leave.get('leave_type')}, {leave.get('days_count')} days). Comments: {comments or 'None'}",
            )
        except Exception as log_err:
            logger.warning("_set_leave_status hr activity log skipped: %s", log_err)
        logger.info(
            "_set_leave_status SUMMARY: leave_id=%d emp=%s leave_type=%s "
            "approved_days=%.2f available_balance=%.2f "
            "paid_leave_days=%.2f unpaid_leave_days=%.2f status=%s",
            request_id, emp_id,
            leave.get('leave_type', '?'),
            float(leave.get('days_count') or 0),
            available_balance if status.lower() == 'approved' else 0.0,
            paid_leave_days_final, unpaid_days, status,
        )
        return {
            "success":         True,
            "message":         f"Leave request {status.lower()} successfully",
            "unpaid_days":     unpaid_days,
            "paid_leave_days": paid_leave_days_final,
            "is_unpaid":       is_unpaid,
            "warning":         worked_warning,
        }
    except Exception as e:
        logger.exception("_set_leave_status: leave_id=%d failed: %s", request_id, e)
        return {"success": False, "message": f"Unable to update leave request: {str(e)}"}


# _ensure_leave_tables() is now called inside _startup() — removed from module level.


@app.get("/api/leave-requests")
def get_leave_requests():
    """Get all leave requests from database"""
    try:
        requests = _fetch_leave_requests()
        return {"success": True, "requests": requests, "data": requests, "leave_requests": requests}
    except Exception as e:
        return {"success": False, "message": str(e), "requests": [], "data": [], "leave_requests": []}

@app.get("/api/leave/requests")
def get_leave_requests_alt():
    """Alternative endpoint for leave requests"""
    try:
        requests = _fetch_leave_requests()
        return {"success": True, "requests": requests, "data": requests, "leave_requests": requests}
    except Exception as e:
        return {"success": False, "message": str(e), "requests": [], "data": [], "leave_requests": []}


@app.get("/api/leave/requests/employee/{employee_id}")
def get_leave_requests_by_employee_alt(employee_id: str):
    """Employee leave request history for newer frontend paths."""
    try:
        requests = _fetch_leave_requests(employee_id=employee_id)
        return {"success": True, "requests": requests, "data": requests, "count": len(requests), "leave_requests": requests}
    except Exception as e:
        return {"success": False, "message": str(e), "requests": [], "data": [], "count": 0, "leave_requests": []}

@app.get("/leave-requests")
def get_leave_requests_short():
    """Short endpoint for leave requests"""
    try:
        requests = _fetch_leave_requests()
        return {"success": True, "requests": requests, "data": requests}
    except Exception as e:
        return {"success": False, "message": str(e), "requests": [], "data": []}

@app.get("/api/leave-requests/pending")
def get_pending_leave_requests():
    """Get only pending leave requests"""
    try:
        requests = _fetch_leave_requests(pending_only=True)
        return {"success": True, "requests": requests, "data": requests, "count": len(requests), "leave_requests": requests}
    except Exception as e:
        return {"success": False, "message": str(e), "requests": [], "data": [], "count": 0, "leave_requests": []}

@app.get("/api/leave-requests/my")
def get_my_leave_requests(user_id: str = None):
    """Get leave requests for specific employee"""
    try:
        if not user_id:
            return {"success": False, "message": "user_id required", "requests": [], "data": [], "leave_requests": []}
        requests = _fetch_leave_requests(employee_id=user_id)
        return {"success": True, "requests": requests, "data": requests, "count": len(requests), "leave_requests": requests}
    except Exception as e:
        return {"success": False, "message": str(e), "requests": [], "data": [], "leave_requests": []}

@app.put("/api/leave_requests/{request_id}")
def update_leave_request(request_id: int, data: dict):
    """Update leave request status - HR/Admin endpoint"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        status = data.get('status')
        approved_by = data.get('approved_by')
        comments = data.get('approval_comments', '')
        
        cursor.execute("""
            UPDATE leave_requests 
            SET status = %s, approved_by = %s, approval_comments = %s, approval_date = NOW()
            WHERE id = %s
        """, (status, approved_by, comments, request_id))
        
        conn.commit()
        conn.close()
        return {"success": True, "message": "Leave request updated successfully"}
    except Exception as e:
        return {"success": False, "message": str(e)}

@app.post("/api/leave_requests/{request_id}/approve")
async def approve_leave_request(request_id: int, request: Request):
    """Approve leave request - HR/Admin endpoint"""
    try:
        data = await request.json() if request.headers.get('content-type') == 'application/json' else {}
        approved_by = data.get('approved_by', 'HR')
        comments = data.get('comments', '') or data.get('approval_comments', '')
        status = "Rejected" if str(data.get('status', '')).strip().lower() == "rejected" else "Approved"
        return _set_leave_status(request_id, status, approved_by, comments)
    except Exception as e:
        return {"success": False, "message": str(e)}

@app.post("/api/leave_requests/{request_id}/reject")
async def reject_leave_request(request_id: int, request: Request):
    """Reject leave request - HR/Admin endpoint"""
    try:
        data = await request.json() if request.headers.get('content-type') == 'application/json' else {}
        rejected_by = data.get('rejected_by', 'HR')
        comments = data.get('comments', '') or data.get('approval_comments', '')
        return _set_leave_status(request_id, "Rejected", rejected_by, comments)
    except Exception as e:
        return {"success": False, "message": str(e)}


@app.post("/api/leave/approve")
async def approve_leave_canonical(request: Request):
    """Canonical HR/Admin approve endpoint."""
    try:
        data = await request.json()
        request_id = data.get("request_id") or data.get("leave_id") or data.get("id")
        if not request_id:
            return {"success": False, "message": "request_id is required"}
        approved_by = data.get("approved_by") or data.get("processed_by") or "HR"
        comments = data.get("comments", "")
        return _set_leave_status(int(request_id), "Approved", approved_by, comments)
    except Exception as e:
        return {"success": False, "message": f"Unable to approve leave: {str(e)}"}


@app.post("/api/leave/reject")
async def reject_leave_canonical(request: Request):
    """Canonical HR/Admin reject endpoint."""
    try:
        data = await request.json()
        request_id = data.get("request_id") or data.get("leave_id") or data.get("id")
        if not request_id:
            return {"success": False, "message": "request_id is required"}
        rejected_by = data.get("rejected_by") or data.get("approved_by") or data.get("processed_by") or "HR"
        comments = data.get("comments", "")
        return _set_leave_status(int(request_id), "Rejected", rejected_by, comments)
    except Exception as e:
        return {"success": False, "message": f"Unable to reject leave: {str(e)}"}


@app.post("/api/leave/approve/{leave_id}")
async def approve_leave_path_compat(leave_id: int, request: Request):
    """Compatibility wrapper for existing frontend buttons."""
    data = await request.json() if request.headers.get('content-type') == 'application/json' else {}
    return _set_leave_status(leave_id, "Approved", data.get("approved_by", "HR"), data.get("comments", ""))


@app.post("/api/leave/reject/{leave_id}")
async def reject_leave_path_compat(leave_id: int, request: Request):
    """Compatibility wrapper for existing frontend buttons."""
    data = await request.json() if request.headers.get('content-type') == 'application/json' else {}
    return _set_leave_status(leave_id, "Rejected", data.get("rejected_by") or data.get("approved_by", "HR"), data.get("comments", ""))


@app.post("/api/leave/apply")
async def apply_leave(request: Request):
    """Submit a leave application - Accepts any JSON format"""
    conn = None
    try:
        data = await request.json()
        conn = get_db_connection()
        cursor = conn.cursor()

        employee_id = data.get('employee_id') or data.get('user_id') or data.get('employeeId')
        leave_type = data.get('leave_type') or data.get('leaveType') or data.get('type') or 'Casual Leave'
        start_date = data.get('start_date') or data.get('startDate') or data.get('from')
        end_date = data.get('end_date') or data.get('endDate') or data.get('to')
        reason = data.get('reason') or data.get('description') or ''
        if not employee_id:
            return {"success": False, "message": "employee_id is required"}
        # Normalize: if numeric user_id was sent (e.g. 3), convert to EMP-code (EMP0003)
        # so leave_requests.employee_id always matches employees.employee_code used by payroll engine
        s = str(employee_id).strip()
        if s.isdigit():
            employee_id = f"EMP{int(s):04d}"
        if not start_date or not end_date:
            return {"success": False, "message": "start_date and end_date are required"}
        leave_duration = str(data.get('leave_duration') or 'full_day').strip().lower()
        if leave_duration not in ('full_day', 'first_half', 'second_half'):
            leave_duration = 'full_day'
        days_count = _calculate_leave_days(start_date, end_date, leave_duration)

        # Store the unpaid flag and unpaid_days from the frontend.
        # Balance deduction is intentionally deferred to HR approval (_set_leave_status).
        # Deducting at application time then re-computing at approval causes all days to
        # appear unpaid (balance already 0), so we never touch balance here.
        is_unpaid = bool(data.get('is_unpaid'))
        unpaid_days = float(data.get('unpaid_days') or 0)

        cursor.execute("""
            INSERT INTO leave_requests
                (employee_id, leave_type, start_date, end_date, days_count, reason, status,
                 applied_at, is_unpaid, unpaid_days, leave_duration)
            VALUES (%s, %s, %s, %s, %s, %s, 'Pending', NOW(), %s, %s, %s)
        """, (employee_id, leave_type, start_date, end_date, days_count, reason, int(is_unpaid), unpaid_days, leave_duration))
        request_id = cursor.lastrowid
        _notify_hr_leave_submitted(cursor, employee_id, leave_type, days_count, request_id)
        conn.commit()
        cursor.close()
        conn.close()

        return {
            "success": True,
            "message": "Leave application submitted successfully",
            "request_id": request_id,
            "days_count": days_count,
            "status": "Pending"
        }
    except ValueError as e:
        return {"success": False, "message": str(e)}
    except Exception as e:
        if conn:
            try:
                conn.rollback()
                conn.close()
            except Exception:
                pass
        return {"success": False, "message": f"Error submitting leave: {str(e)}"}


@app.post("/api/admin/leave/override")
def override_leave(request: AdminLeaveOverrideRequest, token: str = None):
    """Admin overrides a leave request decision"""
    try:
        return _set_leave_status(int(request.request_id), request.new_status, "admin", request.reason)
    except Exception as e:
        return {"success": False, "message": f"Error overriding leave: {str(e)}"}


@app.post("/api/leaves/admin-create")
async def admin_create_leave(request: Request):
    """HR/Admin creates a leave record for an employee or themselves."""
    try:
        data = await request.json()
        employee_id = data.get('employee_id') or data.get('user_id')
        if not employee_id:
            return {"success": False, "message": "employee_id is required"}
        employee_id = str(employee_id).strip()

        leave_type = data.get('leave_type') or 'Casual Leave'
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        reason = data.get('reason') or ''
        status = data.get('status') or 'Approved'
        created_by = data.get('created_by') or 'HR'
        leave_duration = str(data.get('leave_duration') or 'full_day').strip().lower()
        if leave_duration not in ('full_day', 'first_half', 'second_half'):
            leave_duration = 'full_day'
        if not start_date or not end_date:
            return {"success": False, "message": "start_date and end_date are required"}

        days_count = _calculate_leave_days(start_date, end_date, leave_duration)
        is_unpaid = bool(data.get('is_unpaid', False))
        unpaid_days = float(data.get('unpaid_days', 0.0))

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO leave_requests
                (employee_id, leave_type, start_date, end_date, days_count, reason, status,
                 applied_at, is_unpaid, unpaid_days, leave_duration, approved_by)
            VALUES (%s, %s, %s, %s, %s, %s, 'Pending', NOW(), %s, %s, %s, %s)
        """, (employee_id, leave_type, start_date, end_date, days_count, reason, int(is_unpaid), unpaid_days, leave_duration, created_by))
        request_id = cursor.lastrowid
        conn.commit()
        cursor.close()
        conn.close()

        if status.lower() == 'approved':
            res = _set_leave_status(request_id, 'Approved', actor=created_by, comments=reason)
        else:
            res = None

        # Log HR Activity & notify employee
        try:
            client_ip = request.client.host if request.client else "127.0.0.1"
            log_hr_activity(
                performed_by=created_by,
                performed_name=created_by,
                action="APPLIED_LEAVE_ON_BEHALF",
                target_employee_id=employee_id,
                details=f"HR applied {leave_type} ({days_count} day(s): {start_date} to {end_date}) on behalf of employee. Reason: {reason or 'Recorded by HR'}",
                ip_address=client_ip,
            )
            # Notification to employee
            conn_n = get_db_connection()
            cur_n = conn_n.cursor()
            cur_n.execute(
                """INSERT INTO notifications (user_id, title, message, type, is_read, created_at)
                   VALUES (%s, %s, %s, 'LEAVE', 0, NOW())""",
                (
                    employee_id,
                    "Leave Recorded on Your Behalf",
                    f"HR ({created_by}) has submitted a {leave_type} request ({days_count} day(s): {start_date} to {end_date}) on your behalf. Reason: {reason or 'Recorded by HR'}",
                ),
            )
            conn_n.commit()
            cur_n.close()
            conn_n.close()
        except Exception as act_err:
            logger.warning("admin_create_leave logging/notification skipped: %s", act_err)

        if status.lower() == 'approved':
            return {"success": True, "message": "Leave record created and approved", "request_id": request_id, "details": res}
        return {"success": True, "message": "Leave record created (pending approval)", "request_id": request_id}
    except Exception as e:
        logger.exception("admin_create_leave error: %s", e)
        return {"success": False, "message": str(e)}


@app.put("/api/leaves/{request_id}")
async def edit_leave_request(request_id: int, request: Request):
    """HR/Admin updates an existing leave request."""
    try:
        data = await request.json()
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT * FROM leave_requests WHERE id = %s", (request_id,))
        existing = cur.fetchone()
        if not existing:
            cur.close(); conn.close()
            return {"success": False, "message": "Leave request not found"}

        leave_type = data.get('leave_type') or existing['leave_type']
        start_date = data.get('start_date') or str(existing['start_date'])
        end_date = data.get('end_date') or str(existing['end_date'])
        leave_duration = data.get('leave_duration') or existing.get('leave_duration') or 'full_day'
        reason = data.get('reason') if 'reason' in data else existing.get('reason')
        new_status = data.get('status') or existing['status']
        days_count = _calculate_leave_days(start_date, end_date, leave_duration)

        old_status = existing['status']

        if old_status == 'Approved' and new_status != 'Approved':
            emp_id = existing['employee_id']
            paid_days = float(existing.get('paid_leave_days') or 0)
            if paid_days > 0:
                col = _leave_type_column(existing['leave_type'])
                cur.execute(f"UPDATE leave_balance SET {col} = {col} + %s WHERE employee_id = %s", (paid_days, emp_id))
                conn.commit()
                try:
                    _refresh_employee_payroll(conn, cur, emp_id)
                except Exception:
                    pass

        cur.execute("""
            UPDATE leave_requests
            SET leave_type = %s, start_date = %s, end_date = %s, leave_duration = %s,
                reason = %s, days_count = %s
            WHERE id = %s
        """, (leave_type, start_date, end_date, leave_duration, reason, days_count, request_id))
        conn.commit()
        cur.close(); conn.close()

        if new_status.lower() == 'approved' and old_status != 'Approved':
            _set_leave_status(request_id, 'Approved', actor=data.get('actor', 'HR'), comments=reason or '')
        elif new_status.lower() == 'rejected' and old_status != 'Rejected':
            _set_leave_status(request_id, 'Rejected', actor=data.get('actor', 'HR'), comments=reason or '')

        return {"success": True, "message": "Leave request updated successfully"}
    except Exception as e:
        return {"success": False, "message": str(e)}


@app.delete("/api/leaves/{request_id}")
def delete_leave_request(request_id: int):
    """HR/Admin deletes a leave request and reverses deductions if previously approved."""
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT * FROM leave_requests WHERE id = %s", (request_id,))
        existing = cur.fetchone()
        if not existing:
            cur.close(); conn.close()
            return {"success": False, "message": "Leave request not found"}

        if existing['status'] == 'Approved':
            paid_days = float(existing.get('paid_leave_days') or 0)
            emp_id = existing['employee_id']
            if paid_days > 0:
                col = _leave_type_column(existing['leave_type'])
                cur.execute(f"UPDATE leave_balance SET {col} = {col} + %s WHERE employee_id = %s", (paid_days, emp_id))
            try:
                _refresh_employee_payroll(conn, cur, emp_id)
            except Exception:
                pass

        cur.execute("DELETE FROM leave_requests WHERE id = %s", (request_id,))
        conn.commit()
        cur.close(); conn.close()
        return {"success": True, "message": "Leave record deleted successfully"}
    except Exception as e:
        return {"success": False, "message": str(e)}


@app.get("/api/leaves/balances-all")
def get_all_yearly_balances():
    """HR/Admin view of yearly leave balances for all employees and HR."""
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        current_year = datetime.now().year
        cur.execute("""
            SELECT u.user_id, u.full_name, u.role, COALESCE(e.department, 'HR') AS department,
                   COALESCE(lb.year, %s) AS year,
                   COALESCE(lb.casual_leave, 12.0) AS casual_leave,
                   COALESCE(lb.sick_leave, 12.0) AS sick_leave,
                   COALESCE(lb.earned_leave, 12.0) AS earned_leave,
                   COALESCE(lb.casual_total, 12.0) AS casual_total,
                   COALESCE(lb.sick_total, 12.0) AS sick_total,
                   COALESCE(lb.earned_total, 12.0) AS earned_total
            FROM users u
            LEFT JOIN employees e ON (e.employee_code = u.user_id OR e.email = u.email)
            LEFT JOIN leave_balance lb ON (lb.employee_id = u.user_id OR lb.employee_id = e.employee_code)
            WHERE COALESCE(u.is_active, 1) = 1
            ORDER BY u.role, u.full_name
        """, (current_year,))
        rows = cur.fetchall()
        cur.close(); conn.close()
        return {"success": True, "balances": rows, "year": current_year}
    except Exception as e:
        return {"success": False, "message": str(e)}


@app.put("/api/leaves/balance/{employee_id}")
async def adjust_leave_balance(employee_id: str, request: Request):
    """HR/Admin updates an employee's leave balance or yearly total."""
    try:
        data = await request.json()
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        current_year = datetime.now().year
        cur.execute("""
            INSERT IGNORE INTO leave_balance
                (employee_id, year, casual_leave, sick_leave, earned_leave, casual_total, sick_total, earned_total)
            VALUES (%s, %s, 12.0, 12.0, 12.0, 12.0, 12.0, 12.0)
        """, (employee_id, current_year))

        updates = []
        params = []
        for col in ('casual_leave', 'sick_leave', 'earned_leave', 'casual_total', 'sick_total', 'earned_total'):
            if col in data:
                updates.append(f"{col} = %s")
                params.append(float(data[col]))
        if updates:
            params.append(employee_id)
            cur.execute(f"UPDATE leave_balance SET {', '.join(updates)} WHERE employee_id = %s", tuple(params))
            conn.commit()
        cur.close(); conn.close()
        return {"success": True, "message": "Leave balance updated successfully"}
    except Exception as e:
        return {"success": False, "message": str(e)}




@app.get("/api/users")
def get_users(token: str = None):
    """Return active employees for document dropdowns.
    Queries the employees table directly (canonical source).
    Falls back to users table if employees is empty.
    """
    import logging as _log
    try:
        conn   = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        users = []

        # Primary: employees table (always has full employee list)
        try:
            cursor.execute("""
                SELECT employee_code          AS user_id,
                       full_name,
                       COALESCE(email, '')    AS email,
                       'employee'             AS role
                FROM employees
                WHERE COALESCE(status, 'active') != 'inactive'
                ORDER BY full_name
            """)
            users = cursor.fetchall()
        except Exception as primary_err:
            _log.getLogger(__name__).warning("employees table query failed: %s", primary_err)
            try:
                conn.rollback()
            except Exception:
                pass

        # Fallback: users table
        if not users:
            try:
                cursor.execute("""
                    SELECT user_id,
                           full_name,
                           COALESCE(email, '') AS email,
                           role
                    FROM users
                    WHERE role = 'employee'
                      AND COALESCE(is_active, 1) = 1
                    ORDER BY full_name
                """)
                users = cursor.fetchall()
            except Exception as fallback_err:
                _log.getLogger(__name__).warning("users table fallback failed: %s", fallback_err)

        cursor.close()
        conn.close()

        if users:
            return {"success": True, "users": users, "count": len(users)}
        return {"success": True, "users": [], "count": 0,
                "message": "No active employees found in database"}
    except Exception as e:
        import logging as _log2
        _log2.getLogger(__name__).error("GET /api/users error: %s", e)
        return {"success": False, "message": str(e), "users": [], "count": 0}


@app.get("/api/users/{user_id}")
def get_user_detail(user_id: str, token: str = None):
    """Get detailed user information - Direct database query"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Get user from users table
        cursor.execute("SELECT * FROM users WHERE user_id = %s", (user_id,))
        user = cursor.fetchone()
        conn.close()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Remove sensitive data
        user.pop('password', None)
        user.pop('password_hash', None)
        
        return {"success": True, "user": user}
    except HTTPException:
        raise
    except Exception as e:
        return {"success": False, "message": str(e)}

@app.put("/api/users/{user_id}")
def update_user_profile(user_id: str, data: dict):
    """Update user profile information"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        full_name = data.get('full_name')
        if not full_name:
            return {"success": False, "message": "full_name is required"}
        
        cursor.execute('UPDATE users SET full_name = %s WHERE user_id = %s', (full_name, user_id))
        conn.commit()
        conn.close()
        
        return {"success": True, "message": "Profile updated successfully"}
    except Exception as e:
        return {"success": False, "message": str(e)}


@app.get("/api/credentials")
def get_credentials(token: str = None):
    """Get all user credentials from users table only (no duplicates)"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Get ALL users from users table only
        cursor.execute("""
            SELECT user_id,
                   full_name as name,
                   username,
                   password,
                   username as email,
                   role,
                   role as department
            FROM users
            ORDER BY full_name
        """)
        all_creds = cursor.fetchall()
        
        conn.close()
        
        return {
            "success": True,
            "credentials": all_creds,
            "count": len(all_creds)
        }
    except Exception as e:
        return {
            "success": False,
            "credentials": [],
            "count": 0,
            "message": str(e)
        }

@app.get("/api/departments/mapping")
def get_departments_mapping():
    """Get department to employee mapping"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT department, COUNT(*) as count
            FROM employees
            GROUP BY department
        """)
        mappings = cursor.fetchall()
        cursor.close()
        conn.close()
        return {"success": True, "mappings": mappings}
    except:
        return {"success": True, "mappings": []}


@app.get("/api/analytics/overview")
def get_analytics_overview():
    """Get analytics overview with real data"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Get employee counts
        cursor.execute("SELECT COUNT(*) as total FROM employees")
        total_employees = cursor.fetchone()['total']
        
        # Get user counts by role
        cursor.execute("SELECT COUNT(*) as total FROM users")
        total_users = cursor.fetchone()['total']
        
        cursor.execute("SELECT COUNT(*) as count FROM users WHERE role='admin'")
        admins = cursor.fetchone()['count']
        
        cursor.execute("SELECT COUNT(*) as count FROM users WHERE role='hr'")
        hrs = cursor.fetchone()['count']
        
        cursor.execute("SELECT COUNT(*) as count FROM users WHERE role='employee' OR role='accountant'")
        regular_employees = cursor.fetchone()['count']
        
        cursor.execute("SELECT COUNT(*) as count FROM users WHERE is_active=1")
        active_users = cursor.fetchone()['count']
        
        # Department distribution
        cursor.execute("SELECT department, COUNT(*) as count FROM employees GROUP BY department")
        dept_rows = cursor.fetchall()
        dept_counts = {row['department'] or 'Unknown': row['count'] for row in dept_rows}
        
        conn.close()
        
        return {
            "success": True,
            "total_employees": total_employees,
            "active_employees": active_users,
            "total_users": total_users,
            "role_distribution": {
                "admin": admins,
                "hr": hrs,
                "employee": regular_employees
            },
            "department_distribution": dept_counts,
            "attendance_rate": 94.2,
            "pending_leaves": 12
        }
    except Exception as e:
        print(f"Analytics error: {e}")
        return {
            "success": False,
            "message": str(e),
            "total_employees": 0,
            "total_users": 0,
            "active_employees": 0,
            "role_distribution": {"admin": 0, "hr": 0, "employee": 0},
            "department_distribution": {}
        }


@app.get("/api/analytics/users")
def get_users_analytics():
    """Get detailed user analytics from MySQL users table."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT user_id, full_name, role, email, department, COALESCE(is_active,1) AS is_active FROM users")
        users = cursor.fetchall()
        cursor.close()
        conn.close()

        by_role = {"admin": [], "hr": [], "employee": []}
        by_department: dict = {}
        for u in users:
            role = u.get("role", "employee")
            if role in by_role:
                by_role[role].append({k: v for k, v in u.items() if k != "password"})
            dept = u.get("department") or "Unknown"
            by_department[dept] = by_department.get(dept, 0) + 1

        analytics = {
            "total_users": len(users),
            "by_role": by_role,
            "by_department": by_department,
            "active_users": sum(1 for u in users if u.get("is_active")),
            "inactive_users": sum(1 for u in users if not u.get("is_active")),
        }
        return {"success": True, "data": analytics}
    except Exception as e:
        return {"success": False, "message": str(e), "data": {}}


@app.post("/api/users/{user_id}/role")
def update_user_role(user_id: str, new_role: str, token: str = None):
    """Update user role - admin only"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE users SET role = %s WHERE user_id = %s", (new_role, user_id))
        conn.commit()
        cursor.close()
        conn.close()
        return {"success": True, "message": f"Role updated to {new_role}"}
    except Exception as e:
        return {"success": False, "message": str(e)}


class RoleUpdate(BaseModel):
    role: str

@app.put("/api/users/{user_id}/role")
def put_user_role(user_id: str, body: RoleUpdate):
    """Update user role via PUT with JSON body {role: '...'}"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE users SET role = %s WHERE user_id = %s", (body.role, user_id))
        conn.commit()
        cursor.close()
        conn.close()
        return {"success": True, "message": f"Role updated to {body.role}"}
    except Exception as e:
        return {"success": False, "message": str(e)}


@app.post("/api/users/{user_id}/deactivate")
def deactivate_user_endpoint(user_id: str, token: str = None):
    """Deactivate user - admin only"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE users SET is_active = 0 WHERE user_id = %s", (user_id,))
        conn.commit()
        cursor.close()
        conn.close()
        audit_logger.log_admin_activity(
            admin_id="admin",
            admin_name="Administrator",
            action="User Deactivated",
            details=f"Deactivated user {user_id}",
            target_employee_id=user_id
        )
        return {"success": True, "message": f"User {user_id} deactivated"}
    except Exception as e:
        return {"success": False, "message": str(e)}


# Reports Endpoints
@app.get("/api/reports/employee_summary")
def get_employee_summary_report(token: str = None):
    """Generate employee summary report - Admin and HR only"""
    try:
        # Allow all authenticated users (frontend already handles role-based display)
        employees = get_all_employees()
        return {
            "success": True,
            "data": {
                "total_employees": len(employees),
                "active_employees": len([e for e in employees if e.get('is_active', True)]),
                "departments": len(set(e.get('department', 'General') for e in employees)),
                "average_tenure_days": 365
            }
        }
    except Exception as e:
        return {"success": False, "message": str(e)}


@app.get("/api/reports/department_report")
def get_department_report(token: str = None):
    """Generate department-wise report - Admin and HR only"""
    try:
        employees = get_all_employees()
        dept_breakdown = {}
        for emp in employees:
            dept = emp.get('department', 'General')
            dept_breakdown[dept] = dept_breakdown.get(dept, 0) + 1
        
        return {
            "success": True,
            "data": dept_breakdown
        }
    except Exception as e:
        return {"success": False, "message": str(e)}


@app.get("/api/reports/payroll_report")
def get_payroll_report(token: str = None):
    """Generate payroll report - Admin and HR only"""
    try:
        employees = get_all_employees()
        total_salary = 0
        salary_count = 0
        
        for emp in employees:
            if 'salary' in emp and emp['salary']:
                try:
                    salary = float(str(emp['salary']).replace(',', ''))
                    total_salary += salary
                    salary_count += 1
                except:
                    pass
        
        avg_salary = total_salary / salary_count if salary_count > 0 else 0
        
        return {
            "success": True,
            "data": {
                "total_monthly_payroll": round(total_salary, 2),
                "average_salary": round(avg_salary, 2),
                "employees_with_salary": salary_count,
                "total_employees": len(employees)
            }
        }
    except Exception as e:
        return {"success": False, "message": str(e)}


@app.get("/api/reports/attendance_report")
def get_attendance_report(token: str = None):
    """Generate attendance report - Admin and HR only"""
    try:
        employees = get_all_employees()
        return {
            "success": True,
            "data": {
                "total_employees": len(employees),
                "present": len(employees),
                "absent": 0,
                "on_leave": 0,
                "attendance_percentage": 100
            }
        }
    except Exception as e:
        return {"success": False, "message": str(e)}


@app.get("/api/reports/leave_report")
def get_leave_report(token: str = None):
    """Generate leave report - Admin and HR only"""
    try:
        # Allow access without strict token validation (frontend handles role-based display)
        return {
            "success": True,
            "data": {
                "casual_leave_total": 12,
                "sick_leave_total": 5,
                "earned_leave_total": 18,
                "leaves_taken": 8,
                "leaves_remaining": 27,
                "pending_approval": 2
            }
        }
    except Exception as e:
        return {"success": False, "message": str(e)}


@app.get("/api/reports/performance_report")
def get_performance_report(token: str = None):
    """Generate performance report with task-based calculations - Admin and HR only"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Get all employees with their task performance
        cursor.execute("SELECT employee_id, CONCAT(first_name, ' ', last_name) as name FROM employees")
        employees = cursor.fetchall()
        
        # Calculate task-based performance for each employee
        performance_data = []
        total_completion_rate = 0
        total_on_time_rate = 0
        employees_with_tasks = 0
        
        for emp in employees:
            # Get tasks for this employee
            cursor.execute("SELECT * FROM tasks WHERE assigned_to = %s", (emp['name'],))
            tasks = cursor.fetchall()
            
            if tasks:
                employees_with_tasks += 1
                total_tasks = len(tasks)
                completed_tasks = len([t for t in tasks if t['status'] == 'Completed'])
                on_time_tasks = 0
                weighted_score = 0
                
                for task in tasks:
                    if task['status'] == 'Completed':
                        if task['actual_end_date'] and task['target_end_date']:
                            if task['actual_end_date'].date() <= task['target_end_date']:
                                on_time_tasks += 1
                        weighted_score += float(task.get('custom_weightage', 1.0))
                
                completion_rate = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0
                on_time_rate = (on_time_tasks / completed_tasks * 100) if completed_tasks > 0 else 0
                
                total_completion_rate += completion_rate
                total_on_time_rate += on_time_rate
                
                performance_data.append({
                    "employee_id": emp['employee_id'],
                    "name": emp['name'],
                    "total_tasks": total_tasks,
                    "completed_tasks": completed_tasks,
                    "completion_rate": round(completion_rate, 2),
                    "on_time_rate": round(on_time_rate, 2),
                    "weighted_score": round(weighted_score, 2)
                })
        
        # Calculate overall statistics
        avg_completion_rate = total_completion_rate / employees_with_tasks if employees_with_tasks > 0 else 0
        avg_on_time_rate = total_on_time_rate / employees_with_tasks if employees_with_tasks > 0 else 0
        
        # Categorize performers based on completion rate
        high_performers = len([p for p in performance_data if p['completion_rate'] >= 80])
        average_performers = len([p for p in performance_data if 50 <= p['completion_rate'] < 80])
        low_performers = len([p for p in performance_data if p['completion_rate'] < 50])
        
        cursor.close()
        conn.close()
        
        return {
            "success": True,
            "data": {
                "total_employees_with_tasks": employees_with_tasks,
                "high_performers": high_performers,
                "average_performers": average_performers,
                "low_performers": low_performers,
                "average_completion_rate": round(avg_completion_rate, 2),
                "average_on_time_rate": round(avg_on_time_rate, 2),
                "employee_details": performance_data
            }
        }
    except Exception as e:
        return {"success": False, "message": str(e)}

# ── Ensure announcements + notifications tables exist ──────────────────────────
def _ensure_support_tables():
    """
    Create tables that features depend on but that were never created by a migration:
    tickets, task boards, performance reviews/goals, final settlements, payroll records,
    plus the plain `tasks` and `remarks` tables used by the task list and HR remarks.
    Idempotent: every statement is CREATE TABLE IF NOT EXISTS.
    """
    import re as _re
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        sql_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sql", "sql")
        for name in ("create_tickets_tables.sql", "fnf_settlement_table.sql", "task_manager_schema.sql",
                     "performance_tables.sql", "payroll_records.sql"):
            path = os.path.join(sql_dir, name)
            if not os.path.exists(path):
                continue
            text = "\n".join(ln.split("--")[0] for ln in open(path, encoding="utf-8").read().splitlines())
            for stmt in [x.strip() for x in text.split(";") if x.strip()]:
                if stmt.upper().startswith("CREATE TABLE") or stmt.upper().startswith("INSERT INTO TASK_BOARDS"):
                    try:
                        cur.execute(stmt)
                    except Exception as exc:
                        logger.warning("_ensure_support_tables %s: %s", name, exc)
        for stmt in (
            """CREATE TABLE IF NOT EXISTS tasks (
                id INT AUTO_INCREMENT PRIMARY KEY,
                task_id VARCHAR(50) NOT NULL UNIQUE,
                title VARCHAR(255) NOT NULL,
                description TEXT NULL,
                assigned_to VARCHAR(150) NOT NULL,
                assigned_by VARCHAR(150) NOT NULL,
                priority VARCHAR(20) DEFAULT 'Medium',
                due_date DATE NULL,
                target_start_date DATE NULL,
                target_end_date DATE NULL,
                actual_start_date DATETIME NULL,
                actual_end_date DATETIME NULL,
                custom_weightage DECIMAL(5,2) DEFAULT 1.00,
                status VARCHAR(30) DEFAULT 'To Do',
                category VARCHAR(100) DEFAULT 'General',
                last_edited_at DATETIME NULL,
                last_edited_by VARCHAR(100) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_assigned_to (assigned_to),
                INDEX idx_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",
            """CREATE TABLE IF NOT EXISTS remarks (
                id INT AUTO_INCREMENT PRIMARY KEY,
                employee_id VARCHAR(50) NOT NULL,
                remark TEXT NOT NULL,
                sentiment VARCHAR(30) NULL,
                created_by VARCHAR(50) NULL,
                created_by_name VARCHAR(150) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_employee (employee_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",
        ):
            cur.execute(stmt)
        conn.commit()
        # performance_api reads performance_reviews.completed_at; the SQL file does not define it
        cur.execute("SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = %s "
                    "AND table_name = 'performance_reviews' AND column_name = 'completed_at'", (DB_CONFIG["database"],))
        if cur.fetchone()[0] == 0:
            cur.execute("ALTER TABLE performance_reviews ADD COLUMN completed_at DATETIME NULL")
            conn.commit()
        # Use the same collation as the existing tables so joins do not fail
        # ("Illegal mix of collations") on MySQL 8+, whose default is utf8mb4_0900_ai_ci.
        try:
            cur.execute("ALTER DATABASE `%s` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci" % DB_CONFIG["database"])
        except Exception as exc:
            logger.warning("_ensure_support_tables: could not set database collation: %s", exc)
        cur.execute(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = %s AND table_name IN "
            "('tasks','remarks','support_tickets','ticket_comments','ticket_attachments','final_settlements','task_boards',"
            "'kanban_tasks','task_comments','performance_reviews','goals','payroll_records') "
            "AND table_collation <> 'utf8mb4_general_ci'", (DB_CONFIG["database"],))
        odd = [r[0] for r in cur.fetchall()]
        if odd:
            cur.execute("SET FOREIGN_KEY_CHECKS = 0")
            for t in odd:
                cur.execute("ALTER TABLE `%s` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci" % t)
            cur.execute("SET FOREIGN_KEY_CHECKS = 1")
        conn.commit()
        cur.close()
    except Exception as exc:
        logger.warning("_ensure_support_tables failed: %s", exc)
    finally:
        if conn:
            try: conn.close()
            except Exception: pass


def _ensure_announcement_tables():
    try:
        conn = get_db_connection()
        cur  = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS announcements (
                id           INT AUTO_INCREMENT PRIMARY KEY,
                title        VARCHAR(255) NOT NULL,
                message      TEXT NOT NULL,
                created_by   VARCHAR(50)  NOT NULL,
                creator_name VARCHAR(150) DEFAULT 'Admin',
                creator_role VARCHAR(50)  DEFAULT 'admin',
                is_active    TINYINT(1)   DEFAULT 1,
                created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_active_created (is_active, created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS notifications (
                id          INT AUTO_INCREMENT PRIMARY KEY,
                user_id     VARCHAR(50)  NOT NULL,
                title       VARCHAR(255) NOT NULL,
                message     TEXT,
                type        VARCHAR(50)  DEFAULT 'general',
                is_read     TINYINT(1)   DEFAULT 0,
                created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_user_read (user_id, is_read),
                INDEX idx_created   (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """)
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"[startup] table creation warning: {e}")

# _ensure_announcement_tables() is now called inside _startup() — removed from module level.

# ── Announcement endpoints ─────────────────────────────────────────────────────
def _fanout_notifications(conn, title: str, message: str, ann_type: str = "announcement"):
    """Insert one notification row per active user/employee."""
    try:
        cur = conn.cursor()
        # Collect every user_id from users table
        cur.execute("SELECT user_id FROM users WHERE is_active = 1")
        user_rows = cur.fetchall()
        if not user_rows:
            # Fall back to employee codes
            cur.execute("SELECT employee_code FROM employees WHERE status = 'active'")
            user_rows = [{"user_id": r[0]} for r in cur.fetchall()]
        if user_rows:
            cur.executemany("""
                INSERT INTO notifications (user_id, title, message, type)
                VALUES (%s, %s, %s, %s)
            """, [(row[0] if isinstance(row, tuple) else row["user_id"],
                   title, message, ann_type) for row in user_rows])
        cur.close()
    except Exception as e:
        print(f"[notifications fanout] warning: {e}")

@app.post("/api/announcements")
@app.post("/api/announcements/create")
async def create_announcement(request: Request):
    try:
        announcement = await request.json()
    except Exception:
        return {"success": False, "message": "Invalid JSON body"}

    title        = (announcement.get("title") or "Announcement").strip()
    message      = (announcement.get("message") or announcement.get("content") or "").strip()
    created_by   = announcement.get("created_by",   "admin")
    creator_name = announcement.get("creator_name", "Administrator")
    creator_role = announcement.get("creator_role", "admin")

    if not title or not message:
        return {"success": False, "message": "Title and message are required"}

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO announcements (title, message, created_by, creator_name, creator_role)
            VALUES (%s, %s, %s, %s, %s)
        """, (title, message, created_by, creator_name, creator_role))
        conn.commit()

        # Fanout: create a notification for every user
        _fanout_notifications(conn, title, message, "announcement")
        conn.commit()

        cursor.close()
        conn.close()
        return {"success": True, "message": "Announcement posted and notifications sent"}
    except Exception as e:
        return {"success": False, "message": str(e)}

# Tasks endpoints
@app.post("/api/tasks")
def create_task(task: dict):
    try:
        print(f"[DEBUG] Creating task: {task}")
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Calculate weightage: if custom_weightage provided, use it; else use priority-based default
        custom_weightage = task.get('custom_weightage')
        if custom_weightage is None:
            priority = task.get('priority', 'Medium')
            weightage_map = {'High': 1.5, 'Medium': 1.0, 'Low': 0.5}
            custom_weightage = weightage_map.get(priority, 1.0)
        
        cursor.execute("""
            INSERT INTO tasks (task_id, title, description, assigned_to, assigned_by, priority, 
                             due_date, target_start_date, target_end_date, custom_weightage, status, category)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            task['task_id'],
            task['title'],
            task.get('description'),
            task['assigned_to'],
            task['assigned_by'],
            task.get('priority', 'Medium'),
            task.get('due_date'),
            task.get('target_start_date'),
            task.get('target_end_date'),
            custom_weightage,
            task.get('status', 'To Do'),
            task.get('category', 'General')
        ))
        conn.commit()
        
        # Log admin activity
        audit_logger.log_admin_activity(
            admin_id=task.get('assigned_by', 'admin'),
            admin_name="Administrator",
            action="Task Created",
            details=f"Created task '{task['title']}' for {task['assigned_to']}",
            target_employee_id=task.get('assigned_to')
        )
        
        print(f"[DEBUG] Task created successfully: {task['task_id']}")
        conn.close()
        return {"success": True, "message": "Task created successfully", "task_id": task['task_id']}
    except Exception as e:
        print(f"[ERROR] Task creation failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return {"success": False, "message": str(e)}

@app.get("/api/tasks")
def get_tasks(user_id: str = None, user_role: str = None):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        if user_id and user_role != 'admin':
            # Only admin can see all tasks in task manager
            # HR and employees can only see their own tasks
            
            # First try to get employee name from employee_id
            cursor.execute("SELECT CONCAT(first_name, ' ', last_name) as full_name FROM employees WHERE employee_id = %s", (user_id,))
            employee_result = cursor.fetchone()
            
            if employee_result:
                employee_name = employee_result['full_name']
                # Search by employee name
                cursor.execute("SELECT * FROM tasks WHERE TRIM(assigned_to) = TRIM(%s) ORDER BY created_at DESC", (employee_name,))
                
                # Log employee activity
                audit_logger.log_employee_activity(
                    employee_id=user_id,
                    employee_name=employee_name,
                    action="Tasks Viewed",
                    details="Viewed assigned tasks in task manager"
                )
            else:
                # Fallback: search by user_id directly
                cursor.execute("SELECT * FROM tasks WHERE TRIM(assigned_to) = TRIM(%s) ORDER BY created_at DESC", (user_id,))
        else:
            # Admin or no user_id: show all tasks
            cursor.execute("SELECT * FROM tasks ORDER BY created_at DESC")
            
            if user_id and user_role == 'admin':
                audit_logger.log_admin_activity(
                    admin_id=user_id,
                    admin_name="Administrator",
                    action="All Tasks Viewed",
                    details="Viewed all tasks in admin panel"
                )
        
        tasks = cursor.fetchall()
        conn.close()
        return {"success": True, "tasks": tasks}
    except Exception as e:
        return {"success": False, "message": str(e), "tasks": []}

@app.put("/api/tasks/{task_id}")
def update_task(task_id: str, task: dict):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Build dynamic update query
        update_fields = []
        update_values = []
        
        if 'title' in task:
            update_fields.append("title=%s")
            update_values.append(task['title'])
        if 'description' in task:
            update_fields.append("description=%s")
            update_values.append(task['description'])
        if 'status' in task:
            update_fields.append("status=%s")
            update_values.append(task['status'])
            if task['status'] == 'In Progress':
                update_fields.append("actual_start_date=COALESCE(actual_start_date, NOW())")
                update_fields.append("actual_end_date=NULL")
            elif task['status'] == 'Completed':
                update_fields.append("actual_end_date=NOW()")
            elif task['status'] == 'To Do':
                # Marking as incomplete - increment flag counter
                update_fields.append("actual_start_date=NULL")
                update_fields.append("actual_end_date=NULL")
                update_fields.append("flags=flags+1")
        if 'priority' in task:
            update_fields.append("priority=%s")
            update_values.append(task['priority'])
            if 'custom_weightage' not in task:
                weightage_map = {'High': 1.5, 'Medium': 1.0, 'Low': 0.5}
                update_fields.append("custom_weightage=%s")
                update_values.append(weightage_map.get(task['priority'], 1.0))
        if 'custom_weightage' in task:
            update_fields.append("custom_weightage=%s")
            update_values.append(task['custom_weightage'])
        if 'due_date' in task:
            update_fields.append("due_date=%s")
            update_values.append(task['due_date'])
        if 'category' in task:
            update_fields.append("category=%s")
            update_values.append(task['category'])
        if 'last_edited_by' in task:
            update_fields.append("last_edited_by=%s")
            update_values.append(task['last_edited_by'])
        
        update_fields.append("last_edited_at=NOW()")
        update_values.append(task_id)
        
        query = f"UPDATE tasks SET {', '.join(update_fields)} WHERE task_id=%s"
        cursor.execute(query, tuple(update_values))
        conn.commit()
        
        # Log activity based on who updated
        editor = task.get('last_edited_by', 'Unknown')
        if editor and 'admin' in editor.lower() or task.get('user_role') == 'admin':
            audit_logger.log_admin_activity(
                admin_id=editor,
                admin_name="Administrator",
                action="Task Updated",
                details=f"Updated task {task_id}: {', '.join([k for k in task.keys() if k != 'last_edited_by'])}",
                target_employee_id=task.get('assigned_to')
            )
        elif editor:
            audit_logger.log_employee_activity(
                employee_id=editor,
                employee_name=editor,
                action="Task Updated",
                details=f"Updated own task {task_id}: status={task.get('status', 'N/A')}"
            )
        
        conn.close()
        return {"success": True, "message": "Task updated successfully"}
    except Exception as e:
        return {"success": False, "message": str(e)}

@app.get("/api/tasks/performance/{employee_id}")
def get_task_performance(employee_id: str, start_date: str = None, end_date: str = None, user_id: str = None, user_role: str = None):
    try:
        # Task Manager access control: only admin can see all performance, others see only their own
        if user_role != 'admin' and user_id != employee_id:
            return {"success": False, "message": "Access denied - only admin can view all performance metrics in task manager"}
        
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        query = "SELECT * FROM tasks WHERE assigned_to = %s"
        params = [employee_id]
        if start_date and end_date:
            query += " AND created_at BETWEEN %s AND %s"
            params.extend([start_date, end_date])
        cursor.execute(query, tuple(params))
        tasks = cursor.fetchall()
        conn.close()
        
        total_tasks = len(tasks)
        completed_tasks = len([t for t in tasks if t['status'] == 'Completed'])
        on_time_tasks = 0
        total_weighted_score = 0
        
        for task in tasks:
            if task['status'] == 'Completed':
                if task['actual_end_date'] and task['target_end_date']:
                    if task['actual_end_date'].date() <= task['target_end_date']:
                        on_time_tasks += 1
                        total_weighted_score += float(task.get('custom_weightage', 1.0))
        
        completion_rate = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0
        on_time_rate = (on_time_tasks / completed_tasks * 100) if completed_tasks > 0 else 0
        
        return {
            "success": True,
            "employee_id": employee_id,
            "total_tasks": total_tasks,
            "completed_tasks": completed_tasks,
            "on_time_tasks": on_time_tasks,
            "completion_rate": round(completion_rate, 2),
            "on_time_rate": round(on_time_rate, 2),
            "weighted_score": round(total_weighted_score, 2)
        }
    except Exception as e:
        return {"success": False, "message": str(e)}


@app.get("/api/admin/profile/{user_id}")
def get_user_profile(user_id: str, token: str = None):
    """Get complete user profile with documents"""
    if profile_system is None:
        raise HTTPException(status_code=503, detail="Service not ready")
    try:
        result = profile_system.get_profile_data(user_id)
        if result:
            return {"success": True, "profile": result}
        return {"success": False, "message": "Profile not found"}
    except Exception as e:
        return {"success": False, "message": str(e)}


@app.get("/api/admin/employee-files/{user_id}")
def get_employee_files(user_id: str, token: str = None):
    """Get list of employee files for download"""
    try:
        import os
        from pathlib import Path
        
        employee_dir = Path("employee_data") / user_id
        files = []
        
        if employee_dir.exists():
            for root, dirs, filenames in os.walk(employee_dir):
                for filename in filenames:
                    file_path = Path(root) / filename
                    rel_path = file_path.relative_to(employee_dir)
                    files.append({
                        "name": filename,
                        "path": str(rel_path),
                        "download_url": f"http://localhost:8002/employee-file/{user_id}/{rel_path}"
                    })
        
        return {"success": True, "files": files}
    except Exception as e:
        return {"success": False, "message": str(e), "files": []}


@app.get("/employee-file/{user_id}/{file_path:path}")
def download_employee_file(user_id: str, file_path: str):
    """Download employee file"""
    try:
        # Prevent directory traversal: reject path components that escape the employee dir
        if ".." in file_path or ".." in user_id:
            raise HTTPException(status_code=400, detail="Invalid path")
        base = Path("employee_data").resolve()
        full_path = (Path("employee_data") / user_id / file_path).resolve()
        try:
            full_path.relative_to(base)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid path")
        if not full_path.exists():
            raise HTTPException(status_code=404, detail="File not found")
        return FileResponse(path=str(full_path))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


# Document action card endpoints
# Test endpoint for document generation
@app.get("/api/test-doc")
async def test_document_generation():
    """Test document generation endpoint"""
    try:
        from backend.core.document_generator import DocumentGenerator
        doc_gen = DocumentGenerator()
        
        salary_data = {
            'employee_id': 'emp004',
            'employee_name': 'Test Employee',
            'department': 'General',
            'position': 'Employee',
            'month_year': datetime.now().strftime('%Y-%m'),
            'basic_salary': 25000,
            'hra': 10000,
            'transport': 2000,
            'medical': 1500,
            'gross_salary': 50000,
            'pf_deduction': 6000,
            'tax_deduction': 5000,
            'total_deductions': 11000,
            'net_salary': 39000
        }
        
        filename = doc_gen.generate_salary_slip(salary_data)
        file_path = Path("generated_docs") / filename
        
        return {
            "success": True,
            "filename": filename,
            "file_exists": file_path.exists(),
            "file_path": str(file_path.absolute()),
            "download_url": f"/download/{filename}"
        }
    except Exception as e:
        import traceback
        return {
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }

@app.get("/api/documents/my-salary-slip")
async def download_my_salary_slip(user_id: str = None):
    """Download salary slip for employee"""
    try:
        from backend.core.document_generator import DocumentGenerator
        doc_gen = DocumentGenerator()
        
        if not user_id:
            user_id = 'emp004'
        
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Get employee and salary data
        cursor.execute("""
            SELECT e.employee_id, CONCAT(e.first_name, ' ', e.last_name) as name, 
                   e.department, e.title,
                   ss.basic_salary, ss.hra, ss.transport_allowance, ss.medical_allowance, ss.special_allowance,
                   ss.pf_employee, ss.professional_tax, ss.tds_deduction, ss.gross_salary, ss.net_salary
            FROM employees e
            LEFT JOIN salary_structures ss ON e.employee_id = ss.employee_id AND ss.status = 'active'
            WHERE e.employee_id = %s
        """, (user_id,))
        
        result = cursor.fetchone()
        conn.close()
        
        if not result:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        # Use database values or calculate if not present
        basic = result.get('basic_salary') or 0
        hra = result.get('hra') or 0
        transport = result.get('transport_allowance') or 0
        medical = result.get('medical_allowance') or 0
        bonus = result.get('special_allowance') or 0
        gross = result.get('gross_salary') or (basic + hra + transport + medical + bonus)
        
        pf = result.get('pf_employee') or 0
        tax = result.get('tds_deduction') or 0
        pt = result.get('professional_tax') or 0
        total_deductions = pf + tax + pt
        net = result.get('net_salary') or (gross - total_deductions)
        
        salary_data = {
            'employee_id': user_id,
            'employee_name': result['name'],
            'department': result['department'],
            'position': result['title'],
            'month_year': datetime.now().strftime('%Y-%m'),
            'basic_salary': basic,
            'hra': hra,
            'transport': transport,
            'medical': medical,
            'bonus': bonus,
            'gross_salary': gross,
            'pf_deduction': pf,
            'tax_deduction': tax,
            'total_deductions': total_deductions,
            'net_salary': net
        }
        
        filename = doc_gen.generate_salary_slip(salary_data)
        file_path = Path("generated_docs") / filename
        
        return FileResponse(
            path=str(file_path.absolute()),
            filename=filename,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/documents/my-experience-letter")
async def download_my_experience_letter(user_id: str = None):
    """Download experience letter for employee"""
    try:
        from backend.core.document_generator import DocumentGenerator
        doc_gen = DocumentGenerator()
        
        # Get user_id from query params if not provided
        if not user_id:
            user_id = 'emp004'  # Default for testing
        
        # Get employee details
        try:
            conn = get_db_connection()
            cursor = conn.cursor(dictionary=True)
            cursor.execute("SELECT CONCAT(first_name, ' ', last_name) as name, department, title FROM employees WHERE employee_id = %s", (user_id,))
            emp = cursor.fetchone()
            conn.close()
        except:
            emp = {'name': 'Test Employee', 'department': 'General', 'title': 'Employee'}
        
        exp_data = {
            'employee_name': emp['name'] if emp else 'Test Employee',
            'employee_id': user_id,
            'designation': emp['title'] if emp else 'Employee',
            'department': emp['department'] if emp else 'General',
            'joining_date': '2023-01-01',
            'relieving_date': datetime.now().strftime('%Y-%m-%d')
        }
        
        filename = doc_gen.generate_experience_certificate(exp_data)
        file_path = Path("generated_docs") / filename
        
        return FileResponse(
            path=str(file_path.absolute()),
            filename=filename,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/documents/offer-letter")
async def download_offer_letter(user_id: str = None, user_role: str = None):
    """Download offer letter (admin only)"""
    try:
        if user_role != "admin":
            return {"success": False, "message": "Access denied - Admin only"}
        
        from backend.core.document_generator import DocumentGenerator
        doc_gen = DocumentGenerator()
        
        offer_data = {
            'candidate_name': 'New Employee',
            'position': 'Employee',
            'department': 'General',
            'salary': 'Rs. 5,00,000 per annum',
            'joining_date': (datetime.now() + timedelta(days=15)).strftime('%Y-%m-%d'),
            'employee_id': f"NEW{random.randint(100, 999)}"
        }
        
        filename = doc_gen.generate_offer_letter(offer_data)
        
        # Log activity
        audit_logger.log_admin_activity(
            admin_id=user_id,
            admin_name="Administrator",
            action="Offer Letter Generated",
            details="Generated sample offer letter"
        )
        
        return {
            "success": True,
            "message": "Offer letter generated",
            "download_url": f"/download/{filename}",
            "filename": filename,
            "auto_download": True
        }
    except Exception as e:
        return {"success": False, "message": str(e)}

@app.get("/api/documents/experience-letter")
async def download_experience_letter(user_id: str = None, user_role: str = None):
    """Download experience letter for current user"""
    try:
        if not user_id:
            raise HTTPException(status_code=400, detail="User ID required")
        
        # Get employee details
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT CONCAT(first_name, ' ', last_name) as name, title, department FROM employees WHERE employee_id = %s", (user_id,))
        emp = cursor.fetchone()
        conn.close()
        
        if not emp:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        from backend.core.document_generator import DocumentGenerator
        doc_gen = DocumentGenerator()
        
        exp_data = {
            'employee_name': emp['name'],
            'employee_id': user_id,
            'designation': emp.get('title', 'Employee'),
            'department': emp.get('department', 'General'),
            'joining_date': '2023-01-01',
            'relieving_date': datetime.now().strftime('%Y-%m-%d')
        }
        
        filename = doc_gen.generate_experience_certificate(exp_data)
        file_path = Path("generated_docs") / filename
        
        # Log activity
        audit_logger.log_employee_activity(
            employee_id=user_id,
            employee_name=emp['name'],
            action="Experience Letter Downloaded",
            details="Downloaded experience letter"
        )
        
        # Return direct file download
        return FileResponse(
            path=str(file_path.absolute()),
            filename=filename,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Original document generation endpoints for AI assistant
@app.post("/api/documents/generate_salary_slip")
async def generate_salary_slip_api(request: dict):
    """Generate salary slip for employee(s) - HR endpoint"""
    try:
        from backend.core.document_generator import DocumentGenerator
        doc_gen = DocumentGenerator()
        
        employee_id = request.get('employee_id', '').strip()
        if not employee_id:
            return {"success": False, "message": "employee_id is required"}
        
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT e.employee_id, CONCAT(e.first_name, ' ', e.last_name) as name, 
                   e.department, e.title,
                   ss.basic_salary, ss.hra, ss.transport_allowance, ss.medical_allowance, ss.special_allowance,
                   ss.pf_employee, ss.professional_tax, ss.tds_deduction, ss.gross_salary, ss.net_salary
            FROM employees e
            LEFT JOIN salary_structures ss ON e.employee_id = ss.employee_id AND ss.status = 'active'
            WHERE e.employee_id = %s
        """, (employee_id,))
        
        result = cursor.fetchone()
        
        if not result:
            conn.close()
            return {"success": False, "message": "Employee or salary structure not found"}
        
        basic = result.get('basic_salary') or 0
        hra = result.get('hra') or 0
        transport = result.get('transport_allowance') or 0
        medical = result.get('medical_allowance') or 0
        bonus = result.get('special_allowance') or 0
        gross = result.get('gross_salary') or (basic + hra + transport + medical + bonus)
        
        pf = result.get('pf_employee') or 0
        tax = result.get('tds_deduction') or 0
        pt = result.get('professional_tax') or 0
        total_deductions = pf + tax + pt
        net = result.get('net_salary') or (gross - total_deductions)
        
        salary_data = {
            'employee_id': employee_id,
            'employee_name': result['name'],
            'department': result['department'],
            'position': result['title'],
            'month_year': request.get('month_year', datetime.now().strftime('%Y-%m')),
            'basic_salary': basic,
            'hra': hra,
            'transport': transport,
            'medical': medical,
            'bonus': bonus,
            'gross_salary': gross,
            'pf_deduction': pf,
            'tax_deduction': tax,
            'total_deductions': total_deductions,
            'net_salary': net
        }
        
        filename = doc_gen.generate_salary_slip(salary_data)
        file_path = f"generated_docs/{filename}"
        
        # Store in employee_documents table
        doc_id = f"DOC{random.randint(10000, 99999)}"
        cursor.execute("""
            INSERT INTO employee_documents 
            (document_id, employee_id, document_type, document_name, file_path, uploaded_by)
            VALUES (%s, %s, 'Salary_Slip', %s, %s, 'HR')
            ON DUPLICATE KEY UPDATE file_path = VALUES(file_path)
        """, (doc_id, employee_id, filename, file_path))
        
        conn.commit()
        conn.close()
        
        return {
            "success": True,
            "message": "Salary slip generated successfully",
            "filename": filename,
            "download_url": f"http://localhost:8002/download/{filename}"
        }
    except Exception as e:
        return {"success": False, "message": str(e)}
        
        # Log document generation activity
        if user_id:
            if user_role == "admin":
                audit_logger.log_admin_activity(
                    admin_id=user_id,
                    admin_name="Administrator",
                    action="Salary Slip Generated",
                    details=f"Generated salary slip for {employee_name} - {month}",
                    target_employee_id=employee_name
                )
            else:
                conn = get_db_connection()
                cursor = conn.cursor(dictionary=True)
                cursor.execute("SELECT CONCAT(first_name, ' ', last_name) as name FROM employees WHERE employee_id = %s", (user_id,))
                emp = cursor.fetchone()
                emp_name = emp['name'] if emp else user_id
                conn.close()
                
                audit_logger.log_employee_activity(
                    employee_id=user_id,
                    employee_name=emp_name,
                    action="Salary Slip Downloaded",
                    details=f"Downloaded salary slip for {month}"
                )
        
        if employee_name.lower() == 'all employees':
            employees = get_all_employees()
            generated_files = []
            
            for emp in employees:
                salary_data = {
                    'employee_id': emp.get('employee_id', 'EMP001'),
                    'employee_name': emp.get('name', 'Unknown'),
                    'department': emp.get('department', 'General'),
                    'position': emp.get('title', 'Employee'),
                    'month_year': month,
                    'basic_salary': int(float(emp.get('salary', 50000)) * 0.5),
                    'hra': int(float(emp.get('salary', 50000)) * 0.2),
                    'transport': 2000,
                    'medical': 1500,
                    'gross_salary': int(float(emp.get('salary', 50000))),
                    'pf_deduction': int(float(emp.get('salary', 50000)) * 0.12),
                    'tax_deduction': int(float(emp.get('salary', 50000)) * 0.1),
                    'total_deductions': int(float(emp.get('salary', 50000)) * 0.22),
                    'net_salary': int(float(emp.get('salary', 50000)) * 0.78)
                }
                filename = doc_gen.generate_salary_slip(salary_data)
                generated_files.append(filename)
            
            return {
                "success": True,
                "message": f"Generated {len(generated_files)} salary slips",
                "files": generated_files,
                "download_url": f"http://localhost:8002/files/{generated_files[0]}" if generated_files else None
            }
        else:
            employees = get_all_employees()
            employee = next((e for e in employees if e.get('name', '').lower() == employee_name.lower()), None)
            
            if not employee:
                return {"success": False, "message": f"Employee '{employee_name}' not found"}
            
            salary_data = {
                'employee_id': employee.get('employee_id', 'EMP001'),
                'employee_name': employee.get('name', employee_name),
                'department': employee.get('department', 'General'),
                'position': employee.get('title', 'Employee'),
                'month_year': month,
                'basic_salary': int(float(employee.get('salary', 50000)) * 0.5),
                'hra': int(float(employee.get('salary', 50000)) * 0.2),
                'transport': 2000,
                'medical': 1500,
                'gross_salary': int(float(employee.get('salary', 50000))),
                'pf_deduction': int(float(employee.get('salary', 50000)) * 0.12),
                'tax_deduction': int(float(employee.get('salary', 50000)) * 0.1),
                'total_deductions': int(float(employee.get('salary', 50000)) * 0.22),
                'net_salary': int(float(employee.get('salary', 50000)) * 0.78)
            }
            
            filename = doc_gen.generate_salary_slip(salary_data)
            
            return {
                "success": True,
                "message": "Salary slip generated successfully",
                "filename": filename,
                "download_url": f"http://localhost:8002/files/{filename}"
            }
    except Exception as e:
        return {"success": False, "message": str(e)}


@app.post("/api/documents/generate_offer_letter")
async def generate_offer_letter_api(request: dict, user_id: str = None, user_role: str = None):
    """Generate offer letter for candidate with real salary data"""
    try:
        from backend.core.document_generator import DocumentGenerator
        doc_gen = DocumentGenerator()
        
        employee_id = request.get('employee_id')
        if not employee_id:
            return {"success": False, "message": "employee_id is required"}
        
        # Get real salary data from salary_structures
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT e.employee_id, CONCAT(e.first_name, ' ', e.last_name) as name, 
                   e.department, e.title, e.date_of_joining,
                   ss.annual_ctc, ss.basic_salary, ss.hra, ss.gross_salary, ss.net_salary
            FROM employees e
            LEFT JOIN salary_structures ss ON e.employee_id = ss.employee_id AND ss.status = 'active'
            WHERE e.employee_id = %s
        """, (employee_id,))
        
        result = cursor.fetchone()
        
        if not result:
            conn.close()
            return {"success": False, "message": "Employee or salary structure not found"}
        
        offer_data = {
            'candidate_name': result['name'],
            'position': result['title'],
            'department': result['department'],
            'annual_ctc': result.get('annual_ctc') or 0,
            'basic_salary': (result.get('basic_salary') or 0) * 12,
            'hra': (result.get('hra') or 0) * 12,
            'gross_salary': (result.get('gross_salary') or 0) * 12,
            'net_salary': (result.get('net_salary') or 0) * 12,
            'joining_date': request.get('joining_date') or result.get('date_of_joining') or datetime.now().strftime('%Y-%m-%d'),
            'employee_id': employee_id
        }
        
        filename = doc_gen.generate_offer_letter(offer_data)
        file_path = f"generated_docs/{filename}"
        
        # Store in employee_documents table
        doc_id = f"DOC{random.randint(10000, 99999)}"
        cursor.execute("""
            INSERT INTO employee_documents 
            (document_id, employee_id, document_type, document_name, file_path, uploaded_by)
            VALUES (%s, %s, 'Other', %s, %s, %s)
            ON DUPLICATE KEY UPDATE file_path = VALUES(file_path), uploaded_by = VALUES(uploaded_by)
        """, (doc_id, employee_id, filename, file_path, user_id or 'HR'))
        
        conn.commit()
        conn.close()
        
        return {
            "success": True,
            "message": "Offer letter generated successfully",
            "filename": filename,
            "download_url": f"http://localhost:8002/download/{filename}"
        }
    except Exception as e:
        return {"success": False, "message": str(e)}
        
        # Log document generation activity
        if user_id and user_role == "admin":
            audit_logger.log_admin_activity(
                admin_id=user_id,
                admin_name="Administrator",
                action="Offer Letter Generated",
                details=f"Generated offer letter for {offer_data['candidate_name']} - {offer_data['position']}",
                target_employee_id=employee_id
            )
        
        filename = doc_gen.generate_offer_letter(offer_data)
        
        return {
            "success": True,
            "message": "Offer letter generated successfully",
            "filename": filename,
            "download_url": f"http://localhost:8002/files/{filename}"
        }
    except Exception as e:
        return {"success": False, "message": str(e)}


# ============ SUPPORT TICKET MANAGEMENT ENDPOINTS ============

@app.post("/api/tickets")
def create_ticket(ticket: dict, token: str = None):
    """Create new support ticket"""
    if ticket_system is None:
        raise HTTPException(status_code=503, detail="Service not ready")
    try:
        result = ticket_system.create_ticket(
            title=ticket.get('title'),
            description=ticket.get('description'),
            category=ticket.get('category', 'Other'),
            priority=ticket.get('priority', 'Medium'),
            created_by=ticket.get('created_by'),
            created_by_name=ticket.get('created_by_name'),
            created_by_role=ticket.get('created_by_role')
        )
        return result
    except Exception as e:
        return {"success": False, "message": str(e)}

@app.get("/api/tickets")
def get_tickets(user_id: str = None, user_role: str = None, token: str = None):
    """Get tickets based on user role"""
    if ticket_system is None:
        raise HTTPException(status_code=503, detail="Service not ready")
    try:
        if not user_id or not user_role:
            return {"success": False, "message": "user_id and user_role required", "tickets": []}
        
        tickets = ticket_system.get_tickets(user_id, user_role)
        return {"success": True, "tickets": tickets}
    except Exception as e:
        return {"success": False, "message": str(e), "tickets": []}

@app.get("/api/tickets/{ticket_id}")
def get_ticket_detail(ticket_id: str, user_id: str = None, user_role: str = None, token: str = None):
    """Get ticket details"""
    if ticket_system is None:
        raise HTTPException(status_code=503, detail="Service not ready")
    try:
        if not user_id or not user_role:
            return {"success": False, "message": "user_id and user_role required"}
        
        ticket = ticket_system.get_ticket_by_id(ticket_id, user_id, user_role)
        if not ticket:
            return {"success": False, "message": "Ticket not found or access denied"}
        
        return {"success": True, "ticket": ticket}
    except Exception as e:
        return {"success": False, "message": str(e)}

@app.post("/api/tickets/{ticket_id}/assign")
def assign_ticket(ticket_id: str, assignment: dict, token: str = None):
    """Assign ticket to support staff"""
    if ticket_system is None:
        raise HTTPException(status_code=503, detail="Service not ready")
    try:
        result = ticket_system.assign_ticket(
            ticket_id=ticket_id,
            assigned_to=assignment.get('assigned_to'),
            assigned_to_name=assignment.get('assigned_to_name'),
            assigned_by_role=assignment.get('assigned_by_role', 'admin')
        )
        return result
    except Exception as e:
        return {"success": False, "message": str(e)}

@app.put("/api/tickets/{ticket_id}/status")
def update_ticket_status(ticket_id: str, status_update: dict, token: str = None):
    """Update ticket status"""
    if ticket_system is None:
        raise HTTPException(status_code=503, detail="Service not ready")
    try:
        result = ticket_system.update_status(
            ticket_id=ticket_id,
            new_status=status_update.get('status'),
            user_id=status_update.get('user_id'),
            user_role=status_update.get('user_role'),
            resolution_notes=status_update.get('resolution_notes')
        )
        return result
    except Exception as e:
        return {"success": False, "message": str(e)}

@app.post("/api/tickets/{ticket_id}/comments")
def add_ticket_comment(ticket_id: str, comment: dict, token: str = None):
    """Add comment to ticket"""
    if ticket_system is None:
        raise HTTPException(status_code=503, detail="Service not ready")
    try:
        result = ticket_system.add_comment(
            ticket_id=ticket_id,
            user_id=comment.get('user_id'),
            user_name=comment.get('user_name'),
            user_role=comment.get('user_role'),
            comment_text=comment.get('comment_text'),
            is_internal=comment.get('is_internal', False)
        )
        return result
    except Exception as e:
        return {"success": False, "message": str(e)}

@app.get("/api/tickets/{ticket_id}/comments")
def get_ticket_comments(ticket_id: str, user_role: str = None, token: str = None):
    """Get ticket comments"""
    if ticket_system is None:
        raise HTTPException(status_code=503, detail="Service not ready")
    try:
        if not user_role:
            return {"success": False, "message": "user_role required", "comments": []}
        
        comments = ticket_system.get_comments(ticket_id, user_role)
        return {"success": True, "comments": comments}
    except Exception as e:
        return {"success": False, "message": str(e), "comments": []}

@app.get("/api/support/employee-context/{employee_id}")
def get_employee_context_for_support(employee_id: str, requester_role: str = None, token: str = None):
    """Get limited employee info for support (no sensitive data)"""
    if ticket_system is None:
        raise HTTPException(status_code=503, detail="Service not ready")
    try:
        if requester_role not in ['admin', 'support', 'hr']:
            return {"success": False, "message": "Access denied"}
        
        context = ticket_system.get_employee_context(employee_id, requester_role)
        if not context:
            return {"success": False, "message": "Employee not found"}
        
        return {"success": True, "context": context}
    except Exception as e:
        return {"success": False, "message": str(e)}

@app.get("/api/tickets/stats")
def get_ticket_stats(user_id: str = None, user_role: str = None, token: str = None):
    """Get ticket statistics"""
    if ticket_system is None:
        raise HTTPException(status_code=503, detail="Service not ready")
    try:
        if not user_id or not user_role:
            return {"success": False, "message": "user_id and user_role required"}
        
        stats = ticket_system.get_ticket_stats(user_id, user_role)
        return {"success": True, "stats": stats}
    except Exception as e:
        return {"success": False, "message": str(e), "stats": {}}


def _load_csv_into_db():
    """Auto-load CSV file into database if it exists and DB is empty"""
    try:
        import pandas as pd
        from backend.load_excel import dataframe_to_rows
        
        # Check if database has employees
        existing_employees = get_all_employees()
        if len(existing_employees) > 0:
            print("Database already populated with employees")
            return
        
        # Try to load from CSV
        csv_path = Path("data/empl.csv")
        if csv_path.exists():
            print(f"Loading employees from {csv_path}...")
            df = pd.read_csv(csv_path)
            rows = dataframe_to_rows(df)
            count = load_employees(rows)
            print(f"Loaded {count} employees from CSV")
        else:
            print(f"CSV file not found at {csv_path}")
    except ImportError:
        print("pandas not installed - install it with: pip install pandas")
    except Exception as e:
        print(f"Could not auto-load CSV: {e}")


@app.get("/api/employees/all")
async def api_get_all_employees():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT employee_id, CONCAT(first_name, ' ', last_name) as name, title, email, department FROM employees ORDER BY first_name")
        employees = cursor.fetchall()
        cursor.close()
        conn.close()
        return {"success": True, "employees": employees, "count": len(employees)}
    except Exception as e:
        return {"success": False, "message": str(e), "employees": []}


@app.get("/api/departments/list")
async def get_departments_list():
    """Get all departments for dropdowns"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT department_id, name, description FROM departments WHERE is_active = 1 ORDER BY name")
        departments = cursor.fetchall()
        cursor.close()
        conn.close()
        return {"success": True, "departments": departments}
    except Exception as e:
        return {"success": False, "message": str(e), "departments": []}


# ==================== AUDIT & SECURITY ENDPOINTS ====================

@app.post("/api/audit/clear")
def clear_audit_logs():
    """Clear all audit logs - Admin only"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM admin_activity_logs")
        cursor.execute("DELETE FROM employee_activity_logs")
        cursor.execute("DELETE FROM login_history")
        conn.commit()
        conn.close()
        
        # Log this action
        audit_logger.log_admin_activity(
            admin_id="admin",
            admin_name="System Administrator",
            action="Audit Logs Cleared",
            details="Cleared all audit logs and started fresh tracking"
        )
        
        return {"success": True, "message": "Audit logs cleared. Fresh tracking started."}
    except Exception as e:
        return {"success": False, "message": str(e)}

@app.get("/api/audit/admin-logs")
def get_admin_activity_logs(limit: int = 100, admin_id: str = None):
    """Get admin activity logs"""
    return audit_logger.get_admin_logs(limit, admin_id)

@app.get("/api/audit/employee-logs")
def get_employee_activity_logs(limit: int = 100, employee_id: str = None):
    """Get employee activity logs"""
    return audit_logger.get_employee_logs(limit, employee_id)

@app.get("/api/audit/login-history")
def get_login_history_logs(limit: int = 100, user_id: str = None):
    """Get login history"""
    return audit_logger.get_login_history(limit, user_id)

@app.get("/api/audit/summary")
def get_audit_summary():
    """Get audit summary statistics"""
    return audit_logger.get_audit_summary()


# ==================== ADMIN FEATURES ENDPOINTS ====================

# Employee Management
@app.put("/api/admin/employees/{employee_id}")
@app.post("/api/admin/employees/{employee_id}/edit")
def admin_edit_employee(employee_id: str, data: dict, request: Request):
    client_ip = request.client.host if request.client else "127.0.0.1"
    actor = data.get('actor') or data.get('performed_by') or "HR Admin"
    return admin_features.edit_employee(employee_id, data, actor=actor, client_ip=client_ip)

@app.post("/api/admin/employees/{employee_id}/toggle-status")
def admin_toggle_employee(employee_id: str, data: dict, request: Request):
    client_ip = request.client.host if request.client else "127.0.0.1"
    actor = data.get('actor') or data.get('performed_by') or "HR Admin"
    return admin_features.toggle_employee_status(employee_id, data.get('is_active', True), actor=actor, client_ip=client_ip)

# Document Generation
@app.post("/api/admin/documents/experience-letter/{employee_id}")
def admin_generate_experience(employee_id: str):
    return admin_features.generate_experience_letter(employee_id)

@app.post("/api/admin/documents/relieving-letter/{employee_id}")
def admin_generate_relieving(employee_id: str, data: dict):
    return admin_features.generate_relieving_letter(employee_id, data.get('last_working_day'))

# Credential Management
@app.put("/api/admin/credentials/{employee_id}")
@app.post("/api/admin/employees/{employee_id}/credentials")
def admin_update_credentials(employee_id: str, data: dict, request: Request):
    client_ip = request.client.host if request.client else "127.0.0.1"
    actor = data.get('actor') or data.get('performed_by') or "HR Admin"
    return admin_features.update_employee_credentials(
        employee_id,
        new_employee_id=data.get('new_employee_id'),
        password=data.get('password'),
        actor=actor,
        client_ip=client_ip
    )

@app.get("/api/admin/login-history")
def admin_get_login_history(employee_id: str = None):
    return admin_features.get_login_history(employee_id)

@app.post("/api/admin/force-logout/{employee_id}")
def admin_force_logout(employee_id: str):
    return admin_features.force_logout_user(employee_id)

# Payroll
@app.post("/api/admin/payroll/salary-structure/{employee_id}")
def admin_create_salary(employee_id: str, structure: dict):
    return admin_features.create_salary_structure(employee_id, structure)

@app.get("/api/admin/payroll/salary-history/{employee_id}")
def admin_salary_history(employee_id: str):
    return admin_features.get_salary_history(employee_id)

@app.post("/api/admin/payroll/bonus/{employee_id}")
def admin_add_bonus(employee_id: str, data: dict):
    return admin_features.add_bonus(employee_id, data['amount'], data['bonus_type'], data.get('reason', ''))

@app.post("/api/admin/payroll/final-settlement/{employee_id}")
def admin_final_settlement(employee_id: str, data: dict):
    return admin_features.calculate_final_settlement(employee_id, data['last_working_day'])

# Attendance
@app.post("/api/admin/attendance/mark")
def admin_mark_attendance(data: dict):
    from backend.core.time_tracking import verify_staff, log_audit
    actor = verify_staff(data.get('modified_by'))      # HR / admin only
    result = admin_features.mark_attendance(
        data['employee_id'], data['date'], data['status'],
        data.get('check_in'), data.get('check_out')
    )
    try:
        conn = get_db_connection(); cur = conn.cursor(dictionary=True)
        log_audit(cur, employee_id=data['employee_id'], attendance_date=str(data['date'])[:10], action="ADMIN_MARK",
                  actor=actor, new={"status": data['status'], "check_in": data.get('check_in'), "check_out": data.get('check_out')},
                  reason=data.get('reason'))
        conn.commit(); cur.close(); conn.close()
    except Exception as exc:
        logger.warning("admin_mark_attendance audit failed: %s", exc)
    return result

@app.get("/api/admin/attendance/calendar")
def admin_attendance_calendar(employee_id: str = None, month: str = None):
    return admin_features.get_attendance_calendar(employee_id, month)

@app.get("/api/admin/attendance/leave-balance/{employee_id}")
def admin_leave_balance(employee_id: str):
    return admin_features.get_leave_balance(employee_id)

# Department & Designation
@app.post("/api/admin/departments")
def admin_create_dept(data: dict):
    return admin_features.create_department(data['name'], data.get('description'), data.get('head_id'))

@app.put("/api/admin/departments/{dept_id}")
def admin_edit_dept(dept_id: int, data: dict):
    return admin_features.edit_department(dept_id, data.get('name'), data.get('description'), data.get('head_id'))

@app.delete("/api/admin/departments/{dept_id}")
def admin_delete_dept(dept_id: int):
    return admin_features.delete_department(dept_id)

@app.post("/api/admin/designations")
def admin_create_designation(data: dict):
    return admin_features.create_designation(data['title'], data.get('department_id'), data.get('level'))

@app.get("/api/admin/departments")
def admin_get_departments():
    return admin_features.get_departments()

# Performance Management
@app.post("/api/admin/performance/cycles")
def admin_create_cycle(data: dict):
    return admin_features.create_performance_cycle(
        data['name'], data['start_date'], data['end_date'], data.get('description')
    )


@app.post("/api/admin/performance/kpis")
def admin_create_kpi(data: dict):
    return admin_features.create_kpi(
        data['employee_id'], data['cycle_id'], data['kpi_name'], data['target'], data['weightage']
    )

@app.post("/api/admin/performance/self-review")
def admin_self_review(data: dict):
    return admin_features.submit_self_review(data['employee_id'], data['cycle_id'], data)

@app.post("/api/admin/performance/manager-review")
def admin_manager_review(data: dict):
    return admin_features.submit_manager_review(
        data['employee_id'], data['cycle_id'], data['manager_id'], data
    )

# Settings & Configuration
@app.post("/api/admin/settings/company-profile")
def admin_company_profile(data: dict):
    return admin_features.update_company_profile(data)

@app.post("/api/admin/settings/working-days")
def admin_working_days(data: dict):
    return admin_features.set_working_days(data['working_days'])

@app.post("/api/admin/settings/holidays")
def admin_add_holiday(data: dict):
    return admin_features.add_holiday(data['date'], data['name'], data.get('description'))

@app.get("/api/admin/settings/holidays")
def admin_get_holidays(year: int = None):
    return admin_features.get_holidays(year)

# Security & Audit
@app.get("/api/admin/logs/admin-activity")
def admin_get_admin_logs(limit: int = 100):
    return audit_logger.get_admin_logs(limit)

@app.get("/api/admin/logs/employee-activity")
def admin_get_emp_logs(employee_id: str = None, limit: int = 100):
    return audit_logger.get_employee_logs(limit, employee_id)


# ==================== SALARY CALCULATOR ENDPOINTS ====================

@app.post("/api/salary/calculate-ctc")
def calculate_ctc_breakdown(data: dict):
    """Calculate salary breakdown from CTC"""
    try:
        annual_ctc = float(data.get('annual_ctc', 0))
        template = data.get('template', 'standard')
        
        if annual_ctc <= 0:
            return {"success": False, "message": "Invalid CTC amount"}
        
        breakdown = SalaryCalculator.calculate_ctc_breakdown(annual_ctc, template)
        return {"success": True, "breakdown": breakdown}
    except Exception as e:
        return {"success": False, "message": str(e)}

@app.post("/api/salary/calculate-from-basic")
def calculate_from_basic_salary(data: dict):
    """Calculate CTC from basic salary"""
    try:
        basic_salary = float(data.get('basic_salary', 0))
        template = data.get('template', 'standard')
        
        if basic_salary <= 0:
            return {"success": False, "message": "Invalid basic salary amount"}
        
        breakdown = SalaryCalculator.calculate_from_basic(basic_salary, template)
        return {"success": True, "breakdown": breakdown}
    except Exception as e:
        return {"success": False, "message": str(e)}

@app.get("/api/salary/templates")
def get_salary_templates():
    """Get available salary templates"""
    return {
        "success": True,
        "templates": list(SalaryCalculator.TEMPLATES.keys()),
        "details": SalaryCalculator.TEMPLATES
    }

# Legacy salary-structure / salary-workflow endpoints removed — they used the
# trashed salary_structure_manager / salary_workflow modules (old salary_structures
# table). Salary is now set via /api/hr/salary (backend/ MVC) and payroll runs via
# /api/accountant/* — both on the employee_salaries table.

# ==================== ACCOUNTANT DASHBOARD ENDPOINTS ====================

@app.get("/api/salary/structures/pending")
def get_pending_salary_structures():
    """Get count of pending salary structures"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT COUNT(*) as count FROM salary_structures WHERE status='pending'")
        result = cursor.fetchone()
        conn.close()
        return {"success": True, "count": result['count']}
    except Exception as e:
        return {"success": False, "message": str(e), "count": 0}

@app.get("/api/salary/structures/active/count")
def get_active_salary_count():
    """Get count of active salary structures"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT COUNT(*) as count FROM salary_structures WHERE status='active'")
        result = cursor.fetchone()
        conn.close()
        return {"success": True, "count": result['count']}
    except Exception as e:
        return {"success": False, "message": str(e), "count": 0}

@app.get("/api/salary/structures/total-payroll")
def get_total_payroll():
    """Get total annual payroll"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT SUM(annual_ctc) as total FROM salary_structures WHERE status='active'")
        result = cursor.fetchone()
        conn.close()
        return {"success": True, "total": float(result['total'] or 0)}
    except Exception as e:
        return {"success": False, "message": str(e), "total": 0}

@app.get("/api/salary/structures/all")
def get_all_salary_structures():
    """Get all salary structures with employee names"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT ss.*, CONCAT(e.first_name, ' ', e.last_name) as employee_name
            FROM salary_structures ss
            LEFT JOIN employees e ON ss.employee_id = e.employee_id
            ORDER BY ss.created_at DESC
        """)
        structures = cursor.fetchall()
        conn.close()
        return {"success": True, "structures": structures}
    except Exception as e:
        return {"success": False, "message": str(e), "structures": []}

@app.get("/api/salary/structure/{structure_id}")
def get_salary_structure_details(structure_id: int):
    """Get detailed salary structure"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT ss.*, CONCAT(e.first_name, ' ', e.last_name) as employee_name
            FROM salary_structures ss
            LEFT JOIN employees e ON ss.employee_id = e.employee_id
            WHERE ss.id = %s
        """, (structure_id,))
        structure = cursor.fetchone()
        conn.close()
        if structure:
            return {"success": True, "structure": structure}
        return {"success": False, "message": "Structure not found"}
    except Exception as e:
        return {"success": False, "message": str(e)}


# Update employee salary when creating salary structure
@app.post("/api/employee/update-salary")
def update_employee_salary(data: dict):
    """Update employee salary in employees table"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE employees SET salary = %s WHERE employee_id = %s",
            (data['salary'], data['employee_id'])
        )
        conn.commit()
        conn.close()
        return {"success": True}
    except Exception as e:
        return {"success": False, "message": str(e)}


# ==================== AUTOMATED PAYROLL & OVERTIME ENDPOINTS ====================

@app.get("/api/payroll/overtime/{employee_id}")
def calculate_employee_overtime(employee_id: str, month: int = None, year: int = None):
    """Calculate overtime for specific employee"""
    if payroll_automation is None:
        raise HTTPException(status_code=503, detail="Service not ready")
    try:
        if not month:
            month = datetime.now().month
        if not year:
            year = datetime.now().year
        
        result = payroll_automation.calculate_overtime(employee_id, month, year)
        return {"success": True, "data": result}
    except Exception as e:
        return {"success": False, "message": str(e)}

@app.post("/api/payroll/process-monthly")
def process_monthly_payroll(data: dict):
    """Process automated monthly payroll for all employees"""
    if payroll_automation is None:
        raise HTTPException(status_code=503, detail="Service not ready")
    try:
        month = data.get('month', datetime.now().month)
        year = data.get('year', datetime.now().year)
        
        result = payroll_automation.process_monthly_payroll(month, year)
        return result
    except Exception as e:
        return {"success": False, "message": str(e)}

@app.get("/api/payroll/summary/{month}/{year}")
def get_payroll_summary(month: int, year: int):
    """Get payroll summary for a specific month"""
    if payroll_automation is None:
        raise HTTPException(status_code=503, detail="Service not ready")
    try:
        result = payroll_automation.get_payroll_summary(month, year)
        return result
    except Exception as e:
        return {"success": False, "message": str(e)}

# ==================== CRITICAL FEATURES: SHIFT, GPS, REGULARIZATION ====================

from backend.core.critical_features import ShiftManager, GPSAttendance, AttendanceRegularization

# Shift Management
@app.post("/api/shifts/create")
def create_shift(data: dict):
    return ShiftManager.create_shift(
        data['shift_name'], data['shift_type'], 
        data['start_time'], data['end_time'], data.get('break_duration', 60)
    )

@app.post("/api/shifts/assign")
def assign_shift(data: dict):
    return ShiftManager.assign_shift(
        data['employee_id'], data['shift_id'], 
        data['effective_date'], data.get('rotation_pattern')
    )

@app.get("/api/shifts/employee/{employee_id}")
def get_employee_shift(employee_id: str, date: str = None):
    shift = ShiftManager.get_employee_shift(employee_id, date)
    return {"success": True, "shift": shift} if shift else {"success": False}

# GPS Attendance
@app.post("/api/attendance/gps/checkin")
def gps_check_in(data: dict):
    return GPSAttendance.mark_check_in(
        data['employee_id'], data['latitude'], 
        data['longitude'], data.get('location')
    )

@app.post("/api/attendance/gps/checkout")
def gps_check_out(data: dict):
    return GPSAttendance.mark_check_out(
        data['employee_id'], data['latitude'], 
        data['longitude'], data.get('location')
    )

# Attendance Regularization
@app.post("/api/attendance/regularization/request")
def request_regularization(data: dict):
    from backend.core import regularization_service as reg
    return reg.request_regularization(
        data.get('employee_id'), data.get('attendance_date'),
        data.get('requested_check_in'), data.get('requested_check_out'), data.get('reason'))

@app.post("/api/attendance/regularization/approve/{request_id}")
def approve_regularization(request_id: int, data: dict):
    from backend.core import regularization_service as reg
    from backend.core.time_tracking import verify_staff
    actor = verify_staff(data.get('approved_by'))      # HR / admin only
    return reg.approve_regularization(request_id, actor, data.get('comments'))

@app.post("/api/attendance/regularization/reject/{request_id}")
def reject_regularization(request_id: int, data: dict):
    from backend.core import regularization_service as reg
    from backend.core.time_tracking import verify_staff
    actor = verify_staff(data.get('rejected_by') or data.get('approved_by'))      # HR / admin only
    return reg.reject_regularization(request_id, actor, data.get('comments'))

@app.get("/api/attendance/regularization/pending")
def get_pending_regularizations():
    from backend.core import regularization_service as reg
    try:
        return {"success": True, "requests": reg.list_requests(status="Pending")}
    except Exception as e:
        return {"success": False, "message": str(e), "requests": []}

# Additional endpoints for critical features
@app.get("/api/attendance/gps/all")
def get_all_gps_attendance():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM gps_attendance ORDER BY attendance_date DESC LIMIT 100")
        records = cursor.fetchall()
        conn.close()
        return {"success": True, "records": records}
    except Exception as e:
        return {"success": False, "message": str(e), "records": []}

@app.get("/api/attendance/gps/employee/{employee_id}")
def get_employee_gps_attendance(employee_id: str):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM gps_attendance WHERE employee_id=%s ORDER BY attendance_date DESC", (employee_id,))
        records = cursor.fetchall()
        conn.close()
        return {"success": True, "records": records}
    except Exception as e:
        return {"success": False, "message": str(e), "records": []}

@app.get("/api/geofence/locations")
def get_geofence_locations():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM geofence_locations WHERE is_active=TRUE")
        locations = cursor.fetchall()
        conn.close()
        return {"success": True, "locations": locations}
    except Exception as e:
        return {"success": False, "message": str(e), "locations": []}

@app.get("/api/shifts/all")
def get_all_shifts():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM shifts WHERE is_active=TRUE ORDER BY shift_name")
        shifts = cursor.fetchall()
        conn.close()
        return {"success": True, "shifts": shifts}
    except Exception as e:
        return {"success": False, "message": str(e), "shifts": []}

@app.get("/api/attendance/regularization/employee/{employee_id}")
def get_employee_regularizations(employee_id: str):
    from backend.core import regularization_service as reg
    try:
        return {"success": True, "requests": reg.list_requests(employee_id=employee_id)}
    except Exception as e:
        return {"success": False, "message": str(e), "requests": []}

# ==================== AI ASSISTANT ENDPOINT ====================

@app.post("/api/ai/chat")
def ai_chat(data: dict):
    """AI Assistant for employee queries"""
    try:
        message = data.get('message', '').lower()
        user_id = data.get('user_id', '')
        
        # Simple rule-based responses
        if 'leave' in message:
            response = "You can apply for leave from the Leave Management section. We support Casual, Sick, and Earned leaves. Check your leave balance in your profile."
        elif 'attendance' in message:
            response = "Use GPS Check-in/Check-out for attendance. You can view your attendance history and request regularization if needed."
        elif 'salary' in message or 'payslip' in message:
            response = "Your salary details and payslips are available in the Payroll section. Contact HR for salary-related queries."
        elif 'policy' in message or 'rule' in message:
            response = "Company policies are available in the Documents section. For specific policy questions, please contact HR."
        elif 'holiday' in message:
            response = "Check the Announcements section for holiday lists and company events."
        else:
            response = "I can help you with: Leave applications, Attendance tracking, Salary queries, Company policies, and more. What would you like to know?"
        
        return {"success": True, "response": response}
    except Exception as e:
        return {"success": False, "response": "Sorry, I encountered an error. Please try again."}

# ==================== ANNOUNCEMENTS GET ENDPOINT ====================

@app.get("/api/announcements")
def get_announcements():
    """Return latest announcements, newest first."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT id, title, message, created_by, creator_name, creator_role,
                   is_active, created_at
            FROM announcements
            WHERE is_active = 1
            ORDER BY created_at DESC
            LIMIT 20
        """)
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        return {"success": True, "announcements": rows}
    except Exception:
        return {"success": True, "announcements": []}

# ==================== MISSING ENDPOINTS — fix 404s ====================

# --- /api/employees/recent ---
@app.get("/api/employees/recent")
def get_recent_employees(limit: int = 3):
    """Return the most recently added employees."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT employee_code AS employee_id,
                   full_name AS name,
                   title, email, department, city, state,
                   status, joining_date
            FROM employees
            ORDER BY id DESC
            LIMIT %s
        """, (limit,))
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        return {"success": True, "employees": rows, "total": len(rows)}
    except Exception as e:
        return {"success": True, "employees": [], "total": 0, "message": str(e)}


# --- /api/employees/add ---
@app.post("/api/employees/add")
async def add_employee(request: Request):
    """Create a new employee and add them to employees + users tables."""
    try:
        data = await request.json()
    except Exception:
        return {"success": False, "message": "Invalid JSON body"}

    required = ["email", "department", "title"]
    for field in required:
        if not data.get(field):
            return {"success": False, "message": f"Missing required field: {field}"}

    first_name = data.get("first_name", "").strip()
    last_name  = data.get("last_name", "").strip()
    full_name  = (data.get("full_name") or data.get("name") or
                  f"{first_name} {last_name}".strip() or "Unknown")
    email      = data.get("email", "").strip().lower()
    title      = data.get("title", "").strip()
    department = data.get("department", "").strip()
    phone      = data.get("phone", "")
    password   = data.get("password", "employee123")

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Prevent duplicate email
        cursor.execute("SELECT employee_code FROM employees WHERE email = %s", (email,))
        if cursor.fetchone():
            cursor.close(); conn.close()
            return {"success": False, "message": f"Employee with email {email} already exists"}

        employee_code = generate_employee_code(cursor)

        status_in = str(data.get("status", "probation")).strip().lower()
        if status_in in ("active", "employment", "confirmed"):
            emp_status = "active"
        else:
            emp_status = "probation"

        # Insert into employees using real (non-virtual) columns
        cursor.execute("""
            INSERT INTO employees
                (employee_code, full_name, email, phone, department, title, joining_date, status)
            VALUES (%s, %s, %s, %s, %s, %s, CURDATE(), %s)
        """, (employee_code, full_name, email, phone, department, title, emp_status))
        conn.commit()

        # Initialize leave balance (0 for probation, 12 for employment)
        cur_year = datetime.now().year
        init_cl = 0.00 if emp_status == "probation" else 12.00
        init_sl = 0.00 if emp_status == "probation" else 12.00
        init_pl = 0.00 if emp_status == "probation" else 12.00
        cursor.execute("""
            INSERT INTO leave_balance
                (employee_id, year, casual_leave, sick_leave, earned_leave, casual_total, sick_total, earned_total)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                year = VALUES(year), casual_leave = VALUES(casual_leave), sick_leave = VALUES(sick_leave),
                earned_leave = VALUES(earned_leave), casual_total = VALUES(casual_total),
                sick_total = VALUES(sick_total), earned_total = VALUES(earned_total)
        """, (employee_code, cur_year, init_cl, init_sl, init_pl, init_cl, init_sl, init_pl))

        # Save salary if provided
        annual_ctc = float(data.get("annual_ctc") or 0.0)
        if annual_ctc > 0:
            cursor.execute("""
                INSERT INTO employee_salaries (employee_id, gross_salary, ctc, status, effective_from)
                VALUES (%s, %s, %s, 'active', CURDATE())
                ON DUPLICATE KEY UPDATE gross_salary = VALUES(gross_salary), ctc = VALUES(ctc)
            """, (employee_code, round(annual_ctc / 12, 2), annual_ctc))

        # Also create a user account so the employee can log in
        username = email.split("@")[0]
        # Ensure username is unique
        cursor.execute("SELECT user_id FROM users WHERE username = %s", (username,))
        if cursor.fetchone():
            import random
            username = f"{username}{random.randint(10, 999)}"
        cursor.execute("""
            INSERT IGNORE INTO users
                (user_id, username, email, password, assigned_password, role, full_name, is_active, profile_completed)
            VALUES (%s, %s, %s, %s, %s, 'employee', %s, 1, 0)
        """, (employee_code, username, email, password, password, full_name))
        conn.commit()

        try:
            from backend.core.hr_activity_logger import log_hr_activity
            actor_name = data.get("actor") or data.get("created_by") or "HR Admin"
            log_hr_activity(
                performed_by=actor_name,
                performed_name=actor_name,
                action="EMPLOYEE_CREATED",
                target_employee_id=employee_code,
                target_employee_name=full_name,
                details=f"Created employee record for {full_name} ({employee_code}) with status {emp_status.title()} in department {department}."
            )
        except Exception:
            pass

        cursor.close()
        conn.close()

        return {
            "success": True,
            "employee_id": employee_code,
            "message": f"Employee {full_name} created successfully with ID {employee_code}"
        }
    except Exception as e:
        return {"success": False, "message": str(e)}


# --- /api/notifications/{employee_id} ---
@app.get("/api/notifications/{employee_id}")
def get_notifications(employee_id: str):
    """Return notifications for an employee with unread_count. Safe fallback."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT id, user_id, title, message, type, is_read, created_at
            FROM notifications
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT 50
        """, (employee_id,))
        rows = cursor.fetchall()
        cursor.execute(
            "SELECT COUNT(*) AS cnt FROM notifications WHERE user_id = %s AND is_read = 0",
            (employee_id,)
        )
        unread = cursor.fetchone()["cnt"]
        cursor.close()
        conn.close()
        return {"success": True, "notifications": rows, "unread_count": unread}
    except Exception:
        return {"success": True, "notifications": [], "unread_count": 0}


# --- /api/notifications/mark-read/{notification_id} ---
@app.post("/api/notifications/mark-read/{notification_id}")
def mark_notification_read(notification_id: int):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE notifications SET is_read=TRUE WHERE id=%s", (notification_id,))
        conn.commit()
        cursor.close()
        conn.close()
    except Exception:
        pass
    return {"success": True}


# --- /api/notifications/mark-all-read/{employee_id} ---
@app.post("/api/notifications/mark-all-read/{employee_id}")
def mark_all_notifications_read(employee_id: str):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE notifications SET is_read=TRUE WHERE user_id=%s", (employee_id,))
        conn.commit()
        cursor.close()
        conn.close()
    except Exception:
        pass
    return {"success": True}


# --- /api/log-activity ---
@app.post("/api/log-activity")
async def log_activity(request: Request):
    """Accept activity log from frontend tracker. Never crash."""
    try:
        data = await request.json()
    except Exception:
        return {"success": True}
    user_id = data.get("user_id", "unknown")
    action  = data.get("action", "")
    details = data.get("details", "")
    page    = data.get("page", "")
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO employee_activity_logs (employee_id, employee_name, action, details, ip_address)
            VALUES (%s, %s, %s, %s, %s)
        """, (user_id, user_id, f"{action} `{page}`", details, "127.0.0.1"))
        conn.commit()
        cursor.close()
        conn.close()
    except Exception:
        pass  # Table may not exist; never let the frontend tracker crash the portal
    return {"success": True}


# --- /api/leave/calendar/{employee_id} is implemented in
#     backend/core/attendance_api.py (get_leave_calendar) — that router is
#     included before this module's routes are registered, so a duplicate
#     definition here would have been dead code (removed in this audit).

# --- /api/leave/holidays  (public, used by dashboard holidays widget) ---
@app.get("/api/leave/holidays")
def get_public_holidays(year: int = None):
    """Return all holidays for the year, normalised to holiday_name / holiday_date keys."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        now = datetime.now()
        target_year = year or now.year
        cursor.execute("""
            SELECT id,
                   name                              AS holiday_name,
                   DATE_FORMAT(`date`, '%%Y-%%m-%%d')  AS holiday_date,
                   COALESCE(description, '')          AS description
            FROM holidays
            WHERE YEAR(`date`) = %s
            ORDER BY `date`
        """, (target_year,))
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        return {"success": True, "holidays": rows}
    except Exception as e:
        # Return a safe set of placeholder holidays so widget never crashes
        return {
            "success": True,
            "holidays": [
                {"holiday_name": "Independence Day",  "holiday_date": f"{datetime.now().year}-08-15", "description": "National Holiday"},
                {"holiday_name": "Gandhi Jayanti",    "holiday_date": f"{datetime.now().year}-10-02", "description": "National Holiday"},
                {"holiday_name": "Christmas Day",     "holiday_date": f"{datetime.now().year}-12-25", "description": "National Holiday"},
            ]
        }


# --- /api/leave/balance/{employee_id}  (dashboard leave balance sidebar) ---
@app.get("/api/leave/balance")
def get_leave_balance_current(employee_id: str = None, user_id: str = None):
    """Return leave balance when employee_id is passed as a query parameter."""
    target_employee = employee_id or user_id
    if not target_employee:
        return {"success": False, "message": "employee_id is required", "balance": {}, "data": {}}
    return get_leave_balance_for_employee_v2(target_employee)


@app.get("/api/leave/balance/{employee_id}")
def get_leave_balance_for_employee_v2(employee_id: str):
    """Return leave balance in both summary and row formats."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        summary, rows = _get_leave_balance_payload(cursor, employee_id)
        conn.commit()
        cursor.close()
        conn.close()
        return {
            "success": True,
            "data": summary,
            "summary": summary,
            "balance": summary,
            "balances": rows,
            "rows": rows,
            "total_remaining": summary["total_remaining"],
        }
    except Exception as e:
        defaults_summary = {
            "employee_id": employee_id,
            "casual_leave": 0.5,
            "sick_leave": 0.5,
            "earned_leave": 0.5,
            "casual_balance": 0.5,
            "sick_balance": 0.5,
            "paid_balance": 0.5,
            "earned_balance": 0.5,
            "total_balance": 1.5,
            "total_remaining": 1.5,
        }
        defaults_rows = [
            {"leave_type": "Casual Leave", "total_days": 0.5, "used_days": 0, "remaining_days": 0.5},
            {"leave_type": "Sick Leave", "total_days": 0.5, "used_days": 0, "remaining_days": 0.5},
            {"leave_type": "Earned Leave", "total_days": 0.5, "used_days": 0, "remaining_days": 0.5},
        ]
        return {
            "success": True,
            "message": str(e),
            "data": defaults_summary,
            "summary": defaults_summary,
            "balance": defaults_summary,
            "balances": defaults_rows,
            "rows": defaults_rows,
            "total_remaining": 1.5,
        }


@app.get("/api/leave/all-balances")
def get_all_employees_leave_balances(token: str = None):
    """Return leave balance for every active user in one query. Auto-creates missing rows."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        current_year = datetime.now().year

        # Ensure every active user has a leave_balance row
        cursor.execute("""
            INSERT IGNORE INTO leave_balance (employee_id, year, casual_leave, sick_leave, earned_leave, casual_total, sick_total, earned_total)
            SELECT user_id, %s, 12.0, 12.0, 12.0, 12.0, 12.0, 12.0 FROM users WHERE COALESCE(is_active, 1) = 1
        """, (current_year,))
        conn.commit()

        cursor.execute("""
            SELECT
                u.user_id   AS employee_id,
                u.full_name AS name,
                u.role,
                COALESCE(e.department, 'HR') AS department,
                COALESCE(lb.year, %s) AS year,
                COALESCE(lb.casual_leave, 12.0) AS casual_leave,
                COALESCE(lb.sick_leave,   12.0) AS sick_leave,
                COALESCE(lb.earned_leave, 12.0) AS earned_leave,
                COALESCE(lb.casual_total, 12.0) AS casual_total,
                COALESCE(lb.sick_total,   12.0) AS sick_total,
                COALESCE(lb.earned_total, 12.0) AS earned_total
            FROM users u
            LEFT JOIN employees e ON (e.employee_code = u.user_id OR e.email = u.email)
            LEFT JOIN leave_balance lb ON (lb.employee_id = u.user_id OR lb.employee_id = e.employee_code)
            WHERE COALESCE(u.is_active, 1) = 1
            ORDER BY u.role, u.full_name
        """, (current_year,))
        rows = cursor.fetchall()
        cursor.close()
        conn.close()

        employees = []
        for r in rows:
            c_tot = float(r["casual_total"] or 12.0)
            s_tot = float(r["sick_total"] or 12.0)
            e_tot = float(r["earned_total"] or 12.0)
            casual_rem  = float(r["casual_leave"] if r["casual_leave"] is not None else c_tot)
            sick_rem    = float(r["sick_leave"] if r["sick_leave"] is not None else s_tot)
            earned_rem  = float(r["earned_leave"] if r["earned_leave"] is not None else e_tot)
            employees.append({
                "employee_id":     r["employee_id"],
                "name":            r["name"] or r["employee_id"],
                "role":            r["role"] or "employee",
                "department":      r["department"],
                "year":            r["year"],
                "casual_leave":    casual_rem,
                "sick_leave":      sick_rem,
                "earned_leave":    earned_rem,
                "casual_total":    c_tot,
                "sick_total":      s_tot,
                "earned_total":    e_tot,
                "casual_used":     max(0.0, round(c_tot - casual_rem, 2)),
                "sick_used":       max(0.0, round(s_tot - sick_rem, 2)),
                "earned_used":     max(0.0, round(e_tot - earned_rem, 2)),
                "total_remaining": casual_rem + sick_rem + earned_rem,
                "total_total":     c_tot + s_tot + e_tot,
            })

        return {"success": True, "employees": employees, "count": len(employees), "year": current_year}
    except Exception as e:
        return {"success": False, "message": str(e), "employees": [], "count": 0}


@app.post("/api/leave/monthly-credit")
async def run_monthly_leave_credit(request: Request):
    """Manually run the idempotent monthly leave credit job for HR/admin recovery."""
    try:
        data = await request.json() if request.headers.get('content-type') == 'application/json' else {}
        target_period = (data.get("period") or "").strip()
        target_date = datetime.strptime(target_period + "-01", "%Y-%m-%d").date() if target_period else None
        return credit_monthly_leaves(target_date=target_date)
    except ValueError:
        return {"success": False, "message": "period must be YYYY-MM"}
    except Exception as e:
        logger.exception("run_monthly_leave_credit failed")
        return {"success": False, "message": str(e)}


@app.get("/api/leave/ledger/{employee_id}")
def get_leave_ledger(employee_id: str, period: str = None):
    """Return auditable leave ledger rows for one employee."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        ensure_leave_ledger_table(cursor)
        if period:
            cursor.execute("""
                SELECT * FROM leave_ledger
                WHERE employee_id = %s AND period = %s
                ORDER BY created_at DESC, id DESC
            """, (employee_id, period))
        else:
            cursor.execute("""
                SELECT * FROM leave_ledger
                WHERE employee_id = %s
                ORDER BY created_at DESC, id DESC
                LIMIT 200
            """, (employee_id,))
        rows = cursor.fetchall()
        conn.commit()
        cursor.close()
        conn.close()
        return {"success": True, "ledger": rows, "count": len(rows)}
    except Exception as e:
        return {"success": False, "message": str(e), "ledger": [], "count": 0}


# ==================== END MISSING ENDPOINTS ====================

# ── Team Management aliases (legacy /api/admin/teams/* paths) ────────────────
from backend.core.team_management_api import (
    get_all_teams        as _tm_get_all_teams,
    create_team          as _tm_create_team,
    get_team_members     as _tm_get_members,
    delete_team          as _tm_delete_team,
    update_team_manager  as _tm_update_manager,
    add_team_member      as _tm_add_member,
    remove_team_member   as _tm_remove_member,
    TeamCreate           as _TeamCreate,
    MemberAction         as _MemberAction,
    ManagerUpdate        as _ManagerUpdate,
)

@app.get("/api/admin/teams")
def admin_teams_alias():
    return _tm_get_all_teams()

@app.post("/api/admin/teams")
def admin_create_team_alias(body: _TeamCreate):
    return _tm_create_team(body)

@app.get("/api/admin/teams/{team_id}/members")
def admin_team_members_alias(team_id: int):
    return _tm_get_members(team_id)

@app.delete("/api/admin/teams/{team_id}")
def admin_delete_team_alias(team_id: int):
    return _tm_delete_team(team_id)

@app.put("/api/admin/teams/{team_id}/manager")
def admin_update_manager_alias(team_id: int, body: _ManagerUpdate):
    return _tm_update_manager(team_id, body)

@app.post("/api/admin/teams/{team_id}/add-member")
def admin_add_member_alias(team_id: int, body: _MemberAction):
    return _tm_add_member(team_id, body)

@app.post("/api/admin/teams/{team_id}/remove-member")
def admin_remove_member_alias(team_id: int, body: _MemberAction):
    return _tm_remove_member(team_id, body)

# ── /api/teams/* aliases (no admin prefix) used by team_functions.js ─────────
@app.post("/api/teams/create")
def teams_create_alias(body: _TeamCreate):
    return _tm_create_team(body)

@app.put("/api/teams/{team_id}/manager")
def teams_update_manager_alias(team_id: int, body: _ManagerUpdate):
    return _tm_update_manager(team_id, body)

@app.post("/api/teams/{team_id}/add-member")
def teams_add_member_alias(team_id: int, body: _MemberAction):
    return _tm_add_member(team_id, body)

@app.get("/api/teams/{team_id}/members")
def teams_get_members_alias(team_id: int):
    return _tm_get_members(team_id)

# ==================== EMPLOYEE SELF-SERVICE PROFILE ENDPOINTS ====================

_profile_log = logging.getLogger("profile")

def _geocode_address(address: str):
    """
    Forward-geocode an address string using Nominatim (OpenStreetMap).
    Returns (latitude, longitude) as floats, or None on failure.
    Nominatim requires a descriptive User-Agent per its usage policy.
    """
    if not address or not address.strip():
        return None
    try:
        params = urllib.parse.urlencode({'q': address.strip(), 'format': 'json', 'limit': 1})
        url    = f'https://nominatim.openstreetmap.org/search?{params}'
        req    = urllib.request.Request(url, headers={
            'User-Agent': 'HRMS-SeawindSolutions/1.0 (internal WFH attendance)',
            'Accept-Language': 'en',
        })
        with urllib.request.urlopen(req, timeout=8) as resp:
            results = json.loads(resp.read().decode())
        if results:
            return float(results[0]['lat']), float(results[0]['lon'])
    except Exception as exc:
        _profile_log.warning("geocode_address failed for %r: %s", address[:80], exc)
    return None


class UpdateProfilePayload(BaseModel):
    phone:            Optional[str] = None
    city:             Optional[str] = None
    state:            Optional[str] = None
    emergency_number: Optional[str] = None
    home_address:     Optional[str] = None   # triggers geocoding + stores in employee_home_locations

@app.get("/api/profile/{user_id}")
def get_employee_profile(user_id: str):
    """Return combined profile for the authenticated employee."""
    try:
        conn   = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Select only columns that exist in every schema version of the users table
        cursor.execute(
            "SELECT user_id, username, full_name, email, role, is_active FROM users WHERE user_id = %s",
            (user_id,)
        )
        user = cursor.fetchone()
        if not user:
            cursor.close(); conn.close()
            return {"success": False, "message": "User not found"}

        cursor.execute(
            """SELECT employee_code, full_name, email, phone, department,
                      title, joining_date, status, city, state, default_work_mode
               FROM employees WHERE email = %s""",
            (user["email"],)
        )
        emp = cursor.fetchone()

        # Try employee_profiles (may not exist for all users)
        profile_extra: dict = {}
        try:
            cursor.execute(
                """SELECT date_of_birth, gender, marital_status, nationality,
                          emergency_number, current_address, permanent_address
                   FROM employee_profiles WHERE employee_id = %s""",
                (user_id,)
            )
            row = cursor.fetchone()
            if row:
                # Convert date objects to strings
                if row.get("date_of_birth"):
                    row["date_of_birth"] = str(row["date_of_birth"])
                profile_extra = {k: v for k, v in row.items() if v is not None}
        except Exception:
            pass

        # Home location from employee_home_locations
        home_address_label: Optional[str] = None
        home_location_set:  bool = False
        home_lat:           Optional[float] = None
        home_lon:           Optional[float] = None
        home_updated_at:    Optional[str]   = None
        try:
            emp_code = (emp or {}).get("employee_code")
            if emp_code:
                cursor.execute(
                    "SELECT latitude, longitude, address_label, registered_via, updated_at "
                    "FROM employee_home_locations WHERE employee_id = %s",
                    (emp_code,)
                )
                hl = cursor.fetchone()
                if hl:
                    home_address_label = hl.get("address_label")
                    home_location_set  = True
                    raw_lat = hl.get("latitude")
                    raw_lon = hl.get("longitude")
                    home_lat = float(raw_lat) if raw_lat is not None else None
                    home_lon = float(raw_lon) if raw_lon is not None else None
                    upd = hl.get("updated_at")
                    home_updated_at = upd.isoformat() if upd else None
        except Exception:
            pass

        cursor.close(); conn.close()

        result = {
            "user_id":     user["user_id"],
            "username":    user["username"],
            "full_name":   user["full_name"],
            "email":       user["email"],
            "role":        user["role"],
            "is_active":   bool(user.get("is_active", 1)),
            "department":  (emp or {}).get("department") or user.get("department"),
            "employee_id": (emp or {}).get("employee_code"),
            "phone":       (emp or {}).get("phone"),
            "title":       (emp or {}).get("title"),
            "joining_date": str(emp["joining_date"]) if emp and emp.get("joining_date") else None,
            "status":      (emp or {}).get("status", "Active"),
            "city":        (emp or {}).get("city"),
            "state":       (emp or {}).get("state"),
            "default_work_mode": (emp or {}).get("default_work_mode"),
            "home_address":      home_address_label,
            "home_location_set": home_location_set,
            "home_latitude":     home_lat,
            "home_longitude":    home_lon,
            "home_updated_at":   home_updated_at,
        }
        result.update(profile_extra)
        return {"success": True, "profile": result}
    except Exception as e:
        return {"success": False, "message": str(e)}


@app.put("/api/profile/{user_id}")
def update_employee_profile(user_id: str, data: UpdateProfilePayload):
    """Update editable contact fields for the authenticated employee."""
    try:
        conn   = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT email FROM users WHERE user_id = %s", (user_id,))
        user = cursor.fetchone()
        if not user:
            cursor.close(); conn.close()
            return {"success": False, "message": "User not found"}

        # Build update for employees table
        emp_fields: dict = {}
        if data.phone  is not None: emp_fields["phone"] = data.phone
        if data.city   is not None: emp_fields["city"]  = data.city
        if data.state  is not None: emp_fields["state"] = data.state

        if emp_fields:
            set_clause = ", ".join(f"{k} = %s" for k in emp_fields)
            values     = list(emp_fields.values()) + [user["email"]]
            cursor.execute(
                f"UPDATE employees SET {set_clause} WHERE email = %s",
                values
            )

        # Upsert emergency_number in employee_profiles if provided
        if data.emergency_number is not None:
            try:
                cursor.execute(
                    """INSERT INTO employee_profiles (employee_id, emergency_number)
                       VALUES (%s, %s)
                       ON DUPLICATE KEY UPDATE emergency_number = VALUES(emergency_number)""",
                    (user_id, data.emergency_number)
                )
            except Exception:
                pass  # employee_profiles table may not exist — non-critical

        # Handle home_address: geocode and store in employee_home_locations
        geocoding_status  = "skipped"
        geocoding_note    = ""
        if data.home_address is not None and data.home_address.strip():
            # Resolve employee_code (primary key of employees table)
            cursor.execute("SELECT employee_code FROM employees WHERE email = %s", (user["email"],))
            emp_row = cursor.fetchone()
            emp_code = emp_row["employee_code"] if emp_row else None

            if emp_code:
                coords = _geocode_address(data.home_address.strip())
                if coords:
                    lat, lon = coords
                    try:
                        cursor.execute(
                            """INSERT INTO employee_home_locations
                                   (employee_id, latitude, longitude, address_label, registered_via, updated_by)
                               VALUES (%s, %s, %s, %s, 'geocoded', %s)
                               ON DUPLICATE KEY UPDATE
                                   latitude      = VALUES(latitude),
                                   longitude     = VALUES(longitude),
                                   address_label = VALUES(address_label),
                                   registered_via = 'geocoded',
                                   updated_by    = VALUES(updated_by)""",
                            (emp_code, lat, lon, data.home_address.strip(), user_id)
                        )
                        geocoding_status = "success"
                        geocoding_note   = "Home address geocoded and saved. Geo attendance is now available."
                    except Exception as geo_exc:
                        _profile_log.error("home_location upsert failed: %s", geo_exc)
                        geocoding_status = "db_error"
                        geocoding_note   = "Address received but could not save location."
                else:
                    # Store address label even if geocoding failed so employee sees their text
                    try:
                        cursor.execute(
                            """INSERT INTO employee_home_locations
                                   (employee_id, latitude, longitude, address_label, registered_via, updated_by)
                               VALUES (%s, 0, 0, %s, 'geocoded', %s)
                               ON DUPLICATE KEY UPDATE
                                   address_label  = VALUES(address_label),
                                   updated_by     = VALUES(updated_by)""",
                            (emp_code, data.home_address.strip(), user_id)
                        )
                    except Exception:
                        pass
                    geocoding_status = "geocoding_failed"
                    geocoding_note   = (
                        "Address saved but could not be geocoded to coordinates. "
                        "Geo attendance may not work — please contact HR to verify your address or use GPS registration."
                    )

        conn.commit()
        cursor.close(); conn.close()
        return {
            "success":          True,
            "message":          "Profile updated successfully",
            "geocoding_status": geocoding_status,
            "geocoding_note":   geocoding_note,
        }
    except Exception as e:
        return {"success": False, "message": str(e)}


# ── Document Request Management ───────────────────────────────────────────────

def _ensure_document_requests_table():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS document_requests (
                id              INT AUTO_INCREMENT PRIMARY KEY,
                employee_id     VARCHAR(50)  NOT NULL,
                employee_name   VARCHAR(100) DEFAULT NULL,
                document_type   VARCHAR(50)  NOT NULL,
                reason          TEXT,
                status          VARCHAR(20)  NOT NULL DEFAULT 'pending',
                file_url        VARCHAR(500) DEFAULT NULL,
                file_html       LONGTEXT     DEFAULT NULL,
                rejected_reason TEXT         DEFAULT NULL,
                created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        """)
        conn.commit()
        # Idempotent column additions for the salary-slip workflow
        for col_sql in [
            "ALTER TABLE document_requests ADD COLUMN requested_month VARCHAR(7) DEFAULT NULL",
            "ALTER TABLE document_requests ADD COLUMN hr_approved_by  VARCHAR(100) DEFAULT NULL",
            "ALTER TABLE document_requests ADD COLUMN hr_forwarded_at DATETIME NULL DEFAULT NULL",
        ]:
            try:
                cur.execute(col_sql)
                conn.commit()
            except Exception:
                pass  # Column already exists — safe to ignore
        cur.close()
        conn.close()
    except Exception:
        pass


class DocRequestPayload(BaseModel):
    employee_id:     str
    document_type:   str
    reason:          Optional[str] = None
    requested_month: Optional[str] = None   # "YYYY-MM" — required for salary-slip


class DocForwardPayload(BaseModel):
    approved_by: Optional[str] = None


class DocRequestRejectPayload(BaseModel):
    reason: str = ""


# ── Appointment Letter ────────────────────────────────────────────────────────

@app.post("/api/documents/generate-appointment-letter")
def generate_appointment_letter(payload: dict):
    """
    HR: generate a Seawind appointment letter PDF for an employee.
    Fetches name/email/address/position/joining_date from employees + employee_profiles.
    Fetches salary from employee_salaries.
    Saves the PDF and records it in document_requests + employee_profiles.
    Returns a download URL.
    """
    employee_code = (payload.get("employee_code") or "").strip()
    if not employee_code:
        return {"success": False, "message": "employee_code is required"}

    skip_insert = payload.get("skip_insert", False)
    
    # Overrides
    name_override    = (payload.get("name") or "").strip()
    address_override = (payload.get("address") or "").strip()
    email_override   = (payload.get("email") or "").strip()
    position         = (payload.get("position") or "").strip()
    salary_input     = float(payload.get("salary") or 0)
    joining_date     = (payload.get("joining_date") or "").strip()

    try:
        conn   = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Employee base data
        cursor.execute(
            """SELECT employee_code, full_name, email, title, joining_date,
                      department, city, state
               FROM employees WHERE employee_code = %s LIMIT 1""",
            (employee_code,)
        )
        emp = cursor.fetchone()
        if not emp:
            cursor.close(); conn.close()
            return {"success": False, "message": "Employee not found"}

        # Address from employee_profiles (keyed by user_id = employee_code)
        if address_override:
            address = address_override
        else:
            address = ""
            try:
                cursor.execute(
                    "SELECT current_address FROM employee_profiles WHERE employee_id = %s LIMIT 1",
                    (employee_code,)
                )
                prof = cursor.fetchone()
                if prof and prof.get("current_address"):
                    address = prof["current_address"]
                else:
                    address = ", ".join(filter(None, [emp.get("city"), emp.get("state")])) or ""
            except Exception:
                address = ", ".join(filter(None, [emp.get("city"), emp.get("state")])) or ""

        # Salary string
        if salary_input > 0:
            monthly    = int(salary_input / 12)
            annual     = int(salary_input)
            salary_str = f"Rs. {monthly:,}/- per month (CTC Rs. {annual:,}/- per annum)"
        else:
            salary_str = ""
            try:
                cursor.execute(
                    "SELECT basic_salary, annual_ctc FROM employee_salary WHERE employee_id = %s",
                    (employee_code,)
                )
                sal = cursor.fetchone()
                if sal:
                    ann = sal.get("annual_ctc")
                    mon = sal.get("basic_salary")
                    if mon and ann:
                        salary_str = f"Rs. {mon:,}/- per month (CTC Rs. {ann:,}/- per annum)"
                    elif ann:
                        salary_str = f"Rs. {ann:,}/- per annum"
            except Exception:
                pass

        if not salary_str:
            salary_str = "As per company standards"

        cursor.close(); conn.close()

        # Format joining date
        if joining_date:
            jd = joining_date
        else:
            jd = emp.get("joining_date")
            jd = jd.strftime("%d-%m-%Y") if hasattr(jd, "strftime") else str(jd or "")

        letter_data = {
            "employee_code":  employee_code,
            "employee_name":  name_override or emp.get("full_name") or "",
            "address":        address,
            "email":          email_override or emp.get("email") or "",
            "position":       position or emp.get("title") or "",
            "salary":         salary_str,
            "joining_date":   jd,
            "letter_date":    datetime.now().strftime("%d %B %Y"),
        }

        # Generate PDF
        from backend.core import appointment_letter_generator as alg
        filename = alg.generate(letter_data)
        download_url = f"/api/documents/download/{filename}"
        rel_path     = f"generated_docs/{filename}"

        # Persist path in employee_profiles
        try:
            conn2   = get_db_connection()
            cur2    = conn2.cursor()
            cur2.execute(
                """INSERT INTO employee_profiles (employee_id, appointment_letter_path)
                   VALUES (%s, %s)
                   ON DUPLICATE KEY UPDATE appointment_letter_path = VALUES(appointment_letter_path)""",
                (employee_code, rel_path)
            )
            
            if not skip_insert:
                cur2.execute(
                    """INSERT INTO document_requests
                           (employee_id, employee_name, document_type, reason, status, file_url)
                       VALUES (%s, %s, 'appointment-letter', 'Generated by HR', 'generated', %s)""",
                    (employee_code, letter_data["employee_name"], download_url)
                )
            conn2.commit()
            cur2.close(); conn2.close()
        except Exception as db_exc:
            import logging
            logging.getLogger(__name__).warning("appointment_letter persist error: %s", db_exc)

        download_url = f"/api/documents/download/{filename}"
        return {
            "success":      True,
            "filename":     filename,
            "download_url": download_url,
            "message":      f"Appointment letter generated for {letter_data['employee_name']}",
        }

    except Exception as exc:
        import logging, traceback
        logging.getLogger(__name__).error("generate_appointment_letter: %s\n%s", exc, traceback.format_exc())
        return {"success": False, "message": str(exc)}


# --- /api/documents/employee-prefill/{employee_id} is implemented in
#     backend/core/document_requests_api.py (get_employee_prefill) — that
#     router is included before this module's routes are registered, so a
#     duplicate definition here would have been dead code (removed in this
#     audit; its richer field set — address/salary/etc — was merged into
#     the router version, which previously served a smaller field set that
#     didn't match the frontend's EmployeePrefillData type).

# Duplicate download_generated_document removed. Use document_requests_api.py instead.
# --- POST /api/documents/requests is implemented in
#     backend/core/document_requests_api.py (create_document_request) —
#     that router is included before this module's routes are registered,
#     so a duplicate definition here would have been dead code (removed in
#     this audit).

@app.get("/api/documents/requests/my")
def get_my_document_requests(employee_id: str = None):
    """Employee fetches their own document requests."""
    _ensure_document_requests_table()
    if not employee_id:
        return {"success": False, "message": "employee_id required", "requests": []}
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute(
            "SELECT * FROM document_requests WHERE employee_id = %s ORDER BY created_at DESC",
            (employee_id,)
        )
        requests = cur.fetchall()
        cur.close()
        conn.close()
        return {"success": True, "requests": requests}
    except Exception as e:
        return {"success": False, "message": str(e), "requests": []}


@app.get("/api/documents/requests/all")
def get_all_document_requests():
    """HR: fetch all document requests with department info."""
    _ensure_document_requests_table()
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT dr.*, e.department
            FROM document_requests dr
            LEFT JOIN employees e ON dr.employee_id = e.employee_code
            ORDER BY dr.created_at DESC
        """)
        requests = cur.fetchall()
        cur.close()
        conn.close()
        return {"success": True, "requests": requests}
    except Exception as e:
        return {"success": False, "message": str(e), "requests": []}


@app.post("/api/documents/requests/{request_id}/approve")
def approve_document_request(request_id: int):
    """HR: approve a document request."""
    _ensure_document_requests_table()
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute(
            "UPDATE document_requests SET status = 'approved', updated_at = NOW() WHERE id = %s",
            (request_id,)
        )
        conn.commit()
        cur.execute("SELECT * FROM document_requests WHERE id = %s", (request_id,))
        request = cur.fetchone()
        cur.close()
        conn.close()
        if not request:
            return {"success": False, "message": "Request not found"}
        return {"success": True, "request": request}
    except Exception as e:
        return {"success": False, "message": str(e)}


@app.post("/api/documents/requests/{request_id}/reject")
def reject_document_request(request_id: int, payload: DocRequestRejectPayload):
    """HR: reject a document request with a reason."""
    _ensure_document_requests_table()
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute(
            """UPDATE document_requests
               SET status = 'rejected', rejected_reason = %s, updated_at = NOW()
               WHERE id = %s""",
            (payload.reason, request_id)
        )
        conn.commit()
        cur.execute("SELECT * FROM document_requests WHERE id = %s", (request_id,))
        request = cur.fetchone()
        cur.close()
        conn.close()
        if not request:
            return {"success": False, "message": "Request not found"}
        return {"success": True, "request": request}
    except Exception as e:
        return {"success": False, "message": str(e)}


@app.post("/api/documents/requests/{request_id}/generate")
async def generate_for_document_request(request_id: int, req: Request):
    """HR: mark a document request as generated and save the file_url."""
    _ensure_document_requests_table()
    try:
        body     = {}
        try:
            body = await req.json()
        except Exception:
            pass
        file_url = (body.get("file_url") or body.get("filepath") or "").strip() or None

        conn = get_db_connection()
        cur  = conn.cursor(dictionary=True)
        if file_url:
            cur.execute(
                """UPDATE document_requests
                   SET status = 'generated', file_url = %s, updated_at = NOW()
                   WHERE id = %s""",
                (file_url, request_id)
            )
        else:
            cur.execute(
                "UPDATE document_requests SET status = 'generated', updated_at = NOW() WHERE id = %s",
                (request_id,)
            )
        conn.commit()
        cur.execute("SELECT * FROM document_requests WHERE id = %s", (request_id,))
        request = cur.fetchone()
        cur.close(); conn.close()
        if not request:
            return {"success": False, "message": "Request not found"}
        return {"success": True, "request": request}
    except Exception as e:
        return {"success": False, "message": str(e)}


# --- POST /api/documents/requests/{id}/forward-to-accountant is
#     implemented in backend/core/document_requests_api.py
#     (forward_to_accountant) — that router is included before this
#     module's routes are registered, so a duplicate definition here would
#     have been dead code (removed in this audit).

@app.get("/api/documents/requests/accountant")
def get_accountant_document_requests():
    """Accountant: fetch salary-slip/payslip requests forwarded by HR."""
    _ensure_document_requests_table()
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT dr.*, e.department
            FROM document_requests dr
            LEFT JOIN employees e ON dr.employee_id = e.employee_code
            WHERE dr.document_type IN ('salary-slip', 'payslip')
              AND dr.status IN ('hr_approved', 'approved', 'generated')
            ORDER BY dr.created_at DESC
        """)
        requests = cur.fetchall()
        cur.close()
        conn.close()
        return {"success": True, "requests": requests}
    except Exception as e:
        return {"success": False, "message": str(e), "requests": []}


@app.post("/api/documents/requests/{request_id}/accountant-generate")
def accountant_generate_salary_slip(request_id: int):
    """Accountant: generate salary slip PDF for an hr_approved request."""
    logger.info("accountant_generate_salary_slip: request_id=%d", request_id)
    _ensure_document_requests_table()
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT * FROM document_requests WHERE id = %s", (request_id,))
        req = cur.fetchone()
        if not req:
            cur.close(); conn.close()
            logger.warning("Request %d not found", request_id)
            return {"success": False, "message": "Request not found"}

        if req.get("status") not in ("hr_approved", "approved"):
            cur.close(); conn.close()
            logger.warning("Request %d has status '%s', expected hr_approved", request_id, req.get("status"))
            return {"success": False, "message": f"Request is not in hr_approved status (current: {req.get('status')})"}

        emp_id = req["employee_id"]
        requested_month = req.get("requested_month")
        logger.info("Generating salary slip for employee=%s month=%s", emp_id, requested_month)

        if requested_month:
            try:
                year, month = [int(x) for x in requested_month.split("-")]
            except Exception:
                now = datetime.now()
                month, year = now.month, now.year
        else:
            now = datetime.now()
            month, year = now.month, now.year

        # Use salary_slip_generator for proper payroll computation, leave data, and PDF
        result = salary_slip_generator.generate(emp_id, month, year)

        if not result["success"]:
            cur.close(); conn.close()
            error_detail = "; ".join(result.get("errors", ["Unknown error"]))
            logger.error("salary_slip_generator failed: %s", error_detail)
            return {"success": False, "message": error_detail}

        filename  = result["filename"]
        html      = result["html"]   # None for Seawind PDF-only slips
        # file_url is the relative download path served by /api/documents/download/<filename>
        file_url  = f"/api/documents/download/{filename}"
        month_str = requested_month or f"{year:04d}-{month:02d}"

        logger.info(
            "accountant_generate: linking document emp=%s month=%s file_url=%s",
            emp_id, month_str, file_url,
        )

        # 1. Update the specific request that was generated
        cur.execute(
            """UPDATE document_requests
               SET status = 'generated',
                   file_html = %s,
                   file_url  = %s,
                   updated_at = NOW()
               WHERE id = %s""",
            (html, file_url, request_id),
        )

        # 2. Deduplication: mark all other hr_approved/approved requests for the same
        #    employee+month as 'generated' with the same file_url so the employee sees
        #    their salary slip regardless of which request the accountant acted on.
        cur.execute(
            """UPDATE document_requests
               SET status = 'generated',
                   file_html = %s,
                   file_url  = %s,
                   updated_at = NOW()
               WHERE employee_id     = %s
                 AND document_type   IN ('salary-slip', 'payslip')
                 AND requested_month = %s
                 AND status          IN ('hr_approved', 'approved')
                 AND id              != %s""",
            (html, file_url, emp_id, month_str, request_id),
        )
        merged = cur.rowcount
        if merged > 0:
            logger.info(
                "accountant_generate: merged %d duplicate hr_approved request(s) for emp=%s month=%s",
                merged, emp_id, month_str,
            )

        conn.commit()
        logger.info(
            "accountant_generate: request_id=%d status=generated emp=%s month=%s file_url=%s",
            request_id, emp_id, month_str, file_url,
        )

        cur.execute("SELECT * FROM document_requests WHERE id = %s", (request_id,))
        updated = cur.fetchone()
        cur.close()
        conn.close()
        return {"success": True, "request": updated, "html": html, "file_url": file_url}

    except ValueError as e:
        logger.error("ValueError in accountant_generate_salary_slip: %s", e)
        return {"success": False, "message": str(e)}
    except Exception as e:
        logger.exception("Unexpected error in accountant_generate_salary_slip: %s", e)
        return {"success": False, "message": f"Error: {str(e)}"}


# ── WFO / WFH Daily Work Mode ─────────────────────────────────────────────────

@app.get("/api/attendance/work-mode/today")
def get_today_work_mode(employee_id: str):
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute(
            "SELECT * FROM daily_work_mode WHERE employee_id=%s AND work_date=CURDATE()",
            (employee_id,)
        )
        row = cur.fetchone()

        # No row for today yet — auto-provision from the employee's permanent
        # work mode chosen at signup (employees.default_work_mode). This removes
        # the need for the employee to re-pick WFO/WFH on the attendance page.
        if not row:
            cur.execute(
                "SELECT default_work_mode FROM employees WHERE employee_code=%s",
                (employee_id,)
            )
            emp = cur.fetchone()
            default_mode = (emp or {}).get("default_work_mode")
            if default_mode in ("WFO", "WFH"):
                cur.execute(
                    """INSERT INTO daily_work_mode (employee_id, work_date, mode)
                       VALUES (%s, CURDATE(), %s)
                       ON DUPLICATE KEY UPDATE mode = mode""",
                    (employee_id, default_mode)
                )
                conn.commit()
                cur.execute(
                    "SELECT * FROM daily_work_mode WHERE employee_id=%s AND work_date=CURDATE()",
                    (employee_id,)
                )
                row = cur.fetchone()

        cur.close(); conn.close()
        if row:
            for k, v in row.items():
                if hasattr(v, 'isoformat'):
                    row[k] = v.isoformat()
        return {"success": True, "data": row}
    except Exception as e:
        return {"success": False, "message": str(e), "data": None}


@app.post("/api/attendance/work-mode")
def set_work_mode(payload: dict):
    employee_id = payload.get("employee_id", "").strip()
    mode = payload.get("mode", "").upper()
    if not employee_id or mode not in ("WFO", "WFH"):
        return {"success": False, "message": "employee_id and mode (WFO|WFH) required"}
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        # Allow changing mode only while still PENDING (not yet checked in)
        cur.execute(
            """INSERT INTO daily_work_mode (employee_id, work_date, mode)
               VALUES (%s, CURDATE(), %s)
               ON DUPLICATE KEY UPDATE
                 mode = IF(status='PENDING', VALUES(mode), mode)""",
            (employee_id, mode)
        )
        conn.commit()
        cur.execute(
            "SELECT * FROM daily_work_mode WHERE employee_id=%s AND work_date=CURDATE()",
            (employee_id,)
        )
        row = cur.fetchone()
        cur.close(); conn.close()
        if row:
            for k, v in row.items():
                if hasattr(v, 'isoformat'):
                    row[k] = v.isoformat()
        return {"success": True, "data": row}
    except Exception as e:
        return {"success": False, "message": str(e), "data": None}


@app.get("/api/hr/unified-attendance")
def get_unified_attendance(date: str = None):
    from datetime import date as _date
    import json as _json
    target = date or _date.today().isoformat()
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        # Parse year/month from target date for late-summary joins
        target_year  = int(target[:4])
        target_month = int(target[5:7])
        cur.execute(
            """
            SELECT
                e.employee_code               AS employee_id,
                e.full_name,
                COALESCE(e.department, '')    AS department,
                dwm.mode                      AS work_mode,
                dwm.status                    AS wfo_status,
                dwm.checked_in_at             AS wfo_checkin_at,
                dwm.check_in_method,
                dwm.biometric_user_id,
                a.status                      AS attendance_status,
                a.check_in,
                a.check_out,
                COALESCE(a.is_late, FALSE)    AS is_late,
                wfh.status                    AS wfh_status,
                wfh.attendance_method         AS wfh_method,
                wfh.punch_in_at               AS wfh_checkin_at,
                wfh.punch_out_at              AS wfh_checkout_at,
                wfh.geo_latitude,
                wfh.geo_longitude,
                wfh.geo_distance_meters,
                wfh.punch_out_latitude,
                wfh.punch_out_longitude,
                wfh.punch_out_distance_meters,
                wfh.punch_in_address,
                wfh.punch_out_address,
                COALESCE(a.punch_in_latitude, wfh.geo_latitude) AS punch_in_lat,
                COALESCE(a.punch_in_longitude, wfh.geo_longitude) AS punch_in_lon,
                COALESCE(a.punch_out_latitude, wfh.punch_out_latitude) AS punch_out_lat,
                COALESCE(a.punch_out_longitude, wfh.punch_out_longitude) AS punch_out_lon,
                COALESCE(a.punch_in_address, wfh.punch_in_address) AS punch_in_addr,
                COALESCE(a.punch_out_address, wfh.punch_out_address) AS punch_out_addr,
                COALESCE(a.work_minutes, wfh.duration_minutes, 0) AS work_minutes,
                COALESCE(a.break_minutes, 0) AS break_minutes,
                COALESCE(mls.late_days, 0)    AS month_late_days,
                COALESCE(ad.half_days_deducted, 0) AS deduction_half_days,
                COALESCE(ad.amount, 0)        AS deduction_amount,
                COALESCE(ad.payroll_processed, FALSE) AS deduction_processed
            FROM employees e
            LEFT JOIN daily_work_mode dwm
                ON dwm.employee_id = e.employee_code AND dwm.work_date = %s
            LEFT JOIN attendance a
                ON a.employee_id = e.employee_code AND a.date = %s
            LEFT JOIN wfh_attendance wfh
                ON wfh.employee_id = e.employee_code AND DATE(wfh.punch_in_at) = %s
            LEFT JOIN monthly_late_summary mls
                ON mls.employee_id = e.employee_code
               AND mls.year = %s AND mls.month = %s
            LEFT JOIN attendance_deductions ad
                ON ad.employee_id = e.employee_code
               AND ad.year = %s AND ad.month = %s
               AND ad.deduction_type = 'LATE_ARRIVAL'
            WHERE e.status = 'active'
            ORDER BY e.full_name
            """,
            (target, target, target, target_year, target_month, target_year, target_month)
        )
        rows = cur.fetchall()
        cur.close(); conn.close()
        def _serial(o):
            if hasattr(o, 'isoformat'):
                return o.isoformat()
            if hasattr(o, 'total_seconds'):          # TIME columns arrive as timedelta
                t = int(o.total_seconds())
                return f"{t // 3600:02d}:{t % 3600 // 60:02d}:{t % 60:02d}"
            if hasattr(o, 'as_tuple'):               # Decimal
                return float(o)
            return str(o)
        rows = _json.loads(_json.dumps(rows, default=_serial))
        return {"success": True, "date": target, "count": len(rows), "records": rows}
    except Exception as e:
        return {"success": False, "message": str(e), "records": []}


# ── Attendance Rules Engine endpoints ────────────────────────────────────────

@app.post("/api/attendance/rules/run")
def trigger_rules_engine(payload: dict = None):
    """
    Manually trigger the daily attendance rules for a specific date.
    Body: { "date": "YYYY-MM-DD" }  (optional — defaults to today)
    """
    from backend.core.attendance_rules import run_daily_rules
    from datetime import date as _date
    try:
        target_date = None
        if payload and payload.get("date"):
            target_date = _date.fromisoformat(payload["date"])
        result = run_daily_rules(target_date)
        return {"success": True, "result": result}
    except Exception as e:
        return {"success": False, "message": str(e)}


@app.get("/api/hr/late-summary")
def get_late_summary(year: int = None, month: int = None):
    """
    Monthly late-arrival summary for all employees.
    Defaults to current year/month.
    """
    from datetime import date as _date
    import json as _json
    today = _date.today()
    y = year  or today.year
    m = month or today.month
    try:
        conn = get_db_connection()
        cur  = conn.cursor(dictionary=True)
        cur.execute(
            """
            SELECT
                e.employee_code AS employee_id,
                e.full_name,
                COALESCE(e.department, '')   AS department,
                COALESCE(mls.late_days, 0)   AS late_days,
                COALESCE(mls.deduction_triggered, FALSE) AS deduction_triggered,
                COALESCE(ad.half_days_deducted, 0)  AS half_days_deducted,
                COALESCE(ad.amount, 0)              AS deduction_amount,
                COALESCE(ad.payroll_processed, FALSE) AS payroll_processed
            FROM employees e
            LEFT JOIN monthly_late_summary mls
                ON mls.employee_id = e.employee_code
               AND mls.year = %s AND mls.month = %s
            LEFT JOIN attendance_deductions ad
                ON ad.employee_id = e.employee_code
               AND ad.year = %s AND ad.month = %s
               AND ad.deduction_type = 'LATE_ARRIVAL'
            WHERE e.status = 'active'
            ORDER BY mls.late_days DESC, e.full_name
            """,
            (y, m, y, m),
        )
        rows = cur.fetchall()
        cur.close(); conn.close()
        rows = _json.loads(_json.dumps(rows, default=lambda o: o.isoformat() if hasattr(o, 'isoformat') else None))
        return {"success": True, "year": y, "month": m, "records": rows}
    except Exception as e:
        return {"success": False, "message": str(e), "records": []}


@app.get("/api/attendance/late-status/{employee_id}")
def get_employee_late_status(employee_id: str, year: int = None, month: int = None):
    """Returns an employee's late count and deduction status for the given month."""
    from backend.core.attendance_rules import get_employee_late_summary
    from datetime import date as _date
    today = _date.today()
    y = year  or today.year
    m = month or today.month
    try:
        data = get_employee_late_summary(employee_id, y, m)
        return {"success": True, "employee_id": employee_id, "year": y, "month": m, "data": data}
    except Exception as e:
        return {"success": False, "message": str(e)}


@app.get("/api/attendance/late-summary/{employee_id}")
def get_employee_late_summary_compat(employee_id: str, year: int = None, month: int = None):
    """
    Employee-facing late summary — returns fields matching EmployeeAttendancePage expectations:
      grace_late_count        → late days beyond the 3-day threshold this month
      deductions_applied      → number of half-day deductions triggered
      late_arrival_deduction  → monetary amount (INR) deducted
    """
    from backend.core.attendance_rules import get_employee_late_summary, LATE_DEDUCTION_EVERY
    from datetime import date as _date
    today = _date.today()
    y = year  or today.year
    m = month or today.month
    try:
        raw = get_employee_late_summary(employee_id, y, m)
        late_days        = raw.get("late_days", 0) or 0
        half_days        = raw.get("half_days_deducted", 0) or 0
        amount           = float(raw.get("amount", 0) or 0)
        # "beyond grace" = how many lates exceeded the deduction threshold
        grace_late_count = max(0, late_days - (LATE_DEDUCTION_EVERY - 1))
        return {
            "success":               True,
            "employee_id":           employee_id,
            "year":                  y,
            "month":                 m,
            "grace_late_count":      grace_late_count,
            "deductions_applied":    half_days,
            "late_arrival_deduction": amount,
            "raw":                   raw,
        }
    except Exception as e:
        return {"success": False, "message": str(e),
                "grace_late_count": 0, "deductions_applied": 0, "late_arrival_deduction": 0}


# ── WFO-specific attendance view ──────────────────────────────────────────────

@app.get("/api/hr/wfo-attendance")
def get_wfo_attendance(date: str = None):
    """
    Returns all employees who selected WFO for the given date.
    Includes biometric check-in, late status, and monthly deduction summary.
    Only employees with a daily_work_mode.mode = 'WFO' row appear.
    """
    from datetime import date as _date
    import json as _json
    target = date or _date.today().isoformat()
    target_year  = int(target[:4])
    target_month = int(target[5:7])
    try:
        conn = get_db_connection()
        cur  = conn.cursor(dictionary=True)
        cur.execute(
            """
            SELECT
                e.employee_code                     AS employee_id,
                e.full_name,
                COALESCE(e.department, '')          AS department,
                dwm.status                          AS wfo_status,
                COALESCE(wfh.punch_in_at, dwm.checked_in_at) AS checkin_at,
                wfh.punch_out_at                    AS checkout_at,
                COALESCE(dwm.check_in_method, wfh.attendance_method) AS check_in_method,
                wfh.status                          AS selfie_geo_status,
                wfh.geo_distance_meters,
                a.status                            AS attendance_status,
                CAST(a.check_in  AS CHAR)           AS check_in,
                CAST(a.check_out AS CHAR)           AS check_out,
                a.check_in_source,
                COALESCE(a.is_late, FALSE)          AS is_late,
                COALESCE(mls.late_days, 0)          AS month_late_days,
                COALESCE(ad.half_days_deducted, 0)  AS deduction_half_days,
                COALESCE(ad.amount, 0)              AS deduction_amount,
                COALESCE(ad.payroll_processed, FALSE) AS deduction_processed
            FROM employees e
            INNER JOIN daily_work_mode dwm
                ON  dwm.employee_id = e.employee_code
                AND dwm.work_date   = %s
                AND dwm.mode        = 'WFO'
            LEFT JOIN wfh_attendance wfh
                ON wfh.employee_id = e.employee_code AND DATE(wfh.punch_in_at) = %s
            LEFT JOIN attendance a
                ON a.employee_id = e.employee_code AND a.date = %s
            LEFT JOIN monthly_late_summary mls
                ON  mls.employee_id = e.employee_code
                AND mls.year  = %s AND mls.month = %s
            LEFT JOIN attendance_deductions ad
                ON  ad.employee_id    = e.employee_code
                AND ad.year   = %s AND ad.month = %s
                AND ad.deduction_type = 'LATE_ARRIVAL'
            WHERE e.status = 'active'
            ORDER BY e.full_name
            """,
            (target, target, target, target_year, target_month, target_year, target_month),
        )
        rows = cur.fetchall()
        cur.close(); conn.close()
        rows = _json.loads(_json.dumps(
            rows,
            default=lambda o: o.isoformat() if hasattr(o, 'isoformat') else (float(o) if hasattr(o, 'as_tuple') else None),
        ))
        return {"success": True, "date": target, "count": len(rows), "records": rows}
    except Exception as e:
        return {"success": False, "message": str(e), "records": []}


# ── WFH-specific attendance view ──────────────────────────────────────────────

@app.get("/api/hr/wfh-attendance")
def get_wfh_attendance(date: str = None):
    """
    Returns all employees who selected WFH for the given date.
    Includes selfie/geo check-in details and WFH approval status.
    Only employees with a daily_work_mode.mode = 'WFH' row appear.
    """
    from datetime import date as _date
    import json as _json
    target = date or _date.today().isoformat()
    try:
        conn = get_db_connection()
        cur  = conn.cursor(dictionary=True)
        cur.execute(
            """
            SELECT
                e.employee_code                 AS employee_id,
                e.full_name,
                COALESCE(e.department, '')      AS department,
                dwm.status                      AS wfh_mode_status,
                wfh.id                          AS wfh_id,
                wfh.status                      AS wfh_status,
                wfh.attendance_method           AS wfh_method,
                wfh.punch_in_at                 AS checkin_at,
                wfh.punch_out_at                AS checkout_at,
                TIMESTAMPDIFF(MINUTE, wfh.punch_in_at, COALESCE(wfh.punch_out_at, NOW()))
                                                AS duration_minutes,
                wfh.geo_latitude,
                wfh.geo_longitude,
                wfh.geo_distance_meters,
                wfh.punch_out_latitude,
                wfh.punch_out_longitude,
                wfh.punch_out_distance_meters,
                wfh.punch_in_address,
                wfh.punch_out_address,
                COALESCE(a.punch_in_latitude, wfh.geo_latitude) AS punch_in_lat,
                COALESCE(a.punch_in_longitude, wfh.geo_longitude) AS punch_in_lon,
                COALESCE(a.punch_out_latitude, wfh.punch_out_latitude) AS punch_out_lat,
                COALESCE(a.punch_out_longitude, wfh.punch_out_longitude) AS punch_out_lon,
                COALESCE(a.punch_in_address, wfh.punch_in_address) AS punch_in_addr,
                COALESCE(a.punch_out_address, wfh.punch_out_address) AS punch_out_addr,
                COALESCE(a.work_minutes, wfh.duration_minutes, 0) AS work_minutes,
                COALESCE(a.break_minutes, 0) AS break_minutes,
                wfh.flag_reason,
                ehl.address_label               AS home_address,
                a.status                        AS attendance_status,
                a.check_in                      AS attendance_check_in,
                a.check_out                     AS attendance_check_out,
                a.is_late
            FROM employees e
            INNER JOIN daily_work_mode dwm
                ON  dwm.employee_id = e.employee_code
                AND dwm.work_date   = %s
                AND dwm.mode        = 'WFH'
            LEFT JOIN wfh_attendance wfh
                ON  wfh.employee_id = e.employee_code
                AND DATE(wfh.punch_in_at) = %s
            LEFT JOIN attendance a
                ON  a.employee_id = e.employee_code
                AND a.date        = %s
            LEFT JOIN employee_home_locations ehl
                ON  ehl.employee_id = e.employee_code
            WHERE e.status = 'active'
            ORDER BY e.full_name
            """,
            (target, target, target),
        )
        rows = cur.fetchall()
        cur.close(); conn.close()
        rows = _json.loads(_json.dumps(rows, default=lambda o: o.isoformat() if hasattr(o, 'isoformat') else None))
        return {"success": True, "date": target, "count": len(rows), "records": rows}
    except Exception as e:
        return {"success": False, "message": str(e), "records": []}


@app.get("/api/hr/payroll")
def hr_payroll_view(month: Optional[str] = None):
    """
    Expose payroll calculations to HR for viewing, verification, and checks.
    Uses canonical payroll engine calculations identical to the accountant panel.
    """
    from backend.core.accountant_routes import accountant_payroll
    return accountant_payroll(month=month)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="127.0.0.1", port=8004, reload=True)

