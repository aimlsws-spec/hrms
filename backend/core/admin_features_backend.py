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

def edit_employee(employee_id: str, data: dict):
    """Edit employee details"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        fields = []
        values = []
        
        if 'name' in data:
            fields.append("name=%s")
            values.append(data['name'])
        if 'email' in data:
            fields.append("email=%s")
            values.append(data['email'])
        if 'phone' in data:
            fields.append("phone=%s")
            values.append(data['phone'])
        if 'department' in data:
            fields.append("department=%s")
            values.append(data['department'])
        if 'designation' in data:
            fields.append("designation=%s")
            values.append(data['designation'])
        if 'reporting_manager' in data:
            fields.append("reporting_manager=%s")
            values.append(data['reporting_manager'])
        if 'joining_date' in data:
            fields.append("joining_date=%s")
            values.append(data['joining_date'])
        if 'probation_end_date' in data:
            fields.append("probation_end_date=%s")
            values.append(data['probation_end_date'])
        
        values.append(employee_id)
        query = f"UPDATE employees SET {', '.join(fields)} WHERE employee_id=%s"
        cursor.execute(query, tuple(values))
        conn.commit()
        conn.close()
        return {"success": True, "message": "Employee updated"}
    except Exception as e:
        return {"success": False, "message": str(e)}

def toggle_employee_status(employee_id: str, is_active: bool):
    """Activate/Deactivate employee"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        status = 'active' if is_active else 'inactive'
        cursor.execute("UPDATE employees SET status=%s WHERE employee_id=%s", (status, employee_id))
        conn.commit()
        conn.close()
        return {"success": True, "message": f"Employee {status}"}
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

def update_employee_credentials(employee_id: str, email: str = None, password: str = None):
    """Update employee email/password"""
    try:
        from hrms_agent.auth import UserManager
        user_manager = UserManager()
        
        if email:
            result = user_manager.update_email(employee_id, email)
            if not result['success']:
                return result
        
        if password:
            result = user_manager.reset_password(employee_id, password)
            if not result['success']:
                return result
        
        return {"success": True, "message": "Credentials updated"}
    except Exception as e:
        return {"success": False, "message": str(e)}

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
