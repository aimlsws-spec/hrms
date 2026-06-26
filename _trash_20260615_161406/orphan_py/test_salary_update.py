"""
Test Salary Structure Update Workflow
Demonstrates automatic document deletion and regeneration
"""

import requests
import json

BASE_URL = "http://localhost:8002"

def test_salary_structure_update():
    """Test the complete salary structure update workflow"""
    
    print("=" * 60)
    print("SALARY STRUCTURE UPDATE WORKFLOW TEST")
    print("=" * 60)
    
    # Example: Update Amit Shah's salary structure
    employee_id = "EMP029"  # Amit Shah's ID
    new_annual_ctc = 1200000  # 12 LPA
    
    print(f"\n1. Updating salary structure for {employee_id}")
    print(f"   New Annual CTC: Rs. {new_annual_ctc:,}")
    
    # Call the update endpoint
    response = requests.post(
        f"{BASE_URL}/api/salary/structure/create",
        json={
            "employee_id": employee_id,
            "annual_ctc": new_annual_ctc,
            "template": "standard",
            "created_by": "Accountant"
        }
    )
    
    result = response.json()
    
    if result.get("success"):
        print("\n[SUCCESS]")
        print(f"   - Old documents deleted")
        print(f"   - New salary structure created and activated")
        print(f"   - Structure ID: {result.get('structure_id')}")
        
        # Show generated documents
        documents = result.get("documents", [])
        if documents:
            print(f"\n[DOCUMENTS] Generated Documents:")
            for doc in documents:
                print(f"   - {doc['type']}: {doc['filename']}")
                print(f"     Download: {doc['download_url']}")
        
        # Show breakdown
        breakdown = result.get("breakdown", {})
        if breakdown:
            monthly = breakdown.get("monthly", {})
            print(f"\n[SALARY] Salary Breakdown (Monthly):")
            print(f"   - Basic Salary: Rs. {monthly.get('basic', 0):,.2f}")
            print(f"   - HRA: Rs. {monthly.get('hra', 0):,.2f}")
            print(f"   - Special Allowance: Rs. {monthly.get('special_allowance', 0):,.2f}")
            print(f"   - Gross Salary: Rs. {monthly.get('gross', 0):,.2f}")
            print(f"   - Total Deductions: Rs. {monthly.get('total_deductions', 0):,.2f}")
            print(f"   - Net Salary: Rs. {monthly.get('net_salary', 0):,.2f}")
    else:
        print(f"\n[FAILED]: {result.get('message')}")
    
    print("\n" + "=" * 60)

def test_update_existing_employee():
    """Test updating an existing employee's salary"""
    
    print("\n" + "=" * 60)
    print("UPDATE EXISTING EMPLOYEE SALARY")
    print("=" * 60)
    
    employee_id = "EMP029"
    new_ctc = 1500000  # 15 LPA
    
    print(f"\nUpdating {employee_id} to Rs. {new_ctc:,} per annum")
    
    response = requests.put(
        f"{BASE_URL}/api/salary/structure/update/{employee_id}",
        json={
            "annual_ctc": new_ctc,
            "template": "standard",
            "updated_by": "Accountant"
        }
    )
    
    result = response.json()
    
    if result.get("success"):
        print("\n[SUCCESS] Salary structure updated successfully!")
        documents = result.get("documents", [])
        if documents:
            print(f"\n[DOCUMENTS] New Documents Generated:")
            for doc in documents:
                print(f"   - {doc['filename']}")
    else:
        print(f"\n[FAILED] Update failed: {result.get('message')}")
    
    print("\n" + "=" * 60)

if __name__ == "__main__":
    print("\nMake sure the HRMS server is running on localhost:8002")
    print("Press Enter to start the test...")
    input()
    
    # Test 1: Create new salary structure
    test_salary_structure_update()
    
    # Test 2: Update existing salary structure
    print("\nPress Enter to test updating existing salary...")
    input()
    test_update_existing_employee()
    
    print("\n[SUCCESS] All tests completed!")
