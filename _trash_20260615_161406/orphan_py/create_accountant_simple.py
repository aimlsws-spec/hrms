"""
Create Accountant User - Simple Version
"""
import json
import bcrypt
from pathlib import Path

def create_accountant():
    users_file = Path("users_data.json")
    
    # Load existing users
    if users_file.exists():
        with open(users_file, 'r') as f:
            data = json.load(f)
            # Handle both list and dict formats
            users = data if isinstance(data, list) else data.get('users', [])
    else:
        users = []
    
    # Check if accountant already exists
    if any(isinstance(u, dict) and u.get('username') == 'accountant' for u in users):
        print("⚠️  Accountant user already exists!")
        print("\nLogin Credentials:")
        print("Username: accountant")
        print("Password: accountant123")
        return
    
    # Create accountant user
    password_hash = bcrypt.hashpw('accountant123'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    accountant_user = {
        "user_id": "ACC001",
        "username": "accountant",
        "email": "accountant@company.com",
        "password_hash": password_hash,
        "full_name": "Finance Accountant",
        "role": "accountant",
        "department": "Finance",
        "title": "Senior Accountant",
        "is_active": True,
        "profile_completed": True,
        "created_at": "2024-01-01T00:00:00"
    }
    
    users.append(accountant_user)
    
    # Save back to file
    with open(users_file, 'w') as f:
        json.dump(users, f, indent=2)
    
    print("✅ Accountant user created successfully!")
    print("\nLogin Credentials:")
    print("Username: accountant")
    print("Password: accountant123")
    print("Role: Accountant")
    print("\nAccess: http://localhost:8002/login")

if __name__ == "__main__":
    create_accountant()
