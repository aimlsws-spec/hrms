import mysql.connector

DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': 'Root@12345',
    'database': 'hrms_complete'
}

# Values from your accountant dashboard
basic_monthly = 25000
hra_percent = 40
special_allowance = 5000
pf_percent = 12
esic_percent = 0.75
tds_percent = 10

# Calculate
hra = (basic_monthly * hra_percent) / 100  # 10,000
gross_monthly = basic_monthly + hra + special_allowance  # 40,000
pf = (basic_monthly * pf_percent) / 100  # 3,000
esic = (gross_monthly * esic_percent) / 100  # 300
tds = (gross_monthly * tds_percent) / 100  # 4,000
total_deductions = pf + esic + tds  # 7,300
net_monthly = gross_monthly - total_deductions  # 32,700

print("Amit Shah Salary Structure (from Accountant Dashboard):")
print(f"  Basic: Rs. {basic_monthly:,.2f}")
print(f"  HRA (40%): Rs. {hra:,.2f}")
print(f"  Special Allowance: Rs. {special_allowance:,.2f}")
print(f"  Gross: Rs. {gross_monthly:,.2f}")
print(f"  PF (12%): Rs. {pf:,.2f}")
print(f"  ESIC (0.75%): Rs. {esic:,.2f}")
print(f"  TDS (10%): Rs. {tds:,.2f}")
print(f"  Total Deductions: Rs. {total_deductions:,.2f}")
print(f"  Net Salary: Rs. {net_monthly:,.2f}")

conn = mysql.connector.connect(**DB_CONFIG)
cursor = conn.cursor()

# Update the salary structure
cursor.execute("""
    UPDATE salary_structures 
    SET basic_salary = %s,
        hra = %s,
        special_allowance = %s,
        transport_allowance = 0,
        medical_allowance = 0,
        gross_salary = %s,
        pf_deduction = %s,
        esic_deduction = %s,
        tds_deduction = %s,
        net_salary = %s,
        annual_ctc = %s,
        status = 'active'
    WHERE employee_id = 'emp004'
""", (
    basic_monthly, hra, special_allowance, gross_monthly,
    pf, esic, tds, net_monthly, gross_monthly * 12
))

# Update employee salary
cursor.execute("UPDATE employees SET salary = %s WHERE employee_id = 'emp004'", (gross_monthly * 12,))

conn.commit()
cursor.close()
conn.close()

print("\n[SUCCESS] Salary structure updated in database!")
