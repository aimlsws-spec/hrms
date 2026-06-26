#!/usr/bin/env python3
"""
Verification Script for Salary Structure & Accountant Implementation
"""

import mysql.connector
import requests
import json

DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': 'Root@12345',
    'database': 'hrms_complete'
}

def test_database():
    """Test database changes"""
    print("=" * 60)
    print("1. Testing Database Changes")
    print("=" * 60)
    
    conn = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor(dictionary=True)
    
    # Check salary column exists
    cursor.execute("SHOW COLUMNS FROM employees LIKE 'salary'")
    result = cursor.fetchone()
    if result:
        print("✓ Salary column exists in employees table")
        print(f"  Type: {result['Type']}")
    else:
        print("✗ Salary column NOT found in employees table")
    
    # Check salary_structures table
    cursor.execute("SHOW TABLES LIKE 'salary_structures'")
    if cursor.fetchone():
        print("✓ salary_structures table exists")
        
        cursor.execute("SELECT COUNT(*) as count FROM salary_structures")
        count = cursor.fetchone()['count']
        print(f"  Total structures: {count}")
        
        cursor.execute("SELECT COUNT(*) as count FROM salary_structures WHERE status='pending'")
        pending = cursor.fetchone()['count']
        print(f"  Pending approvals: {pending}")
        
        cursor.execute("SELECT COUNT(*) as count FROM salary_structures WHERE status='active'")
        active = cursor.fetchone()['count']
        print(f"  Active structures: {active}")
    else:
        print("✗ salary_structures table NOT found")
    
    conn.close()
    print()

def test_api_endpoints():
    """Test API endpoints"""
    print("=" * 60)
    print("2. Testing API Endpoints")
    print("=" * 60)
    
    base_url = "http://localhost:8002"
    
    endpoints = [
        "/api/salary/structures/pending",
        "/api/salary/structures/active/count",
        "/api/salary/structures/total-payroll",
        "/api/salary/structures/all"
    ]
    
    for endpoint in endpoints:
        try:
            response = requests.get(f"{base_url}{endpoint}", timeout=5)
            if response.status_code == 200:
                data = response.json()
                print(f"✓ {endpoint}")
                print(f"  Response: {json.dumps(data, indent=2)[:100]}...")
            else:
                print(f"✗ {endpoint} - Status: {response.status_code}")
        except requests.exceptions.ConnectionError:
            print(f"⚠ {endpoint} - Server not running")
        except Exception as e:
            print(f"✗ {endpoint} - Error: {str(e)}")
    
    print()

def test_files():
    """Test file existence"""
    print("=" * 60)
    print("3. Testing Files")
    print("=" * 60)
    
    import os
    
    files = [
        "accountant_dashboard_new.html",
        "document_generator.py",
        "salary_workflow.py",
        "app.py",
        "IMPLEMENTATION_SUMMARY.md"
    ]
    
    for file in files:
        if os.path.exists(file):
            size = os.path.getsize(file)
            print(f"✓ {file} ({size:,} bytes)")
        else:
            print(f"✗ {file} NOT found")
    
    print()

def test_salary_workflow():
    """Test salary workflow functionality"""
    print("=" * 60)
    print("4. Testing Salary Workflow")
    print("=" * 60)
    
    try:
        from salary_workflow import SalaryWorkflowManager
        from salary_calculator import SalaryCalculator
        
        print("✓ Salary modules imported successfully")
        
        # Test salary calculation
        breakdown = SalaryCalculator.calculate_ctc_breakdown(600000, 'standard')
        print(f"✓ Salary calculation works")
        print(f"  Annual CTC: ₹{breakdown['annual']['gross']:,.2f}")
        print(f"  Monthly Net: ₹{breakdown['monthly']['net_salary']:,.2f}")
        
    except Exception as e:
        print(f"✗ Salary workflow error: {str(e)}")
    
    print()

def main():
    """Run all tests"""
    print("\n" + "=" * 60)
    print("SALARY STRUCTURE & ACCOUNTANT IMPLEMENTATION VERIFICATION")
    print("=" * 60 + "\n")
    
    test_database()
    test_api_endpoints()
    test_files()
    test_salary_workflow()
    
    print("=" * 60)
    print("VERIFICATION COMPLETE")
    print("=" * 60)
    print("\nNext Steps:")
    print("1. Start the server: python app.py")
    print("2. Login as accountant")
    print("3. Navigate to /accountant")
    print("4. Create a salary structure")
    print("5. Approve it")
    print("6. Generate an offer letter")
    print()

if __name__ == "__main__":
    main()
