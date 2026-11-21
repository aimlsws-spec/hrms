import mysql.connector
import json
import os

config = {
    'host': os.getenv('DB_HOST', '127.0.0.1'),
    'port': int(os.getenv('DB_PORT', '3306')),
    'user': os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD', ''),
    'database': os.getenv('DB_NAME', 'hrms')
}

def audit():
    conn = mysql.connector.connect(**config)
    cursor = conn.cursor(dictionary=True)
    
    # 1. Alter Database
    cursor.execute("ALTER DATABASE hrms CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;")
    
    # 2. Get Tables and Alter them if needed
    cursor.execute("SHOW TABLES")
    tables = [list(t.values())[0] for t in cursor.fetchall()]
    
    table_details = {}
    
    for table in tables:
        # Alter table default charset
        cursor.execute(f"ALTER TABLE `{table}` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;")
        
        # Get schema details for documentation
        cursor.execute(f"DESCRIBE `{table}`")
        columns = cursor.fetchall()
        
        # Get indexes
        cursor.execute(f"SHOW INDEXES FROM `{table}`")
        indexes = cursor.fetchall()
        
        # Get foreign keys
        cursor.execute(f"""
            SELECT 
                k.COLUMN_NAME, 
                k.REFERENCED_TABLE_NAME, 
                k.REFERENCED_COLUMN_NAME 
            FROM information_schema.KEY_COLUMN_USAGE k 
            WHERE k.TABLE_SCHEMA = 'hrms' AND k.TABLE_NAME = '{table}' AND k.REFERENCED_TABLE_NAME IS NOT NULL;
        """)
        fks = cursor.fetchall()
        
        table_details[table] = {
            'columns': columns,
            'indexes': indexes,
            'fks': fks
        }
        
    conn.commit()
    
    with open('db_metadata.json', 'w') as f:
        json.dump(table_details, f, indent=4)
        
    print("Database audited and converted. Metadata saved.")
    
if __name__ == '__main__':
    audit()
