"""
Run once to create the attendance_regularization table in the active HRMS database.
Uses the same DB_CONFIG as app.py (reads from config.py / .env).

Usage:
    python setup_regularization.py
"""
import mysql.connector
from config import DB_CONFIG

CREATE_SQL = """
CREATE TABLE IF NOT EXISTS attendance_regularization (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    employee_id         VARCHAR(50)  NOT NULL,
    attendance_date     DATE         NOT NULL,
    original_check_in   TIME,
    original_check_out  TIME,
    requested_check_in  TIME         NOT NULL,
    requested_check_out TIME         NOT NULL,
    reason              TEXT         NOT NULL,
    status              ENUM('Pending', 'Approved', 'Rejected') DEFAULT 'Pending',
    approved_by         VARCHAR(100),
    approval_comments   TEXT,
    approved_at         TIMESTAMP    NULL,
    created_at          TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_employee  (employee_id),
    INDEX idx_status    (status),
    INDEX idx_date      (attendance_date)
)
"""

def main():
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor()
        cursor.execute(CREATE_SQL)
        conn.commit()
        cursor.close()
        conn.close()
        print(f"[OK] attendance_regularization table ready in '{DB_CONFIG['database']}'")
    except Exception as e:
        print(f"[ERROR] {e}")

if __name__ == "__main__":
    main()
