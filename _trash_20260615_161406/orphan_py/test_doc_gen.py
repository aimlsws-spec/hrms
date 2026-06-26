import sys
sys.path.insert(0, 'c:/hrms_agent')

from hrms_agent.documents import DocumentGenerator

employee = {
    'employee_id': 'emp004',
    'name': 'Amit Shah',
    'title': 'Employee',
    'department': 'General'
}

print("Testing document generation...")
doc_gen = DocumentGenerator()

# This should fetch from database
result = doc_gen.generate_salary_slip(employee, month="December 2025")

print(f"\nGenerated:")
print(f"  Basic: {result.get('basic_salary')}")
print(f"  HRA: {result.get('hra')}")
print(f"  Gross: {result.get('gross_salary')}")
print(f"  Net: {result.get('net_salary')}")
print(f"  PDF: {result.get('pdf_path')}")
