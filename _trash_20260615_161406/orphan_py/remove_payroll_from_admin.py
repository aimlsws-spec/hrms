#!/usr/bin/env python3
"""Remove Payroll Section from Admin Dashboard"""

import re

def remove_payroll_from_admin():
    """Remove payroll section from enterprise_portal.html"""
    
    file_path = "enterprise_portal.html"
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    print("Original file size:", len(content), "characters")
    
    # 1. Remove payroll navigation item
    content = re.sub(
        r'<div class="nav-item"[^>]*onclick="showSection\(\'payroll\'\)"[^>]*>.*?</div>\s*',
        '',
        content,
        flags=re.DOTALL
    )
    print("[OK] Removed payroll navigation item")
    
    # 2. Remove payroll section content
    content = re.sub(
        r'<!-- Payroll Section -->.*?<!-- Attendance Section -->',
        '<!-- Attendance Section -->',
        content,
        flags=re.DOTALL
    )
    print("[OK] Removed payroll section content")
    
    # 3. Remove payrollNav from admin navigation array
    content = content.replace(
        "['payrollNav', 'attendanceNav', 'departmentsNav', 'performanceNav', 'auditNav']",
        "['attendanceNav', 'departmentsNav', 'performanceNav', 'auditNav']"
    )
    print("[OK] Removed payrollNav from admin navigation array")
    
    # 4. Remove payroll-related functions
    # Remove viewPayrollSummary function
    content = re.sub(
        r'function viewPayrollSummary\(\).*?}\s*\n',
        '',
        content,
        flags=re.DOTALL
    )
    
    # Remove showPayrollSummaryWidget call
    content = content.replace('showPayrollSummaryWidget();', '')
    
    print("[OK] Removed payroll functions")
    
    # Write back
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("\nNew file size:", len(content), "characters")
    print("\n[SUCCESS] Payroll section removed from admin dashboard!")
    print("\nChanges made:")
    print("  - Removed payroll navigation item")
    print("  - Removed payroll section content")
    print("  - Removed payrollNav from admin navigation")
    print("  - Removed payroll-related functions")
    print("\nPayroll management is now exclusive to Accountant dashboard!")

if __name__ == "__main__":
    remove_payroll_from_admin()
