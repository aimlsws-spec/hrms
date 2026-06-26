import os
import glob

os.chdir(r"d:\hrms_agent")

patterns = ['**/*.html', '**/*.js', '**/*.txt', '**/*.py', '**/*.md']
files = []
for p in patterns:
    files.extend(glob.glob(p, recursive=True))

for file in files:
    try:
        with open(file, 'r', encoding='utf-8') as f:
            content = f.read()
            
        modified = False
        if 'localhost:8002' in content:
            content = content.replace('localhost:8002', 'localhost:8002')
            modified = True
            
        if 'port 8002' in content:
            content = content.replace('port 8002', 'port 8002')
            modified = True
            
        if modified:
            with open(file, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Updated {file}")
    except Exception as e:
        pass
