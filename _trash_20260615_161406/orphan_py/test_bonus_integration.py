"""
Test salary slip with bonus
"""

from hrms_agent.documents import DocumentGenerator
import mysql.connector

DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': 'Root@12345',
    'database': 'hrms_complete'
}

def test_salary_slip_with_bonus():
    print("=" * 60)
    print("TESTING SALARY SLIP WITH BONUS")
    print("=" * 60)
    
    employee_id = "EMP029"
    
    # Get employee data
    conn = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor(dictionary=True)
    
    # Get employee
    cursor.execute("""
        SELECT employee_id, CONCAT(first_name, ' ', last_name) as name, 
               title, department
        FROM employees WHERE employee_id = %s
    """, (employee_id,))
    employee = cursor.fetchone()
    
    if not employee:
        print(f"Employee {employee_id} not found!")
        return
    
    print(f"\nEmployee: {employee['name']}")
    print(f"ID: {employee['employee_id']}")
    
    # Check salary structure
    cursor.execute("""
        SELECT * FROM salary_structures 
        WHERE employee_id = %s AND status = 'active'
        ORDER BY created_at DESC LIMIT 1
    """, (employee_id,))
    salary_structure = cursor.fetchone()
    
    if salary_structure:
        print(f"\n[SALARY STRUCTURE]")
        print(f"  Basic: Rs. {salary_structure['basic_salary']:,.2f}")
        print(f"  HRA: Rs. {salary_structure['hra']:,.2f}")
        print(f"  Gross: Rs. {salary_structure['gross_salary']:,.2f}")
        print(f"  Net: Rs. {salary_structure['net_salary']:,.2f}")
    else:
        print("\n[WARNING] No active salary structure found!")
    
    # Check bonuses
    month_year = "2025-01"  # Current month
    cursor.execute("""
        SELECT * FROM bonuses 
        WHERE employee_id = %s AND bonus_month = %s
    """, (employee_id, month_year))
    bonuses = cursor.fetchall()
    
    total_bonus = sum(float(b['amount']) for b in bonuses)
    
    if bonuses:
        print(f"\n[BONUSES]")
        for bonus in bonuses:
            print(f"  - {bonus['bonus_type']}: Rs. {bonus['amount']:,.2f}")
        print(f"  Total Bonus: Rs. {total_bonus:,.2f}")
    else:
        print("\n[INFO] No bonuses for current month")
    
    cursor.close()
    conn.close()
    
    # Generate salary slip
    print(f"\n[GENERATING SALARY SLIP]")
    doc_gen = DocumentGenerator()
    
    try:
        result = doc_gen.generate_salary_slip(employee)
        print(f"\n[SUCCESS]")
        print(f"  PDF: {result['pdf_path']}")
        print(f"  Gross: {result['gross_salary']}")
        print(f"  Net: {result['net_salary']}")
        
        if total_bonus > 0:
            print(f"  Bonus Included: Rs. {total_bonus:,.2f}")
    except Exception as e:
        print(f"\n[ERROR] {e}")
    
    print("\n" + "=" * 60)

if __name__ == "__main__":
    test_salary_slip_with_bonus()
