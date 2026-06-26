import mysql.connector

conn = mysql.connector.connect(
    host='localhost',
    user='root',
    password='Root@12345',
    database='hrms_complete'
)
cursor = conn.cursor()
cursor.execute('DESCRIBE bonuses')
for row in cursor.fetchall():
    print(row)
conn.close()
