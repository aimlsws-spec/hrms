import mysql.connector

DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': 'Root@12345',
    'database': 'hrms_complete'
}

conn = mysql.connector.connect(**DB_CONFIG)
cursor = conn.cursor(dictionary=True)

# Find who is EMP029
cursor.execute("SELECT employee_id, first_name, last_name FROM employees WHERE employee_id LIKE '%29%'")
employees = cursor.fetchall()

print("Employees with '29' in ID:")
for emp in employees:
    print(f"  {emp['employee_id']}: {emp['first_name']} {emp['last_name']}")

# Check salary structures
cursor.execute("""
    SELECT ss.*, CONCAT(e.first_name, ' ', e.last_name) as name
    FROM salary_structures ss
    JOIN employees e ON ss.employee_id = e.employee_id
    WHERE ss.status = 'active'
    ORDER BY ss.created_at DESC
    LIMIT 5
""")
structures = cursor.fetchall()

print("\nRecent Active Salary Structures:")
for s in structures:
    print(f"  {s['employee_id']} ({s['name']}): Rs. {s['annual_ctc']:,.0f}")

cursor.close()
conn.close()
