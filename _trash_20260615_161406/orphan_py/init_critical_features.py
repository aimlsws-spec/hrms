"""
Initialize Critical Features: Shift Management, GPS Attendance, Attendance Regularization
"""

import mysql.connector

DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': 'Root@12345',
    'database': 'hrms_complete'
}

def init_critical_features():
    """Initialize all critical feature tables"""
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        print("Creating tables...")
        
        # Read and execute SQL file
        with open('sql/critical_features.sql', 'r', encoding='utf-8') as f:
            sql_commands = f.read().split(';')
            
            for command in sql_commands:
                command = command.strip()
                if command:
                    try:
                        cursor.execute(command)
                    except mysql.connector.Error as e:
                        if 'already exists' not in str(e).lower() and 'duplicate' not in str(e).lower():
                            print(f"Warning: {e}")
        
        conn.commit()
        cursor.close()
        conn.close()
        
        print("[OK] Critical features initialized successfully!")
        print("[OK] Tables created:")
        print("  - shifts")
        print("  - employee_shifts")
        print("  - gps_attendance")
        print("  - geofence_locations")
        print("  - attendance_regularization")
        
        return {"success": True}
    except Exception as e:
        print(f"[ERROR] {str(e)}")
        return {"success": False, "message": str(e)}

if __name__ == "__main__":
    init_critical_features()
