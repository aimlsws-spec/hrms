import mysql.connector

DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': 'Root@12345',
    'database': 'hrms_complete'
}

conn = mysql.connector.connect(**DB_CONFIG)
cursor = conn.cursor(dictionary=True)

# Check Amit Shah
cursor.execute("SELECT * FROM employees WHERE employee_id = 'EMP004'")
emp = cursor.fetchone()
print(f"Employee: {emp['first_name']} {emp['last_name']} ({emp['employee_id']})")
print(f"Current Salary in employees table: Rs. {emp.get('salary', 'N/A')}")

# Check salary structure
cursor.execute("""
    SELECT * FROM salary_structures 
    WHERE employee_id = 'EMP004' AND status = 'active'
    ORDER BY created_at DESC LIMIT 1
""")
structure = cursor.fetchone()

if structure:
    print(f"\n[SALARY STRUCTURE - ACTIVE]")
    print(f"  Annual CTC: Rs. {structure['annual_ctc']:,.2f}")
    print(f"  Basic: Rs. {structure['basic_salary']:,.2f}")
    print(f"  HRA: Rs. {structure['hra']:,.2f}")
    print(f"  Gross: Rs. {structure['gross_salary']:,.2f}")
    print(f"  Net: Rs. {structure['net_salary']:,.2f}")
else:
    print("\n[NO ACTIVE SALARY STRUCTURE FOUND]")

# Check bonuses
cursor.execute("""
    SELECT * FROM bonuses 
    WHERE employee_id = 'EMP004'
    ORDER BY created_at DESC
""")
bonuses = cursor.fetchall()

if bonuses:
    print(f"\n[BONUSES]")
    for b in bonuses:
        print(f"  - {b['bonus_type']}: Rs. {b['amount']:,.2f} (Month: {b['bonus_month']})")
else:
    print("\n[NO BONUSES FOUND]")

cursor.close()
conn.close()
