import requests

BASE_URL = "http://localhost:8002"

print("Testing GPS Attendance System...\n")

# Test 1: Get locations
print("1. Testing GET locations...")
try:
    response = requests.get(f"{BASE_URL}/api/gps-attendance/locations")
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"   Found {len(data.get('locations', []))} locations")
    else:
        print(f"   Response: {response.text}")
except Exception as e:
    print(f"   Error: {e}")

# Test 2: Test HTML pages
print("\n2. Testing HTML pages...")
try:
    response = requests.get(f"{BASE_URL}/gps-attendance")
    print(f"   Employee page: {response.status_code}")
except Exception as e:
    print(f"   Error: {e}")

try:
    response = requests.get(f"{BASE_URL}/gps-attendance-admin")
    print(f"   Admin page: {response.status_code}")
except Exception as e:
    print(f"   Error: {e}")

print("\n" + "="*50)
print("IMPORTANT: If you see 404 errors, restart the server!")
print("Stop server (Ctrl+C) and run: python app.py")
print("="*50)
