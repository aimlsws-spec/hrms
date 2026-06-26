
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function getAuthHeaders() {
    const user = JSON.parse(sessionStorage.getItem('user') || '{}');
    return {
        'Content-Type': 'application/json',
        'authorization': `${user.user_id || 'admin'},${user.role || 'admin'}`,
    };
}

function _teamResult() {
    return document.getElementById('teamResults');
}

function _myTeamResult() {
    return document.getElementById('myTeamResults');
}

async function _loadEmployees() {
    const res  = await fetch('/api/employees/list', { headers: getAuthHeaders() });
    const data = await res.json();
    return data.employees || [];
}

async function _loadTeams() {
    const res  = await fetch('/api/teams', { headers: getAuthHeaders() });
    const data = await res.json();
    return data.teams || [];
}

function _empOptions(employees) {
    return employees.map(e =>
        `<option value="${e.employee_id}">${e.full_name}${e.role ? ' (' + e.role + ')' : ''}</option>`
    ).join('');
}

function _msgBox(id, text, color) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `<p style="color:${color};font-weight:600;margin-top:10px;">${text}</p>`;
}


// ── 1. VIEW ALL TEAMS ────────────────────────────────────────────────────────

async function viewAllTeams() {
    const r = _teamResult();
    if (!r) return;
    r.innerHTML = '<p style="color:#64748b;">Loading teams…</p>';
    try {
        const teams = await _loadTeams();
        if (!teams.length) {
            r.innerHTML = '<p style="color:#64748b;">No teams found. Create a team first.</p>';
            return;
        }
        let html = `
            <div style="background:#fff;border-radius:8px;padding:20px;">
              <h3 style="margin:0 0 16px;">All Teams (${teams.length})</h3>
              <table style="width:100%;border-collapse:collapse;">
                <thead>
                  <tr style="background:#f1f5f9;border-bottom:2px solid #e2e8f0;">
                    <th style="padding:12px;text-align:left;">Team Name</th>
                    <th style="padding:12px;text-align:left;">Manager</th>
                    <th style="padding:12px;text-align:left;">Members</th>
                    <th style="padding:12px;text-align:left;">Actions</th>
                  </tr>
                </thead><tbody>`;
        teams.forEach(t => {
            const tid = t.id || t.team_id;
            const mgr = t.manager_name || t.manager_id || '—';
            const cnt = t.member_count != null ? t.member_count : '—';
            html += `
                <tr style="border-bottom:1px solid #e2e8f0;">
                  <td style="padding:12px;font-weight:600;">${t.team_name}</td>
                  <td style="padding:12px;">${mgr}</td>
                  <td style="padding:12px;">${cnt}</td>
                  <td style="padding:12px;display:flex;gap:6px;flex-wrap:wrap;">
                    <button onclick="assignManager(${tid})" class="btn btn-primary" style="padding:4px 10px;font-size:12px;">Assign Manager</button>
                    <button onclick="viewTeamMembers(${tid})" class="btn btn-secondary" style="padding:4px 10px;font-size:12px;">Members</button>
                    <button onclick="manageTeamMembers(${tid})" class="btn btn-secondary" style="padding:4px 10px;font-size:12px;">Add/Remove</button>
                    <button onclick="deleteTeam(${tid},'${t.team_name.replace(/'/g,"\\'")}');" class="btn" style="padding:4px 10px;font-size:12px;background:#ef4444;color:#fff;border:none;border-radius:4px;cursor:pointer;">Delete</button>
                  </td>
                </tr>`;
        });
        html += '</tbody></table></div>';
        r.innerHTML = html;
    } catch (e) {
        r.innerHTML = `<p style="color:#ef4444;">Error loading teams: ${e.message}</p>`;
    }
}


// ── 2. DELETE TEAM ────────────────────────────────────────────────────────────

async function deleteTeam(teamId, teamName) {
    if (!confirm(`Delete team "${teamName}"? This will remove all member links.`)) return;
    try {
        const res  = await fetch(`/api/teams/${teamId}`, { method: 'DELETE', headers: getAuthHeaders() });
        const data = await res.json();
        if (data.success) {
            alert('✅ Team deleted.');
            viewAllTeams();
        } else {
            alert('❌ ' + (data.message || 'Failed to delete team'));
        }
    } catch (e) {
        alert('❌ ' + e.message);
    }
}


// ── 3. CREATE TEAM ────────────────────────────────────────────────────────────

async function createTeamForm() {
    const r = _teamResult();
    if (!r) return;
    r.innerHTML = '<p style="color:#64748b;">Loading employees…</p>';

    let employees = [];
    try {
        employees = await _loadEmployees();
    } catch (e) {
        r.innerHTML = '<p style="color:#ef4444;">Failed to load employees.</p>';
        return;
    }

    const opts = _empOptions(employees);

    r.innerHTML = `
        <div style="background:#fff;border-radius:8px;padding:20px;">
          <h3 style="margin:0 0 16px;">Create New Team</h3>
          <form id="createTeamFormEl" style="display:grid;gap:14px;max-width:520px;">
            <div>
              <label style="display:block;margin-bottom:4px;font-weight:500;">Team Name *</label>
              <input type="text" id="ct_name" required placeholder="e.g. Backend Team"
                style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:14px;">
            </div>
            <div>
              <label style="display:block;margin-bottom:4px;font-weight:500;">Description</label>
              <textarea id="ct_desc" rows="3" placeholder="Optional team description"
                style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:14px;resize:vertical;"></textarea>
            </div>
            <div>
              <label style="display:block;margin-bottom:4px;font-weight:500;">Manager</label>
              <select id="ct_manager" style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:14px;">
                <option value="">— No Manager —</option>
                ${opts}
              </select>
            </div>
            <div>
              <label style="display:block;margin-bottom:4px;font-weight:500;">Employees</label>
              <select id="ct_members" multiple
                style="width:100%;padding:6px;border:1px solid #e2e8f0;border-radius:6px;font-size:14px;min-height:130px;">
                ${opts}
              </select>
              <small style="color:#94a3b8;font-size:12px;">Hold Ctrl / Cmd to select multiple</small>
            </div>
            <div style="display:flex;gap:8px;">
              <button type="submit" id="ct_submit" class="btn btn-primary">Create Team</button>
              <button type="button" onclick="viewAllTeams()" class="btn btn-secondary">Cancel</button>
            </div>
          </form>
          <div id="ct_msg"></div>
        </div>`;

    document.getElementById('createTeamFormEl').addEventListener('submit', async function (e) {
        e.preventDefault();
        const btn = document.getElementById('ct_submit');
        btn.disabled = true;
        btn.textContent = 'Creating…';

        const name      = document.getElementById('ct_name').value.trim();
        const desc      = document.getElementById('ct_desc').value.trim();
        const managerId = document.getElementById('ct_manager').value;
        const memberIds = Array.from(document.getElementById('ct_members').selectedOptions).map(o => o.value);
        const user      = JSON.parse(sessionStorage.getItem('user') || '{}');

        try {
            const res  = await fetch('/api/teams/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ team_name: name, description: desc || null, manager_id: managerId || null, created_by: user.user_id || null }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message || 'Failed to create team');

            for (const empId of memberIds) {
                await fetch(`/api/teams/${data.team_id}/add-member`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ employee_id: empId }),
                });
            }

            _msgBox('ct_msg', '✓ Team created successfully!', '#10b981');
            setTimeout(() => viewAllTeams(), 1200);
        } catch (err) {
            _msgBox('ct_msg', '✗ ' + err.message, '#ef4444');
            btn.disabled = false;
            btn.textContent = 'Create Team';
        }
    });
}


// ── 4. ASSIGN MANAGER ─────────────────────────────────────────────────────────

async function assignManager(teamId) {
    const r = _teamResult();
    if (!r) return;
    r.innerHTML = '<p style="color:#64748b;">Loading employees…</p>';
    try {
        const employees = await _loadEmployees();
        const opts = _empOptions(employees);
        r.innerHTML = `
            <div style="background:#fff;border-radius:8px;padding:20px;">
              <h3 style="margin:0 0 16px;">Assign Manager</h3>
              <form id="assignMgrForm" style="display:grid;gap:14px;max-width:460px;">
                <div>
                  <label style="display:block;margin-bottom:4px;font-weight:500;">Select Manager *</label>
                  <select id="am_manager" required style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:14px;">
                    <option value="">— Select —</option>
                    ${opts}
                  </select>
                </div>
                <div style="display:flex;gap:8px;">
                  <button type="submit" id="am_submit" class="btn btn-primary">Assign</button>
                  <button type="button" onclick="viewAllTeams()" class="btn btn-secondary">Cancel</button>
                </div>
              </form>
              <div id="am_msg"></div>
            </div>`;

        document.getElementById('assignMgrForm').addEventListener('submit', async function (e) {
            e.preventDefault();
            const btn      = document.getElementById('am_submit');
            const managerId = document.getElementById('am_manager').value;
            btn.disabled = true;
            btn.textContent = 'Assigning…';
            try {
                const res  = await fetch(`/api/teams/${teamId}/manager`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ manager_id: managerId }),
                });
                const data = await res.json();
                if (!data.success) throw new Error(data.message || 'Failed to assign manager');
                _msgBox('am_msg', '✓ Manager assigned!', '#10b981');
                setTimeout(() => viewAllTeams(), 1000);
            } catch (err) {
                _msgBox('am_msg', '✗ ' + err.message, '#ef4444');
                btn.disabled = false;
                btn.textContent = 'Assign';
            }
        });
    } catch (e) {
        r.innerHTML = `<p style="color:#ef4444;">Error: ${e.message}</p>`;
    }
}


// ── 5. MANAGE TEAM MEMBERS (add / remove) ─────────────────────────────────────

async function manageTeamMembers(preselectedTeamId) {
    const r = _teamResult();
    if (!r) return;
    r.innerHTML = '<p style="color:#64748b;">Loading…</p>';
    try {
        const [teams, employees] = await Promise.all([_loadTeams(), _loadEmployees()]);
        if (!teams.length) { r.innerHTML = '<p>No teams found. Create a team first.</p>'; return; }

        const teamOpts = teams.map(t => {
            const tid = t.id || t.team_id;
            const sel = preselectedTeamId && tid == preselectedTeamId ? ' selected' : '';
            return `<option value="${tid}"${sel}>${t.team_name}</option>`;
        }).join('');

        r.innerHTML = `
            <div style="background:#fff;border-radius:8px;padding:20px;">
              <h3 style="margin:0 0 16px;">Manage Team Members</h3>
              <div style="display:grid;gap:14px;max-width:520px;">
                <div>
                  <label style="display:block;margin-bottom:4px;font-weight:500;">Select Team *</label>
                  <select id="mm_team" style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:14px;">
                    <option value="">— Select Team —</option>
                    ${teamOpts}
                  </select>
                </div>
                <div id="mm_current" style="min-height:40px;"></div>
                <div>
                  <label style="display:block;margin-bottom:4px;font-weight:500;">Add Employee</label>
                  <div style="display:flex;gap:8px;">
                    <select id="mm_emp" style="flex:1;padding:8px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:14px;">
                      <option value="">— Select Employee —</option>
                      ${_empOptions(employees)}
                    </select>
                    <button onclick="_mmAdd()" class="btn btn-primary" style="white-space:nowrap;">Add</button>
                  </div>
                </div>
                <div><button type="button" onclick="viewAllTeams()" class="btn btn-secondary">← Back</button></div>
              </div>
              <div id="mm_msg"></div>
            </div>`;

        async function loadCurrentMembers() {
            const teamId = document.getElementById('mm_team').value;
            const cur = document.getElementById('mm_current');
            if (!teamId) { cur.innerHTML = ''; return; }
            cur.innerHTML = '<p style="color:#64748b;font-size:13px;">Loading members…</p>';
            try {
                const res  = await fetch(`/api/teams/${teamId}/members`, { headers: getAuthHeaders() });
                const data = await res.json();
                const members = data.members || [];
                if (!members.length) { cur.innerHTML = '<p style="color:#94a3b8;font-size:13px;">No members yet.</p>'; return; }
                let html = '<div style="margin-bottom:8px;font-weight:500;font-size:13px;">Current Members:</div><div style="display:flex;flex-wrap:wrap;gap:6px;">';
                members.forEach(m => {
                    html += `<span style="background:#f1f5f9;border-radius:20px;padding:4px 12px;font-size:13px;display:flex;align-items:center;gap:6px;">
                        ${m.full_name}
                        <button onclick="_mmRemove(${teamId},'${m.employee_id}')" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:14px;line-height:1;padding:0;">&times;</button>
                    </span>`;
                });
                html += '</div>';
                cur.innerHTML = html;
            } catch (e) {
                cur.innerHTML = `<p style="color:#ef4444;font-size:13px;">Error: ${e.message}</p>`;
            }
        }

        document.getElementById('mm_team').addEventListener('change', loadCurrentMembers);
        if (preselectedTeamId) loadCurrentMembers();

        window._mmAdd = async function () {
            const teamId = document.getElementById('mm_team').value;
            const empId  = document.getElementById('mm_emp').value;
            if (!teamId || !empId) { _msgBox('mm_msg', '✗ Select a team and employee.', '#ef4444'); return; }
            try {
                const res  = await fetch(`/api/teams/${teamId}/add-member`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ employee_id: empId }),
                });
                const data = await res.json();
                if (data.success) { _msgBox('mm_msg', '✓ Member added!', '#10b981'); loadCurrentMembers(); }
                else _msgBox('mm_msg', '✗ ' + (data.message || 'Failed'), '#ef4444');
            } catch (e) { _msgBox('mm_msg', '✗ ' + e.message, '#ef4444'); }
        };

        window._mmRemove = async function (teamId, empId) {
            if (!confirm('Remove this member from the team?')) return;
            try {
                const res  = await fetch(`/api/teams/${teamId}/remove-member`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ employee_id: empId }),
                });
                const data = await res.json();
                if (data.success) { _msgBox('mm_msg', '✓ Member removed.', '#10b981'); loadCurrentMembers(); }
                else _msgBox('mm_msg', '✗ ' + (data.message || 'Failed'), '#ef4444');
            } catch (e) { _msgBox('mm_msg', '✗ ' + e.message, '#ef4444'); }
        };
    } catch (e) {
        r.innerHTML = `<p style="color:#ef4444;">Error: ${e.message}</p>`;
    }
}


// ── 6. VIEW TEAM MEMBERS ──────────────────────────────────────────────────────

async function viewTeamMembers(teamId) {
    const r = _teamResult();
    if (!r) return;
    r.innerHTML = '<p style="color:#64748b;">Loading members…</p>';
    try {
        const res  = await fetch(`/api/teams/${teamId}/members`, { headers: getAuthHeaders() });
        const data = await res.json();
        let html = `
            <div style="background:#fff;border-radius:8px;padding:20px;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
                <h3 style="margin:0;">${data.team_name || 'Team'} — Members</h3>
                <button onclick="viewAllTeams()" class="btn btn-secondary" style="font-size:13px;">← Back</button>
              </div>`;
        const members = data.members || [];
        if (members.length) {
            html += `<table style="width:100%;border-collapse:collapse;">
                <thead><tr style="background:#f1f5f9;border-bottom:2px solid #e2e8f0;">
                  <th style="padding:12px;text-align:left;">Name</th>
                  <th style="padding:12px;text-align:left;">ID</th>
                  <th style="padding:12px;text-align:left;">Role</th>
                  <th style="padding:12px;text-align:left;">Email</th>
                </tr></thead><tbody>`;
            members.forEach(m => {
                html += `<tr style="border-bottom:1px solid #e2e8f0;">
                    <td style="padding:12px;">${m.full_name || '—'}</td>
                    <td style="padding:12px;color:#64748b;">${m.employee_id || '—'}</td>
                    <td style="padding:12px;">${m.role || '—'}</td>
                    <td style="padding:12px;">${m.email || '—'}</td>
                  </tr>`;
            });
            html += '</tbody></table>';
        } else {
            html += '<p style="color:#94a3b8;">No members in this team yet.</p>';
        }
        html += '</div>';
        r.innerHTML = html;
    } catch (e) {
        r.innerHTML = `<p style="color:#ef4444;">Error: ${e.message}</p>`;
    }
}


// ── 7. VIEW TEAM HIERARCHY ────────────────────────────────────────────────────

async function viewManagerHierarchy() {
    const r = _teamResult();
    if (!r) return;
    r.innerHTML = '<p style="color:#64748b;">Loading hierarchy…</p>';
    try {
        const teams = await _loadTeams();
        if (!teams.length) { r.innerHTML = '<p style="color:#64748b;">No teams found.</p>'; return; }
        let html = '<div style="background:#fff;border-radius:8px;padding:20px;"><h3 style="margin:0 0 16px;">Team Structure</h3>';
        teams.forEach(t => {
            const mgr = t.manager_name || t.manager_id || 'Not Assigned';
            const cnt = t.member_count != null ? t.member_count : 0;
            const tid = t.id || t.team_id;
            html += `
                <div style="background:#f8fafc;padding:16px;border-radius:8px;margin-bottom:12px;border-left:4px solid #3b82f6;">
                  <h4 style="margin:0 0 6px;">${t.team_name}</h4>
                  <p style="margin:0 0 4px;color:#64748b;font-size:13px;">Manager: <strong>${mgr}</strong></p>
                  <p style="margin:0;color:#64748b;font-size:13px;">Members: ${cnt}
                    &nbsp;<button onclick="viewTeamMembers(${tid})" style="background:none;border:none;color:#3b82f6;cursor:pointer;font-size:12px;padding:0;">View →</button>
                  </p>
                  ${t.description ? `<p style="margin:6px 0 0;color:#94a3b8;font-size:12px;">${t.description}</p>` : ''}
                </div>`;
        });
        html += '</div>';
        r.innerHTML = html;
    } catch (e) {
        r.innerHTML = `<p style="color:#ef4444;">Error: ${e.message}</p>`;
    }
}


// ── MANAGER-ONLY FUNCTIONS ────────────────────────────────────────────────────

async function _getMyTeam(resultEl) {
    const managerId = (typeof currentUser !== 'undefined' ? currentUser.user_id : null)
        || (JSON.parse(sessionStorage.getItem('user') || '{}').user_id);
    const teams = await _loadTeams();
    const myTeam = teams.find(t =>
        t.manager_id === managerId ||
        t.manager_id === (managerId || '').toUpperCase() ||
        t.manager_id === (managerId || '').toLowerCase()
    );
    if (!myTeam) {
        resultEl.innerHTML = '<p style="color:#64748b;">You are not assigned as a manager to any team.</p>';
        return null;
    }
    return { id: myTeam.id || myTeam.team_id, name: myTeam.team_name };
}

async function _getMyTeamMembers(resultEl) {
    const team = await _getMyTeam(resultEl);
    if (!team) return null;
    const res  = await fetch(`/api/teams/${team.id}/members`, { headers: getAuthHeaders() });
    const data = await res.json();
    return { team, members: data.members || [] };
}


async function viewMyTeamMembers() {
    const r = _myTeamResult();
    if (!r) return;
    r.innerHTML = '<p>Loading your team…</p>';
    try {
        const info = await _getMyTeamMembers(r);
        if (!info) return;
        const { team, members } = info;
        let html = `<div style="background:#fff;border-radius:8px;padding:20px;"><h3 style="margin:0 0 16px;">${team.name} — My Team</h3>`;
        if (members.length) {
            html += `<table style="width:100%;border-collapse:collapse;">
                <thead><tr style="background:#f1f5f9;border-bottom:2px solid #e2e8f0;">
                  <th style="padding:12px;text-align:left;">Name</th>
                  <th style="padding:12px;text-align:left;">Role</th>
                  <th style="padding:12px;text-align:left;">Email</th>
                </tr></thead><tbody>`;
            members.forEach(m => {
                html += `<tr style="border-bottom:1px solid #e2e8f0;">
                    <td style="padding:12px;">${m.full_name}</td>
                    <td style="padding:12px;">${m.role || '—'}</td>
                    <td style="padding:12px;">${m.email || '—'}</td>
                  </tr>`;
            });
            html += '</tbody></table>';
        } else {
            html += '<p style="color:#94a3b8;">No members yet.</p>';
        }
        html += '</div>';
        r.innerHTML = html;
    } catch (e) {
        r.innerHTML = `<p style="color:#ef4444;">Error: ${e.message}</p>`;
    }
}


async function assignTaskToMyTeam() {
    const r = _myTeamResult();
    if (!r) return;
    r.innerHTML = '<p>Loading team members…</p>';
    try {
        const info = await _getMyTeamMembers(r);
        if (!info) return;
        const { members } = info;
        if (!members.length) { r.innerHTML = '<p>No team members found.</p>'; return; }

        const user = JSON.parse(sessionStorage.getItem('user') || '{}');
        const managerId = user.user_id;

        let html = `
            <div style="background:#fff;border-radius:8px;padding:20px;">
              <h3 style="margin:0 0 16px;">Assign Task to Team Member</h3>
              <form id="assignTaskForm" style="display:grid;gap:12px;max-width:500px;">
                <div>
                  <label style="display:block;margin-bottom:4px;font-weight:500;">Team Member *</label>
                  <select id="taskMember" required style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:6px;">
                    <option value="">— Select Member —</option>
                    ${members.map(m => `<option value="${m.full_name}">${m.full_name}</option>`).join('')}
                  </select>
                </div>
                <div>
                  <label style="display:block;margin-bottom:4px;font-weight:500;">Task Title *</label>
                  <input type="text" id="taskTitle" required style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:6px;">
                </div>
                <div>
                  <label style="display:block;margin-bottom:4px;font-weight:500;">Description</label>
                  <textarea id="taskDesc" rows="3" style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:6px;resize:vertical;"></textarea>
                </div>
                <div>
                  <label style="display:block;margin-bottom:4px;font-weight:500;">Priority</label>
                  <select id="taskPriority" style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:6px;">
                    <option value="Low">Low</option>
                    <option value="Medium" selected>Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
                <div>
                  <label style="display:block;margin-bottom:4px;font-weight:500;">Due Date</label>
                  <input type="date" id="taskDue" style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:6px;">
                </div>
                <div style="display:flex;gap:8px;">
                  <button type="submit" class="btn btn-primary">Assign Task</button>
                </div>
              </form>
              <div id="at_msg"></div>
            </div>`;
        r.innerHTML = html;

        document.getElementById('assignTaskForm').addEventListener('submit', async function (e) {
            e.preventDefault();
            const taskData = {
                task_id: 'TASK' + Date.now(),
                title: document.getElementById('taskTitle').value,
                description: document.getElementById('taskDesc').value,
                assigned_to: document.getElementById('taskMember').value,
                assigned_by: managerId,
                priority: document.getElementById('taskPriority').value,
                due_date: document.getElementById('taskDue').value,
                status: 'To Do',
            };
            try {
                const res  = await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(taskData) });
                const data = await res.json();
                if (data.success) { _msgBox('at_msg', '✓ Task assigned!', '#10b981'); setTimeout(() => assignTaskToMyTeam(), 1000); }
                else _msgBox('at_msg', '✗ ' + (data.message || 'Failed'), '#ef4444');
            } catch (err) { _msgBox('at_msg', '✗ ' + err.message, '#ef4444'); }
        });
    } catch (e) {
        r.innerHTML = `<p style="color:#ef4444;">Error: ${e.message}</p>`;
    }
}


async function viewMyTeamPerformance() {
    const r = _myTeamResult();
    if (!r) return;
    r.innerHTML = '<p>Loading team performance…</p>';
    try {
        const info = await _getMyTeamMembers(r);
        if (!info) return;
        const { team, members } = info;
        if (!members.length) { r.innerHTML = '<p>No team members found.</p>'; return; }

        const withAtt = await Promise.all(members.map(m =>
            fetch(`/api/attendance/user/${m.employee_id}`, { headers: getAuthHeaders() })
                .then(r => r.json())
                .then(att => ({ ...m, attendance: att.records || [] }))
                .catch(() => ({ ...m, attendance: [] }))
        ));

        let html = `<div style="background:#fff;border-radius:8px;padding:20px;">
            <h3 style="margin:0 0 16px;">${team.name} — Performance</h3>
            <table style="width:100%;border-collapse:collapse;">
              <thead><tr style="background:#f1f5f9;border-bottom:2px solid #e2e8f0;">
                <th style="padding:12px;text-align:left;">Member</th>
                <th style="padding:12px;text-align:left;">Role</th>
                <th style="padding:12px;text-align:left;">Attendance Rate</th>
              </tr></thead><tbody>`;
        withAtt.forEach(m => {
            const total   = m.attendance.length;
            const present = m.attendance.filter(a => a.status === 'present').length;
            const rate    = total > 0 ? Math.round((present / total) * 100) : 0;
            const color   = rate >= 90 ? '#10b981' : rate >= 75 ? '#f59e0b' : '#ef4444';
            html += `<tr style="border-bottom:1px solid #e2e8f0;">
                <td style="padding:12px;">${m.full_name}</td>
                <td style="padding:12px;">${m.role || '—'}</td>
                <td style="padding:12px;font-weight:600;color:${color};">${rate}%</td>
              </tr>`;
        });
        html += '</tbody></table></div>';
        r.innerHTML = html;
    } catch (e) {
        r.innerHTML = `<p style="color:#ef4444;">Error: ${e.message}</p>`;
    }
}


async function viewMyTeamAttendance() {
    const r = _myTeamResult();
    if (!r) return;
    r.innerHTML = '<p>Loading team attendance…</p>';
    try {
        const info = await _getMyTeamMembers(r);
        if (!info) return;
        const { team, members } = info;
        if (!members.length) { r.innerHTML = '<p>No team members found.</p>'; return; }

        const today    = new Date().toISOString().split('T')[0];
        const withAtt  = await Promise.all(members.map(m =>
            fetch(`/api/attendance/user/${m.employee_id}`, { headers: getAuthHeaders() })
                .then(r => r.json())
                .then(att => {
                    const rec = (att.records || []).find(a => a.date === today);
                    return { ...m, todayStatus: rec ? rec.status : 'absent' };
                })
                .catch(() => ({ ...m, todayStatus: 'absent' }))
        ));

        let html = `<div style="background:#fff;border-radius:8px;padding:20px;">
            <h3 style="margin:0 0 16px;">${team.name} — Today's Attendance</h3>
            <table style="width:100%;border-collapse:collapse;">
              <thead><tr style="background:#f1f5f9;border-bottom:2px solid #e2e8f0;">
                <th style="padding:12px;text-align:left;">Member</th>
                <th style="padding:12px;text-align:left;">Status</th>
              </tr></thead><tbody>`;
        withAtt.forEach(m => {
            const s = m.todayStatus;
            const bg   = s === 'present' ? '#d1fae5' : s === 'leave' ? '#fef3c7' : '#fee2e2';
            const fg   = s === 'present' ? '#10b981' : s === 'leave' ? '#f59e0b' : '#ef4444';
            html += `<tr style="border-bottom:1px solid #e2e8f0;">
                <td style="padding:12px;">${m.full_name}</td>
                <td style="padding:12px;"><span style="background:${bg};color:${fg};padding:4px 12px;border-radius:12px;font-size:12px;">${s.charAt(0).toUpperCase() + s.slice(1)}</span></td>
              </tr>`;
        });
        html += '</tbody></table></div>';
        r.innerHTML = html;
    } catch (e) {
        r.innerHTML = `<p style="color:#ef4444;">Error: ${e.message}</p>`;
    }
}


async function giveTeamFeedback() {
    const r = _myTeamResult();
    if (!r) return;
    r.innerHTML = '<p>Loading team members…</p>';
    try {
        const info = await _getMyTeamMembers(r);
        if (!info) return;
        const { members } = info;
        if (!members.length) { r.innerHTML = '<p>No team members found.</p>'; return; }

        const user = JSON.parse(sessionStorage.getItem('user') || '{}');
        const managerId = user.user_id;

        r.innerHTML = `
            <div style="background:#fff;border-radius:8px;padding:20px;">
              <h3 style="margin:0 0 16px;">Give Team Feedback</h3>
              <form id="feedbackForm" style="display:grid;gap:12px;max-width:500px;">
                <div>
                  <label style="display:block;margin-bottom:4px;font-weight:500;">Team Member *</label>
                  <select id="feedbackMember" required style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:6px;">
                    <option value="">— Select Member —</option>
                    ${members.map(m => `<option value="${m.employee_id}">${m.full_name}</option>`).join('')}
                  </select>
                </div>
                <div>
                  <label style="display:block;margin-bottom:4px;font-weight:500;">Feedback *</label>
                  <textarea id="feedbackText" required rows="4" style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:6px;resize:vertical;"></textarea>
                </div>
                <div>
                  <label style="display:block;margin-bottom:4px;font-weight:500;">Rating (1–5)</label>
                  <input type="number" id="feedbackRating" min="1" max="5" value="3" style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:6px;">
                </div>
                <div style="display:flex;gap:8px;">
                  <button type="submit" class="btn btn-primary">Submit Feedback</button>
                </div>
              </form>
              <div id="fb_msg"></div>
            </div>`;

        document.getElementById('feedbackForm').addEventListener('submit', async function (e) {
            e.preventDefault();
            const body = {
                employee_id:    document.getElementById('feedbackMember').value,
                remark:         document.getElementById('feedbackText').value,
                rating:         document.getElementById('feedbackRating').value,
                added_by:       managerId,
                created_by:     managerId,
                created_by_name: user.full_name || 'Manager',
            };
            try {
                const res  = await fetch('/api/remarks/add', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
                const data = await res.json();
                if (data.success) {
                    _msgBox('fb_msg', `✓ ${data.message}${data.sentiment ? ' — ' + data.sentiment : ''}`, '#10b981');
                    setTimeout(() => giveTeamFeedback(), 1200);
                } else {
                    _msgBox('fb_msg', '✗ ' + (data.message || data.detail || 'Failed'), '#ef4444');
                }
            } catch (err) { _msgBox('fb_msg', '✗ ' + err.message, '#ef4444'); }
        });
    } catch (e) {
        r.innerHTML = `<p style="color:#ef4444;">Error: ${e.message}</p>`;
    }
}


// ── Dashboard quick-action stubs (used in task-management section) ────────────

function assignTaskToTeamMember() { assignTaskToMyTeam(); }
function viewTeamPerformance()     { viewMyTeamPerformance(); }

console.log('✅ team_functions.js loaded');
