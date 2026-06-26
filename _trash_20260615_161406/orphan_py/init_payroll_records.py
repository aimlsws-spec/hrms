"""
Initialize Payroll Records Table
"""

import mysql.connector
import os
from dotenv import load_dotenv

load_dotenv()

DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'user': os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD', 'Root@12345'),
    'database': os.getenv('DB_NAME', 'hrms_complete')
}

def init_payroll_records_table():
    """Create payroll_records table"""
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        # Create payroll_records table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS payroll_records (
                id INT AUTO_INCREMENT PRIMARY KEY,
                employee_id VARCHAR(50) NOT NULL,
                month INT NOT NULL,
                year INT NOT NULL,
                basic_salary DECIMAL(10,2) NOT NULL,
                gross_salary DECIMAL(10,2) NOT NULL,
                overtime_hours DECIMAL(5,2) DEFAULT 0,
                overtime_amount DECIMAL(10,2) DEFAULT 0,
                bonus_amount DECIMAL(10,2) DEFAULT 0,
                total_earnings DECIMAL(10,2) NOT NULL,
                total_deductions DECIMAL(10,2) DEFAULT 0,
                net_salary DECIMAL(10,2) NOT NULL,
                processed_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status VARCHAR(20) DEFAULT 'PENDING',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_payroll (employee_id, month, year),
                INDEX idx_employee (employee_id),
                INDEX idx_month_year (month, year),
                INDEX idx_status (status)
            )
        """)
        
        conn.commit()
        print("[OK] Payroll records table created successfully")
        
        cursor.close()
        conn.close()
        
        return {"success": True, "message": "Payroll records table initialized"}
    except Exception as e:
        print(f"[ERROR] {str(e)}")
        return {"success": False, "message": str(e)}

if __name__ == "__main__":
    print("Initializing Payroll Records Table...")
    result = init_payroll_records_table()
    print(f"\nResult: {result['message']}")
