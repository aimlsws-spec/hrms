"""
Add test bonus for EMP029
"""

import mysql.connector

DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': 'Root@12345',
    'database': 'hrms_complete'
}

conn = mysql.connector.connect(**DB_CONFIG)
cursor = conn.cursor()

# Add bonus for current month
cursor.execute("""
    INSERT INTO bonuses (employee_id, bonus_type, amount, bonus_month, reason, approved_by)
    VALUES ('EMP029', 'Performance', 10000, '2025-01', 'Excellent performance', 'Accountant')
""")

conn.commit()
cursor.close()
conn.close()

print("Bonus added for EMP029: Rs. 10,000")
