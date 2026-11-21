import os
import glob
import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    # Replace pyodbc.connect with mysql.connector.connect
    content = content.replace("pyodbc.connect(conn_str)", "mysql.connector.connect(host=os.getenv('IDMS_SERVER', '127.0.0.1'), database=os.getenv('IDMS_DATABASE', 'idms'), user=os.getenv('IDMS_USER', 'root'), password=os.getenv('IDMS_PASSWORD', ''), connection_timeout=8)")
    content = content.replace("pyodbc.connect(CONN_STR)", "mysql.connector.connect(host=os.getenv('IDMS_SERVER', '127.0.0.1'), database=os.getenv('IDMS_DATABASE', 'idms'), user=os.getenv('IDMS_USER', 'root'), password=os.getenv('IDMS_PASSWORD', ''), connection_timeout=8)")
    
    # Also find pyodbc.connect if it was missed
    content = content.replace("pyodbc.", "mysql.connector.")
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")

if __name__ == "__main__":
    search_dir = r"d:\hr management\hrms_agent\backend"
    for root, dirs, files in os.walk(search_dir):
        for file in files:
            if file.endswith('.py'):
                filepath = os.path.join(root, file)
                process_file(filepath)
    print("Done refactoring python connections.")
