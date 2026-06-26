import mysql.connector

DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': 'Root@12345',
    'database': 'hrms_complete'
}

conn = mysql.connector.connect(**DB_CONFIG)
cursor = conn.cursor()
cursor.execute("DESCRIBE salary_structures")
print("Current columns in salary_structures:")
for row in cursor.fetchall():
    print(f"  - {row[0]} ({row[1]})")
cursor.close()
conn.close()
