"""
Fix salary_structures table - Add missing columns
"""

import mysql.connector

DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': 'Root@12345',
    'database': 'hrms_complete'
}

def fix_salary_structures_table():
    """Check and fix salary_structures table"""
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        # Check if table exists
        cursor.execute("SHOW TABLES LIKE 'salary_structures'")
        table_exists = cursor.fetchone()
        
        if not table_exists:
            print("Creating salary_structures table...")
            cursor.execute("""
                CREATE TABLE salary_structures (
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
            print("[OK] Table created successfully!")
        else:
            print("Table exists. Checking columns...")
            
            # Get existing columns
            cursor.execute("DESCRIBE salary_structures")
            existing_columns = {row[0] for row in cursor.fetchall()}
            
            # Required columns
            required_columns = {
                'annual_ctc': "ADD COLUMN annual_ctc DECIMAL(12,2) NOT NULL AFTER employee_id",
                'template': "ADD COLUMN template VARCHAR(50) DEFAULT 'standard' AFTER annual_ctc",
                'transport_allowance': "ADD COLUMN transport_allowance DECIMAL(12,2) AFTER special_allowance",
                'medical_allowance': "ADD COLUMN medical_allowance DECIMAL(12,2) AFTER transport_allowance",
                'pf_employer': "ADD COLUMN pf_employer DECIMAL(12,2) AFTER medical_allowance",
                'pf_employee': "ADD COLUMN pf_employee DECIMAL(12,2) AFTER pf_employer",
                'professional_tax': "ADD COLUMN professional_tax DECIMAL(12,2) AFTER pf_employee",
                'status': "ADD COLUMN status ENUM('pending', 'approved', 'active', 'inactive') DEFAULT 'pending' AFTER net_salary",
                'approved_by': "ADD COLUMN approved_by VARCHAR(50) AFTER created_by",
                'approved_at': "ADD COLUMN approved_at TIMESTAMP NULL AFTER approved_by"
            }
            
            # Add missing columns
            for col_name, alter_sql in required_columns.items():
                if col_name not in existing_columns:
                    print(f"Adding column: {col_name}")
                    cursor.execute(f"ALTER TABLE salary_structures {alter_sql}")
                    print(f"[OK] Added {col_name}")
            
            print("[OK] All columns verified!")
        
        conn.commit()
        cursor.close()
        conn.close()
        
        print("\n[SUCCESS] salary_structures table is ready!")
        return True
        
    except Exception as e:
        print(f"[ERROR] {e}")
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("FIXING SALARY_STRUCTURES TABLE")
    print("=" * 60)
    fix_salary_structures_table()
