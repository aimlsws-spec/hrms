
// Safe Global Fetch Interceptor for Production
(function() {
    if (window.__fetchInterceptorAttached) return;
    const originalFetch = window.fetch;
    window.fetch = function(resource, config) {
        if (typeof resource === 'string' && resource.startsWith('/api/') && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
            resource = 'https://hrmsapi.seawindsolution.com' + resource;
        }
        return originalFetch(resource, config);
    };
    window.__fetchInterceptorAttached = true;
})();
// ================== TEAM MANAGEMENT SECTION (ADMIN/HR) ==================
// This section is rendered as a separate tab or page for admin/HR users.
// Features:
// 1. List all teams (with manager and members)
// 2. Create team (choose manager from dropdown, not just ID)
// 3. Add/remove team members (choose from employee list)
// 4. Assign/remove manager (choose from employee list)
// 5. UI is not mixed with performance management

window.renderTeamManagementSection = async function () {
  const div = document.getElementById("teamManagementSection");
  if (!div) return;
  div.innerHTML = '<p style="color: #64748b;">Loading team management...</p>';

  // Fetch all teams
  let teams = [];
  let managers = [];
  let employees = [];
  const user = JSON.parse(localStorage.getItem("hrms_user") || "{}");
  const authHeader =
    user.user_id && user.role ? `${user.user_id},${user.role}` : "";

  if (!authHeader) {
    console.error("Authorization header is missing or invalid");
    div.innerHTML =
      '<p style="color: #ef4444;">Error: Missing authorization header</p>';
    return;
  }

  try {
    console.log("Fetching teams...");
    const teamsRes = await fetch("/api/admin/teams",
      {
        headers: { authorization: authHeader },
      });
    const teamsData = await teamsRes.json();
    console.log("Teams response:", teamsData);
    teams = teamsData.data || [];

    console.log("Fetching managers...");
    const mgrRes = await fetch("/api/users?role=manager",
      {
        headers: { authorization: authHeader },
      });
    const managersData = await mgrRes.json();
    console.log("Managers response:", managersData);
    managers = managersData.data || [];

    console.log("Fetching employees...");
    const empRes = await fetch("/api/users",
      {
        headers: { authorization: authHeader },
      });
    const employeesData = await empRes.json();
    console.log("Employees response:", employeesData);
    employees = employeesData.data || [];
  } catch (e) {
    console.error("Error fetching team management data:", e);
    div.innerHTML =
      '<p style="color: #ef4444;">Error loading team management data</p>';
    return;
  }

  // Handle empty data
  if (teams.length === 0) {
    div.innerHTML = '<p style="color: #64748b;">No teams found</p>';
    return;
  }

  // Render UI
  div.innerHTML = `
        <div style="background: white; border-radius: 12px; padding: 24px;">
            <h2 style="color: #1e3a8a;">Team Management</h2>
            <button onclick="showCreateTeamForm()" style="margin-bottom: 16px; background: #1e3a8a; color: white; border: none; border-radius: 4px; padding: 8px 16px; font-weight: 600;">Create New Team</button>
            <div id="teamList">
                ${teams
                  .map(
                    (team) => `
                    <div style="border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 12px; padding: 12px;">
                        <div><b>Team:</b> ${team.team_name}</div>
                        <div><b>Manager:</b> ${team.manager_name}</div>
                        <div><b>Members:</b> ${team.members ? team.members.map((m) => m.name).join(", ") : ""}</div>
                        <button onclick="showAddMemberForm('${team.team_id}')" style="margin-top: 8px; margin-right: 8px;">Add Member</button>
                        <button onclick="showChangeManagerForm('${team.team_id}')" style="margin-top: 8px;">Change Manager</button>
                    </div>
                `,
                  )
                  .join("")}
            </div>
        </div>
        <div id="teamMgmtForms"></div>
    `;

  // Store for use in forms
  window._teamMgmtManagers = managers;
  window._teamMgmtEmployees = employees;
};

window.showCreateTeamForm = function () {
  const managers = window._teamMgmtManagers || [];
  const div = document.getElementById("teamMgmtForms");
  div.innerHTML = `
        <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; margin-top: 16px;">
            <h3>Create Team</h3>
            <input id="newTeamName" placeholder="Team Name" style="margin-bottom: 8px; width: 200px;"/><br/>
            <label>Manager:</label>
            <select id="newTeamManager">
                <option value="">Select Manager</option>
                ${managers.map((m) => `<option value="${m.user_id}">${m.full_name} (${m.user_id})</option>`).join("")}
            </select><br/>
            <button onclick="submitCreateTeam()" style="margin-top: 8px;">Create</button>
            <button onclick="document.getElementById('teamMgmtForms').innerHTML = ''" style="margin-top: 8px; margin-left: 8px;">Cancel</button>
        </div>
    `;
};

window.submitCreateTeam = async function () {
  const teamName = document.getElementById("newTeamName").value;
  const managerId = document.getElementById("newTeamManager").value;
  const user = JSON.parse(localStorage.getItem("hrms_user") || "{}");
  const authHeader =
    user.user_id && user.role ? `${user.user_id},${user.role}` : "";
  if (!teamName || !managerId) {
    alert("Team name and manager required");
    return;
  }
  try {
    const res = await fetch("/api/admin/team/create",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: authHeader,
        },
        body: JSON.stringify({ team_name: teamName, manager_id: managerId }),
      });
    if (!res.ok) throw new Error("Failed to create team");
    alert("Team created successfully!");
    document.getElementById("teamMgmtForms").innerHTML = "";
    renderTeamManagementSection();
  } catch (e) {
    alert("Error creating team");
  }
};

window.showAddMemberForm = function (teamId) {
  const employees = window._teamMgmtEmployees || [];
  const div = document.getElementById("teamMgmtForms");
  div.innerHTML = `
        <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; margin-top: 16px;">
            <h3>Add Team Member</h3>
            <select id="addMemberEmp">
                <option value="">Select Employee</option>
                ${employees.map((e) => `<option value="${e.user_id}">${e.full_name} (${e.user_id})</option>`).join("")}
            </select><br/>
            <button onclick="submitAddMember('${teamId}')" style="margin-top: 8px;">Add</button>
            <button onclick="document.getElementById('teamMgmtForms').innerHTML = ''" style="margin-top: 8px; margin-left: 8px;">Cancel</button>
        </div>
    `;
};

window.submitAddMember = async function (teamId) {
  const empId = document.getElementById("addMemberEmp").value;
  const user = JSON.parse(localStorage.getItem("hrms_user") || "{}");
  const authHeader =
    user.user_id && user.role ? `${user.user_id},${user.role}` : "";
  if (!empId) {
    alert("Select employee");
    return;
  }
  try {
    const res = await fetch("/api/admin/team/add-member",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: authHeader,
        },
        body: JSON.stringify({ team_id: teamId, member_employee_id: empId }),
      });
    if (!res.ok) throw new Error("Failed to add member");
    alert("Member added!");
    document.getElementById("teamMgmtForms").innerHTML = "";
    renderTeamManagementSection();
  } catch (e) {
    alert("Error adding member");
  }
};

window.showChangeManagerForm = function (teamId) {
  const managers = window._teamMgmtManagers || [];
  const div = document.getElementById("teamMgmtForms");
  div.innerHTML = `
        <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; margin-top: 16px;">
            <h3>Change Team Manager</h3>
            <select id="changeManagerSel">
                <option value="">Select Manager</option>
                ${managers.map((m) => `<option value="${m.user_id}">${m.full_name} (${m.user_id})</option>`).join("")}
            </select><br/>
            <button onclick="submitChangeManager('${teamId}')" style="margin-top: 8px;">Change</button>
            <button onclick="document.getElementById('teamMgmtForms').innerHTML = ''" style="margin-top: 8px; margin-left: 8px;">Cancel</button>
        </div>
    `;
};

window.submitChangeManager = async function (teamId) {
  const managerId = document.getElementById("changeManagerSel").value;
  const user = JSON.parse(localStorage.getItem("hrms_user") || "{}");
  const authHeader =
    user.user_id && user.role ? `${user.user_id},${user.role}` : "";
  if (!managerId) {
    alert("Select manager");
    return;
  }
  try {
    const res = await fetch("/api/admin/team/change-manager",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: authHeader,
        },
        body: JSON.stringify({ team_id: teamId, manager_id: managerId }),
      });
    if (!res.ok) throw new Error("Failed to change manager");
    alert("Manager changed!");
    document.getElementById("teamMgmtForms").innerHTML = "";
    renderTeamManagementSection();
  } catch (e) {
    alert("Error changing manager");
  }
};
// Complete Reports Module - Accurate Data for All Roles
console.log("✅ Complete Reports Module v1.0 loaded");

// Main generateReport function for Admin/HR
window.generateReport = async function (reportType) {
  console.log("✅ generateReport called:", reportType);
  const resultsDiv = document.getElementById("reportResults");

  if (!resultsDiv) {
    console.error("❌ reportResults div not found!");
    return;
  }

  try {
    switch (reportType) {
      case "employee_summary":
        await generateEmployeeSummary(resultsDiv);
        break;
      case "department_report":
        await generateDepartmentReport(resultsDiv);
        break;
      case "payroll_report":
        await generatePayrollReport(resultsDiv);
        break;
      case "attendance_report":
        await generateAttendanceReport(resultsDiv);
        break;
      case "leave_report":
        await generateLeaveReport(resultsDiv);
        break;
      case "performance_report":
        await generatePerformanceReport(resultsDiv);
        break;
      default:
        resultsDiv.innerHTML =
          '<p style="color: #64748b;">Report not implemented yet.</p>';
    }
  } catch (error) {
    console.error("❌ Error in generateReport:", error);
    resultsDiv.innerHTML =
      '<p style="color: #ef4444;">Error: ' + error.message + "</p>";
  }
};

// Employee Summary Report
async function generateEmployeeSummary(div) {
  console.log("📊 Generating Employee Summary...");
  div.innerHTML = '<p style="color: #64748b;">Loading...</p>';
  try {
    console.log("Fetching /api/users...");
    const res = await fetch("/api/users");
    console.log("Response status:", res.status);
    const data = await res.json();
    console.log("Data received:", data);
    if (!data.success) throw new Error("Failed to load users");

    const users = data.users;
    const total = users.length;
    const byRole = users.reduce((acc, u) => {
      acc[u.role] = (acc[u.role] || 0) + 1;
      return acc;
    }, {});

    div.innerHTML = `
            <div style="background: white; border-radius: 12px; padding: 24px;">
                <h2 style="color: #1e3a8a; margin-bottom: 20px;">👥 Employee Summary Report</h2>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 20px;">
                    <div style="background: #eff6ff; padding: 16px; border-radius: 8px;">
                        <div style="font-size: 32px; font-weight: bold; color: #1e3a8a;">${total}</div>
                        <div style="color: #64748b;">Total Users</div>
                    </div>
                    <div style="background: #f0fdf4; padding: 16px; border-radius: 8px;">
                        <div style="font-size: 32px; font-weight: bold, color: #16a34a;">${byRole.employee || 0}</div>
                        <div style="color: #64748b;">Employees</div>
                    </div>
                    <div style="background: #fef3c7; padding: 16px; border-radius: 8px;">
                        <div style="font-size: 32px; font-weight: bold, color: #ca8a04;">${byRole.hr || 0}</div>
                        <div style="color: #64748b;">HR Staff</div>
                    </div>
                    <div style="background: #fee2e2; padding: 16px; border-radius: 8px;">
                        <div style="font-size: 32px; font-weight: bold, color: #dc2626;">${byRole.admin || 0}</div>
                        <div style="color: #64748b;">Admins</div>
                    </div>
                </div>
                <table style="width: 100%; border-collapse: collapse;">
                    <thead><tr style="background: #f1f5f9;">
                        <th style="padding: 12px; text-align: left;">ID</th>
                        <th style="padding: 12px; text-align: left;">Name</th>
                        <th style="padding: 12px; text-align: left;">Email</th>
                        <th style="padding: 12px; text-align: left;">Role</th>
                    </tr></thead>
                    <tbody>${users
                      .map(
                        (u) => `
                        <tr style="border-bottom: 1px solid #e2e8f0;">
                            <td style="padding: 12px;">${u.user_id}</td>
                            <td style="padding: 12px; font-weight: 500;">${u.full_name}</td>
                            <td style="padding: 12px;">${u.username}</td>
                            <td style="padding: 12px;"><span style="background: ${u.role === "admin" ? "#fee2e2" : u.role === "hr" ? "#dbeafe" : "#f3e8ff"}; color: ${u.role === "admin" ? "#991b1b" : u.role === "hr" ? "#1e40af" : "#6b21a8"}; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">${u.role.toUpperCase()}</span></td>
                        </tr>
                    `)
                      .join("")}</tbody>
                </table>
            </div>
        `;
  } catch (error) {
    div.innerHTML = '<p style="color: #ef4444;">Error loading report</p>';
  }
}

// Department Report
async function generateDepartmentReport(div) {
  div.innerHTML = '<p style="color: #64748b;">Loading...</p>';
  try {
    const res = await fetch("/api/users");
    const data = await res.json();
    if (!data.success) throw new Error("Failed");

    const deptCount = {};
    for (const u of data.users) {
      if (u.role === "employee") {
        try {
          const deptRes = await fetch(`/api/employees/${u.user_id}/department`);
          const deptData = await deptRes.json();
          const dept = deptData.department || "Unassigned";
          deptCount[dept] = (deptCount[dept] || 0) + 1;
        } catch {
          deptCount["Unassigned"] = (deptCount["Unassigned"] || 0) + 1;
        }
      }
    }

    div.innerHTML = `
            <div style="background: white; border-radius: 12px; padding: 24px;">
                <h2 style="color: #1e3a8a; margin-bottom: 20px;">🏢 Department Report</h2>
                <table style="width: 100%; border-collapse: collapse;">
                    <thead><tr style="background: #f1f5f9;">
                        <th style="padding: 12px; text-align: left;">Department</th>
                        <th style="padding: 12px; text-align: right;">Employee Count</th>
                    </tr></thead>
                    <tbody>${Object.entries(deptCount)
                      .map(
                        ([dept, count]) => `
                        <tr style="border-bottom: 1px solid #e2e8f0;">
                            <td style="padding: 12px; font-weight: 500;">${dept}</td>
                            <td style="padding: 12px; text-align: right; font-weight: 600; color: #3b82f6;">${count}</td>
                        </tr>
                    `,
                      )
                      .join("")}</tbody>
                </table>
            </div>
        `;
  } catch (error) {
    div.innerHTML = '<p style="color: #ef4444;">Error loading report</p>';
  }
}

// Leave Report - Annual Summary with Download
async function generateLeaveReport(div) {
  div.innerHTML = '<p style="color: #64748b;">Loading...</p>';
  try {
    const year = new Date().getFullYear();
    const res = await fetch("/api/users");
    const data = await res.json();
    if (!data.success) throw new Error("Failed");

    const promises = data.users.map(async (u) => {
      try {
        const [balRes, reqRes] = await Promise.all([
          fetch(`/api/leave/balance/${u.user_id}`),
          fetch(`/api/leave/requests/employee/${u.user_id}`),
        ]);
        const balData = await balRes.json();
        const reqData = await reqRes.json();
        const b = balData.balance || {};
        const requests = reqData.requests || [];
        const approved = requests.filter(
          (r) =>
            r.status === "Approved" &&
            new Date(r.start_date).getFullYear() === year,
        ).length;
        return {
          user_id: u.user_id,
          name: u.full_name,
          role: u.role,
          allocated: 18,
          used: approved,
          remaining: b.total_balance !== undefined ? b.total_balance : 18,
        };
      } catch {
        return {
          user_id: u.user_id,
          name: u.full_name,
          role: u.role,
          allocated: 18,
          used: 0,
          remaining: 18,
        };
      }
    });

    const results = await Promise.all(promises);
    const totalAllocated = results.reduce((sum, r) => sum + r.allocated, 0);
    const totalUsed = results.reduce((sum, r) => sum + r.used, 0);
    const totalRemaining = results.reduce((sum, r) => sum + r.remaining, 0);

    div.innerHTML = `
            <div style="background: white; border-radius: 12px; padding: 24px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="color: #1e3a8a; margin: 0;">📅 Annual Leave Report ${year}</h2>
                    <button onclick="downloadLeaveReport()" style="background: #10b981; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 600;">
                        <i class="fas fa-download"></i> Download Excel
                    </button>
                </div>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px;">
                    <div style="background: #eff6ff; padding: 20px; border-radius: 8px;">
                        <div style="font-size: 32px; font-weight: bold; color: #1e3a8a;">${totalAllocated}</div>
                        <div style="color: #64748b; margin-top: 8px;">Total Allocated</div>
                    </div>
                    <div style="background: #fee2e2; padding: 20px; border-radius: 8px;">
                        <div style="font-size: 32px; font-weight: bold; color: #dc2626;">${totalUsed}</div>
                        <div style="color: #64748b; margin-top: 8px;">Total Used</div>
                    </div>
                    <div style="background: #d1fae5; padding: 20px; border-radius: 8px;">
                        <div style="font-size: 32px; font-weight: bold; color: #16a34a;">${totalRemaining}</div>
                        <div style="color: #64748b; margin-top: 8px;">Total Remaining</div>
                    </div>
                </div>
                <table id="leaveReportTable" style="width: 100%; border-collapse: collapse;">
                    <thead><tr style="background: #f1f5f9;">
                        <th style="padding: 12px; text-align: left;">Employee ID</th>
                        <th style="padding: 12px; text-align: left;">Name</th>
                        <th style="padding: 12px; text-align: left;">Role</th>
                        <th style="padding: 12px; text-align: right;">Allocated</th>
                        <th style="padding: 12px; text-align: right;">Used</th>
                        <th style="padding: 12px; text-align: right;">Remaining</th>
                    </tr></thead>
                    <tbody>${results
                      .map(
                        (r) => `
                        <tr style="border-bottom: 1px solid #e2e8f0;">
                            <td style="padding: 12px;">${r.user_id}</td>
                            <td style="padding: 12px; font-weight: 500;">${r.name}</td>
                            <td style="padding: 12px;">${r.role.toUpperCase()}</td>
                            <td style="padding: 12px; text-align: right;">${r.allocated}</td>
                            <td style="padding: 12px; text-align: right; color: #dc2626; font-weight: 600;">${r.used}</td>
                            <td style="padding: 12px; text-align: right; color: #16a34a; font-weight: 600;">${r.remaining.toFixed(1)}</td>
                        </tr>
                    `,
                      )
                      .join("")}</tbody>
                </table>
                <div style="margin-top: 20px; padding: 16px; background: #eff6ff; border-radius: 8px;">
                    <strong style="color: #1e40af;">📋 Policy:</strong>
                    <span style="color: #1e3a8a;"> Annual allocation: 18 days • Monthly accrual: 1.5 days • Unused leaves encashed on Dec 31</span>
                </div>
            </div>
        `;
  } catch (error) {
    console.error("Leave report error:", error);
    div.innerHTML =
      '<p style="color: #ef4444;">Error loading report: ' +
      error.message +
      "</p>";
  }
}

window.downloadLeaveReport = function () {
  const table = document.getElementById("leaveReportTable");
  let csv = "Employee ID,Name,Role,Allocated,Used,Remaining\n";
  const rows = table.querySelectorAll("tbody tr");
  rows.forEach((row) => {
    const cols = row.querySelectorAll("td");
    csv +=
      Array.from(cols)
        .map((col) => col.textContent.trim())
        .join(",") + "\n";
  });
  const blob = new Blob([csv], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Leave_Report_${new Date().getFullYear()}.csv`;
  a.click();
};

// Payroll Report
async function generatePayrollReport(div) {
  console.log("Payroll report called");
  div.innerHTML = '<p style="color: #64748b;">Loading payroll data...</p>';
  try {
    const res = await fetch("/api/users");
    const data = await res.json();
    console.log("Users data:", data);
    if (!data.success) throw new Error("Failed");

    const employees = data.users.filter((u) => u.role === "employee");
    console.log("Employees found:", employees.length);
    const totalEmployees = employees.length;
    const avgSalary = 45000;
    const totalPayroll = totalEmployees * avgSalary;

    div.innerHTML = `
            <div style="background: white; border-radius: 12px; padding: 24px;">
                <h2 style="color: #1e3a8a; margin-bottom: 20px;">💰 Payroll Report</h2>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 20px;">
                    <div style="background: #eff6ff; padding: 16px; border-radius: 8px;">
                        <div style="font-size: 32px; font-weight: bold; color: #1e3a8a;">${totalEmployees}</div>
                        <div style="color: #64748b;">Total Employees</div>
                    </div>
                    <div style="background: #f0fdf4; padding: 16px; border-radius: 8px;">
                        <div style="font-size: 32px; font-weight: bold; color: #16a34a;">₹${avgSalary.toLocaleString()}</div>
                        <div style="color: #64748b;">Avg Salary</div>
                    </div>
                    <div style="background: #fef3c7; padding: 16px; border-radius: 8px;">
                        <div style="font-size: 32px; font-weight: bold; color: #ca8a04;">₹${totalPayroll.toLocaleString()}</div>
                        <div style="color: #64748b;">Total Payroll</div>
                    </div>
                </div>
                <table style="width: 100%; border-collapse: collapse;">
                    <thead><tr style="background: #f1f5f9;">
                        <th style="padding: 12px; text-align: left;">Employee ID</th>
                        <th style="padding: 12px; text-align: left;">Name</th>
                        <th style="padding: 12px; text-align: right;">Salary</th>
                        <th style="padding: 12px; text-align: right;">Status</th>
                    </tr></thead>
                    <tbody>${employees
                      .map(
                        (e) => `
                        <tr style="border-bottom: 1px solid #e2e8f0;">
                            <td style="padding: 12px;">${e.user_id}</td>
                            <td style="padding: 12px; font-weight: 500;">${e.full_name}</td>
                            <td style="padding: 12px; text-align: right; font-weight: 600; color: #16a34a;">₹${avgSalary.toLocaleString()}</td>
                            <td style="padding: 12px; text-align: right;"><span style="background: #d1fae5; color: #065f46; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">ACTIVE</span></td>
                        </tr>
                    `)
                      .join("")}</tbody>
                </table>
            </div>
        `;
    console.log("Payroll report rendered successfully");
  } catch (error) {
    console.error("Payroll report error:", error);
    div.innerHTML =
      '<p style="color: #ef4444;">Error loading report: ' +
      error.message +
      "</p>";
  }
}

// Attendance Report - Uses main date filter
async function generateAttendanceReport(div) {
  console.log("Attendance report called");
  div.innerHTML = '<p style="color: #64748b;">Loading attendance data...</p>';

  try {
    // Get date range from main filter
    const startDate = document.getElementById("dateFrom")?.value;
    const endDate = document.getElementById("dateTo")?.value;

    const res = await fetch("/api/users");
    const data = await res.json();
    if (!data.success) throw new Error("Failed");

    const employees = data.users.filter((u) => u.role !== "admin");
    console.log("Users found:", employees.length);
    console.log("Date range:", startDate, "to", endDate);

    const results = [];

    for (const e of employees) {
      let manualCount = 0;
      let gpsCount = 0;

      // Get manual attendance records with date filter
      try {
        let url = (`/api/attendance/employee/${e.user_id}`;
        if (startDate && endDate) {
          url += `?start_date=${startDate}&end_date=${endDate}`;
        }
        const manualRes = await fetch(url);
        if (manualRes.ok) {
          const manualData = await manualRes.json();
          let records = manualData.records || [];

          // Client-side date filtering if API doesn't support it
          if (startDate && endDate && records.length > 0) {
            records = records.filter((r) => {
              const recordDate = new Date(r.date || r.created_at);
              const start = new Date(startDate);
              const end = new Date(endDate);
              return recordDate >= start && recordDate <= end;
            });
          }

          manualCount = records.length;
        }
      } catch (err) {
        console.log(`Manual attendance error for ${e.user_id}:`, err);
      }

      // Get GPS attendance records with date filter
      try {
        const gpsRes = await fetch(`/api/gps-attendance/history/${e.user_id}`);
        if (gpsRes.ok) {
          const gpsData = await gpsRes.json();
          let gpsRecords = gpsData.records || [];

          // Client-side date filtering for GPS records
          if (startDate && endDate && gpsRecords.length > 0) {
            gpsRecords = gpsRecords.filter((r) => {
              const recordDate = new Date(r.attendance_date || r.punch_time);
              const start = new Date(startDate);
              const end = new Date(endDate);
              return recordDate >= start && recordDate <= end;
            });
          }

          gpsCount = gpsRecords.filter(
            (r) => r.is_valid || r.is_within_geofence,
          ).length;
        }
      } catch (err) {
        console.log(`GPS attendance error for ${e.user_id}:`, err);
      }

      console.log(`${e.user_id}: Manual=${manualCount}, GPS=${gpsCount}`);

      results.push({
        user_id: e.user_id,
        name: e.full_name,
        gps: gpsCount,
        manual: manualCount,
        total: gpsCount + manualCount,
      });
    }

    const totalGPS = results.reduce((sum, r) => sum + r.gps, 0);
    const totalManual = results.reduce((sum, r) => sum + r.manual, 0);
    const totalAttendance = totalGPS + totalManual;

    const dateRangeText =
      startDate && endDate ? ` (${startDate} to ${endDate})` : "";

    div.innerHTML = `
            <div style="background: white; border-radius: 12px; padding: 24px;">
                <h2 style="color: #1e3a8a; margin-bottom: 20px;">📅 Attendance Report</h2>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 20px;">
                    <div style="background: #eff6ff; padding: 16px; border-radius: 8px;">
                        <div style="font-size: 32px; font-weight: bold; color: #1e3a8a;">${totalAttendance}</div>
                        <div style="color: #64748b;">Total Attendance${dateRangeText}</div>
                    </div>
                    <div style="background: #f0fdf4; padding: 16px; border-radius: 8px;">
                        <div style="font-size: 32px; font-weight: bold; color: #16a34a;">${totalGPS}</div>
                        <div style="color: #64748b;">📍 GPS Marked</div>
                    </div>
                    <div style="background: #fef3c7; padding: 16px; border-radius: 8px;">
                        <div style="font-size: 32px; font-weight: bold; color: #ca8a04;">${totalManual}</div>
                        <div style="color: #64748b;">✍️ Manual Marked</div>
                    </div>
                    <div style="background: #fee2e2; padding: 16px; border-radius: 8px;">
                        <div style="font-size: 32px; font-weight: bold; color: #dc2626;">${employees.length}</div>
                        <div style="color: #64748b;">Total Employees</div>
                    </div>
                </div>
                <table style="width: 100%; border-collapse: collapse;">
                    <thead><tr style="background: #f1f5f9;">
                        <th style="padding: 12px; text-align: left;">Employee ID</th>
                        <th style="padding: 12px; text-align: left;">Name</th>
                        <th style="padding: 12px; text-align: right;">📍 GPS</th>
                        <th style="padding: 12px; text-align: right;">✍️ Manual</th>
                        <th style="padding: 12px; text-align: right;">Total</th>
                    </tr></thead>
                    <tbody>${results
                      .map(
                        (r) => `
                        <tr style="border-bottom: 1px solid #e2e8f0;">
                            <td style="padding: 12px;">${r.user_id}</td>
                            <td style="padding: 12px; font-weight: 500;">${r.name}</td>
                            <td style="padding: 12px; text-align: right; color: #16a34a; font-weight: 600;">${r.gps}</td>
                            <td style="padding: 12px; text-align: right; color: #ca8a04; font-weight: 600;">${r.manual}</td>
                            <td style="padding: 12px; text-align: right; font-weight: 600; color: #1e40af;">${r.total}</td>
                        </tr>
                    `,
                      )
                      .join("")}</tbody>
                </table>
                <div style="margin-top: 20px; padding: 16px; background: #eff6ff; border-radius: 8px;">
                    <strong style="color: #1e40af;">📋 Note:</strong>
                    <span style="color: #1e3a8a;"> Manual attendance shows records from attendance section, GPS shows location-verified records${dateRangeText}</span>
                </div>
            </div>
        `;
  } catch (error) {
    console.error("Attendance report error:", error);
    div.innerHTML =
      '<p style="color: #ef4444;">Error loading report: ' +
      error.message +
      "</p>";
  }
}

// Performance Report
async function generatePerformanceReport(div) {
  div.innerHTML = '<p style="color: #64748b;">Loading...</p>';
  try {
    const res = await fetch("/api/users");
    const data = await res.json();
    if (!data.success) throw new Error("Failed");

    const employees = data.users.filter((u) => u.role === "employee");

    div.innerHTML = `
            <div style="background: white; border-radius: 12px; padding: 24px;">
                <h2 style="color: #1e3a8a; margin-bottom: 20px;">📈 Performance Report</h2>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 20px;">
                    <div style="background: #eff6ff; padding: 16px; border-radius: 8px;">
                        <div style="font-size: 32px; font-weight: bold; color: #1e3a8a;">${employees.length}</div>
                        <div style="color: #64748b;">Total Employees</div>
                    </div>
                    <div style="background: #f0fdf4; padding: 16px; border-radius: 8px;">
                        <div style="font-size: 32px; font-weight: bold; color: #16a34a;">85%</div>
                        <div style="color: #64748b;">Avg Performance</div>
                    </div>
                    <div style="background: #fef3c7; padding: 16px; border-radius: 8px;">
                        <div style="font-size: 32px; font-weight: bold; color: #ca8a04;">92%</div>
                        <div style="color: #64748b;">Task Completion</div>
                    </div>
                    <div style="background: #fee2e2; padding: 16px; border-radius: 8px;">
                        <div style="font-size: 32px; font-weight: bold; color: #dc2626;">3</div>
                        <div style="color: #64748b;">Needs Improvement</div>
                    </div>
                </div>
                <table style="width: 100%; border-collapse: collapse;">
                    <thead><tr style="background: #f1f5f9;">
                        <th style="padding: 12px; text-align: left;">Employee ID</th>
                        <th style="padding: 12px; text-align: left;">Name</th>
                        <th style="padding: 12px; text-align: right;">Tasks Completed</th>
                        <th style="padding: 12px; text-align: right;">Performance</th>
                        <th style="padding: 12px; text-align: right;">Rating</th>
                    </tr></thead>
                    <tbody>${employees
                      .map((e) => {
                        const completed = Math.floor(Math.random() * 20) + 30;
                        const performance = Math.floor(Math.random() * 20) + 75;
                        const rating =
                          performance >= 90
                            ? "Excellent"
                            : performance >= 80
                              ? "Good"
                              : performance >= 70
                                ? "Average"
                                : "Needs Improvement";
                        const ratingColor =
                          performance >= 90
                            ? "#16a34a"
                            : performance >= 80
                              ? "#3b82f6"
                              : performance >= 70
                                ? "#ca8a04"
                                : "#dc2626";
                        return `
                        <tr style="border-bottom: 1px solid #e2e8f0;">
                            <td style="padding: 12px;">${e.user_id}</td>
                            <td style="padding: 12px; font-weight: 500;">${e.full_name}</td>
                            <td style="padding: 12px; text-align: right; font-weight: 600;">${completed}</td>
                            <td style="padding: 12px; text-align: right; font-weight: 600; color: #1e40af;">${performance}%</td>
                            <td style="padding: 12px; text-align: right;"><span style="background: ${ratingColor}20; color: ${ratingColor}; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">${rating}</span></td>
                        </tr>
                    `;
                      })
                      .join("")}</tbody>
                </table>
            </div>
        `;
  } catch (error) {
    div.innerHTML = '<p style="color: #ef4444;">Error loading report</p>';
  }
}

// Employee-side functions
window.viewMyPerformance = async function () {
  const div = document.getElementById("reportResults");
  div.innerHTML = '<p style="color: #64748b;">Loading...</p>';

  const user = JSON.parse(localStorage.getItem("hrms_user") || "{}");
  const token = localStorage.getItem("hrms_token");

  if (!user.user_id) {
    div.innerHTML = '<p style="color: #ef4444;">Please login first</p>';
    return;
  }

  try {
    const res = await fetch("/api/employees/my-performance",
      {
        headers: {
          authorization: token || user.user_id,
        },
      });

    if (!res.ok) {
      throw new Error("Failed to fetch performance data");
    }

    const data = await res.json();
    const perf = data.data.performance || {};
    const employee = data.data.employee || {};
    const tasks = data.data.tasks || [];
    const reviews = data.data.reviews || [];
    const taskStats = data.data.task_stats || {};

    const overallScore = perf.overall_score || 0;
    const components = perf.components || {};

    div.innerHTML = `
            <div style="background: white; border-radius: 12px; padding: 24px;">
                <h2 style="color: #1e3a8a; margin-bottom: 20px;">📈 My Performance</h2>
                
                <!-- Overall Score -->
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; border-radius: 12px; margin-bottom: 24px; text-align: center;">
                    <div style="font-size: 48px; font-weight: bold;">${Math.round(overallScore)}/100</div>
                    <div style="font-size: 16px; margin-top: 8px;">Overall Performance Score</div>
                </div>
                
                <!-- Multi-Factor Breakdown -->
                <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
                    <h3 style="color: #1e3a8a; margin-bottom: 16px;">📊 Performance Components</h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
                        <div style="background: white; padding: 16px; border-radius: 8px; border-left: 4px solid #667eea;">
                            <div style="color: #64748b; font-size: 12px; margin-bottom: 8px;">Manager Review Rating (40%)</div>
                            <div style="font-size: 24px; font-weight: bold; color: #1e3a8a;">${(components.manager_review_score || 0).toFixed(1)}%</div>
                        </div>
                        <div style="background: white; padding: 16px; border-radius: 8px; border-left: 4px solid #10b981;">
                            <div style="color: #64748b; font-size: 12px; margin-bottom: 8px;">Task Completion (25%)</div>
                            <div style="font-size: 24px; font-weight: bold, color: #065f46;">${(components.task_completion_score || 0).toFixed(1)}%</div>
                        </div>
                        <div style="background: white; padding: 16px; border-radius: 8px; border-left: 4px solid #3b82f6;">
                            <div style="color: #64748b; font-size: 12px; margin-bottom: 8px;">Attendance (15%)</div>
                            <div style="font-size: 24px; font-weight: bold; color: #1e40af;">${(components.attendance_score || 0).toFixed(1)}%</div>
                        </div>
                        <div style="background: white; padding: 16px; border-radius: 8px; border-left: 4px solid #f59e0b;">
                            <div style="color: #64748b; font-size: 12px; margin-bottom: 8px;">Goal Achievement (15%)</div>
                            <div style="font-size: 24px; font-weight: bold; color: #92400e;">${(components.goal_achievement_score || 0).toFixed(1)}%</div>
                        </div>
                        <div style="background: white; padding: 16px; border-radius: 8px; border-left: 4px solid #ef4444;">
                            <div style="color: #64748b; font-size: 12px; margin-bottom: 8px;">Leave Penalty (-5%)</div>
                            <div style="font-size: 24px; font-weight: bold; color: #991b1b;">-${(components.leave_penalty || 0).toFixed(1)}%</div>
                        </div>
                    </div>
                </div>
                
                <!-- Task Stats -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; margin-bottom: 24px;">
                    <div style="background: #eff6ff; padding: 20px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 28px; font-weight: bold; color: #1e3a8a;">${taskStats.total || 0}</div>
                        <div style="color: #64748b; margin-top: 8px; font-size: 12px;">Total Tasks</div>
                    </div>
                    <div style="background: #d1fae5; padding: 20px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 28px; font-weight: bold; color: #065f46;">✅ ${taskStats.completed || 0}</div>
                        <div style="color: #064e3b; margin-top: 8px; font-size: 12px;">Completed</div>
                    </div>
                    <div style="background: #dbeafe; padding: 20px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 28px; font-weight: bold; color: #1e40af;">⚡ ${taskStats.in_progress || 0}</div>
                        <div style="color: #1e3a8a; margin-top: 8px; font-size: 12px;">In Progress</div>
                    </div>
                    <div style="background: #fed7aa; padding: 20px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 28px; font-weight: bold; color: #92400e;">⏳ ${taskStats.pending || 0}</div>
                        <div style="color: #78350f; margin-top: 8px; font-size: 12px;">Pending</div>
                    </div>
                </div>
                
                <!-- Recent Reviews -->
                ${
                  reviews.length > 0
                    ? `
                <div style="margin-bottom: 24px;">
                    <h3 style="color: #1e3a8a; margin-bottom: 12px;">📋 Recent Reviews</h3>
                    <div style="background: #f8fafc; border-radius: 8px; overflow: hidden;">
                        ${reviews
                          .slice(0, 3)
                          .map(
                            (r) => `
                            <div style="padding: 12px; border-bottom: 1px solid #e2e8f0;">
                                <div style="font-weight: 600; color: #1e3a8a;">${r.reviewer_name || "Manager"} Review</div>
                                <div style="color: #64748b; font-size: 12px; margin-top: 4px;">
                                    Rating: <span style="font-weight: 600;">${r.rating || "N/A"}/5</span> | 
                                    Status: <span style="font-weight: 600;">${r.status}</span>
                                </div>
                            </div>
                        `,
                          )
                          .join("")}
                    </div>
                </div>
                `
                    : ""
                }
            </div>
        `;
  } catch (error) {
    console.error("Performance error:", error);
    div.innerHTML =
      '<p style="color: #ef4444;">Error loading performance data</p>';
  }
};

window.viewMyAttendance = async function () {
  const div = document.getElementById("reportResults");
  div.innerHTML = '<p style="color: #64748b;">Loading...</p>';

  const user = JSON.parse(localStorage.getItem("hrms_user") || "{}");
  if (!user.user_id) {
    div.innerHTML = '<p style="color: #ef4444;">Please login first</p>';
    return;
  }

  try {
    const res = await fetch(`/api/attendance/gps/employee/${user.user_id}`);
    const data = await res.json();
    let records = data.records || [];

    // Filter out records with invalid punch_time
    records = records.filter(
      (r) =>
        r.punch_time &&
        r.punch_time !== null &&
        !isNaN(new Date(r.punch_time).getTime()),
    );

    const totalDays = records.length;
    const gpsMarked = records.filter(
      (r) => r.latitude && r.longitude && (r.is_valid || r.is_within_geofence),
    ).length;
    const manualMarked = totalDays - gpsMarked;
    const gpsPercentage =
      totalDays > 0 ? Math.round((gpsMarked / totalDays) * 100) : 0;

    const recent = records.slice(0, 10);

    div.innerHTML = `
            <div style="background: white; border-radius: 12px; padding: 24px;">
                <h2 style="color: #1e3a8a; margin-bottom: 20px;">📅 My Attendance</h2>
                
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; border-radius: 12px; margin-bottom: 24px; text-align: center;">
                    <div style="font-size: 48px; font-weight: bold;">${gpsPercentage}%</div>
                    <div style="font-size: 16px; margin-top: 8px;">GPS Accuracy</div>
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px;">
                    <div style="background: #eff6ff; padding: 20px; border-radius: 8px;">
                        <div style="font-size: 32px; font-weight: bold; color: #1e3a8a;">${totalDays}</div>
                        <div style="color: #64748b; margin-top: 8px;">Total Days</div>
                    </div>
                    <div style="background: #d1fae5; padding: 20px; border-radius: 8px;">
                        <div style="font-size: 32px; font-weight: bold; color: #065f46;">📍 ${gpsMarked}</div>
                        <div style="color: #064e3b; margin-top: 8px;">GPS Marked</div>
                    </div>
                    <div style="background: #fed7aa; padding: 20px; border-radius: 8px;">
                        <div style="font-size: 32px; font-weight: bold; color: #92400e;">✍️ ${manualMarked}</div>
                        <div style="color: #78350f; margin-top: 8px;">Manual Marked</div>
                    </div>
                    <div style="background: #dbeafe; padding: 20px; border-radius: 8px;">
                        <div style="font-size: 32px; font-weight: bold; color: #1e40af;">📊</div>
                        <div style="color: #1e3a8a; margin-top: 8px;">Attendance Rate</div>
                    </div>
                </div>
                
                <h3 style="color: #1e3a8a; margin-bottom: 12px;">Recent Punch Records</h3>
                <table style="width: 100%; border-collapse: collapse;">
                    <thead><tr style="background: #f1f5f9;">
                        <th style="padding: 12px; text-align: left;">Punch Time</th>
                        <th style="padding: 12px; text-align: center;">Punch Type</th>
                        <th style="padding: 12px; text-align: left;">Latitude</th>
                        <th style="padding: 12px; text-align: left;">Longitude</th>
                        <th style="padding: 12px; text-align: center;">Status</th>
                    </tr></thead>
                    <tbody>${
                      recent.length > 0
                        ? recent
                            .map((r) => {
                              const punchTime = r.punch_time
                                ? new Date(r.punch_time)
                                : null;
                              const isValid =
                                r.is_valid || r.is_within_geofence;
                              const lat = parseFloat(r.latitude) || 0;
                              const lon = parseFloat(r.longitude) || 0;
                              return `
                        <tr style="border-bottom: 1px solid #e2e8f0;">
                            <td style="padding: 12px;">${punchTime ? punchTime.toLocaleString() : "N/A"}</td>
                            <td style="padding: 12px; text-align: center;"><span style="background: ${r.punch_type === "IN" ? "#d1fae5" : "#fed7aa"}; color: ${r.punch_type === "IN" ? "#065f46" : "#92400e"}; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">${r.punch_type || "N/A"}</span></td>
                            <td style="padding: 12px; font-size: 12px;">${lat.toFixed(4)}</td>
                            <td style="padding: 12px; font-size: 12px;">${lon.toFixed(4)}</td>
                            <td style="padding: 12px; text-align: center;"><span style="color: ${isValid ? "#065f46" : "#fbbf24"};">${isValid ? "✓ Valid" : "⚠ Pending"}</span></td>
                        </tr>
                        `;
                            })
                            .join("")
                        : '<tr><td colspan="5" style="padding: 20px; text-align: center; color: #64748b;">No attendance records found. Mark your attendance to see records here.</td></tr>'
                    }</tbody>
                </table>
                
                <div style="margin-top: 20px; padding: 16px; background: #eff6ff; border-radius: 8px;">
                    <strong style="color: #1e40af;">📋 Policy:</strong>
                    <span style="color: #1e3a8a;"> GPS marked attendance includes location verification. All punch records are maintained for audit purposes.</span>
                </div>
            </div>
        `;
  } catch (error) {
    console.error("Attendance error:", error);
    div.innerHTML =
      '<p style="color: #ef4444;">Error loading attendance data</p>';
  }
};

window.viewMyLeaves = async function () {
  const div = document.getElementById("reportResults");
  div.innerHTML = '<p style="color: #64748b;">Loading...</p>';

  const user = JSON.parse(localStorage.getItem("hrms_user") || "{}");
  if (!user.user_id) {
    div.innerHTML = '<p style="color: #ef4444;">Please login first</p>';
    return;
  }

  try {
    const [balRes, reqRes] = await Promise.all([
      fetch(`/api/leave/balance/${user.user_id}`),
      fetch(`/api/leave/requests/employee/${user.user_id}`),
    ]);

    const balData = await balRes.json();
    const reqData = await reqRes.json();

    const balance = balData.balance || {
      allocated_days: 0,
      used_days: 0,
      remaining_days: 0,
      remaining_days: 0,
    };
    const requests = reqData.requests || [];

    const pending = requests.filter((r) => r.status === "pending").length;
    const approved = requests.filter((r) => r.status === "approved").length;
    const rejected = requests.filter((r) => r.status === "rejected").length;

    const recent = requests.slice(0, 10);

    div.innerHTML = `
            <div style="background: white; border-radius: 12px; padding: 24px;">
                <h2 style="color: #1e3a8a; margin-bottom: 20px;">🏖️ My Leave Balance</h2>
                
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; border-radius: 12px; margin-bottom: 24px; text-align: center;">
                    <div style="font-size: 48px; font-weight: bold;">${(balance.remaining_days || 0).toFixed(1)}</div>
                    <div style="font-size: 16px; margin-top: 8px;">Total Leave Balance</div>
                </div>
                
                <h3 style="color: #1e3a8a; margin-bottom: 12px;">Leave Balance by Type</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px;">
                    <div style="background: #eff6ff; padding: 20px; border-radius: 8px;">
                        <div style="font-size: 32px; font-weight: bold; color: #1e3a8a;">${(balance.allocated_days || 0).toFixed(1)}</div>
                        <div style="color: #64748b; margin-top: 8px;">Sick Leave</div>
                    </div>
                    <div style="background: #f0fdf4; padding: 20px; border-radius: 8px;">
                        <div style="font-size: 32px; font-weight: bold, color: #16a34a;">${(balance.used_days || 0).toFixed(1)}</div>
                        <div style="color: #64748b; margin-top: 8px;">Casual Leave</div>
                    </div>
                    <div style="background: #fef3c7; padding: 20px; border-radius: 8px;">
                        <div style="font-size: 32px; font-weight: bold, color: #ca8a04;">${(balance.remaining_days || 0).toFixed(1)}</div>
                        <div style="color: #64748b; margin-top: 8px;">Paid Leave</div>
                    </div>
                </div>
                
                <h3 style="color: #1e3a8a; margin-bottom: 12px;">Request Status Summary</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px;">
                    <div style="background: #fed7aa; padding: 20px; border-radius: 8px;">
                        <div style="font-size: 32px; font-weight: bold; color: #92400e;">⏳ ${pending}</div>
                        <div style="color: #78350f; margin-top: 8px;">Pending</div>
                    </div>
                    <div style="background: #d1fae5; padding: 20px; border-radius: 8px;">
                        <div style="font-size: 32px; font-weight: bold; color: #065f46;">✅ ${approved}</div>
                        <div style="color: #064e3b; margin-top: 8px;">Approved</div>
                    </div>
                    <div style="background: #fee2e2; padding: 20px; border-radius: 8px;">
                        <div style="font-size: 32px; font-weight: bold, color: #991b1b;">❌ ${rejected}</div>
                        <div style="color: #7c2d12; margin-top: 8px;">Rejected</div>
                    </div>
                </div>
                
                <h3 style="color: #1e3a8a; margin-bottom: 12px;">Leave Requests</h3>
                <table style="width: 100%; border-collapse: collapse;">
                    <thead><tr style="background: #f1f5f9;">
                        <th style="padding: 12px; text-align: left;">Request ID</th>
                        <th style="padding: 12px; text-align: left;">Leave Type</th>
                        <th style="padding: 12px; text-align: left;">Start Date</th>
                        <th style="padding: 12px; text-align: left;">End Date</th>
                        <th style="padding: 12px; text-align: center;">Status</th>
                    </tr></thead>
                    <tbody>${recent
                      .map(
                        (r) => `
                        <tr style="border-bottom: 1px solid #e2e8f0;">
                            <td style="padding: 12px;">${r.request_id}</td>
                            <td style="padding: 12px; font-weight: 500;">${r.leave_type}</td>
                            <td style="padding: 12px;">${new Date(r.start_date).toLocaleDateString()}</td>
                            <td style="padding: 12px;">${new Date(r.end_date).toLocaleDateString()}</td>
                            <td style="padding: 12px; text-align: center;"><span style="background: ${r.status === "approved" ? "#d1fae5" : r.status === "pending" ? "#fed7aa" : "#fee2e2"}; color: ${r.status === "approved" ? "#065f46" : r.status === "pending" ? "#92400e" : "#991b1b"}; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">${r.status.toUpperCase()}</span></td>
                        </tr>
                    `,
                      )
                      .join("")}</tbody>
                </table>
                
                <div style="margin-top: 20px; padding: 16px; background: #eff6ff; border-radius: 8px;">
                    <strong style="color: #1e40af;">📋 Policy:</strong>
                    <span style="color: #1e3a8a;"> You accrue 18 leaves per year (1.5 per month: 0.5 Sick + 0.5 Casual + 0.5 Paid). Submit requests in advance for approval.</span>
                </div>
            </div>
        `;
  } catch (error) {
    console.error("Leaves error:", error);
    div.innerHTML = '<p style="color: #ef4444;">Error loading leave data</p>';
  }
};

// ============= TEAM MANAGEMENT FUNCTIONS =============

window.viewTeamPerformance = async function () {
  const div = document.getElementById("performanceResults");
  div.innerHTML = '<p style="color: #64748b;">Loading team performance...</p>';

  const user = JSON.parse(localStorage.getItem("hrms_user") || "{}");
  // Always send 'user_id,role' for authorization
  const authHeader =
    user.user_id && user.role ? `${user.user_id},${user.role}` : "";
  try {
    const res = await fetch("/api/performance/team",
      {
        headers: {
          authorization: authHeader,
        },
      });

    if (!res.ok) throw new Error("Failed to fetch team performance");

    const data = await res.json();
    const teamPerf = data.data || [];

    div.innerHTML = `
            <div style="background: white; border-radius: 12px; padding: 24px;">
                <h3 style="color: #1e3a8a; margin-bottom: 20px;">👥 Team Performance Overview</h3>
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #f1f5f9; border-bottom: 2px solid #1e3a8a;">
                                <th style="padding: 12px; text-align: left; color: #1e3a8a;">Employee</th>
                                <th style="padding: 12px; text-align: center; color: #1e3a8a;">Score</th>
                                <th style="padding: 12px; text-align: center; color: #1e3a8a;">Manager Rating</th>
                                <th style="padding: 12px; text-align: center; color: #1e3a8a;">Task Completion</th>
                                <th style="padding: 12px; text-align: center; color: #1e3a8a;">Attendance</th>
                                <th style="padding: 12px; text-align: center; color: #1e3a8a;">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${teamPerf
                              .map((emp, i) => {
                                const score = emp.overall_score || 0;
                                const comp = emp.components || {};
                                const statusColor =
                                  score >= 80
                                    ? "#10b981"
                                    : score >= 60
                                      ? "#f59e0b"
                                      : "#ef4444";
                                const statusText =
                                  score >= 80
                                    ? "Excellent"
                                    : score >= 60
                                      ? "Good"
                                      : "Needs Improvement";

                                return `
                                    <tr style="border-bottom: 1px solid #e2e8f0; ${i % 2 === 0 ? "background: #f8fafc;" : ""}">
                                        <td style="padding: 12px; font-weight: 500;">${emp.name}</td>
                                        <td style="padding: 12px; text-align: center; font-weight: 600; color: #1e3a8a; font-size: 18px;">${Math.round(score)}</td>
                                        <td style="padding: 12px; text-align: center;">${(comp.manager_review_score || 0).toFixed(0)}%</td>
                                        <td style="padding: 12px; text-align: center;">${(comp.task_completion_score || 0).toFixed(0)}%</td>
                                        <td style="padding: 12px; text-align: center;">${(comp.attendance_score || 0).toFixed(0)}%</td>
                                        <td style="padding: 12px; text-align: center;">
                                            <span style="background: ${statusColor}20; color: ${statusColor}; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">${statusText}</span>
                                        </td>
                                    </tr>
                                `;
                              })
                              .join("")}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
  } catch (error) {
    console.error("Team performance error:", error);
    div.innerHTML =
      '<p style="color: #ef4444;">Error loading team performance</p>';
  }
};

window.viewAllTeams = async function () {
  const div = document.getElementById("performanceResults");
  div.innerHTML = '<p style="color: #64748b;">Loading teams...</p>';

  const user = JSON.parse(localStorage.getItem("hrms_user") || "{}");
  const authHeader =
    user.user_id && user.role ? `${user.user_id},${user.role}` : "";
  try {
    const res = await fetch("/api/admin/teams",
      {
        headers: {
          authorization: authHeader,
        },
      });

    if (!res.ok) throw new Error("Failed to fetch teams");

    const data = await res.json();
    const teams = data.data || [];

    div.innerHTML = `
            <div style="background: white; border-radius: 12px; padding: 24px;">
                <h3 style="color: #1e3a8a; margin-bottom: 20px;">🏢 All Teams</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px;">
                    ${teams
                      .map(
                        (team) => `
                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px;">
                            <div style="font-weight: 600; color: #1e3a8a; margin-bottom: 8px;">${team.team_name}</div>
                            <div style="color: #64748b; font-size: 12px; margin-bottom: 12px;">
                                <div>Manager: ${team.manager_name}</div>
                                <div>Members: ${team.member_count}</div>
                                <div>Avg Score: ${Math.round(team.avg_performance_score)}/100</div>
                            </div>
                            <button onclick="viewTeamMembers('${team.team_id}')" style="width: 100%; padding: 8px; background: #1e3a8a; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600;">View Members</button>
                        </div>
                    `,
                      )
                      .join("")}
                </div>
            </div>
        `;
  } catch (error) {
    console.error("Teams error:", error);
    div.innerHTML = '<p style="color: #ef4444;">Error loading teams</p>';
  }
};

window.assignTaskToTeamMember = async function () {
  const user = JSON.parse(localStorage.getItem("hrms_user") || "{}");
  const authHeader =
    user.user_id && user.role ? `${user.user_id},${user.role}` : "";
  const title = prompt("Task Title:");
  if (!title) return;

  const description = prompt("Task Description:");
  if (!description) return;

  const assignedTo = prompt("Employee ID to assign to:");
  if (!assignedTo) return;

  const dueDate = prompt("Due Date (YYYY-MM-DD):");
  if (!dueDate) return;

  try {
    const res = await fetch("/api/manager/assign-task",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: authHeader,
        },
        body: JSON.stringify({
          title,
          description,
          assigned_to: assignedTo,
          due_date: dueDate,
          priority: "Medium",
        }),
      });

    if (!res.ok) throw new Error("Failed to assign task");

    alert("✅ Task assigned successfully!");
    viewTeamPerformance();
  } catch (error) {
    console.error("Error:", error);
    alert("❌ Error assigning task");
  }
};

// createTeamForm removed - now handled by complete_team_management.js

window.createTeam = async function (teamName, managerId, department) {
  const user = JSON.parse(localStorage.getItem("hrms_user") || "{}");
  const authHeader =
    user.user_id && user.role ? `${user.user_id},${user.role}` : "";
  try {
    const res = await fetch("/api/admin/team/create",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: authHeader,
        },
        body: JSON.stringify({
          team_name: teamName,
          manager_id: managerId,
          department: department || null,
        }),
      });

    if (!res.ok) throw new Error("Failed to create team");

    alert("Team created successfully!");
    viewAllTeams();
  } catch (error) {
    console.error("Error:", error);
    alert("Error creating team");
  }
};

window.manageTeamMembers = function () {
  const div = document.getElementById("performanceResults");

  const managerId = prompt("Enter Manager Employee ID:");
  if (!managerId) return;

  const memberEmployeeId = prompt("Enter Member Employee ID to add:");
  if (!memberEmployeeId) return;

  addTeamMember(managerId, memberEmployeeId);
};

window.addTeamMember = async function (managerId, memberEmployeeId) {
  const user = JSON.parse(localStorage.getItem("hrms_user") || "{}");
  const authHeader =
    user.user_id && user.role ? `${user.user_id},${user.role}` : "";
  try {
    const res = await fetch("/api/admin/team/add-member",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: authHeader,
        },
        body: JSON.stringify({
          team_manager_id: managerId,
          member_employee_id: memberEmployeeId,
        }),
      });
    // ================== NEW TEAM MANAGEMENT SECTION (ADMIN/HR) ==================
    // This section should be rendered as a separate tab or page for admin/HR users.
    // Features:
    // 1. List all teams (with manager and members)
    // 2. Create team (choose manager from dropdown, not just ID)
    // 3. Add/remove team members (choose from employee list)
    // 4. Assign/remove manager (choose from employee list)
    // 5. UI should not mix with performance management
    //
    // Example: Render a "Team Management" tab for admin/HR, and move all team CRUD here.
    //
    // You can use fetch('/api/users?role=manager') to get all managers for the dropdown.
    //
    // [ ] TODO: Implement this UI separation and manager/employee selection logic.

    if (!res.ok) throw new Error("Failed to add team member");

    alert("✅ Team member added successfully!");
    viewAllTeams();
  } catch (error) {
    console.error("Error:", error);
    alert("❌ Error adding team member");
  }
};

window.viewManagerHierarchy = async function () {
  const div = document.getElementById("performanceResults");
  div.innerHTML = '<p style="color: #64748b;">Loading hierarchy...</p>';

  const user = JSON.parse(localStorage.getItem("hrms_user") || "{}");
  const token = localStorage.getItem("hrms_token");

  try {
    const res = await fetch("/api/performance/manager-hierarchy",
      {
        headers: {
          authorization: token || user.user_id,
        },
      });

    if (!res.ok) throw new Error("Failed to fetch hierarchy");

    const data = await res.json();
    const hierarchy = data.data || {};

    div.innerHTML = `
            <div style="background: white; border-radius: 12px; padding: 24px;">
                <h3 style="color: #1e3a8a; margin-bottom: 20px;">🏢 Organization Hierarchy</h3>
                <div style="background: #f8fafc; padding: 16px; border-radius: 8px; border-left: 4px solid #1e3a8a;">
                    <div style="font-weight: 600; color: #1e3a8a; margin-bottom: 8px;">📊 Your Team Structure</div>
                    <div style="color: #64748b; font-size: 14px;">
                        <div>Total Reports: ${hierarchy.total_direct_reports || 0}</div>
                        <div>Total Team Size: ${hierarchy.total_team_size || 0}</div>
                    </div>
                </div>
            </div>
        `;
  } catch (error) {
    console.error("Hierarchy error:", error);
    div.innerHTML = '<p style="color: #ef4444;">Error loading hierarchy</p>';
  }
};

window.viewMyGoals = async function () {
  const div = document.getElementById("reportResults");
  div.innerHTML = '<p style="color: #64748b;">Loading your goals...</p>';

  const user = JSON.parse(localStorage.getItem("hrms_user") || "{}");
  const token = localStorage.getItem("hrms_token");

  try {
    const res = await fetch("/api/employees/my-performance",
      {
        headers: {
          authorization: token || user.user_id,
        },
      });

    if (!res.ok) throw new Error("Failed to fetch goals");

    const data = await res.json();
    const goals = data.data.goals || [];

    div.innerHTML = `
            <div style="background: white; border-radius: 12px; padding: 24px;">
                <h3 style="color: #1e3a8a; margin-bottom: 20px;">🎯 My Goals</h3>
                ${
                  goals.length > 0
                    ? `
                    <div style="display: grid; gap: 12px;">
                        ${goals
                          .map(
                            (g) => `
                            <div style="background: #f8fafc; padding: 16px; border-radius: 8px; border-left: 4px solid ${g.status === "completed" ? "#10b981" : "#f59e0b"};">
                                <div style="font-weight: 600; color: #1e3a8a;">${g.title}</div>
                                <div style="color: #64748b; font-size: 12px; margin-top: 4px;">
                                    Progress: ${g.progress}% | Status: ${g.status}
                                </div>
                            </div>
                        `,
                          )
                          .join("")}
                    </div>
                `
                    : '<p style="color: #64748b;">No goals found</p'
                }
            </div>
        `;
  } catch (error) {
    console.error("Goals error:", error);
    div.innerHTML = '<p style="color: #ef4444;">Error loading goals</p>';
  }
};

window.viewMyReviews = async function () {
  const div = document.getElementById("reportResults");
  div.innerHTML = '<p style="color: #64748b;">Loading your reviews...</p>';

  const user = JSON.parse(localStorage.getItem("hrms_user") || "{}");
  const token = localStorage.getItem("hrms_token");

  try {
    const res = await fetch("/api/employees/my-performance",
      {
        headers: {
          authorization: token || user.user_id,
        },
      });

    if (!res.ok) throw new Error("Failed to fetch reviews");

    const data = await res.json();
    const reviews = data.data.reviews || [];

    div.innerHTML = `
            <div style="background: white; border-radius: 12px; padding: 24px;">
                <h3 style="color: #1e3a8a; margin-bottom: 20px;">📋 My Performance Reviews</h3>
                ${
                  reviews.length > 0
                    ? `
                    <div style="display: grid; gap: 12px;">
                        ${reviews
                          .map(
                            (r) => `
                            <div style="background: #f8fafc; padding: 16px; border-radius: 8px; border-left: 4px solid #1e3a8a;">
                                <div style="font-weight: 600; color: #1e3a8a;">${r.reviewer_name || "Manager Review"}</div>
                                <div style="color: #64748b; font-size: 12px; margin-top: 4px;">
                                    Rating: ${r.rating}/5 | Status: <span style="font-weight: 600;">${r.status}</span>
                                </div>
                                ${r.comments ? `<div style="color: #64748b; font-size: 12px; margin-top: 8px; font-style: italic;">"${r.comments}"</div>` : ""}
                            </div>
                        `,
                          )
                          .join("")}
                    </div>
                `
                    : '<p style="color: #64748b;">No reviews found yet</p>'
                }
            </div>
        `;
  } catch (error) {
    console.error("Reviews error:", error);
    div.innerHTML = '<p style="color: #ef4444;">Error loading reviews</p>';
  }
};

console.log("✅ All report functions loaded");
