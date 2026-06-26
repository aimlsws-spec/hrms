"""
Insert Employee Overtime Widget into Enterprise Portal
"""

# Read the widget content
with open('employee_overtime_widget.html', 'r', encoding='utf-8') as f:
    widget_content = f.read()

# Read the enterprise portal
with open('enterprise_portal.html', 'r', encoding='utf-8') as f:
    portal_lines = f.readlines()

# Find the insertion point (before Reports Section at line 1161)
insertion_line = 1160  # Insert before line 1161 (0-indexed = 1160)

# Insert the widget with proper indentation
indent = "                "  # Match the indentation of surrounding code
widget_lines = widget_content.split('\n')
indented_widget = [indent + line + '\n' if line.strip() else '\n' for line in widget_lines]

# Add a comment before the widget
comment = f"{indent}<!-- Employee Overtime Widget -->\n"
indented_widget.insert(0, comment)
indented_widget.append('\n')

# Insert into portal
new_content = portal_lines[:insertion_line] + indented_widget + portal_lines[insertion_line:]

# Write back
with open('enterprise_portal.html', 'w', encoding='utf-8') as f:
    f.writelines(new_content)

print("[OK] Overtime widget successfully added to enterprise_portal.html")
print(f"[OK] Inserted at line {insertion_line + 1} (before Reports Section)")
print("[OK] Widget will appear in employee analytics section")
