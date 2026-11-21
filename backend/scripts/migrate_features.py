"""Database migration script for new features:
1. Yearly leave balances, carry-forward, and totals.
2. Punch in/out locations (coordinates and addresses) for attendance and wfh_attendance.
3. Flexible geo-location settings.
4. Breaks table column adjustments.
"""

from datetime import datetime
import mysql.connector
from backend.config import DB_CONFIG

def run_migration():
    conn = mysql.connector.connect(**DB_CONFIG)
    cur = conn.cursor()
    current_year = datetime.now().year

    # Helper to check columns
    def get_columns(table):
        cur.execute(f"SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '{table}'")
        return [r[0] for r in cur.fetchall()]

    print("--- 1. Migrating leave_balance ---")
    cols = get_columns('leave_balance')
    if 'year' not in cols:
        cur.execute(f"ALTER TABLE leave_balance ADD COLUMN year INT NOT NULL DEFAULT {current_year}")
        print("Added year column to leave_balance")
    if 'casual_total' not in cols:
        cur.execute("ALTER TABLE leave_balance ADD COLUMN casual_total DECIMAL(5,2) NOT NULL DEFAULT 12.00")
        print("Added casual_total column to leave_balance")
    if 'sick_total' not in cols:
        cur.execute("ALTER TABLE leave_balance ADD COLUMN sick_total DECIMAL(5,2) NOT NULL DEFAULT 12.00")
        print("Added sick_total column to leave_balance")
    if 'earned_total' not in cols:
        cur.execute("ALTER TABLE leave_balance ADD COLUMN earned_total DECIMAL(5,2) NOT NULL DEFAULT 12.00")
        print("Added earned_total column to leave_balance")

    cur.execute("ALTER TABLE leave_balance MODIFY casual_leave DECIMAL(5,2) NOT NULL DEFAULT 12.00")
    cur.execute("ALTER TABLE leave_balance MODIFY sick_leave DECIMAL(5,2) NOT NULL DEFAULT 12.00")
    cur.execute("ALTER TABLE leave_balance MODIFY earned_leave DECIMAL(5,2) NOT NULL DEFAULT 12.00")

    # Update existing balances that had monthly placeholder (<= 0.5) to yearly 12.0
    cur.execute(f"""
        UPDATE leave_balance
        SET year = {current_year},
            casual_total = 12.00,
            sick_total = 12.00,
            earned_total = 12.00,
            casual_leave = CASE WHEN casual_leave <= 0.5 THEN 12.00 ELSE casual_leave END,
            sick_leave = CASE WHEN sick_leave <= 0.5 THEN 12.00 ELSE sick_leave END,
            earned_leave = CASE WHEN earned_leave <= 0.5 THEN 12.00 ELSE earned_leave END
    """)

    print("--- 2. Updating leave_ledger transaction_type ---")
    cur.execute("ALTER TABLE leave_ledger MODIFY transaction_type VARCHAR(30) NOT NULL")

    print("--- 3. Migrating wfh_attendance for punch out locations ---")
    wfh_cols = get_columns('wfh_attendance')
    if 'punch_out_latitude' not in wfh_cols:
        cur.execute("ALTER TABLE wfh_attendance ADD COLUMN punch_out_latitude DECIMAL(10,8) NULL")
        print("Added punch_out_latitude to wfh_attendance")
    if 'punch_out_longitude' not in wfh_cols:
        cur.execute("ALTER TABLE wfh_attendance ADD COLUMN punch_out_longitude DECIMAL(11,8) NULL")
        print("Added punch_out_longitude to wfh_attendance")
    if 'punch_out_distance_meters' not in wfh_cols:
        cur.execute("ALTER TABLE wfh_attendance ADD COLUMN punch_out_distance_meters DECIMAL(10,2) NULL")
        print("Added punch_out_distance_meters to wfh_attendance")
    if 'punch_in_address' not in wfh_cols:
        cur.execute("ALTER TABLE wfh_attendance ADD COLUMN punch_in_address VARCHAR(500) NULL")
        print("Added punch_in_address to wfh_attendance")
    if 'punch_out_address' not in wfh_cols:
        cur.execute("ALTER TABLE wfh_attendance ADD COLUMN punch_out_address VARCHAR(500) NULL")
        print("Added punch_out_address to wfh_attendance")

    print("--- 4. Migrating attendance table for punch locations and work mode ---")
    att_cols = get_columns('attendance')
    if 'punch_in_latitude' not in att_cols:
        cur.execute("ALTER TABLE attendance ADD COLUMN punch_in_latitude DECIMAL(10,8) NULL")
        print("Added punch_in_latitude to attendance")
    if 'punch_in_longitude' not in att_cols:
        cur.execute("ALTER TABLE attendance ADD COLUMN punch_in_longitude DECIMAL(11,8) NULL")
        print("Added punch_in_longitude to attendance")
    if 'punch_out_latitude' not in att_cols:
        cur.execute("ALTER TABLE attendance ADD COLUMN punch_out_latitude DECIMAL(10,8) NULL")
        print("Added punch_out_latitude to attendance")
    if 'punch_out_longitude' not in att_cols:
        cur.execute("ALTER TABLE attendance ADD COLUMN punch_out_longitude DECIMAL(11,8) NULL")
        print("Added punch_out_longitude to attendance")
    if 'punch_in_address' not in att_cols:
        cur.execute("ALTER TABLE attendance ADD COLUMN punch_in_address VARCHAR(500) NULL")
        print("Added punch_in_address to attendance")
    if 'punch_out_address' not in att_cols:
        cur.execute("ALTER TABLE attendance ADD COLUMN punch_out_address VARCHAR(500) NULL")
        print("Added punch_out_address to attendance")
    if 'work_mode' not in att_cols:
        cur.execute("ALTER TABLE attendance ADD COLUMN work_mode VARCHAR(20) NULL")
        print("Added work_mode to attendance")

    print("--- 5. Migrating attendance_breaks table ---")
    brk_cols = get_columns('attendance_breaks')
    cur.execute("ALTER TABLE attendance_breaks MODIFY wfh_attendance_id INT NULL")
    if 'attendance_id' not in brk_cols:
        cur.execute("ALTER TABLE attendance_breaks ADD COLUMN attendance_id INT NULL AFTER wfh_attendance_id")
        print("Added attendance_id to attendance_breaks")

    print("--- 6. Setting up wfh_system_config defaults for flexible geo ---")
    configs = [
        ('wfh_geo_enforce', '0', 'Enforce strict WFH geofence: 1=strict, 0=flexible'),
        ('office_geo_enforce', '0', 'Enforce strict Office geofence: 1=strict, 0=flexible'),
        ('wfh_geo_radius_meters', '500', 'WFH geofence radius in meters'),
        ('office_geo_radius_meters', '300', 'Office geofence radius in meters'),
    ]
    for key, val, desc in configs:
        cur.execute("""
            INSERT INTO wfh_system_config (config_key, config_value, description)
            VALUES (%s, %s, %s)
            ON DUPLICATE KEY UPDATE description = VALUES(description)
        """, (key, val, desc))

    conn.commit()
    cur.close()
    conn.close()
    print("Migration finished successfully!")

if __name__ == '__main__':
    run_migration()
