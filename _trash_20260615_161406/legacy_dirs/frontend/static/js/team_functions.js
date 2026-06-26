
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
// COMPLETE TEAM MANAGEMENT WORKFLOW

// Helper to get headers with auth
function getAuthHeaders() {
  const user = JSON.parse(sessionStorage.getItem("user") || "{}");
  const userId = user.user_id || "admin";
  const userRole = user.role || "admin";
  return {
    "Content-Type": "application/json",
    authorization: `${userId},${userRole}`,
  };
}

// 1. VIEW ALL TEAMS
function viewAllTeams() {
  const r = document.getElementById("teamResults");
  if (!r) return;
  r.innerHTML = '<p style="color:#64748b;">Loading teams...</p>';

  fetch("/api/admin/teams", {
    headers: getAuthHeaders(),
  })
    .then((res) => (res.ok ? res.json() : Promise.reject(`HTTP ${res.status}`)))
    .then((data) => {
      const teams = data.teams || data.data || [];
      if (data.success && teams.length > 0) {
        let html = `<div style="background:white;border-radius:8px;padding:20px;"><h3>All Teams (${teams.length})</h3><table style="width:100%;border-collapse:collapse;margin-top:20px;"><thead><tr style="background:#f1f5f9;border-bottom:2px solid #e2e8f0;"><th style="padding:12px;text-align:left;">Team Name</th><th style="padding:12px;text-align:left;">Manager</th><th style="padding:12px;text-align:left;">Actions</th></tr></thead><tbody>`;
        teams.forEach((team) => {
          const teamId = team.team_id || team.id;
          html += `<tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:12px;font-weight:600;">${team.team_name}</td><td style="padding:12px;">${team.manager_id || "No Manager"}</td><td style="padding:12px;"><button onclick="assignManager('${teamId}')" class="btn btn-primary" style="padding:4px 8px;font-size:12px;margin-right:4px;">Assign Manager</button><button onclick="viewTeamMembers('${teamId}')" class="btn btn-secondary" style="padding:4px 8px;font-size:12px;margin-right:4px;">View Members</button><button onclick="deleteTeam('${teamId}', '${team.team_name}')" class="btn btn-danger" style="padding:4px 8px;font-size:12px;background:#ef4444;">Delete</button></td></tr>`;
        });
        html += "</tbody></table></div>";
        r.innerHTML = html;
      } else {
        r.innerHTML =
          '<p style="color:#64748b;">No teams found. Create a team first.</p>';
      }
    })
    .catch(
      (err) => (r.innerHTML = `<p style="color:#ef4444;">Error: ${err}</p>`));
}

// DELETE TEAM
function deleteTeam(teamId, teamName) {
  if (
    !confirm(
      `Are you sure you want to delete team "${teamName}"? This will also remove all team members.`,
    )
  )
    return;

  fetch(`/api/admin/teams/${teamId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.success) {
        alert("✅ Team deleted successfully!");
        viewAllTeams();
      } else {
        alert("❌ Error: " + (data.message || "Failed to delete team"));
      }
    })
    .catch((err) => alert("❌ Error: " + err.message));
}

// 2. CREATE TEAM
function createTeamForm() {
  const r = document.getElementById("teamResults");
  if (!r) return;
  r.innerHTML = `<div style="background:white;border-radius:8px;padding:20px;"><h3>Create New Team</h3><form id="createTeamForm" style="display:grid;gap:12px;max-width:500px;margin-top:20px;"><div><label style="display:block;margin-bottom:4px;font-weight:500;">Team Name *</label><input type="text" id="teamName" required style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:6px;"></div><button type="submit" class="btn btn-primary">Create Team</button><button type="button" onclick="viewAllTeams()" class="btn btn-secondary">Cancel</button></form></div>`;
  setTimeout(() => {
    document
      .getElementById("createTeamForm")
      .addEventListener("submit", async (e) => {
        e.preventDefault();
        const res = await fetch("/api/teams/create",
          {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({
              team_name: document.getElementById("teamName").value,
              manager_id: null,
            }),
          });
        const data = await res.json();
        if (data.success) {
          alert("✅ Team created!");
          viewAllTeams();
        } else {
          alert("❌ Error: " + data.message);
        }
      });
  }, 100);
}

// 3. ASSIGN MANAGER
function assignManager(teamId) {
  const r = document.getElementById("teamResults");
  if (!r) return;
  r.innerHTML = "<p>Loading...</p>";
  fetch("/api/employees/list", {
    headers: getAuthHeaders(),
  })
    .then((res) => res.json())
    .then((data) => {
      const employees = data.employees || data.users || [];
      if (data.success && employees) {
        let html = `<div style="background:white;border-radius:8px;padding:20px;"><h3>Assign Manager</h3><form id="assignManagerForm" style="display:grid;gap:12px;max-width:500px;margin-top:20px;"><div><label>Select User *</label><select id="managerSelect" required style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:6px;"><option value="">-- Select --</option>`;
        employees.forEach((u) => {
          const uId = u.employee_id || u.user_id;
          html += `<option value="${uId}">${u.full_name} (${u.role})</option>`;
        });
        html += `</select></div><button type="submit" class="btn btn-primary">Assign</button><button type="button" onclick="viewAllTeams()" class="btn btn-secondary">Cancel</button></form></div>`;
        r.innerHTML = html;
        setTimeout(() => {
          document
            .getElementById("assignManagerForm")
            .addEventListener("submit", async (e) => {
              e.preventDefault();
              const userId = document.getElementById("managerSelect").value;
              if (!userId) { alert("Please select a user"); return; }
              try {
                const a = await fetch(`/api/teams/${teamId}/manager`, {
                  method: "PUT",
                  headers: getAuthHeaders(),
                  body: JSON.stringify({ manager_id: userId }),
                });
                const ad = await a.json();
                if (ad.success) {
                  alert("✅ Manager assigned!");
                  viewAllTeams();
                } else {
                  alert("❌ " + ad.message);
                }
              } catch (err) {
                alert("❌ Error: " + err.message);
              }
            });
        }, 100);
      }
    });
}

// 4. MANAGE TEAM MEMBERS
function manageTeamMembers() {
  const r = document.getElementById("teamResults");
  if (!r) return;
  r.innerHTML = "<p>Loading teams...</p>";
  fetch("/api/admin/teams", {
    headers: getAuthHeaders(),
  })
    .then((res) => res.json())
    .then((data) => {
      const teams = data.teams || data.data || [];
      if (data.success && teams.length > 0) {
        let html = `<div style="background:white;border-radius:8px;padding:20px;"><h3>Manage Team Members</h3><form id="addMemberForm" style="display:grid;gap:12px;max-width:500px;margin-top:20px;"><div><label>Select Team *</label><select id="teamSelect" required style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:6px;"><option value="">-- Select Team --</option>`;
        teams.forEach(
          (t) =>
            (html += `<option value="${t.team_id || t.id}">${t.team_name}</option>`));
        html += `</select></div><div><label>Select Employee *</label><select id="memberSelect" required style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:6px;"><option value="">-- Select Employee --</option></select></div><button type="submit" class="btn btn-primary">Add Member</button><button type="button" onclick="viewAllTeams()" class="btn btn-secondary">Cancel</button></form></div>`;
        r.innerHTML = html;
        setTimeout(() => {
          fetch("/api/employees/list", {
            headers: getAuthHeaders(),
          })
            .then((res) => res.json())
            .then((userData) => {
              const sel = document.getElementById("memberSelect");
              const employees = userData.employees || userData.users || [];
              employees.forEach((u) => {
                const uId = u.employee_id || u.user_id;
                if (u.role === "employee")
                  sel.innerHTML += `<option value="${uId}">${u.full_name}</option>`;
              });
            });
          document
            .getElementById("addMemberForm")
            .addEventListener("submit", async (e) => {
              e.preventDefault();
              const teamId = document.getElementById("teamSelect").value;
              const memberId = document.getElementById("memberSelect").value;
              console.log("Selected employee id:", memberId);
              console.log("Add Member Payload:", { employee_id: memberId });
              const res = await fetch(`/api/teams/${teamId}/add-member`,
                {
                  method: "POST",
                  headers: getAuthHeaders(),
                  body: JSON.stringify({
                    employee_id: memberId,
                  }),
                });
              const result = await res.json();
              console.log("Add Member API Response:", result);
              if (result.success) {
                alert("✅ Member added!");
                manageTeamMembers();
              } else {
                alert("❌ " + result.message);
              }
            });
        }, 100);
      } else {
        r.innerHTML = "<p>No teams found. Create a team first.</p>";
      }
    });
}

// 5. VIEW TEAM MEMBERS
function viewTeamMembers(teamId) {
  const r = document.getElementById("teamResults");
  if (!r) return;
  r.innerHTML = "<p>Loading members...</p>";
  fetch(`/api/teams/${teamId}/members`,
    { headers: getAuthHeaders() })
    .then((res) => res.json())
    .then((data) => {
      let html = `<div style="background:white;border-radius:8px;padding:20px;"><h3>Team Members</h3><button onclick="viewAllTeams()" class="btn btn-secondary" style="margin-bottom:15px;">← Back</button>`;
      if (data.success && data.members && data.members.length > 0) {
        html +=
          '<table style="width:100%;border-collapse:collapse;"><thead><tr style="background:#f1f5f9;"><th style="padding:12px;text-align:left;">Name</th><th style="padding:12px;text-align:left;">User ID</th><th style="padding:12px;text-align:left;">Role</th></tr></thead><tbody>';
        data.members.forEach(
          (m) =>
            (html += `<tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:12px;">${m.full_name}</td><td style="padding:12px;">${m.user_id}</td><td style="padding:12px;">${m.role}</td></tr>`),
        );
        html += "</tbody></table>";
      } else {
        html += '<p style="color:#64748b;">No members yet.</p>';
      }
      html += "</div>";
      r.innerHTML = html;
    });
}

// 6. VIEW HIERARCHY
function viewManagerHierarchy() {
  const r = document.getElementById("teamResults");
  if (!r) return;
  r.innerHTML = "<p>Loading hierarchy...</p>";
  fetch("/api/admin/teams", {
    headers: getAuthHeaders(),
  })
    .then((res) => res.json())
    .then((data) => {
      const teams = data.teams || data.data || [];
      if (data.success && teams.length > 0) {
        let html =
          '<div style="background:white;border-radius:8px;padding:20px;"><h3>Team Hierarchy</h3>';
        teams.forEach((team) => {
          html += `<div style="background:#f8fafc;padding:16px;border-radius:8px;margin-bottom:12px;border-left:4px solid #3b82f6;"><h4 style="margin:0 0 8px 0;">${team.team_name}</h4><p style="margin:0;color:#64748b;">Manager: ${team.manager_id || "Not Assigned"}</p></div>`;
        });
        html += "</div>";
        r.innerHTML = html;
      }
    });
}

// Manager-specific functions
function viewMyTeamMembers() {
  const r = document.getElementById("myTeamResults");
  if (!r) return;
  r.innerHTML = "<p>Loading your team...</p>";
  const managerId = currentUser.user_id;

  console.log("Manager ID:", managerId);

  // First get the team where this user is manager
  fetch("/api/admin/teams", {
    headers: getAuthHeaders(),
  })
    .then((res) => res.json())
    .then((data) => {
      const teams = data.teams || data.data || [];
      console.log("All teams:", teams);
      console.log("Looking for manager_id:", managerId);

      const myTeam = teams.find(
        (t) =>
          t.manager_id === managerId ||
          t.manager_id === managerId.toUpperCase() ||
          t.manager_id === managerId.toLowerCase());
      console.log("My team:", myTeam);

      if (!myTeam) {
        r.innerHTML =
          "<p>You are not assigned as a manager to any team. Debug: manager_id=" +
          managerId +
          "</p>";
        return;
      }

      // Get team members
      const teamId = myTeam.team_id || myTeam.id;
      return fetch(`/api/admin/teams/${teamId}/members`,
        { headers: getAuthHeaders() });
    })
    .then((res) => (res ? res.json() : null))
    .then((data) => {
      if (data && data.success && data.members && data.members.length > 0) {
        let html = `<div style="background:white;border-radius:8px;padding:20px;"><h3>My Team Members</h3><table style="width:100%;border-collapse:collapse;margin-top:20px;"><thead><tr style="background:#f1f5f9;"><th style="padding:12px;text-align:left;">Name</th><th style="padding:12px;text-align:left;">Role</th><th style="padding:12px;text-align:left;">User ID</th></tr></thead><tbody>`;
        data.members.forEach((m) => {
          html += `<tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:12px;">${m.full_name}</td><td style="padding:12px;">${m.role}</td><td style="padding:12px;">${m.user_id}</td></tr>`;
        });
        html += "</tbody></table></div>";
        r.innerHTML = html;
      } else if (data) {
        r.innerHTML = "<p>No team members found.</p>";
      }
    })
    .catch(
      (err) =>
        (r.innerHTML = `<p style="color:#ef4444;">Error: ${err.message}</p>`),
    );
}

function assignTaskToMyTeam() {
  const r = document.getElementById("myTeamResults");
  if (!r) return;
  r.innerHTML = "<p>Loading team members...</p>";
  const managerId = currentUser.user_id;

  console.log("📍 Section: assign-task");
  console.log("Manager ID:", managerId);

  fetch("/api/admin/teams", {
    headers: getAuthHeaders(),
  })
    .then((res) => res.json())
    .then((data) => {
      const teams = data.teams || data.data || [];
      console.log("All teams:", teams);
      console.log("Looking for manager_id:", managerId);

      const myTeam = teams.find(
        (t) =>
          t.manager_id === managerId ||
          t.manager_id === managerId.toUpperCase() ||
          t.manager_id === managerId.toLowerCase());
      console.log("My team:", myTeam);

      if (!myTeam) {
        r.innerHTML = "<p>You are not assigned as a manager to any team.</p>";
        return;
      }

      const teamId = myTeam.team_id || myTeam.id;
      return fetch(`/api/admin/teams/${teamId}/members`,
        { headers: getAuthHeaders() });
    })
    .then((res) => (res ? res.json() : null))
    .then((data) => {
      console.log("Members data:", data);
      console.log("teamResults element:", r);
      if (data && data.success && data.members) {
        let html = `<div style="background:white;border-radius:8px;padding:20px;"><h3>Assign Task to Team Member</h3><form id="assignTaskForm" style="display:grid;gap:12px;max-width:500px;margin-top:20px;"><div><label>Team Member *</label><select id="taskMember" required style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:6px;"><option value="">-- Select Member --</option>`;
        data.members.forEach(
          (m) =>
            (html += `<option value="${m.full_name}">${m.full_name}</option>`),
        );
        html += `</select></div><div><label>Task Title *</label><input type="text" id="taskTitle" required style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:6px;"></div><div><label>Description</label><textarea id="taskDesc" rows="3" style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:6px;"></textarea></div><div><label>Priority</label><select id="taskPriority" style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:6px;"><option value="Low">Low</option><option value="Medium" selected>Medium</option><option value="High">High</option></select></div><div><label>Due Date</label><input type="date" id="taskDue" style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:6px;"></div><button type="submit" class="btn btn-primary">Assign Task</button></form></div>`;
        console.log("Setting HTML, length:", html.length);
        r.innerHTML = html;
        console.log("HTML set successfully");
        setTimeout(() => {
          document
            .getElementById("assignTaskForm")
            .addEventListener("submit", async (e) => {
              e.preventDefault();
              const taskData = {
                task_id: "TASK" + Date.now(),
                title: document.getElementById("taskTitle").value,
                description: document.getElementById("taskDesc").value,
                assigned_to: document.getElementById("taskMember").value,
                assigned_by: managerId,
                priority: document.getElementById("taskPriority").value,
                due_date: document.getElementById("taskDue").value,
                status: "To Do",
              };
              const res = await fetch("/api/tasks",
                {
                  method: "POST",
                  headers: getAuthHeaders(),
                  body: JSON.stringify(taskData),
                });
              const result = await res.json();
              if (result.success) {
                alert("✅ Task assigned!");
                assignTaskToMyTeam();
              } else {
                alert("❌ " + result.message);
              }
            });
        }, 100);
      } else if (data) {
        r.innerHTML = "<p>No team members found.</p>";
      }
    })
    .catch((err) => {
      console.error("Error:", err);
      r.innerHTML = `<p style="color:#ef4444;">Error: ${err.message}</p>`;
    });
}

function viewMyTeamPerformance() {
  const r = document.getElementById("myTeamResults");
  if (!r) return;
  r.innerHTML = "<p>Loading team performance...</p>";
  const managerId = currentUser.user_id;

  console.log("📍 Section: team-performance");
  console.log("Manager ID:", managerId);

  fetch("/api/admin/teams", {
    headers: getAuthHeaders(),
  })
    .then((res) => res.json())
    .then((data) => {
      const teams = data.teams || data.data || [];
      console.log("All teams:", teams);
      console.log("Looking for manager_id:", managerId);

      const myTeam = teams.find(
        (t) =>
          t.manager_id === managerId ||
          t.manager_id === managerId.toUpperCase() ||
          t.manager_id === managerId.toLowerCase());
      console.log("My team:", myTeam);

      if (!myTeam) {
        r.innerHTML = "<p>You are not assigned as a manager to any team.</p>";
        return;
      }

      const teamId = myTeam.team_id || myTeam.id;
      return fetch(`/api/admin/teams/${teamId}/members`,
        { headers: getAuthHeaders() });
    })
    .then((res) => (res ? res.json() : null))
    .then((data) => {
      console.log("Performance members data:", data);
      if (data && data.success && data.members && data.members.length > 0) {
        // Fetch attendance stats for each member to calculate performance
        Promise.all(
          data.members.map((m) =>
            fetch(`/api/attendance/user/${m.user_id}`,
              { headers: getAuthHeaders() })
              .then((r) => r.json())
              .then((att) => ({ ...m, attendance: att.records || [] }))
              .catch(() => ({ ...m, attendance: [] })),
          ),
        ).then((membersWithData) => {
          let html = `<div style="background:white;border-radius:8px;padding:20px;"><h3>Team Performance Overview</h3><table style="width:100%;border-collapse:collapse;margin-top:20px;"><thead><tr style="background:#f1f5f9;"><th style="padding:12px;text-align:left;">Member</th><th style="padding:12px;text-align:left;">Role</th><th style="padding:12px;text-align:left;">Attendance Rate</th></tr></thead><tbody>`;
          membersWithData.forEach((m) => {
            const totalDays = m.attendance.length;
            const presentDays = m.attendance.filter(
              (a) => a.status === "present",
            ).length;
            const rate =
              totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;
            const color =
              rate >= 90 ? "#10b981" : rate >= 75 ? "#f59e0b" : "#ef4444";
            html += `<tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:12px;">${m.full_name}</td><td style="padding:12px;">${m.role || "Employee"}</td><td style="padding:12px;font-weight:600;color:${color};">${rate}%</td></tr>`;
          });
          html += "</tbody></table></div>";
          r.innerHTML = html;
        });
      } else if (data) {
        r.innerHTML = "<p>No team members found.</p>";
      }
    })
    .catch((err) => {
      console.error("Error:", err);
      r.innerHTML = `<p style="color:#ef4444;">Error: ${err.message}</p>`;
    });
}

function viewMyTeamAttendance() {
  const r = document.getElementById("myTeamResults");
  if (!r) return;
  r.innerHTML = "<p>Loading team attendance...</p>";
  const managerId = currentUser.user_id;

  console.log("📍 Section: team-attendance");
  console.log("Manager ID:", managerId);

  fetch("/api/admin/teams", {
    headers: getAuthHeaders(),
  })
    .then((res) => res.json())
    .then((data) => {
      const teams = data.teams || data.data || [];
      console.log("All teams:", teams);
      console.log("Looking for manager_id:", managerId);

      const myTeam = teams.find(
        (t) =>
          t.manager_id === managerId ||
          t.manager_id === managerId.toUpperCase() ||
          t.manager_id === managerId.toLowerCase());
      console.log("My team:", myTeam);

      if (!myTeam) {
        r.innerHTML = "<p>You are not assigned as a manager to any team.</p>";
        return;
      }

      const teamId = myTeam.team_id || myTeam.id;
      return fetch(`/api/admin/teams/${teamId}/members`,
        { headers: getAuthHeaders() });
    })
    .then((res) => (res ? res.json() : null))
    .then((data) => {
      console.log("Attendance members data:", data);
      if (data && data.success && data.members) {
        const today = new Date().toISOString().split("T")[0];
        // Fetch today's attendance for each member
        Promise.all(
          data.members.map((m) =>
            fetch(`/api/attendance/user/${m.user_id}`,
              { headers: getAuthHeaders() })
              .then((r) => r.json())
              .then((att) => {
                const todayRecord = (att.records || []).find(
                  (rec) => rec.date === today,
                );
                return {
                  ...m,
                  todayStatus: todayRecord ? todayRecord.status : "absent",
                };
              })
              .catch(() => ({ ...m, todayStatus: "absent" })),
          ),
        ).then((membersWithAttendance) => {
          let html = `<div style="background:white;border-radius:8px;padding:20px;"><h3>Team Attendance (Today)</h3><table style="width:100%;border-collapse:collapse;margin-top:20px;"><thead><tr style="background:#f1f5f9;"><th style="padding:12px;text-align:left;">Member</th><th style="padding:12px;text-align:left;">Status</th></tr></thead><tbody>`;
          membersWithAttendance.forEach((m) => {
            const status = m.todayStatus;
            const bgColor =
              status === "present"
                ? "#d1fae5"
                : status === "leave"
                  ? "#fef3c7"
                  : "#fee2e2";
            const textColor =
              status === "present"
                ? "#10b981"
                : status === "leave"
                  ? "#f59e0b"
                  : "#ef4444";
            const displayStatus =
              status.charAt(0).toUpperCase() + status.slice(1);
            html += `<tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:12px;">${m.full_name}</td><td style="padding:12px;"><span style="background:${bgColor};color:${textColor};padding:4px 12px;border-radius:12px;font-size:12px;">${displayStatus}</span></td></tr>`;
          });
          html += "</tbody></table></div>";
          r.innerHTML = html;
        });
      } else if (data) {
        r.innerHTML = "<p>No team members found.</p>";
      }
    })
    .catch((err) => {
      console.error("Error:", err);
      r.innerHTML = `<p style="color:#ef4444;">Error: ${err.message}</p>`;
    });
}

function giveTeamFeedback() {
  const r = document.getElementById("myTeamResults");
  if (!r) return;
  r.innerHTML = "<p>Loading team members...</p>";
  const managerId = currentUser.user_id;

  console.log("📍 Section: team-feedback");
  console.log("Manager ID:", managerId);

  fetch("/api/admin/teams", {
    headers: getAuthHeaders(),
  })
    .then((res) => res.json())
    .then((data) => {
      const teams = data.teams || data.data || [];
      console.log("All teams:", teams);
      console.log("Looking for manager_id:", managerId);

      const myTeam = teams.find(
        (t) =>
          t.manager_id === managerId ||
          t.manager_id === managerId.toUpperCase() ||
          t.manager_id === managerId.toLowerCase());
      console.log("My team:", myTeam);

      if (!myTeam) {
        r.innerHTML = "<p>You are not assigned as a manager to any team.</p>";
        return;
      }

      const teamId = myTeam.team_id || myTeam.id;
      return fetch(`/api/admin/teams/${teamId}/members`,
        { headers: getAuthHeaders() });
    })
    .then((res) => (res ? res.json() : null))
    .then((data) => {
      console.log("Feedback members data:", data);
      if (data && data.success && data.members) {
        let html = `<div style="background:white;border-radius:8px;padding:20px;"><h3>Give Team Feedback</h3><form id="feedbackForm" style="display:grid;gap:12px;max-width:500px;margin-top:20px;"><div><label>Team Member *</label><select id="feedbackMember" required style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:6px;"><option value="">-- Select Member --</option>`;
        data.members.forEach(
          (m) =>
            (html += `<option value="${m.user_id}">${m.full_name}</option>`),
        );
        html += `</select></div><div><label>Feedback *</label><textarea id="feedbackText" required rows="4" style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:6px;"></textarea></div><div><label>Rating (1-5)</label><input type="number" id="feedbackRating" min="1" max="5" value="3" style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:6px;"></div><button type="submit" class="btn btn-primary">Submit Feedback</button></form></div>`;
        r.innerHTML = html;
        setTimeout(() => {
          document
            .getElementById("feedbackForm")
            .addEventListener("submit", async (e) => {
              e.preventDefault();
              console.log("🔵 Feedback form submitted");
              console.log("🔵 Manager ID:", managerId);
              console.log("🔵 Current User:", currentUser);

              const feedbackData = {
                employee_id: document.getElementById("feedbackMember").value,
                remark: document.getElementById("feedbackText").value,
                rating: document.getElementById("feedbackRating").value,
                added_by: managerId,
                created_by: managerId,
                created_by_name: currentUser.full_name || "Manager",
              };

              console.log("🔵 Feedback Data:", feedbackData);

              try {
                const res = await fetch("/api/remarks/add",
                  {
                    method: "POST",
                    headers: getAuthHeaders(),
                    body: JSON.stringify(feedbackData),
                  });

                console.log("🔵 Response status:", res.status);
                const result = await res.json();
                console.log("🔵 Response data:", result);

                if (result.success) {
                  alert(
                    `✅ ${result.message}\n\nAI Analysis: ${result.sentiment}\n${result.performance_impact || ""}`,
                  );
                  giveTeamFeedback();
                } else {
                  alert(
                    "❌ " +
                      (result.message ||
                        result.detail ||
                        "Failed to submit feedback"),
                  );
                }
              } catch (error) {
                console.error("🔴 Error submitting feedback:", error);
                alert("❌ Error: " + error.message);
              }
            });
        }, 100);
      } else if (data) {
        r.innerHTML = "<p>No team members found.</p>";
      }
    })
    .catch((err) => {
      console.error("Error:", err);
      r.innerHTML = `<p style="color:#ef4444;">Error: ${err.message}</p>`;
    });
}

if (typeof window.viewAllShifts !== 'function') {
    window.viewAllShifts = function () {
        alert("Shift Management module coming soon");
    };
}

console.log("✅ Complete team management loaded");
