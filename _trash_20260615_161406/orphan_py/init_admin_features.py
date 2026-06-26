"""
Initialize Admin Features Database Tables
Run this script to create all required tables for admin features
"""
import mysql.connector

DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': 'Root@12345',
    'database': 'hrms_complete'
}

def init_admin_features_db():
    """Initialize all admin feature tables"""
    conn = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor()
    
    print("Creating admin features tables...")
    
    # Read and execute SQL schema
    with open('admin_features_schema.sql', 'r') as f:
        sql_commands = f.read().split(';')
        
        for command in sql_commands:
            command = command.strip()
            if command:
                try:
                    cursor.execute(command)
                    print(f"✓ Executed: {command[:50]}...")
                except Exception as e:
                    print(f"✗ Error: {e}")
                    print(f"  Command: {command[:100]}")
    
    conn.commit()
    print("\n✅ All tables created successfully!")
    
    # Initialize default data
    print("\nInitializing default data...")
    
    # Default departments
    try:
        cursor.execute("""
            INSERT IGNORE INTO departments (name, description) VALUES
            ('Engineering', 'Software Development and Engineering'),
            ('Human Resources', 'HR and People Operations'),
            ('Finance', 'Finance and Accounting'),
            ('Sales', 'Sales and Business Development'),
            ('Marketing', 'Marketing and Communications')
        """)
        print("✓ Default departments created")
    except Exception as e:
        print(f"✗ Departments error: {e}")
    
    # Default company settings
    try:
        cursor.execute("""
            INSERT INTO company_settings (setting_key, setting_value) VALUES
            ('working_days', '["Monday","Tuesday","Wednesday","Thursday","Friday"]')
            ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)
        """)
        print("✓ Default working days configured")
    except Exception as e:
        print(f"✗ Settings error: {e}")
    
    # Default holidays for 2025
    try:
        cursor.execute("""
            INSERT IGNORE INTO holidays (date, name, description) VALUES
            ('2025-01-26', 'Republic Day', 'National Holiday'),
            ('2025-08-15', 'Independence Day', 'National Holiday'),
            ('2025-10-02', 'Gandhi Jayanti', 'National Holiday'),
            ('2025-12-25', 'Christmas', 'National Holiday')
        """)
        print("✓ Default holidays added")
    except Exception as e:
        print(f"✗ Holidays error: {e}")
    
    conn.commit()
    conn.close()
    
    print("\n🎉 Admin features database initialization complete!")
    print("\nNext steps:")
    print("1. Restart your FastAPI server: python app.py")
    print("2. Open enterprise_portal.html in your browser")
    print("3. Login as admin to access all features")

if __name__ == "__main__":
    try:
        init_admin_features_db()
    except Exception as e:
        print(f"\n❌ Error: {e}")
        print("\nMake sure:")
        print("1. MySQL server is running")
        print("2. Database 'hrms_complete' exists")
        print("3. Credentials in DB_CONFIG are correct")
