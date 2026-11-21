import os
import glob
import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    # Replace SELECT TOP X with SELECT ... LIMIT X
    # It might be SELECT TOP 5 \n or SELECT TOP 5 * ...
    # This is slightly tricky, but we can do:
    # SELECT TOP 5 col1, col2 FROM table -> SELECT col1, col2 FROM table LIMIT 5
    
    # We will use re.sub with a function or just replace the specific occurrences since we saw them in grep:
    content = content.replace("SELECT TOP 5\\n", "SELECT \\n")
    content = content.replace("SELECT TOP 1\\n", "SELECT \\n")
    content = content.replace("SELECT TOP 1\n", "SELECT \n")
    content = content.replace("SELECT TOP 3 * FROM", "SELECT * FROM")
    content = content.replace("SELECT TOP 5 * FROM", "SELECT * FROM")
    
    # Actually, we need to append LIMIT to the query end. Since these are in string literals, it's easier to manually regex them.
    # We can just do a regex replace for the whole SQL query if possible, or just replace the exact lines based on what we saw.
    
    # Wait, biometric_processor.py Line 134:
    # f"SELECT TOP 5\n"
    # f"    CAST({IDMS_USER_ID_COL} AS CHAR(50)) AS user_id,\n"
    # f"    [{IDMS_NAME_COL}] AS user_name\n"
    # f"FROM {IDMS_USER_TABLE}\n"
    # Needs LIMIT 5 at the end.
    
    content = re.sub(r'SELECT TOP (\d+)(.*?FROM.*?)(?=["\n])', r'SELECT \2 LIMIT \1', content, flags=re.IGNORECASE|re.DOTALL)
    # Wait, re.DOTALL across a whole file is dangerous! 
    # Let's write a safer regex line by line or specifically for the snippets.
    pass

def process_file_safe(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    # Specific replacements based on grep output
    content = content.replace('f"SELECT TOP 5\\n"', 'f"SELECT \\n"')
    content = content.replace('f"SELECT TOP 1\\n"', 'f"SELECT \\n"')
    content = content.replace('SELECT TOP 1', 'SELECT')
    content = content.replace('f"SELECT TOP 3 * FROM {table}"', 'f"SELECT * FROM {table} LIMIT 3"')
    content = content.replace('f"SELECT TOP 5 * FROM {fq}"', 'f"SELECT * FROM {fq} LIMIT 5"')
    
    # For biometric_processor.py where LIMIT needs to be at the end:
    # f"FROM {IDMS_USER_TABLE}\n" -> f"FROM {IDMS_USER_TABLE} LIMIT 5\n"
    if "biometric_processor.py" in filepath:
        content = content.replace('f"FROM {IDMS_USER_TABLE}\\n"', 'f"FROM {IDMS_USER_TABLE} LIMIT 5\\n"')
        content = content.replace('f"WHERE CAST({IDMS_USER_ID_COL} AS CHAR(50)) = \'<ENROLL_ID_HERE>\'\\n"', 'f"WHERE CAST({IDMS_USER_ID_COL} AS CHAR(50)) = \'<ENROLL_ID_HERE>\' LIMIT 1\\n"')
        content = content.replace('ORDER BY logs.io_time ASC\\n"', 'ORDER BY logs.io_time ASC LIMIT 1\\n"')

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
                process_file_safe(filepath)
    print("Done refactoring TOP queries.")
