#!/usr/bin/env python3
"""Verify accountant setup and configuration"""

import sys
import os
import json

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def verify_setup():
    """Verify accountant setup"""
    print("\n" + "=" * 70)
    print("ACCOUNTANT SETUP VERIFICATION")
    print("=" * 70)
    
    checks_passed = 0
    checks_total = 0
    
    # Check 1: Verify users_data.json exists
    checks_total += 1
    print("\n[1/5] Checking users_data.json...")
    if os.path.exists("users_data.json"):
        print("  ✓ users_data.json found")
        checks_passed += 1
        
        # Check if accountant user exists in file
        try:
            with open("users_data.json", "r") as f:
                users = json.load(f)
                if "accountant" in users:
                    print("  ✓ Accountant user found in users_data.json")
                    print(f"    - User ID: {users['accountant'].get('user_id')}")
                    print(f"    - Email: {users['accountant'].get('email')}")
                    print(f"    - Role: {users['accountant'].get('role')}")
                    print(f"    - Active: {users['accountant'].get('is_active')}")
                else:
                    print("  ✗ Accountant user NOT found in users_data.json")
                    print("    Run: python init_accountant.py")
        except Exception as e:
            print(f"  ✗ Error reading users_data.json: {e}")
    else:
        print("  ✗ users_data.json not found")
        print("    Run: python init_accountant.py")
    
    # Check 2: Verify accountant dashboard exists
    checks_total += 1
    print("\n[2/5] Checking accountant dashboard files...")
    dashboard_files = [
        "accountant_dashboard.html",
        "accountant_dashboard_new.html"
    ]
    found_dashboard = False
    for file in dashboard_files:
        if os.path.exists(file):
            print(f"  ✓ {file} found")
            found_dashboard = True
            break
    
    if found_dashboard:
        checks_passed += 1
    else:
        print("  ✗ No accountant dashboard file found")
    
    # Check 3: Verify app.py has accountant route
    checks_total += 1
    print("\n[3/5] Checking accountant route in app.py...")
    if os.path.exists("app.py"):
        with open("app.py", "r", encoding="utf-8") as f:
            content = f.read()
            if '/accountant' in content and 'accountant_dashboard' in content:
                print("  ✓ Accountant route found in app.py")
                checks_passed += 1
            else:
                print("  ✗ Accountant route NOT found in app.py")
    else:
        print("  ✗ app.py not found")
    
    # Check 4: Verify index.html has accountant redirect
    checks_total += 1
    print("\n[4/5] Checking login redirect logic...")
    if os.path.exists("index.html"):
        with open("index.html", "r", encoding="utf-8") as f:
            content = f.read()
            if "role === 'accountant'" in content:
                print("  ✓ Accountant redirect logic found in index.html")
                checks_passed += 1
            else:
                print("  ✗ Accountant redirect logic NOT found")
    else:
        print("  ✗ index.html not found")
    
    # Check 5: Verify auth.py has accountant role
    checks_total += 1
    print("\n[5/5] Checking accountant role in auth.py...")
    auth_file = os.path.join("hrms_agent", "auth.py")
    if os.path.exists(auth_file):
        with open(auth_file, "r", encoding="utf-8") as f:
            content = f.read()
            if '"accountant"' in content or "'accountant'" in content:
                print("  ✓ Accountant role found in auth.py")
                checks_passed += 1
            else:
                print("  ✗ Accountant role NOT found in auth.py")
    else:
        print("  ✗ auth.py not found")
    
    # Summary
    print("\n" + "=" * 70)
    print(f"VERIFICATION SUMMARY: {checks_passed}/{checks_total} checks passed")
    print("=" * 70)
    
    if checks_passed == checks_total:
        print("\n✓ ALL CHECKS PASSED! Accountant setup is complete.")
        print("\nNext Steps:")
        print("1. Start the server: python app.py")
        print("2. Navigate to: http://localhost:8002/login")
        print("3. Login with:")
        print("   Username: accountant")
        print("   Password: accountant123")
        print("4. You will be redirected to the Accountant Dashboard")
    else:
        print(f"\n✗ {checks_total - checks_passed} check(s) failed.")
        print("\nTo fix:")
        print("1. Run: python init_accountant.py")
        print("2. Verify all files are in place")
        print("3. Run this verification again")
    
    print("\n" + "=" * 70 + "\n")
    
    return checks_passed == checks_total

if __name__ == "__main__":
    success = verify_setup()
    sys.exit(0 if success else 1)
