import requests
import json
import sys
import io

# Fix encoding for Windows console
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

BASE_URL = "http://localhost:8002"

print("Testing GPS Attendance System...\n")

# Test 1: Get locations
print("1. Testing GET locations...")
try:
    response = requests.get(f"{BASE_URL}/api/gps-attendance/locations")
    if response.status_code == 200:
        data = response.json()
        print(f"   Success! Found {len(data.get('locations', []))} locations")
        for loc in data.get('locations', []):
            print(f"      - {loc['location_name']}: ({loc['latitude']}, {loc['longitude']}) - {loc['radius_meters']}m")
    else:
        print(f"   ❌ Failed: {response.status_code}")
except Exception as e:
    print(f"   ❌ Error: {e}")

# Test 2: Record a test punch
print("\n2️⃣ Testing POST punch (simulated location)...")
try:
    punch_data = {
        "employee_id": "emp004",
        "punch_type": "IN",
        "latitude": 28.6139,  # Near Head Office
        "longitude": 77.2090,
        "device_info": "Test Device"
    }
    response = requests.post(
        f"{BASE_URL}/api/gps-attendance/punch",
        json=punch_data
    )
    if response.status_code == 200:
        data = response.json()
        print(f"   ✅ Punch recorded!")
        print(f"      Valid: {data.get('is_valid')}")
        print(f"      Distance: {data.get('distance_meters')}m")
        print(f"      Location: {data.get('location_name')}")
    else:
        print(f"   ❌ Failed: {response.status_code}")
except Exception as e:
    print(f"   ❌ Error: {e}")

# Test 3: Get attendance history
print("\n3️⃣ Testing GET attendance history...")
try:
    response = requests.get(f"{BASE_URL}/api/gps-attendance/history/emp004")
    if response.status_code == 200:
        data = response.json()
        records = data.get('records', [])
        print(f"   ✅ Found {len(records)} attendance records")
        if records:
            latest = records[0]
            print(f"      Latest: {latest['punch_type']} at {latest['punch_time']}")
    else:
        print(f"   ❌ Failed: {response.status_code}")
except Exception as e:
    print(f"   ❌ Error: {e}")

# Test 4: Check HTML pages
print("\n4️⃣ Testing HTML pages...")
pages = [
    ("/gps-attendance", "Employee Page"),
    ("/gps-attendance-admin", "Admin Page")
]
for path, name in pages:
    try:
        response = requests.get(f"{BASE_URL}{path}")
        if response.status_code == 200:
            print(f"   ✅ {name}: Accessible")
        else:
            print(f"   ❌ {name}: {response.status_code}")
    except Exception as e:
        print(f"   ❌ {name}: {e}")

print("\n✨ Testing complete!")
print("\n📝 Next Steps:")
print("   1. If tests failed, restart the server: python app.py")
print("   2. Open http://localhost:8002/gps-attendance")
print("   3. Allow location access and test punch IN/OUT")
