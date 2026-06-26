#!/usr/bin/env python3
"""Create accountant user in the system"""

import mysql.connector
import hashlib

DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': 'Root@12345',
    'database': 'hrms_complete'
}

def create_accountant():
    conn = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor()
    
    # Create accountant user
    username = "accountant"
    password = "accountant123"
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    
    # Check if user exists
    cursor.execute("SELECT user_id FROM users WHERE username = %s", (username,))
    if cursor.fetchone():
        print("Accountant user already exists")
        # Update to accountant role
        cursor.execute("UPDATE users SET role = 'accountant' WHERE username = %s", (username,))
        conn.commit()
        print("Updated existing user to accountant role")
    else:
        # Insert new accountant user
        cursor.execute("""
            INSERT INTO users (user_id, username, password_hash, email, full_name, role, is_active, profile_completed)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, ('ACC001', username, password_hash, 'accountant@company.com', 'Accountant User', 'accountant', True, True))
        conn.commit()
        print("Accountant user created successfully")
    
    # Also create employee record
    cursor.execute("SELECT employee_id FROM employees WHERE employee_id = 'ACC001'")
    if not cursor.fetchone():
        cursor.execute("""
            INSERT INTO employees (employee_id, user_id, first_name, last_name, email, department, title, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, ('ACC001', 'ACC001', 'Accountant', 'User', 'accountant@company.com', 'Finance', 'Accountant', 'active'))
        conn.commit()
        print("Employee record created")
    
    conn.close()
    
    print("\n" + "="*50)
    print("ACCOUNTANT LOGIN CREDENTIALS")
    print("="*50)
    print(f"Username: {username}")
    print(f"Password: {password}")
    print("="*50)

if __name__ == "__main__":
    create_accountant()
