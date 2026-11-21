import mysql.connector
from config import DB_CONFIG

print('Connecting to DB...')
conn = mysql.connector.connect(**DB_CONFIG)
cur = conn.cursor()

sql = """
UPDATE leave_balance
SET casual_leave = 0.5,
    sick_leave = 0.5,
    earned_leave = 0.5
"""

cur.execute(sql)
conn.commit()
print(f'Rows affected: {cur.rowcount}')
cur.close()
conn.close()
print('Done.')
