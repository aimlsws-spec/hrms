import re
from bs4 import BeautifulSoup

def main():
    with open('frontend/enterprise_portal.html', 'r', encoding='utf-8') as f:
        content = f.read()

    soup = BeautifulSoup(content, 'html.parser')
    dashboard = soup.find(id='dashboard-section')
    if dashboard:
        print("Dashboard Section Cards:")
        # Let's find all cards or headers
        for h3 in dashboard.find_all(['h3', 'h4', 'div']):
            if h3.name in ['h3', 'h4'] and h3.text.strip():
                print(f"Header: {h3.text.strip()}")
            elif h3.name == 'div' and 'card-title' in h3.get('class', []):
                print(f"Card Title: {h3.text.strip()}")
            elif h3.name == 'div' and 'data-translate' in h3.attrs:
                print(f"Data Translate: {h3.get('data-translate')}")

if __name__ == '__main__':
    main()
