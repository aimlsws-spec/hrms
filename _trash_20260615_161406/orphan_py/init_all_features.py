"""
Initialize All New Features (F&F, Attendance, Performance)
"""
import mysql.connector

DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': 'Root@12345',
    'database': 'hrms_complete'
}

def init_all_features():
    conn = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor()
    
    print("Creating tables...")
    
    # F&F Settlement
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS final_settlements (
            id INT AUTO_INCREMENT PRIMARY KEY,
            employee_id VARCHAR(50) NOT NULL,
            resignation_date DATE NOT NULL,
            last_working_day DATE NOT NULL,
            notice_period_days INT DEFAULT 0,
            notice_shortfall_days INT DEFAULT 0,
            pending_salary DECIMAL(10,2) DEFAULT 0,
            earned_leave_days INT DEFAULT 0,
            earned_leave_amount DECIMAL(10,2) DEFAULT 0,
            bonus_amount DECIMAL(10,2) DEFAULT 0,
            notice_recovery DECIMAL(10,2) DEFAULT 0,
            advance_recovery DECIMAL(10,2) DEFAULT 0,
            other_deductions DECIMAL(10,2) DEFAULT 0,
            gross_amount DECIMAL(10,2) NOT NULL,
            total_deductions DECIMAL(10,2) NOT NULL,
            net_settlement DECIMAL(10,2) NOT NULL,
            status VARCHAR(20) DEFAULT 'PENDING',
            processed_by VARCHAR(50),
            processed_at TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_employee (employee_id),
            INDEX idx_status (status)
        )
    """)
    print("[OK] final_settlements table created")
    
    # Attendance
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS attendance_records (
            id INT AUTO_INCREMENT PRIMARY KEY,
            employee_id VARCHAR(50) NOT NULL,
            attendance_date DATE NOT NULL,
            check_in TIME,
            check_out TIME,
            status VARCHAR(20) DEFAULT 'PRESENT',
            work_hours DECIMAL(4,2) DEFAULT 0,
            overtime_hours DECIMAL(4,2) DEFAULT 0,
            remarks TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_attendance (employee_id, attendance_date),
            INDEX idx_employee (employee_id),
            INDEX idx_date (attendance_date)
        )
    """)
    print("[OK] attendance_records table created")
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS leave_requests (
            id INT AUTO_INCREMENT PRIMARY KEY,
            employee_id VARCHAR(50) NOT NULL,
            leave_type VARCHAR(30) NOT NULL,
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            days_count INT NOT NULL,
            reason TEXT,
            status VARCHAR(20) DEFAULT 'PENDING',
            approved_by VARCHAR(50),
            approved_at TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_employee (employee_id),
            INDEX idx_status (status)
        )
    """)
    print("[OK] leave_requests table created")
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS leave_balance (
            id INT AUTO_INCREMENT PRIMARY KEY,
            employee_id VARCHAR(50) NOT NULL,
            year INT NOT NULL,
            casual_leave DECIMAL(5,2) DEFAULT 0.5,
            sick_leave DECIMAL(5,2) DEFAULT 0.5,
            earned_leave DECIMAL(5,2) DEFAULT 0.5,
            used_casual DECIMAL(5,2) DEFAULT 0.0,
            used_sick DECIMAL(5,2) DEFAULT 0.0,
            used_earned DECIMAL(5,2) DEFAULT 0.0,
            UNIQUE KEY unique_balance (employee_id, year),
            INDEX idx_employee (employee_id)
        )
    """)
    print("[OK] leave_balance table created")
    
    # Performance
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS performance_reviews (
            id INT AUTO_INCREMENT PRIMARY KEY,
            employee_id VARCHAR(50) NOT NULL,
            review_period VARCHAR(20) NOT NULL,
            review_date DATE NOT NULL,
            reviewer_id VARCHAR(50) NOT NULL,
            technical_skills INT DEFAULT 0,
            communication INT DEFAULT 0,
            teamwork INT DEFAULT 0,
            productivity INT DEFAULT 0,
            leadership INT DEFAULT 0,
            overall_rating DECIMAL(3,2) DEFAULT 0,
            strengths TEXT,
            areas_improvement TEXT,
            goals TEXT,
            comments TEXT,
            status VARCHAR(20) DEFAULT 'DRAFT',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_employee (employee_id),
            INDEX idx_period (review_period)
        )
    """)
    print("[OK] performance_reviews table created")
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS goals (
            id INT AUTO_INCREMENT PRIMARY KEY,
            employee_id VARCHAR(50) NOT NULL,
            goal_title VARCHAR(200) NOT NULL,
            description TEXT,
            target_date DATE,
            status VARCHAR(20) DEFAULT 'IN_PROGRESS',
            progress INT DEFAULT 0,
            created_by VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP NULL,
            INDEX idx_employee (employee_id)
        )
    """)
    print("[OK] goals table created")
    
    conn.commit()
    cursor.close()
    conn.close()
    
    print("\n[SUCCESS] All features initialized!")
    print("\nFeatures added:")
    print("  - Final Settlement (F&F) Calculation")
    print("  - Attendance Management")
    print("  - Leave Management")
    print("  - Performance Reviews")
    print("  - Goal Tracking")

if __name__ == "__main__":
    init_all_features()
