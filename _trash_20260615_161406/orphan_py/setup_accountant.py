"""
Complete Accountant Setup
Adds accountant to BOTH auth system and users_data.json
"""
import sys
sys.path.append('.')
from hrms_agent.auth import UserManager
import json

def setup_accountant():
    print("Setting up Accountant user...")
    
    # Method 1: Add to auth system
    try:
        user_manager = UserManager()
        
        # Check if exists
        users = user_manager.list_users('admin')
        if any(u.get('username') == 'accountant' for u in users):
            print("✅ Accountant already exists in auth system")
        else:
            # Add manually to users list
            import bcrypt
            password_hash = bcrypt.hashpw('accountant123'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            
            new_user = {
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
            
            user_manager.users.append(new_user)
            user_manager._save_users()
            print("✅ Accountant added to auth system")
    except Exception as e:
        print(f"⚠️  Auth system: {e}")
    
    # Method 2: Add to users_data.json
    try:
        with open('users_data.json', 'r') as f:
            data = json.load(f)
            users = data if isinstance(data, list) else data.get('users', [])
        
        if not any(isinstance(u, dict) and u.get('username') == 'accountant' for u in users):
            import bcrypt
            password_hash = bcrypt.hashpw('accountant123'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            
            users.append({
                "user_id": "ACC001",
                "username": "accountant",
                "email": "accountant@company.com",
                "password_hash": password_hash,
                "full_name": "Finance Accountant",
                "role": "accountant",
                "department": "Finance",
                "title": "Senior Accountant",
                "is_active": True,
                "profile_completed": True
            })
            
            with open('users_data.json', 'w') as f:
                json.dump(users, f, indent=2)
            print("✅ Accountant added to users_data.json")
        else:
            print("✅ Accountant already in users_data.json")
    except Exception as e:
        print(f"⚠️  users_data.json: {e}")
    
    print("\n" + "="*50)
    print("✅ SETUP COMPLETE!")
    print("="*50)
    print("\nLogin Credentials:")
    print("  Username: accountant")
    print("  Password: accountant123")
    print("  Role: Accountant")
    print("\nLogin at: http://localhost:8002/login")
    print("Dashboard: http://localhost:8002/accountant")

if __name__ == "__main__":
    setup_accountant()
