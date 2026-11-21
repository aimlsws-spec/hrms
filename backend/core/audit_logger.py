"""
Audit Logger for HRMS
Tracks admin activities, employee activities, and login history
"""
import mysql.connector
from datetime import datetime
from typing import Optional

from backend.config import DB_CONFIG

def get_db():
    return mysql.connector.connect(**DB_CONFIG)

# ==================== ADMIN ACTIVITY LOGS ====================

def log_admin_activity(admin_id: str, admin_name: str, action: str, details: str = None, 
                       target_employee_id: str = None, ip_address: str = "127.0.0.1"):
    """Log admin activity"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO admin_activity_logs 
            (admin_id, admin_name, action, details, target_employee_id, ip_address, timestamp)
            VALUES (%s, %s, %s, %s, %s, %s, NOW())
        """, (admin_id, admin_name, action, details, target_employee_id, ip_address))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Error logging admin activity: {e}")

def get_admin_logs(limit: int = 100, admin_id: str = None):
    """Get admin activity logs"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        if admin_id:
            cursor.execute("""
                SELECT * FROM admin_activity_logs 
                WHERE admin_id = %s 
                ORDER BY timestamp DESC LIMIT %s
            """, (admin_id, limit))
        else:
            cursor.execute("""
                SELECT * FROM admin_activity_logs 
                ORDER BY timestamp DESC LIMIT %s
            """, (limit,))
        
        logs = cursor.fetchall()
        conn.close()
        return {"success": True, "logs": logs, "count": len(logs)}
    except Exception as e:
        return {"success": False, "message": str(e), "logs": []}

# ==================== EMPLOYEE ACTIVITY LOGS ====================

def log_employee_activity(employee_id: str, employee_name: str, action: str, 
                         details: str = None, ip_address: str = "127.0.0.1"):
    """Log employee activity"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO employee_activity_logs 
            (employee_id, employee_name, action, details, ip_address, timestamp)
            VALUES (%s, %s, %s, %s, %s, NOW())
        """, (employee_id, employee_name, action, details, ip_address))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Error logging employee activity: {e}")

def get_employee_logs(limit: int = 100, employee_id: str = None):
    """Get employee activity logs"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        if employee_id:
            cursor.execute("""
                SELECT * FROM employee_activity_logs 
                WHERE employee_id = %s 
                ORDER BY timestamp DESC LIMIT %s
            """, (employee_id, limit))
        else:
            cursor.execute("""
                SELECT * FROM employee_activity_logs 
                ORDER BY timestamp DESC LIMIT %s
            """, (limit,))
        
        logs = cursor.fetchall()
        conn.close()
        return {"success": True, "logs": logs, "count": len(logs)}
    except Exception as e:
        return {"success": False, "message": str(e), "logs": []}

# ==================== LOGIN HISTORY ====================

def log_login_attempt(user_id: str, username: str, status: str, ip_address: str = "127.0.0.1",
                     user_agent: str = None, failure_reason: str = None):
    """Log login attempt (success or failure) — uses actual login_history schema."""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO login_history
            (employee_id, ip_address, device_info, login_time)
            VALUES (%s, %s, %s, NOW())
        """, (user_id, ip_address, user_agent))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Error logging login attempt: {e}")

def log_logout(user_id: str, username: str, ip_address: str = "127.0.0.1"):
    """Log logout event."""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE login_history SET logout_time = NOW()
            WHERE employee_id = %s AND logout_time IS NULL
            ORDER BY login_time DESC LIMIT 1
        """, (user_id,))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Error logging logout: {e}")

def get_login_history(limit: int = 100, user_id: str = None):
    """Get login history"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        if user_id:
            cursor.execute("""
                SELECT user_id as employee_id, username, status, ip_address, user_agent, 
                       failure_reason, login_time
                FROM login_history 
                WHERE user_id = %s 
                ORDER BY login_time DESC LIMIT %s
            """, (user_id, limit))
        else:
            cursor.execute("""
                SELECT user_id as employee_id, username, status, ip_address, user_agent, 
                       failure_reason, login_time
                FROM login_history 
                ORDER BY login_time DESC LIMIT %s
            """, (limit,))
        
        logs = cursor.fetchall()
        conn.close()
        return {"success": True, "logs": logs, "count": len(logs)}
    except Exception as e:
        return {"success": False, "message": str(e), "logs": []}

# ==================== HELPER FUNCTIONS ====================

def get_audit_summary():
    """Get summary statistics for audit logs"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        # Admin activity count
        cursor.execute("SELECT COUNT(*) as count FROM admin_activity_logs WHERE DATE(timestamp) = CURDATE()")
        admin_today = cursor.fetchone()['count']
        
        # Employee activity count
        cursor.execute("SELECT COUNT(*) as count FROM employee_activity_logs WHERE DATE(timestamp) = CURDATE()")
        employee_today = cursor.fetchone()['count']
        
        # Login attempts today
        cursor.execute("SELECT COUNT(*) as count FROM login_history WHERE DATE(login_time) = CURDATE()")
        logins_today = cursor.fetchone()['count']
        
        # Failed logins today
        cursor.execute("SELECT COUNT(*) as count FROM login_history WHERE status = 'FAILED' AND DATE(login_time) = CURDATE()")
        failed_today = cursor.fetchone()['count']
        
        conn.close()
        
        return {
            "success": True,
            "summary": {
                "admin_activities_today": admin_today,
                "employee_activities_today": employee_today,
                "logins_today": logins_today,
                "failed_logins_today": failed_today
            }
        }
    except Exception as e:
        return {"success": False, "message": str(e)}
