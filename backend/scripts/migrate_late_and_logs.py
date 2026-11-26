import mysql.connector
from backend.config import DB_CONFIG

def migrate():
    conn = mysql.connector.connect(**DB_CONFIG)
    cur = conn.cursor(dictionary=True)

    # 1. Update attendance_deductions table with review columns
    cur.execute("DESCRIBE attendance_deductions")
    cols = [c['Field'] for c in cur.fetchall()]
    print("Existing cols in attendance_deductions:", cols)

    if 'status' not in cols:
        cur.execute("ALTER TABLE attendance_deductions ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'PENDING_REVIEW'")
        print("Added status column to attendance_deductions")

    if 'reviewed_by' not in cols:
        cur.execute("ALTER TABLE attendance_deductions ADD COLUMN reviewed_by VARCHAR(50) NULL")
        print("Added reviewed_by column to attendance_deductions")

    if 'reviewed_at' not in cols:
        cur.execute("ALTER TABLE attendance_deductions ADD COLUMN reviewed_at DATETIME NULL")
        print("Added reviewed_at column to attendance_deductions")

    if 'review_notes' not in cols:
        cur.execute("ALTER TABLE attendance_deductions ADD COLUMN review_notes TEXT NULL")
        print("Added review_notes column to attendance_deductions")

    # 2. Create hr_activity_logs table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS hr_activity_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        performed_by VARCHAR(50) NOT NULL,
        performed_name VARCHAR(100) NOT NULL,
        performed_role VARCHAR(50) DEFAULT 'hr',
        action VARCHAR(100) NOT NULL,
        target_employee_id VARCHAR(50) NULL,
        target_employee_name VARCHAR(100) NULL,
        details TEXT NOT NULL,
        ip_address VARCHAR(45) DEFAULT '127.0.0.1',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_hr_act_user (performed_by),
        INDEX idx_hr_act_target (target_employee_id),
        INDEX idx_hr_act_created (created_at)
    )
    """)
    print("hr_activity_logs table checked/created")

    conn.commit()
    cur.close()
    conn.close()
    print("Step 1 DB migrations successfully executed!")

if __name__ == '__main__':
    migrate()
