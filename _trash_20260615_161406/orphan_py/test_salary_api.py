"""
Test Salary Workflow APIs
Run this to verify all endpoints work correctly
"""
import requests
import json

BASE_URL = "http://localhost:8002"

def test_workflow():
    print("=" * 60)
    print("TESTING SALARY WORKFLOW APIs")
    print("=" * 60)
    
    # Test 1: Calculate CTC Breakdown
    print("\n1. Testing CTC Calculation...")
    response = requests.post(f"{BASE_URL}/api/salary/calculate-ctc", json={
        "annual_ctc": 600000,
        "template": "standard"
    })
    print(f"Status: {response.status_code}")
    data = response.json()
    if data.get('success'):
        print("✓ CTC Calculation works!")
        print(f"  Monthly Net Salary: ₹{data['breakdown']['monthly']['net_salary']}")
    else:
        print(f"✗ Failed: {data.get('message')}")
    
    # Test 2: Create Salary Structure
    print("\n2. Testing Salary Structure Creation...")
    response = requests.post(f"{BASE_URL}/api/salary/structure/create", json={
        "employee_id": "EMP001",
        "annual_ctc": 600000,
        "template": "standard",
        "created_by": "HR"
    })
    print(f"Status: {response.status_code}")
    data = response.json()
    if data.get('success'):
        structure_id = data['structure_id']
        print(f"✓ Salary Structure Created! ID: {structure_id}")
    else:
        print(f"✗ Failed: {data.get('message')}")
        return
    
    # Test 3: Approve Salary Structure
    print("\n3. Testing Salary Structure Approval...")
    response = requests.post(f"{BASE_URL}/api/salary/structure/approve", json={
        "structure_id": structure_id,
        "approved_by": "Accountant"
    })
    print(f"Status: {response.status_code}")
    data = response.json()
    if data.get('success'):
        print("✓ Salary Structure Approved!")
    else:
        print(f"✗ Failed: {data.get('message')}")
    
    # Test 4: Activate Salary
    print("\n4. Testing Salary Activation...")
    response = requests.post(f"{BASE_URL}/api/salary/activate", json={
        "employee_id": "EMP001",
        "effective_from": "2024-01-01"
    })
    print(f"Status: {response.status_code}")
    data = response.json()
    if data.get('success'):
        print("✓ Salary Activated!")
    else:
        print(f"✗ Failed: {data.get('message')}")
    
    # Test 5: Get Active Salary
    print("\n5. Testing Get Active Salary...")
    response = requests.get(f"{BASE_URL}/api/salary/active/EMP001")
    print(f"Status: {response.status_code}")
    data = response.json()
    if data.get('success'):
        print("✓ Active Salary Retrieved!")
        print(f"  Annual CTC: ₹{data['structure']['annual_ctc']}")
        print(f"  Net Salary: ₹{data['structure']['net_salary']}")
    else:
        print(f"✗ Failed: {data.get('message')}")
    
    # Test 6: Create Payroll Run
    print("\n6. Testing Payroll Run Creation...")
    response = requests.post(f"{BASE_URL}/api/payroll/run/create", json={
        "month_year": "2024-01",
        "processed_by": "Accountant"
    })
    print(f"Status: {response.status_code}")
    data = response.json()
    if data.get('success'):
        run_id = data['run_id']
        print(f"✓ Payroll Run Created! ID: {run_id}")
        print(f"  Total Employees: {data['total_employees']}")
    else:
        print(f"✗ Failed: {data.get('message')}")
        return
    
    # Test 7: Process Payroll
    print("\n7. Testing Payroll Processing...")
    response = requests.post(f"{BASE_URL}/api/payroll/run/process", json={
        "run_id": run_id
    })
    print(f"Status: {response.status_code}")
    data = response.json()
    if data.get('success'):
        print("✓ Payroll Processed!")
        print(f"  Processed: {data['processed']} employees")
        print(f"  Total Amount: ₹{data['total_amount']}")
    else:
        print(f"✗ Failed: {data.get('message')}")
    
    # Test 8: Get Offer Letter Data
    print("\n8. Testing Offer Letter Data...")
    response = requests.get(f"{BASE_URL}/api/payroll/offer-letter-data/EMP001")
    print(f"Status: {response.status_code}")
    data = response.json()
    if data.get('success'):
        print("✓ Offer Letter Data Retrieved!")
        print(f"  Candidate: {data['data']['candidate_name']}")
        print(f"  CTC: ₹{data['data']['annual_ctc']}")
    else:
        print(f"✗ Failed: {data.get('message')}")
    
    print("\n" + "=" * 60)
    print("✅ ALL TESTS COMPLETED!")
    print("=" * 60)

if __name__ == "__main__":
    print("\nMake sure your FastAPI server is running on http://localhost:8002")
    input("Press Enter to start tests...")
    
    try:
        test_workflow()
    except requests.exceptions.ConnectionError:
        print("\n❌ ERROR: Cannot connect to server!")
        print("Please start the server first: python app.py")
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
