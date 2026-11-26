import os
import sys
import shutil
import pymysql
from dotenv import load_dotenv

# Explicitly load .env from project root
root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
env_path = os.path.join(root_dir, '.env')
load_dotenv(dotenv_path=env_path)

DB_CONFIG = {
    'host':     os.getenv('DB_HOST', '127.0.0.1'),
    'user':     os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD', 'Root@123'),
    'database': os.getenv('DB_NAME', 'hrms'),
    'charset':  'utf8mb4',
}

def clean_database():
    conn = pymysql.connect(**DB_CONFIG)
    cursor = conn.cursor()
    
    print("Disabling foreign key checks...")
    cursor.execute("SET FOREIGN_KEY_CHECKS = 0;")
    
    # Tables to completely wipe of test data
    tables_to_truncate = [
        # Announcements
        "announcements",
        
        # Employees & related
        "employees",
        "employee_salaries",
        "employee_joining_documents",
        "employee_profiles",
        "employee_home_locations",
        "employee_home_location_audit",
        "home_location_change_requests",
        "final_settlements",
        
        # Attendance & Geolocation
        "attendance",
        "attendance_audit_log",
        "attendance_breaks",
        "attendance_deductions",
        "attendance_regularization",
        "attendance_selfies",
        "wfh_attendance",
        "geo_attendance_attempts",
        "daily_work_mode",
        "monthly_late_summary",
        "selfie_access_log",
        
        # Biometrics (legacy / test data)
        "biometric_sync_log",
        "biometric_userinfo",
        "biometric_raw_logs",
        "biometric_missing_punches",
        "biometric_employee_map",
        
        # Leaves
        "leave_balance",
        "leave_ledger",
        "leave_requests",
        
        # Reimbursements & Documents
        "reimbursements",
        "document_requests",
        
        # Payroll & Finance
        "monthly_payroll",
        "payroll_records",
        "bonuses",
        "remarks",
        
        # Performance
        "performance_cycles",
        "performance_reviews",
        "self_reviews",
        "manager_reviews",
        "goals",
        "kpis",
        
        # Tickets & Support
        "support_tickets",
        "ticket_attachments",
        "ticket_comments",
        
        # Tasks & Kanban
        "tasks",
        "task_comments",
        "kanban_tasks",
        "task_boards",
        
        # Teams
        "teams",
        "team_members",
        
        # Logs & Notifications
        "notifications",
        "login_history",
        "user_sessions",
        "hr_activity_logs",
        "admin_activity_logs",
        "employee_activity_logs"
    ]
    
    for table in tables_to_truncate:
        try:
            cursor.execute(f"TRUNCATE TABLE `{table}`")
            print(f"✓ Truncated `{table}`")
        except Exception as e:
            print(f"  Warning on `{table}`: {e}")
            try:
                cursor.execute(f"DELETE FROM `{table}`")
                print(f"✓ Deleted from `{table}`")
            except Exception as e2:
                print(f"  Error deleting `{table}`: {e2}")

    # Remove all employee records from users table (keep staff users)
    cursor.execute("DELETE FROM users WHERE role = 'employee'")
    deleted_users = cursor.rowcount
    print(f"✓ Removed {deleted_users} employee user(s) from `users` table.")
    
    # Ensure staff leave balances or default board if needed
    # Insert 1 clean default task board
    cursor.execute("""
        INSERT INTO task_boards (id, name, description, created_by, is_active)
        VALUES (1, 'Main Project Board', 'Default organization project board', 'admin', 1)
    """)
    print("✓ Initialized 1 clean default task board.")
    
    cursor.execute("SET FOREIGN_KEY_CHECKS = 1;")
    conn.commit()
    
    # Verify remaining users
    cursor.execute("SELECT user_id, username, email, role, full_name, is_active FROM users")
    remaining_users = cursor.fetchall()
    print("\nRemaining Active Staff Users:")
    for u in remaining_users:
        print(f"  • {u[1]} ({u[3]}): {u[4]} [{u[2]}]")
        
    conn.close()
    print("\nDatabase cleanup complete!")

def clean_disk_files():
    base_dir = os.path.dirname(os.path.dirname(__file__))
    
    # 1. Clean generated_docs
    gen_docs_dir = os.path.join(base_dir, 'generated_docs')
    if os.path.exists(gen_docs_dir):
        for item in os.listdir(gen_docs_dir):
            item_path = os.path.join(gen_docs_dir, item)
            if os.path.isfile(item_path):
                try:
                    os.remove(item_path)
                    print(f"✓ Removed test document: {item}")
                except Exception as e:
                    print(f"  Could not remove {item}: {e}")
                    
    # 2. Clean wfh_selfies
    selfies_dir = os.path.join(base_dir, 'wfh_selfies')
    if os.path.exists(selfies_dir):
        for item in os.listdir(selfies_dir):
            if item == '.gitignore':
                continue
            item_path = os.path.join(selfies_dir, item)
            if os.path.isfile(item_path):
                try:
                    os.remove(item_path)
                    print(f"✓ Removed test selfie: {item}")
                except Exception as e:
                    print(f"  Could not remove {item}: {e}")

    # 3. Clean employee_data/employee_data test folders
    emp_data_dir = os.path.join(base_dir, 'employee_data', 'employee_data')
    if os.path.exists(emp_data_dir):
        for item in os.listdir(emp_data_dir):
            if item.lower().startswith('emp') or item.lower() in ['temp', 'temp_uploads']:
                item_path = os.path.join(emp_data_dir, item)
                if os.path.isdir(item_path):
                    try:
                        shutil.rmtree(item_path)
                        print(f"✓ Removed test employee directory: {item}")
                    except Exception as e:
                        print(f"  Could not remove {item}: {e}")

    print("\nDisk test files cleaned!")

if __name__ == '__main__':
    clean_database()
    clean_disk_files()
