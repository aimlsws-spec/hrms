import os

def main():
    with open('frontend/enterprise_portal.html', 'r', encoding='utf-8') as f:
        lines = f.readlines()

    start_idx = -1
    for i, line in enumerate(lines):
        if 'id="dashboard-section"' in line:
            start_idx = i
            break

    if start_idx == -1:
        print("Not found")
        return

    # Just find the end of the dashboard section by looking for the next section-content or the closing tags
    end_idx = start_idx
    div_count = 0
    found_start = False
    for i in range(start_idx, len(lines)):
        line = lines[i]
        div_count += line.count('<div')
        div_count -= line.count('</div')
        if not found_start and div_count > 0:
            found_start = True
        
        if found_start and div_count == 0:
            end_idx = i
            break

    with open('dashboard_snippet3.txt', 'w', encoding='utf-8') as out:
        out.writelines(lines[start_idx:end_idx+1])
    print(f"Extracted lines {start_idx} to {end_idx}")

if __name__ == '__main__':
    main()
