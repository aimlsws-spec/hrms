// Admin Features UI Module - Part 1: Employee Management & Documents

const API_BASE = 'http://localhost:8002';

// ==================== EMPLOYEE MANAGEMENT ====================

function showEditEmployeeForm(employeeId) {
    const html = `
        <div style="background: white; padding: 24px; border-radius: 8px; max-width: 600px;">
            <h3>Edit Employee</h3>
            <form id="editEmployeeForm">
                <input type="text" id="edit_name" placeholder="Full Name" style="width: 100%; padding: 8px; margin: 8px 0;">
                <input type="email" id="edit_email" placeholder="Email" style="width: 100%; padding: 8px; margin: 8px 0;">
                <input type="text" id="edit_phone" placeholder="Phone" style="width: 100%; padding: 8px; margin: 8px 0;">
                <input type="text" id="edit_department" placeholder="Department" style="width: 100%; padding: 8px; margin: 8px 0;">
                <input type="text" id="edit_designation" placeholder="Designation" style="width: 100%; padding: 8px; margin: 8px 0;">
                <input type="text" id="edit_reporting_manager" placeholder="Reporting Manager" style="width: 100%; padding: 8px; margin: 8px 0;">
                <input type="date" id="edit_joining_date" placeholder="Joining Date" style="width: 100%; padding: 8px; margin: 8px 0;">
                <input type="date" id="edit_probation_end" placeholder="Probation End Date" style="width: 100%; padding: 8px; margin: 8px 0;">
                <button type="submit" style="background: #3b82f6; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer;">Update Employee</button>
            </form>
        </div>
    `;
    
    displayResults('mainContent', html);
    
    document.getElementById('editEmployeeForm').onsubmit = async (e) => {
        e.preventDefault();
        const data = {
            name: document.getElementById('edit_name').value,
            email: document.getElementById('edit_email').value,
            phone: document.getElementById('edit_phone').value,
            department: document.getElementById('edit_department').value,
            designation: document.getElementById('edit_designation').value,
            reporting_manager: document.getElementById('edit_reporting_manager').value,
            joining_date: document.getElementById('edit_joining_date').value,
            probation_end_date: document.getElementById('edit_probation_end').value
        };
        
        const response = await fetch(`${API_BASE}/api/admin/employees/${employeeId}`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        const result = await response.json();
        alert(result.message);
    };
}

function toggleEmployeeStatus(employeeId, isActive) {
    fetch(`${API_BASE}/api/admin/employees/${employeeId}/toggle-status`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({is_active: isActive})
    })
    .then(r => r.json())
    .then(data => alert(data.message));
}

// ==================== DOCUMENT GENERATION ====================

function generateExperienceLetter(employeeId) {
    fetch(`${API_BASE}/api/admin/documents/experience-letter/${employeeId}`, {method: 'POST'})
    .then(r => r.json())
    .then(data => {
        if(data.success) {
            window.open(`${API_BASE}${data.download_url}`, '_blank');
        } else {
            alert(data.message);
        }
    });
}

function generateRelievingLetter(employeeId) {
    const lastDay = prompt('Enter last working day (YYYY-MM-DD):');
    if(!lastDay) return;
    
    fetch(`${API_BASE}/api/admin/documents/relieving-letter/${employeeId}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({last_working_day: lastDay})
    })
    .then(r => r.json())
    .then(data => {
        if(data.success) {
            window.open(`${API_BASE}${data.download_url}`, '_blank');
        } else {
            alert(data.message);
        }
    });
}

// ==================== CREDENTIAL MANAGEMENT ====================

function showUpdateCredentialsForm(employeeId) {
    const html = `
        <div style="background: white; padding: 24px; border-radius: 8px; max-width: 500px;">
            <h3>Update Credentials</h3>
            <form id="credentialsForm">
                <input type="email" id="new_email" placeholder="New Email (optional)" style="width: 100%; padding: 8px; margin: 8px 0;">
                <input type="password" id="new_password" placeholder="New Password (optional)" style="width: 100%; padding: 8px; margin: 8px 0;">
                <button type="submit" style="background: #3b82f6; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer;">Update</button>
            </form>
        </div>
    `;
    
    displayResults('mainContent', html);
    
    document.getElementById('credentialsForm').onsubmit = async (e) => {
        e.preventDefault();
        const data = {
            email: document.getElementById('new_email').value || null,
            password: document.getElementById('new_password').value || null
        };
        
        const response = await fetch(`${API_BASE}/api/admin/credentials/${employeeId}`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        const result = await response.json();
        alert(result.message);
    };
}

function viewLoginHistory(employeeId = null) {
    const url = employeeId ? `${API_BASE}/api/admin/login-history?employee_id=${employeeId}` : `${API_BASE}/api/admin/login-history`;
    
    fetch(url)
    .then(r => r.json())
    .then(data => {
        let html = '<h3>Login History</h3><table style="width: 100%; border-collapse: collapse;">';
        html += '<tr><th>Employee ID</th><th>Login Time</th><th>Logout Time</th><th>IP Address</th></tr>';
        
        data.history.forEach(log => {
            html += `<tr>
                <td>${log.employee_id}</td>
                <td>${log.login_time}</td>
                <td>${log.logout_time || 'Active'}</td>
                <td>${log.ip_address}</td>
            </tr>`;
        });
        
        html += '</table>';
        displayResults('mainContent', html);
    });
}

function forceLogout(employeeId) {
    if(!confirm('Force logout this user?')) return;
    
    fetch(`${API_BASE}/api/admin/force-logout/${employeeId}`, {method: 'POST'})
    .then(r => r.json())
    .then(data => alert(data.message));
}

// ==================== PAYROLL ====================

function showSalaryStructureForm(employeeId) {
    const html = `
        <div style="background: white; padding: 24px; border-radius: 8px; max-width: 600px;">
            <h3>Create Salary Structure</h3>
            <form id="salaryForm">
                <input type="number" id="basic" placeholder="Basic Salary" style="width: 100%; padding: 8px; margin: 8px 0;" required>
                <input type="number" id="hra" placeholder="HRA" style="width: 100%; padding: 8px; margin: 8px 0;">
                <input type="number" id="allowances" placeholder="Allowances" style="width: 100%; padding: 8px; margin: 8px 0;">
                <input type="number" id="pf" placeholder="PF Deduction" style="width: 100%; padding: 8px; margin: 8px 0;">
                <input type="number" id="esic" placeholder="ESIC" style="width: 100%; padding: 8px; margin: 8px 0;">
                <input type="number" id="tds" placeholder="TDS" style="width: 100%; padding: 8px; margin: 8px 0;">
                <input type="number" id="gross" placeholder="Gross Salary" style="width: 100%; padding: 8px; margin: 8px 0;" required>
                <input type="number" id="net" placeholder="Net Salary" style="width: 100%; padding: 8px; margin: 8px 0;" required>
                <input type="date" id="effective_from" placeholder="Effective From" style="width: 100%; padding: 8px; margin: 8px 0;">
                <button type="submit" style="background: #3b82f6; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer;">Create Structure</button>
            </form>
        </div>
    `;
    
    displayResults('mainContent', html);
    
    document.getElementById('salaryForm').onsubmit = async (e) => {
        e.preventDefault();
        const structure = {
            basic: parseFloat(document.getElementById('basic').value),
            hra: parseFloat(document.getElementById('hra').value) || 0,
            allowances: parseFloat(document.getElementById('allowances').value) || 0,
            pf: parseFloat(document.getElementById('pf').value) || 0,
            esic: parseFloat(document.getElementById('esic').value) || 0,
            tds: parseFloat(document.getElementById('tds').value) || 0,
            gross_salary: parseFloat(document.getElementById('gross').value),
            net_salary: parseFloat(document.getElementById('net').value),
            effective_from: document.getElementById('effective_from').value
        };
        
        const response = await fetch(`${API_BASE}/api/admin/payroll/salary-structure/${employeeId}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(structure)
        });
        const result = await response.json();
        alert(result.message);
    };
}

function viewSalaryHistory(employeeId) {
    fetch(`${API_BASE}/api/admin/payroll/salary-history/${employeeId}`)
    .then(r => r.json())
    .then(data => {
        let html = '<h3>Salary Revision History</h3><table style="width: 100%; border-collapse: collapse;">';
        html += '<tr><th>Effective From</th><th>Basic</th><th>HRA</th><th>Gross</th><th>Net</th></tr>';
        
        data.history.forEach(sal => {
            html += `<tr>
                <td>${sal.effective_from}</td>
                <td>₹${sal.basic}</td>
                <td>₹${sal.hra}</td>
                <td>₹${sal.gross_salary}</td>
                <td>₹${sal.net_salary}</td>
            </tr>`;
        });
        
        html += '</table>';
        displayResults('mainContent', html);
    });
}

function addBonus(employeeId) {
    const amount = prompt('Enter bonus amount:');
    const type = prompt('Enter bonus type (Performance/Festival/Other):');
    const reason = prompt('Enter reason:');
    
    if(!amount || !type) return;
    
    fetch(`${API_BASE}/api/admin/payroll/bonus/${employeeId}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({amount: parseFloat(amount), bonus_type: type, reason: reason})
    })
    .then(r => r.json())
    .then(data => alert(data.message));
}

function calculateFinalSettlement(employeeId) {
    const lastDay = prompt('Enter last working day (YYYY-MM-DD):');
    if(!lastDay) return;
    
    fetch(`${API_BASE}/api/admin/payroll/final-settlement/${employeeId}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({last_working_day: lastDay})
    })
    .then(r => r.json())
    .then(data => {
        if(data.success) {
            const s = data.settlement;
            alert(`Final Settlement:
Notice Pay: ₹${s.notice_pay}
Leave Encashment: ₹${s.leave_encashment}
Gratuity: ₹${s.gratuity}
Total: ₹${s.total_settlement}`);
        } else {
            alert(data.message);
        }
    });
}
