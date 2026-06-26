#!/usr/bin/env python3
"""
Test document generation
"""

from document_generator import DocumentGenerator
from datetime import datetime

def test_salary_slip():
    try:
        doc_gen = DocumentGenerator()
        
        salary_data = {
            'employee_id': 'emp004',
            'employee_name': 'Test Employee',
            'department': 'General',
            'position': 'Employee',
            'month_year': datetime.now().strftime('%Y-%m'),
            'basic_salary': 25000,
            'hra': 10000,
            'transport': 2000,
            'medical': 1500,
            'gross_salary': 50000,
            'pf_deduction': 6000,
            'tax_deduction': 5000,
            'total_deductions': 11000,
            'net_salary': 39000
        }
        
        filename = doc_gen.generate_salary_slip(salary_data)
        print(f"Generated: {filename}")
        return filename
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == "__main__":
    test_salary_slip()