"""
Admin Features Backend API Module
Implements all remaining HRMS features for admin portal
"""
import mysql.connector
from datetime import datetime, timedelta
from typing import Optional, List, Dict
import json
import os
from pathlib import Path

from backend.config import DB_CONFIG

def get_db():
    return mysql.connector.connect(**DB_CONFIG)

# ==================== EMPLOYEE MANAGEMENT ====================

def edit_employee(employee_id: str, data: dict, actor: str = "HR Admin", client_ip: str = "127.0.0.1"):
    """Edit employee details and handle probation <-> employment transition"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)

        cursor.execute(
            "SELECT employee_code, full_name, email, status FROM employees WHERE employee_code = %s OR employee_id = %s LIMIT 1",
            (employee_id, employee_id)
        )
        emp_row = cursor.fetchone()
        if not emp_row:
            cursor.close(); conn.close()
            return {"success": False, "message": "Employee not found"}

        emp_code = emp_row.get("employee_code") or employee_id
        emp_name = emp_row.get("full_name") or employee_id
        prev_status = (emp_row.get("status") or "").strip().lower()

        fields = []
        values = []

        if 'name' in data and data['name']:
            fields.append("full_name=%s")
            values.append(data['name'])
        if 'full_name' in data and data['full_name']:
            fields.append("full_name=%s")
            values.append(data['full_name'])
        if 'email' in data and data['email']:
            fields.append("email=%s")
            values.append(data['email'])
        if 'phone' in data:
            fields.append("phone=%s")
            values.append(data['phone'])
        if 'department' in data and data['department']:
            fields.append("department=%s")
            values.append(data['department'])
        if 'designation' in data or 'title' in data:
            title_val = data.get('designation') or data.get('title')
            if title_val:
                fields.append("title=%s")
                values.append(title_val)
        if 'reporting_manager' in data:
            fields.append("reporting_manager=%s")
            values.append(data['reporting_manager'])
        if 'joining_date' in data and data['joining_date']:
            fields.append("joining_date=%s")
            values.append(data['joining_date'])

        new_status = data.get('status')
        status_transitioned_to_employment = False
        status_transitioned_to_probation = False

        if new_status:
            normalized_status = str(new_status).strip().lower()
            if normalized_status in ('employment', 'active', 'confirmed'):
                normalized_status = 'active'
                if prev_status == 'probation':
                    status_transitioned_to_employment = True
            elif normalized_status == 'probation':
                if prev_status != 'probation':
                    status_transitioned_to_probation = True

            fields.append("status=%s")
            values.append(normalized_status)

        if fields:
            values.append(emp_code)
            values.append(employee_id)
            query = f"UPDATE employees SET {', '.join(fields)} WHERE employee_code=%s OR employee_id=%s"
            cursor.execute(query, tuple(values))

        # Handle probation to employment transition:
        # "When HR changes the employee status from Probation to Employment, applicable leave balances become available automatically."
        if status_transitioned_to_employment:
            cur_year = datetime.now().year
            cursor.execute("""
                INSERT INTO leave_balance
                    (employee_id, year, casual_leave, sick_leave, earned_leave, casual_total, sick_total, earned_total)
                VALUES (%s, %s, 12.00, 12.00, 12.00, 12.00, 12.00, 12.00)
                ON DUPLICATE KEY UPDATE
                    year = VALUES(year), casual_leave = 12.00, sick_leave = 12.00, earned_leave = 12.00,
                    casual_total = 12.00, sick_total = 12.00, earned_total = 12.00
            """, (emp_code, cur_year))

            # Notify employee
            cursor.execute("""
                INSERT INTO notifications (user_id, title, message, type, is_read, created_at)
                VALUES (%s, %s, %s, 'LEAVE_BALANCE_ACTIVATED', 0, NOW())
            """, (
                emp_code,
                "Employment Confirmed — Leave Balances Activated",
                "Congratulations! Your employment status has been confirmed. Your yearly leave balances (12 Casual, 12 Sick, 12 Paid leaves) are now active and available for use."
            ))

            # Log HR activity
            try:
                from backend.core.hr_activity_logger import log_hr_activity
                log_hr_activity(
                    performed_by=actor,
                    performed_name=actor,
                    action="EMPLOYMENT_CONFIRMED",
                    target_employee_id=emp_code,
                    target_employee_name=emp_name,
                    details=f"Changed employment status from Probation to Employment for {emp_name} ({emp_code}). Yearly leave balances (12 CL, 12 SL, 12 PL) credited automatically.",
                    ip_address=client_ip
                )
            except Exception:
                pass

        elif status_transitioned_to_probation:
            cur_year = datetime.now().year
            cursor.execute("""
                INSERT INTO leave_balance
                    (employee_id, year, casual_leave, sick_leave, earned_leave, casual_total, sick_total, earned_total)
                VALUES (%s, %s, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00)
                ON DUPLICATE KEY UPDATE
                    year = VALUES(year), casual_leave = 0.00, sick_leave = 0.00, earned_leave = 0.00,
                    casual_total = 0.00, sick_total = 0.00, earned_total = 0.00
            """, (emp_code, cur_year))

            try:
                from backend.core.hr_activity_logger import log_hr_activity
                log_hr_activity(
                    performed_by=actor,
                    performed_name=actor,
                    action="STATUS_CHANGED_TO_PROBATION",
                    target_employee_id=emp_code,
                    target_employee_name=emp_name,
                    details=f"Set employee status to Probation for {emp_name} ({emp_code}). Leave balances set to 0.00.",
                    ip_address=client_ip
                )
            except Exception:
                pass

        # Handle Employee ID change (cascading across all tables)
        new_emp_id = data.get('new_employee_id') or (data.get('employee_id') if data.get('employee_id') != employee_id and data.get('employee_id') != emp_code else None)
        if new_emp_id:
            new_emp_id = str(new_emp_id).strip()
            if new_emp_id and new_emp_id != emp_code:
                # Check uniqueness
                cursor.execute(
                    "SELECT 1 FROM employees WHERE (employee_code = %s OR employee_id = %s) AND employee_code != %s LIMIT 1",
                    (new_emp_id, new_emp_id, emp_code)
                )
                if cursor.fetchone():
                    cursor.close(); conn.close()
                    return {"success": False, "message": f"Employee ID '{new_emp_id}' is already assigned to another employee."}

                cursor.execute("SELECT 1 FROM users WHERE user_id = %s AND user_id != %s LIMIT 1", (new_emp_id, emp_code))
                if cursor.fetchone():
                    cursor.close(); conn.close()
                    return {"success": False, "message": f"User ID '{new_emp_id}' is already in use."}

                old_code = emp_code
                # Cascading updates across all tables
                cascade_queries = [
                    ("employees", "employee_code", "employee_code"),
                    ("employees", "employee_id", "employee_id"),
                    ("users", "user_id", "user_id"),
                    ("attendance", "employee_id", "employee_id"),
                    ("attendance_breaks", "employee_id", "employee_id"),
                    ("attendance_deductions", "employee_id", "employee_id"),
                    ("leave_requests", "employee_id", "employee_id"),
                    ("leave_balance", "employee_id", "employee_id"),
                    ("leave_ledger", "employee_id", "employee_id"),
                    ("employee_salaries", "employee_id", "employee_id"),
                    ("employee_profiles", "employee_id", "employee_id"),
                    ("notifications", "user_id", "user_id"),
                    ("monthly_late_summary", "employee_id", "employee_id"),
                    ("biometric_employee_map", "employee_id", "employee_id"),
                ]
                for tbl, set_col, where_col in cascade_queries:
                    try:
                        cursor.execute(f"UPDATE {tbl} SET {set_col} = %s WHERE {where_col} = %s", (new_emp_id, old_code))
                    except Exception:
                        pass

                emp_code = new_emp_id
                employee_id = new_emp_id

                try:
                    from backend.core.hr_activity_logger import log_hr_activity
                    log_hr_activity(
                        performed_by=actor,
                        performed_name=actor,
                        action="EMPLOYEE_ID_CHANGED",
                        target_employee_id=new_emp_id,
                        target_employee_name=emp_name,
                        details=f"Changed employee ID from {old_code} to {new_emp_id} for {emp_name}. All records updated to new ID.",
                        ip_address=client_ip
                    )
                except Exception:
                    pass

        # Handle Password change by HR
        if 'password' in data and data['password']:
            new_password = str(data['password']).strip()
            if new_password:
                emp_email = emp_row.get("email")
                cursor.execute("""
                    UPDATE users
                    SET password = %s, assigned_password = %s
                    WHERE user_id = %s OR (email IS NOT NULL AND email = %s)
                """, (new_password, new_password, emp_code, emp_email))

                try:
                    from backend.core.hr_activity_logger import log_hr_activity
                    log_hr_activity(
                        performed_by=actor,
                        performed_name=actor,
                        action="EMPLOYEE_PASSWORD_CHANGED",
                        target_employee_id=emp_code,
                        target_employee_name=emp_name,
                        details=f"Updated assigned login password for {emp_name} ({emp_code}).",
                        ip_address=client_ip
                    )
                except Exception:
                    pass

        # Update annual CTC if provided
        if 'annual_ctc' in data and data['annual_ctc'] is not None:
            try:
                ctc_val = float(data['annual_ctc'])
                cursor.execute("""
                    INSERT INTO employee_salaries (employee_id, gross_salary, ctc, status, effective_from)
                    VALUES (%s, %s, %s, 'active', CURDATE())
                    ON DUPLICATE KEY UPDATE gross_salary = VALUES(gross_salary), ctc = VALUES(ctc)
                """, (emp_code, round(ctc_val / 12, 2), ctc_val))
            except Exception:
                pass

        conn.commit()
        cursor.close()
        conn.close()
        return {"success": True, "message": "Employee updated successfully"}
    except Exception as e:
        return {"success": False, "message": str(e)}

def toggle_employee_status(employee_id: str, is_active: bool, actor: str = "HR Admin", client_ip: str = "127.0.0.1"):
    """Activate/Deactivate employee account in both employees and users tables."""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        status = 'active' if is_active else 'inactive'
        active_flag = 1 if is_active else 0

        # Find employee full name and email
        cursor.execute(
            "SELECT full_name, email, employee_code FROM employees WHERE employee_code = %s OR employee_id = %s LIMIT 1",
            (employee_id, employee_id)
        )
        emp_row = cursor.fetchone()
        emp_name = emp_row["full_name"] if emp_row and emp_row.get("full_name") else employee_id
        emp_email = emp_row.get("email") if emp_row else None
        emp_code = emp_row.get("employee_code") if emp_row else employee_id

        # 1. Update employees table
        cursor.execute("UPDATE employees SET status=%s WHERE employee_code=%s OR employee_id=%s", (status, emp_code, employee_id))

        # 2. Update users table (so deactivated employee cannot log in)
        if emp_email:
            cursor.execute("UPDATE users SET is_active=%s WHERE user_id=%s OR email=%s", (active_flag, emp_code, emp_email))
        else:
            cursor.execute("UPDATE users SET is_active=%s WHERE user_id=%s", (active_flag, emp_code))

        conn.commit()
        cursor.close()
        conn.close()

        # Log into HR activity log
        try:
            from backend.core.hr_activity_logger import log_hr_activity
            action_name = "ACCOUNT_ACTIVATED" if is_active else "ACCOUNT_DEACTIVATED"
            action_desc = f"{'Reactivated' if is_active else 'Deactivated'} portal account for {emp_name} ({emp_code}). Login access is {'enabled' if is_active else 'disabled'}."
            log_hr_activity(
                performed_by=actor,
                performed_name=actor,
                action=action_name,
                target_employee_id=emp_code,
                target_employee_name=emp_name,
                details=action_desc,
                ip_address=client_ip
            )
        except Exception:
            pass

        return {
            "success": True,
            "message": f"Employee account {status} successfully",
            "is_active": is_active,
            "status": status,
            "employee_id": emp_code,
        }
    except Exception as e:
        return {"success": False, "message": str(e)}

# ==================== DOCUMENT GENERATION ====================

def generate_experience_letter(employee_id: str):
    """Generate experience letter"""
    try:
        from backend.core.document_generator import DocumentGenerator
        doc_gen = DocumentGenerator()
        
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM employees WHERE employee_id=%s", (employee_id,))
        emp = cursor.fetchone()
        conn.close()
        
        if not emp:
            return {"success": False, "message": "Employee not found"}
        
        exp_data = {
            'employee_name': emp['name'],
            'employee_id': emp['employee_id'],
            'designation': emp.get('designation', 'Employee'),
            'department': emp.get('department', 'General'),
            'joining_date': emp.get('joining_date', datetime.now().strftime('%Y-%m-%d')),
            'relieving_date': datetime.now().strftime('%Y-%m-%d')
        }
        
        filename = doc_gen.generate_experience_letter(exp_data)
        return {"success": True, "filename": filename, "download_url": f"/files/{filename}"}
    except Exception as e:
        return {"success": False, "message": str(e)}

def generate_relieving_letter(employee_id: str, last_working_day: str):
    """Generate relieving letter"""
    try:
        from backend.core.document_generator import DocumentGenerator
        doc_gen = DocumentGenerator()
        
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM employees WHERE employee_id=%s", (employee_id,))
        emp = cursor.fetchone()
        conn.close()
        
        if not emp:
            return {"success": False, "message": "Employee not found"}
        
        rel_data = {
            'employee_name': emp['name'],
            'employee_id': emp['employee_id'],
            'designation': emp.get('designation', 'Employee'),
            'department': emp.get('department', 'General'),
            'joining_date': emp.get('joining_date', datetime.now().strftime('%Y-%m-%d')),
            'last_working_day': last_working_day
        }
        
        filename = doc_gen.generate_relieving_letter(rel_data)
        return {"success": True, "filename": filename, "download_url": f"/files/{filename}"}
    except Exception as e:
        return {"success": False, "message": str(e)}

# ==================== CREDENTIAL MANAGEMENT ====================

def update_employee_credentials(employee_id: str, new_employee_id: str = None, password: str = None, actor: str = "HR Admin", client_ip: str = "127.0.0.1"):
    """Update employee ID and/or password directly in the database with full cascade and audit logging."""
    return edit_employee(employee_id, {
        "new_employee_id": new_employee_id,
        "password": password
    }, actor=actor, client_ip=client_ip)

def get_login_history(employee_id: str = None):
    """Get employee login history"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        if employee_id:
            cursor.execute("""
                SELECT user_id as employee_id, username, status, ip_address, user_agent, 
                       failure_reason, login_time 
                FROM login_history 
                WHERE user_id=%s 
                ORDER BY login_time DESC LIMIT 50
            """, (employee_id,))
        else:
            cursor.execute("""
                SELECT user_id as employee_id, username, status, ip_address, user_agent, 
                       failure_reason, login_time 
                FROM login_history 
                ORDER BY login_time DESC LIMIT 100
            """)
        
        history = cursor.fetchall()
        conn.close()
        return {"success": True, "history": history}
    except Exception as e:
        return {"success": False, "message": str(e), "history": []}

def force_logout_user(employee_id: str):
    """Force logout user and create temporary lockout"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Invalidate all sessions
        cursor.execute("UPDATE user_sessions SET is_active=0 WHERE employee_id=%s", (employee_id,))
        
        # Create a temporary lockout record (expires in 5 minutes)
        cursor.execute("""
            INSERT INTO user_lockouts (employee_id, locked_until, reason, created_at)
            VALUES (%s, DATE_ADD(NOW(), INTERVAL 5 MINUTE), 'Force logout by admin', NOW())
            ON DUPLICATE KEY UPDATE locked_until=DATE_ADD(NOW(), INTERVAL 5 MINUTE), reason='Force logout by admin'
        """, (employee_id,))
        
        conn.commit()
        conn.close()
        return {"success": True, "message": "User logged out and locked for 5 minutes"}
    except Exception as e:
        return {"success": False, "message": str(e)}

# ==================== PAYROLL ====================

def create_salary_structure(employee_id: str, structure: dict):
    """Create salary structure"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO salary_structure 
            (employee_id, basic, hra, allowances, pf, esic, tds, gross_salary, net_salary, effective_from)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            employee_id,
            structure['basic'],
            structure['hra'],
            structure.get('allowances', 0),
            structure.get('pf', 0),
            structure.get('esic', 0),
            structure.get('tds', 0),
            structure['gross_salary'],
            structure['net_salary'],
            structure.get('effective_from', datetime.now().strftime('%Y-%m-%d'))
        ))
        
        conn.commit()
        conn.close()
        return {"success": True, "message": "Salary structure created"}
    except Exception as e:
        return {"success": False, "message": str(e)}

def get_salary_history(employee_id: str):
    """Get salary revision history"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM salary_structure WHERE employee_id=%s ORDER BY effective_from DESC", (employee_id,))
        history = cursor.fetchall()
        conn.close()
        return {"success": True, "history": history}
    except Exception as e:
        return {"success": False, "message": str(e), "history": []}

def add_bonus(employee_id: str, amount: float, bonus_type: str, reason: str):
    """Add bonus/incentive"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO bonuses (employee_id, amount, bonus_type, reason, created_at)
            VALUES (%s, %s, %s, %s, NOW())
        """, (employee_id, amount, bonus_type, reason))
        conn.commit()
        conn.close()
        return {"success": True, "message": "Bonus added"}
    except Exception as e:
        return {"success": False, "message": str(e)}

def calculate_final_settlement(employee_id: str, last_working_day: str):
    """Calculate F&F settlement"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        # Get salary structure
        cursor.execute("SELECT * FROM salary_structure WHERE employee_id=%s ORDER BY effective_from DESC LIMIT 1", (employee_id,))
        salary = cursor.fetchone()
        
        # Get leave balance
        cursor.execute("SELECT * FROM leave_balance WHERE employee_id=%s", (employee_id,))
        leaves = cursor.fetchone()
        
        # Calculate
        notice_pay = 0
        leave_encashment = (leaves.get('casual_leave', 0) + leaves.get('earned_leave', 0)) * (salary['basic'] / 30)
        gratuity = 0  # Calculate based on years of service
        
        settlement = {
            'employee_id': employee_id,
            'last_working_day': last_working_day,
            'notice_pay': notice_pay,
            'leave_encashment': leave_encashment,
            'gratuity': gratuity,
            'total_settlement': notice_pay + leave_encashment + gratuity
        }
        
        conn.close()
        return {"success": True, "settlement": settlement}
    except Exception as e:
        return {"success": False, "message": str(e)}

# ==================== ATTENDANCE ====================

def mark_attendance(employee_id: str, date: str, status: str, check_in: str = None, check_out: str = None):
    """Manual attendance marking"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO attendance (employee_id, date, status, check_in, check_out)
            VALUES (%s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE status=%s, check_in=%s, check_out=%s
        """, (employee_id, date, status, check_in, check_out, status, check_in, check_out))
        conn.commit()
        conn.close()
        return {"success": True, "message": "Attendance marked"}
    except Exception as e:
        return {"success": False, "message": str(e)}

def get_attendance_calendar(employee_id: str = None, month: str = None):
    """Get attendance calendar"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        if not month:
            month = datetime.now().strftime('%Y-%m')
        
        if employee_id:
            cursor.execute("SELECT * FROM attendance WHERE employee_id=%s AND date LIKE %s", (employee_id, f"{month}%"))
        else:
            cursor.execute("SELECT * FROM attendance WHERE date LIKE %s", (f"{month}%",))
        
        records = cursor.fetchall()
        conn.close()
        return {"success": True, "records": records}
    except Exception as e:
        return {"success": False, "message": str(e), "records": []}

def get_leave_balance(employee_id: str):
    """Get leave balance"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM leave_balance WHERE employee_id=%s", (employee_id,))
        balance = cursor.fetchone()
        conn.close()
        
        if not balance:
            balance = {'casual_leave': 0.5, 'sick_leave': 0.5, 'earned_leave': 0.5}
        
        return {"success": True, "balance": balance}
    except Exception as e:
        return {"success": False, "message": str(e), "balance": {}}

# ==================== DEPARTMENT & DESIGNATION ====================

def create_department(name: str, description: str = None, head_id: str = None):
    """Create department"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Generate department_id
        cursor.execute("SELECT COUNT(*) as count FROM departments")
        count = cursor.fetchone()[0]
        dept_id = f"DEPT{str(count + 1).zfill(3)}"
        
        cursor.execute("INSERT INTO departments (department_id, name, description, created_at) VALUES (%s, %s, %s, NOW())", 
                      (dept_id, name, description))
        conn.commit()
        last_id = cursor.lastrowid
        conn.close()
        return {"success": True, "message": "Department created", "dept_id": last_id}
    except Exception as e:
        return {"success": False, "message": str(e)}

def edit_department(dept_id: int, name: str = None, description: str = None, head_id: str = None):
    """Edit department"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        fields = []
        values = []
        
        if name:
            fields.append("name=%s")
            values.append(name)
        if description:
            fields.append("description=%s")
            values.append(description)
        
        if not fields:
            return {"success": False, "message": "No fields to update"}
        
        values.append(dept_id)
        query = f"UPDATE departments SET {', '.join(fields)} WHERE id=%s"
        cursor.execute(query, tuple(values))
        conn.commit()
        conn.close()
        return {"success": True, "message": "Department updated"}
    except Exception as e:
        return {"success": False, "message": str(e)}

def delete_department(dept_id: int):
    """Delete department"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM departments WHERE id=%s", (dept_id,))
        conn.commit()
        conn.close()
        return {"success": True, "message": "Department deleted"}
    except Exception as e:
        return {"success": False, "message": str(e)}

def create_designation(title: str, department_id: int = None, level: str = None):
    """Create designation"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("INSERT INTO designations (title, department_id, level, created_at) VALUES (%s, %s, %s, NOW())", 
                      (title, department_id, level))
        conn.commit()
        desig_id = cursor.lastrowid
        conn.close()
        return {"success": True, "message": "Designation created", "desig_id": desig_id}
    except Exception as e:
        return {"success": False, "message": str(e)}

def get_departments():
    """Get all departments"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM departments ORDER BY name")
        depts = cursor.fetchall()
        conn.close()
        return {"success": True, "departments": depts}
    except Exception as e:
        return {"success": False, "message": str(e), "departments": []}

# ==================== PERFORMANCE MANAGEMENT ====================

def create_performance_cycle(name: str, start_date: str, end_date: str, description: str = None):
    """Create performance cycle"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO performance_cycles (name, start_date, end_date, description, status, created_at)
            VALUES (%s, %s, %s, %s, 'active', NOW())
        """, (name, start_date, end_date, description))
        conn.commit()
        cycle_id = cursor.lastrowid
        conn.close()
        return {"success": True, "message": "Performance cycle created", "cycle_id": cycle_id}
    except Exception as e:
        return {"success": False, "message": str(e)}

def create_kpi(employee_id: str, cycle_id: int, kpi_name: str, target: str, weightage: float):
    """Create KPI/OKR"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO kpis (employee_id, cycle_id, kpi_name, target, weightage, created_at)
            VALUES (%s, %s, %s, %s, %s, NOW())
        """, (employee_id, cycle_id, kpi_name, target, weightage))
        conn.commit()
        conn.close()
        return {"success": True, "message": "KPI created"}
    except Exception as e:
        return {"success": False, "message": str(e)}

def submit_self_review(employee_id: str, cycle_id: int, review_data: dict):
    """Submit self review"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO self_reviews (employee_id, cycle_id, achievements, challenges, goals, rating, submitted_at)
            VALUES (%s, %s, %s, %s, %s, %s, NOW())
        """, (employee_id, cycle_id, review_data.get('achievements'), review_data.get('challenges'), 
              review_data.get('goals'), review_data.get('rating')))
        conn.commit()
        conn.close()
        return {"success": True, "message": "Self review submitted"}
    except Exception as e:
        return {"success": False, "message": str(e)}

def submit_manager_review(employee_id: str, cycle_id: int, manager_id: str, review_data: dict):
    """Submit manager review"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO manager_reviews (employee_id, cycle_id, manager_id, feedback, rating, 
                                        promotion_recommended, appraisal_recommended, submitted_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
        """, (employee_id, cycle_id, manager_id, review_data.get('feedback'), review_data.get('rating'),
              review_data.get('promotion_recommended', False), review_data.get('appraisal_recommended', False)))
        conn.commit()
        conn.close()
        return {"success": True, "message": "Manager review submitted"}
    except Exception as e:
        return {"success": False, "message": str(e)}

# ==================== SETTINGS & CONFIGURATION ====================

def update_company_profile(data: dict):
    """Update company profile"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO company_settings (setting_key, setting_value, updated_at)
            VALUES ('company_profile', %s, NOW())
            ON DUPLICATE KEY UPDATE setting_value=%s, updated_at=NOW()
        """, (json.dumps(data), json.dumps(data)))
        
        conn.commit()
        conn.close()
        return {"success": True, "message": "Company profile updated"}
    except Exception as e:
        return {"success": False, "message": str(e)}

def set_working_days(working_days: list):
    """Configure working days"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO company_settings (setting_key, setting_value, updated_at)
            VALUES ('working_days', %s, NOW())
            ON DUPLICATE KEY UPDATE setting_value=%s, updated_at=NOW()
        """, (json.dumps(working_days), json.dumps(working_days)))
        conn.commit()
        conn.close()
        return {"success": True, "message": "Working days configured"}
    except Exception as e:
        return {"success": False, "message": str(e)}

def add_holiday(date: str, name: str, description: str = None):
    """Add holiday"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("INSERT INTO holidays (date, name, description, created_at) VALUES (%s, %s, %s, NOW())", 
                      (date, name, description))
        conn.commit()
        conn.close()
        return {"success": True, "message": "Holiday added"}
    except Exception as e:
        return {"success": False, "message": str(e)}

def get_holidays(year: int = None):
    """Get holiday calendar"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        if year:
            cursor.execute("SELECT * FROM holidays WHERE YEAR(date)=%s ORDER BY date", (year,))
        else:
            cursor.execute("SELECT * FROM holidays ORDER BY date")
        
        holidays = cursor.fetchall()
        conn.close()
        return {"success": True, "holidays": holidays}
    except Exception as e:
        return {"success": False, "message": str(e), "holidays": []}

# ==================== SECURITY & AUDIT ====================

def log_admin_activity(admin_id: str, action: str, details: str = None):
    """Log admin activity"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO admin_activity_logs (admin_id, action, details, ip_address, timestamp)
            VALUES (%s, %s, %s, %s, NOW())
        """, (admin_id, action, details, '127.0.0.1'))
        conn.commit()
        conn.close()
        return {"success": True}
    except Exception as e:
        return {"success": False, "message": str(e)}

def get_admin_logs(limit: int = 100):
    """Get admin activity logs"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM admin_activity_logs ORDER BY timestamp DESC LIMIT %s", (limit,))
        logs = cursor.fetchall()
        conn.close()
        return {"success": True, "logs": logs}
    except Exception as e:
        return {"success": False, "message": str(e), "logs": []}

def get_employee_activity_logs(employee_id: str = None, limit: int = 100):
    """Get employee activity logs"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        if employee_id:
            cursor.execute("SELECT * FROM employee_activity_logs WHERE employee_id=%s ORDER BY timestamp DESC LIMIT %s", 
                          (employee_id, limit))
        else:
            cursor.execute("SELECT * FROM employee_activity_logs ORDER BY timestamp DESC LIMIT %s", (limit,))
        
        logs = cursor.fetchall()
        conn.close()
        return {"success": True, "logs": logs}
    except Exception as e:
        return {"success": False, "message": str(e), "logs": []}
