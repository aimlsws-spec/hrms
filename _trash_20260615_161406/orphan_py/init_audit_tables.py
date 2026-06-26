"""
Initialize Audit Tables in MySQL Database
Run this script to create the audit & security tables
"""
import mysql.connector

DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': 'Root@12345',
    'database': 'hrms_complete'
}

def init_audit_tables():
    """Create audit tables if they don't exist"""
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        print("Creating audit tables...")
        
        # Drop existing tables to recreate with correct structure
        cursor.execute("DROP TABLE IF EXISTS admin_activity_logs")
        cursor.execute("DROP TABLE IF EXISTS employee_activity_logs")
        cursor.execute("DROP TABLE IF EXISTS login_history")
        
        # Admin Activity Logs Table
        cursor.execute("""CREATE TABLE admin_activity_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                admin_id VARCHAR(50) NOT NULL,
                admin_name VARCHAR(255) NOT NULL,
                action VARCHAR(255) NOT NULL,
                details TEXT,
                target_employee_id VARCHAR(50),
                ip_address VARCHAR(50),
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_admin_id (admin_id),
                INDEX idx_timestamp (timestamp),
                INDEX idx_action (action)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """)
        print("[OK] admin_activity_logs table created")
        
        # Employee Activity Logs Table
        cursor.execute("""CREATE TABLE employee_activity_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                employee_id VARCHAR(50) NOT NULL,
                employee_name VARCHAR(255) NOT NULL,
                action VARCHAR(255) NOT NULL,
                details TEXT,
                ip_address VARCHAR(50),
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_employee_id (employee_id),
                INDEX idx_timestamp (timestamp),
                INDEX idx_action (action)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """)
        print("[OK] employee_activity_logs table created")
        
        # Login History Table
        cursor.execute("""CREATE TABLE login_history (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id VARCHAR(50) NOT NULL,
                username VARCHAR(255) NOT NULL,
                status ENUM('SUCCESS', 'FAILED', 'LOGOUT', 'OTP_SENT', 'OTP_VERIFIED', 'FORCE_LOGOUT') NOT NULL,
                ip_address VARCHAR(50),
                user_agent TEXT,
                failure_reason VARCHAR(255),
                login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_user_id (user_id),
                INDEX idx_status (status),
                INDEX idx_login_time (login_time)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """)
        print("[OK] login_history table created")
        
        conn.commit()
        
        # Insert sample data for demonstration
        print("\nInserting sample audit data...")
        
        # Sample admin activities
        cursor.execute("""
            INSERT INTO admin_activity_logs (admin_id, admin_name, action, details, target_employee_id, ip_address)
            VALUES 
            ('admin001', 'System Administrator', 'Employee Created', 'Created new employee EMP029', 'EMP029', '192.168.1.100'),
            ('admin001', 'System Administrator', 'Role Changed', 'Changed role from employee to HR', 'EMP003', '192.168.1.100'),
            ('admin001', 'System Administrator', 'Password Reset', 'Reset password for employee', 'EMP015', '192.168.1.100'),
            ('admin001', 'System Administrator', 'Salary Updated', 'Updated salary structure', 'EMP010', '192.168.1.100'),
            ('admin001', 'System Administrator', 'Department Created', 'Created new department: Sales', NULL, '192.168.1.100')
        """)
        
        # Sample employee activities
        cursor.execute("""
            INSERT INTO employee_activity_logs (employee_id, employee_name, action, details, ip_address)
            VALUES 
            ('EMP001', 'Harshit', 'Profile Updated', 'Updated contact information', '192.168.1.50'),
            ('EMP002', 'Rajesh Kumar', 'Leave Applied', 'Applied for casual leave (2 days)', '192.168.1.51'),
            ('EMP003', 'Priya Sharma', 'Document Downloaded', 'Downloaded salary slip for December 2025', '192.168.1.52'),
            ('EMP004', 'Amit Shah', 'Attendance Marked', 'Check-in at 09:15 AM', '192.168.1.53'),
            ('EMP005', 'Sneha Patel', 'Ticket Created', 'Created support ticket #TKT0001', '192.168.1.54')
        """)
        
        # Sample login history
        cursor.execute("""
            INSERT INTO login_history (user_id, username, status, ip_address, user_agent)
            VALUES 
            ('admin001', 'admin', 'SUCCESS', '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'),
            ('EMP001', 'harshit@seawind.in', 'SUCCESS', '192.168.1.50', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'),
            ('EMP002', 'rajesh.kumar@company.com', 'FAILED', '192.168.1.51', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'),
            ('EMP003', 'priya.sharma@company.com', 'SUCCESS', '192.168.1.52', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'),
            ('EMP004', 'amit.shah@company.com', 'SUCCESS', '192.168.1.53', 'Mozilla/5.0 (X11; Linux x86_64)')
        """)
        
        conn.commit()
        print("[OK] Sample data inserted")
        
        cursor.close()
        conn.close()
        
        print("\n[SUCCESS] Audit tables initialized successfully!")
        print("\nYou can now access:")
        print("- Admin Activity Logs: GET /api/audit/admin-logs")
        print("- Employee Activity Logs: GET /api/audit/employee-logs")
        print("- Login History: GET /api/audit/login-history")
        print("- Audit Summary: GET /api/audit/summary")
        
    except Exception as e:
        print(f"[ERROR] Error initializing audit tables: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    init_audit_tables()
