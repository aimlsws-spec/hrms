from hrms_agent.documents import DocumentGenerator

# Employee data
employee = {
    'employee_id': 'emp004',
    'name': 'Amit Shah',
    'title': 'Employee',
    'department': 'General'
}

print("Generating salary slip for Amit Shah...")
print("This will use:")
print("  - Salary structure from database (Rs. 40,000 gross)")
print("  - Bonuses from database (Rs. 7,000 total)")

doc_gen = DocumentGenerator()
result = doc_gen.generate_salary_slip(employee)

print(f"\n[SUCCESS] Salary slip generated!")
print(f"  File: {result['pdf_path']}")
print(f"  Gross: {result['gross_salary']}")
print(f"  Net: {result['net_salary']}")
