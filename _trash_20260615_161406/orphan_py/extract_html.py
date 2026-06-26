import re

def main():
    with open('frontend/enterprise_portal.html', 'r', encoding='utf-8') as f:
        content = f.read()

    # Find the start of the dashboard section
    match = re.search(r'<div id="dashboard-section".*?<!-- Leave Section -->', content, re.DOTALL)
    if match:
        print("Dashboard section found.")
        with open('dashboard_snippet2.txt', 'w', encoding='utf-8') as out:
            out.write(match.group(0))
    else:
        print("Not found.")

if __name__ == '__main__':
    main()
