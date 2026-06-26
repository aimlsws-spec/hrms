"""
Simple fix: Move overtime widget inside employee-analytics-view div
"""

with open('enterprise_portal.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find the widget start (around line 1160)
widget_start = None
widget_end = None

for i, line in enumerate(lines):
    if '<!-- Employee Overtime Widget -->' in line and widget_start is None:
        widget_start = i
    if widget_start is not None and '</script>' in line and 'loadMyOvertime' in ''.join(lines[max(0, i-50):i+1]):
        widget_end = i + 1
        break

if widget_start is None or widget_end is None:
    print("[ERROR] Could not find widget boundaries")
    exit(1)

print(f"[INFO] Widget found at lines {widget_start} to {widget_end}")

# Extract the widget
widget_lines = lines[widget_start:widget_end]

# Remove the widget from its current location
lines_without_widget = lines[:widget_start] + lines[widget_end:]

# Find where to insert it - right before line 1158 (the closing </div> of employee-analytics-view)
# Look for the line with just "                </div>" after employeeDashboardContent
insert_position = None
for i, line in enumerate(lines_without_widget):
    if i > 1150 and i < 1160 and line.strip() == '</div>' and 'employeeDashboardContent' in lines_without_widget[i-3]:
        insert_position = i
        break

if insert_position is None:
    print("[ERROR] Could not find insertion point")
    exit(1)

print(f"[INFO] Inserting widget at line {insert_position}")

# Insert the widget at the correct position
final_lines = lines_without_widget[:insert_position] + widget_lines + lines_without_widget[insert_position:]

# Write back
with open('enterprise_portal.html', 'w', encoding='utf-8') as f:
    f.writelines(final_lines)

print("[OK] Widget moved inside employee-analytics-view section")
print("[OK] Widget will now only show in Analytics section for employees")
