"""
Create Accountant User
Run this to add an accountant user to the system
"""
import sys
sys.path.append('.')

from hrms_agent.auth import UserManager

def create_accountant():
    user_manager = UserManager()
    
    # Create accountant user
    result = user_manager.create_user(
        username="accountant",
        password="accountant123",
        email="accountant@company.com",
        full_name="Finance Accountant",
        role="accountant",  # New role
        department="Finance",
        title="Senior Accountant"
    )
    
    if result["success"]:
        print("✅ Accountant user created successfully!")
        print("\nLogin Credentials:")
        print("Username: accountant")
        print("Password: accountant123")
        print("Role: Accountant")
        print("\nAccess: http://localhost:8002/accountant")
    else:
        print(f"❌ Error: {result['message']}")

if __name__ == "__main__":
    create_accountant()
