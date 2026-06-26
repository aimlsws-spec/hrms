import json
import mysql.connector

DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': 'Root@12345',
    'database': 'hrms_complete'
}

def setup_core_tables():
    conn = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor()
    
    # 1. Create employees table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS employees (
        employee_id VARCHAR(50) PRIMARY KEY,
        first_name VARCHAR(50),
        last_name VARCHAR(50),
        title VARCHAR(50),
        email VARCHAR(100),
        department VARCHAR(50),
        city VARCHAR(50),
        state VARCHAR(50)
    )
    """)
    
    # 2. Create users table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        user_id VARCHAR(50) PRIMARY KEY,
        username VARCHAR(100),
        email VARCHAR(100),
        password_hash VARCHAR(255),
        password VARCHAR(50),
        role VARCHAR(20),
        full_name VARCHAR(100),
        department VARCHAR(50),
        created_at DATETIME,
        is_active BOOLEAN,
        profile_completed BOOLEAN
    )
    """)
    
    # Enable foreign keys just in case? This is just independent tables
    
    # Populate from JSON
    try:
        with open('users_data.json', 'r') as f:
            data = json.load(f)
            
        for key, user in data.items():
            uid = user.get('user_id', '')
            if not uid: continue
                
            # Insert into users
            cursor.execute("""
            INSERT IGNORE INTO users (user_id, username, email, password_hash, password, role, full_name, department, created_at, is_active, profile_completed)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                uid, user.get('username'), user.get('email'), user.get('password_hash'),
                user.get('password'), user.get('role'), user.get('full_name'),
                user.get('department'), user.get('created_at'),
                user.get('is_active', True), user.get('profile_completed', True)
            ))
            
            # Insert into employees
            full_name = user.get('full_name', 'Unknown')
            parts = full_name.split(' ', 1)
            first_name = parts[0]
            last_name = parts[1] if len(parts) > 1 else ''
            
            cursor.execute("""
            INSERT IGNORE INTO employees (employee_id, first_name, last_name, title, email, department, city, state)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                uid, first_name, last_name, user.get('role'), user.get('email'),
                user.get('department'), 'Unknown', 'Unknown'
            ))
            
        conn.commit()
        print("Successfully populated base tables from JSON!")
        
    except Exception as e:
        print("Error populating:", str(e))
        
    cursor.close()
    conn.close()

if __name__ == '__main__':
    setup_core_tables()
