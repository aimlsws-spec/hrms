import os

def normalize_files(directories):
    for d in directories:
        for root, dirs, files in os.walk(d):
            # Skip node_modules and .venv
            if 'node_modules' in root or '.venv' in root or '.git' in root:
                continue
            for f in files:
                if f.endswith(('.py', '.ts', '.tsx', '.json', '.md', '.sql', '.html', '.css')):
                    p = os.path.join(root, f)
                    try:
                        with open(p, 'rb') as fp:
                            data = fp.read()
                        if b'\r\n' in data:
                            data = data.replace(b'\r\n', b'\n')
                            with open(p, 'wb') as fp:
                                fp.write(data)
                    except Exception as e:
                        pass
    print("Line endings normalized to LF successfully!")

if __name__ == '__main__':
    normalize_files(['backend', 'frontend/src'])
