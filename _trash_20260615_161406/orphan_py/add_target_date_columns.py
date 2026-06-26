import mysql.connector

try:
    conn = mysql.connector.connect(
        host='localhost',
        user='root',
        password='root',
        database='hrms_db'
    )
    cursor = conn.cursor()
    
    # Add target_start_date and target_end_date columns
    cursor.execute("""
        ALTER TABLE tasks 
        ADD COLUMN target_start_date DATE AFTER due_date,
        ADD COLUMN target_end_date DATE AFTER target_start_date
    """)
    
    conn.commit()
    print("✓ Successfully added target_start_date and target_end_date columns to tasks table")
    
    cursor.close()
    conn.close()
    
except mysql.connector.Error as err:
    if err.errno == 1060:
        print("Columns already exist")
    else:
        print(f"Error: {err}")
