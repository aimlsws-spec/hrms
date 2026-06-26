import os

js_path = r'c:\hr management\hrms_agent\frontend\static\js\team_functions.js'
with open(js_path, 'r', encoding='utf-8') as f:
    js_content = f.read()

# Add console logs for Manager Assignment
js_content = js_content.replace(
    'const userId = document.getElementById("managerSelect").value;\n              if (!confirm("Promote to Manager?")) return;',
    'const userId = document.getElementById("managerSelect").value;\n              console.log("Selected manager id:", userId);\n              console.log("Manager Update Payload:", { manager_id: userId });\n              if (!confirm("Promote to Manager?")) return;'
)
js_content = js_content.replace(
    'const ad = await a.json();\n              if (ad.success) {',
    'const ad = await a.json();\n              console.log("Manager Assignment API Response:", ad);\n              if (ad.success) {'
)

# Add console logs for Add Member
js_content = js_content.replace(
    'const memberId = document.getElementById("memberSelect").value;\n              const res = await fetch(`/api/teams/${teamId}/add-member`,',
    'const memberId = document.getElementById("memberSelect").value;\n              console.log("Selected employee id:", memberId);\n              console.log("Add Member Payload:", { employee_id: memberId });\n              const res = await fetch(`/api/teams/${teamId}/add-member`,'
)
js_content = js_content.replace(
    'const result = await res.json();\n              if (result.success) {',
    'const result = await res.json();\n              console.log("Add Member API Response:", result);\n              if (result.success) {'
)

with open(js_path, 'w', encoding='utf-8') as f:
    f.write(js_content)

print("Logs added.")
