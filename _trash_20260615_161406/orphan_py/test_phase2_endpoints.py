import requests
import json

BASE_URL = "http://localhost:8002"

def test_phase2_endpoints():
    """Test all Phase 2 endpoints"""
    
    print("🧪 Testing Phase 2 Endpoints...\n")
    
    # Test 1: Employee Count
    print("1️⃣ Testing Employee Count...")
    try:
        response = requests.get(f"{BASE_URL}/api/employees/count")
        data = response.json()
        print(f"   ✅ Employee Count: {data.get('count', 0)}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # Test 2: Pending Leaves Count
    print("\n2️⃣ Testing Pending Leaves Count...")
    try:
        response = requests.get(f"{BASE_URL}/api/leave-requests/pending/count")
        data = response.json()
        print(f"   ✅ Pending Leaves: {data.get('count', 0)}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # Test 3: All Employees
    print("\n3️⃣ Testing Get All Employees...")
    try:
        response = requests.get(f"{BASE_URL}/api/employees/all")
        data = response.json()
        emp_count = len(data.get('employees', []))
        print(f"   ✅ Retrieved {emp_count} employees")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # Test 4: Employee Details
    print("\n4️⃣ Testing Employee Details...")
    try:
        response = requests.get(f"{BASE_URL}/api/employees/EMP001")
        data = response.json()
        if data.get('success'):
            emp = data.get('employee', {})
            print(f"   ✅ Employee: {emp.get('first_name')} {emp.get('last_name')}")
        else:
            print(f"   ⚠️  No employee found")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # Test 5: GPS Attendance History
    print("\n5️⃣ Testing GPS Attendance History...")
    try:
        response = requests.get(f"{BASE_URL}/api/attendance/gps/employee/EMP001")
        data = response.json()
        record_count = len(data.get('records', []))
        print(f"   ✅ Retrieved {record_count} attendance records")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # Test 6: AI Assistant
    print("\n6️⃣ Testing AI Assistant...")
    try:
        response = requests.post(
            f"{BASE_URL}/api/ai/chat",
            json={"message": "How do I apply for leave?", "user_id": "EMP001"}
        )
        data = response.json()
        if data.get('success'):
            print(f"   ✅ AI Response: {data.get('response')[:50]}...")
        else:
            print(f"   ⚠️  AI not responding")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # Test 7: Announcements
    print("\n7️⃣ Testing Announcements...")
    try:
        response = requests.get(f"{BASE_URL}/api/announcements")
        data = response.json()
        ann_count = len(data.get('announcements', []))
        print(f"   ✅ Retrieved {ann_count} announcements")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    print("\n" + "="*50)
    print("✅ Phase 2 Endpoint Testing Complete!")
    print("="*50)

if __name__ == "__main__":
    print("🚀 HRMS Phase 2 - Endpoint Verification\n")
    test_phase2_endpoints()
