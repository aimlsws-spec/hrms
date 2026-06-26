#!/usr/bin/env python3
"""Initialize accountant user in the HRMS system"""

import sys
import os
import json
import hashlib
from datetime import datetime

def init_accountant():
    """Initialize accountant user"""
    print("Initializing Accountant User...")
    print("=" * 60)
    
    # Load existing users
    users_file = "users_data.json"
    
    if not os.path.exists(users_file):
        print(f"ERROR: {users_file} not found")
        return False
    
    with open(users_file, 'r') as f:
        users = json.load(f)
    
    print(f"Loaded {len(users)} existing users")
    
    # Check if accountant already exists
    if "accountant" in users:
        print("\nAccountant user already exists!")
        print("\nAccountant Login Credentials:")
        print("-" * 60)
        print(f"Username: accountant")
        print(f"Password: accountant123")
        print(f"Email: {users['accountant'].get('email')}")
        print(f"Role: {users['accountant'].get('role')}")
        print(f"User ID: {users['accountant'].get('user_id')}")
        print("-" * 60)
        print("\nYou can now login at: http://localhost:8002/login")
        print("After login, you will be redirected to: http://localhost:8002/accountant")
        print("=" * 60)
        return True
    
    # Create accountant user
    accountant_password = "accountant123"
    password_hash = hashlib.sha256(accountant_password.encode()).hexdigest()
    
    accountant_data = {
        "user_id": "acc001",
        "username": "accountant",
        "email": "accountant@company.com",
        "password_hash": password_hash,
        "password": accountant_password,
        "role": "accountant",
        "full_name": "Accountant User",
        "department": "Finance",
        "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "is_active": True,
        "profile_completed": True
    }
    
    # Add to users
    users["accountant"] = accountant_data
    
    # Save back to file
    with open(users_file, 'w') as f:
        json.dump(users, f, indent=2)
    
    print("\nSUCCESS: Accountant user created successfully!")
    print("\nAccountant Login Credentials:")
    print("-" * 60)
    print(f"Username: accountant")
    print(f"Password: accountant123")
    print(f"Email: accountant@company.com")
    print(f"Role: accountant")
    print(f"User ID: acc001")
    print("-" * 60)
    print("\nYou can now login at: http://localhost:8002/login")
    print("After login, you will be redirected to: http://localhost:8002/accountant")
    print("=" * 60)
    return True

if __name__ == "__main__":
    success = init_accountant()
    sys.exit(0 if success else 1)
