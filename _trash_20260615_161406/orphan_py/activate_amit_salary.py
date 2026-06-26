import mysql.connector
from salary_calculator import SalaryCalculator

DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': 'Root@12345',
    'database': 'hrms_complete'
}

# Set the CTC you created from accountant dashboard
annual_ctc = 800000  # Change this to what you set in accountant dashboard

print(f"Setting up salary structure for Amit Shah (emp004)")
print(f"Annual CTC: Rs. {annual_ctc:,}")

# Calculate breakdown
breakdown = SalaryCalculator.calculate_ctc_breakdown(annual_ctc, 'standard')
monthly = breakdown['monthly']

conn = mysql.connector.connect(**DB_CONFIG)
cursor = conn.cursor()

# Delete old structures
cursor.execute("DELETE FROM salary_structures WHERE employee_id = 'emp004'")

# Insert new active structure
cursor.execute("""
    INSERT INTO salary_structures 
    (employee_id, annual_ctc, template, basic_salary, hra, 
     special_allowance, transport_allowance, medical_allowance,
     pf_employer, pf_employee, professional_tax, 
     gross_salary, pf_deduction, esic_deduction, tds_deduction, net_salary, 
     status, created_by, effective_date, created_at)
    VALUES ('emp004', %s, 'standard', %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 
            'active', 'Accountant', CURDATE(), NOW())
""", (
    annual_ctc,
    monthly['basic'], monthly['hra'], monthly['special_allowance'],
    monthly['transport_allowance'], monthly['medical_allowance'],
    monthly['pf_employer'], monthly['pf_employee'], monthly['professional_tax'],
    monthly['gross'], monthly['pf_employee'], 0, 0, monthly['net_salary']
))

# Update employee salary
cursor.execute("UPDATE employees SET salary = %s WHERE employee_id = 'emp004'", (annual_ctc,))

conn.commit()
cursor.close()
conn.close()

print("\n[SUCCESS] Salary structure activated!")
print(f"  Basic: Rs. {monthly['basic']:,.2f}")
print(f"  HRA: Rs. {monthly['hra']:,.2f}")
print(f"  Gross: Rs. {monthly['gross']:,.2f}")
print(f"  Net: Rs. {monthly['net_salary']:,.2f}")
