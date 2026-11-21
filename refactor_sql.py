import os
import glob
import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    # 1. Replace pyodbc with mysql.connector
    content = content.replace("import pyodbc", "import mysql.connector")
    content = content.replace("pyodbc.Connection", "mysql.connector.connection.MySQLConnection")
    
    # 2. Replace CAST(... AS NVARCHAR/VARCHAR) -> CAST(... AS CHAR)
    content = re.sub(r'CAST\s*\(\s*(.*?)\s+AS\s+NVARCHAR(?:\(\d+\))?\s*\)', r'CAST(\1 AS CHAR)', content, flags=re.IGNORECASE)
    content = re.sub(r'CAST\s*\(\s*(.*?)\s+AS\s+VARCHAR(?:\(\d+\))?\s*\)', r'CAST(\1 AS CHAR)', content, flags=re.IGNORECASE)
    
    # 3. Replace SQL Server [] syntax
    # e.g. [{database}].[dbo].[tbl_realtime_glog] -> `{database}`.`tbl_realtime_glog`
    content = re.sub(r'\[(.*?)\]\.\[dbo\]\.\[(.*?)\]', r'`\1`.`\2`', content)
    content = re.sub(r'\[idms\]\.\[dbo\]\.\[tbl_realtime_glog\]', r'`idms`.`tbl_realtime_glog`', content)
    
    # Replace single [col] with `col` only if it's clearly a column name in queries
    # e.g. [{filter_col}] -> `{filter_col}`
    content = re.sub(r'\[(\{.*?\})\]', r'`\1`', content)
    
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
    print("Done refactoring python files.")
