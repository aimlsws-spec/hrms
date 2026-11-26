import sys
import os
sys.path.insert(0, os.path.abspath("."))
import mysql.connector
from backend.config import DB_CONFIG

def migrate():
    conn = mysql.connector.connect(**DB_CONFIG)
    cur = conn.cursor()

    # 1. Update reimbursements table
    print("Checking reimbursements table columns...")
    cur.execute("DESCRIBE reimbursements")
    cols = [r[0] for r in cur.fetchall()]
    
    if "payment_method" not in cols:
        print("Adding payment_method to reimbursements...")
        cur.execute("ALTER TABLE reimbursements ADD COLUMN payment_method VARCHAR(20) DEFAULT 'UPI' AFTER description")
        print("Added payment_method column.")
    else:
        print("payment_method already exists in reimbursements.")

    # 2. Create employee_joining_documents table
    print("Creating employee_joining_documents table if not exists...")
    cur.execute("""
        CREATE TABLE IF NOT EXISTS employee_joining_documents (
            id INT AUTO_INCREMENT PRIMARY KEY,
            employee_id VARCHAR(50) NOT NULL,
            document_type VARCHAR(100) NOT NULL,
            document_name VARCHAR(255) NOT NULL,
            file_path VARCHAR(500) NOT NULL,
            file_type VARCHAR(50),
            file_size INT DEFAULT 0,
            uploaded_by VARCHAR(100),
            uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_emp (employee_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    """)
    print("employee_joining_documents table ready.")

    conn.commit()
    cur.close()
    conn.close()
    print("Database migration completed successfully.")

if __name__ == "__main__":
    migrate()
