import os
import shutil

backup_path = r'c:\hr management\hrms_agent\frontend_backup_python\static\js\team_functions.js'
js_path = r'c:\hr management\hrms_agent\frontend\static\js\team_functions.js'

shutil.copyfile(backup_path, js_path)

with open(js_path, 'r', encoding='utf-8') as f:
    js_content = f.read()

js_content = js_content.replace('fetch("/api/admin/teams",\n          {\n            method: "POST",', 'fetch("/api/teams/create",\n          {\n            method: "POST",')

js_content = js_content.replace('fetch("/api/users", {', 'fetch("/api/employees/list", {')
js_content = js_content.replace('fetch(`/api/admin/teams/${teamId}/manager`,', 'fetch(`/api/teams/${teamId}/manager`,')

js_content = js_content.replace(
    'data.users.forEach((u) => {',
    'const employees = data.employees || data.users || [];\n        employees.forEach((u) => {'
)
js_content = js_content.replace(
    '<option value="${u.user_id}">${u.full_name} (${u.role})</option>',
    '<option value="${u.employee_id || u.user_id}">${u.full_name} (${u.role})</option>'
)

js_content = js_content.replace(
    'const res = await fetch("/api/admin/teams/members",\n                {\n                  method: "POST",\n                  headers: getAuthHeaders(),\n                  body: JSON.stringify({\n                    team_id: teamId,\n                    member_id: memberId,\n                  }),\n                });',
    'const res = await fetch(`/api/teams/${teamId}/add-member`,\n                {\n                  method: "POST",\n                  headers: getAuthHeaders(),\n                  body: JSON.stringify({\n                    employee_id: memberId,\n                  }),\n                });'
)

js_content = js_content.replace(
    'const users = userData.users || [];\n              users.forEach((u) => {\n                if (u.role === "employee")\n                  sel.innerHTML += `<option value="${u.user_id}">${u.full_name}</option>`;',
    'const employees = userData.employees || userData.users || [];\n              employees.forEach((u) => {\n                if (u.role === "employee")\n                  sel.innerHTML += `<option value="${u.employee_id || u.user_id}">${u.full_name}</option>`;'
)

with open(js_path, 'w', encoding='utf-8') as f:
    f.write(js_content)

app_path = r'c:\hr management\hrms_agent\app.py'
with open(app_path, 'r', encoding='utf-8') as f:
    app_content = f.read()

if '/api/employees/list' not in app_content:
    alias_code = """
@app.get("/api/employees/list")
def api_employees_list_alias():
    from team_management_api import list_employees_for_dropdown
    return list_employees_for_dropdown()
"""
    app_content = app_content.replace('@app.get("/api/admin/teams")', alias_code + '\n@app.get("/api/admin/teams")')
    with open(app_path, 'w', encoding='utf-8') as f:
        f.write(app_content)

print("Patch applied.")
