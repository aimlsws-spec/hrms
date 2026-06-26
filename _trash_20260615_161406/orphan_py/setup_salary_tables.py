"""
Run this script to create salary workflow tables
"""
import mysql.connector

DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': 'Root@12345',
    'database': 'hrms_complete'
}

def create_tables():
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        print("Creating salary_structures table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS salary_structures (
                id INT AUTO_INCREMENT PRIMARY KEY,
                employee_id VARCHAR(50) NOT NULL,
                annual_ctc DECIMAL(12,2) NOT NULL,
                template VARCHAR(50) DEFAULT 'standard',
                basic_salary DECIMAL(12,2),
                hra DECIMAL(12,2),
                special_allowance DECIMAL(12,2),
                transport_allowance DECIMAL(12,2),
                medical_allowance DECIMAL(12,2),
                pf_employer DECIMAL(12,2),
                pf_employee DECIMAL(12,2),
                professional_tax DECIMAL(12,2),
                gross_salary DECIMAL(12,2),
                total_deductions DECIMAL(12,2),
                net_salary DECIMAL(12,2),
                status ENUM('pending', 'approved', 'active', 'inactive') DEFAULT 'pending',
                created_by VARCHAR(50),
                approved_by VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                approved_at TIMESTAMP NULL,
                effective_from DATE,
                INDEX idx_employee (employee_id),
                INDEX idx_status (status)
            )
        """)
        print("✓ salary_structures table created")
        
        print("Creating payroll_runs table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS payroll_runs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                run_id VARCHAR(50) UNIQUE NOT NULL,
                month_year VARCHAR(7) NOT NULL,
                total_employees INT DEFAULT 0,
                processed_count INT DEFAULT 0,
                total_amount DECIMAL(15,2) DEFAULT 0,
                status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
                processed_by VARCHAR(50),
                started_at TIMESTAMP NULL,
                completed_at TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_month (month_year),
                INDEX idx_status (status)
            )
        """)
        print("✓ payroll_runs table created")
        
        print("Creating payroll_transactions table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS payroll_transactions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                run_id VARCHAR(50) NOT NULL,
                employee_id VARCHAR(50) NOT NULL,
                month_year VARCHAR(7) NOT NULL,
                salary_structure_id INT,
                gross_salary DECIMAL(12,2),
                total_deductions DECIMAL(12,2),
                net_salary DECIMAL(12,2),
                slip_generated BOOLEAN DEFAULT FALSE,
                slip_filename VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_run (run_id),
                INDEX idx_employee (employee_id),
                INDEX idx_month (month_year)
            )
        """)
        print("✓ payroll_transactions table created")
        
        conn.commit()
        cursor.close()
        conn.close()
        
        print("\n✅ All tables created successfully!")
        print("\nYou can now use the salary workflow:")
        print("1. Create salary structure: POST /api/salary/structure/create")
        print("2. Approve structure: POST /api/salary/structure/approve")
        print("3. Activate salary: POST /api/salary/activate")
        print("4. Process payroll: POST /api/payroll/run/create")
        
    except mysql.connector.Error as err:
        print(f"❌ Error: {err}")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")

if __name__ == "__main__":
    print("Creating salary workflow tables in MySQL...")
    print(f"Database: {DB_CONFIG['database']}")
    print("-" * 50)
    create_tables()
