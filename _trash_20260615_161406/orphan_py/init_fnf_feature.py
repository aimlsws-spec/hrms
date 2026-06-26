"""
Initialize Final Settlement (F&F) Feature
"""
import mysql.connector

DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': 'Root@12345',
    'database': 'hrms_complete'
}

def init_fnf_feature():
    conn = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor()
    
    # Create table
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
    
    conn.commit()
    cursor.close()
    conn.close()
    print("✅ Final Settlement table created successfully!")

if __name__ == "__main__":
    init_fnf_feature()
