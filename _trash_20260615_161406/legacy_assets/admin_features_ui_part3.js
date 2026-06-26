// Admin Features UI Module - Part 3: Settings, Security & Audit

const API_BASE = 'http://localhost:8002';

// ==================== SETTINGS & CONFIGURATION ====================

function showCompanyProfileForm() {
    const html = `
        <div style="background: white; padding: 24px; border-radius: 8px; max-width: 600px;">
            <h3>Company Profile Setup</h3>
            <form id="companyForm">
                <input type="text" id="company_name" placeholder="Company Name" style="width: 100%; padding: 8px; margin: 8px 0;" required>
                <input type="text" id="company_address" placeholder="Address" style="width: 100%; padding: 8px; margin: 8px 0;">
                <input type="text" id="company_phone" placeholder="Phone" style="width: 100%; padding: 8px; margin: 8px 0;">
                <input type="email" id="company_email" placeholder="Email" style="width: 100%; padding: 8px; margin: 8px 0;">
                <input type="text" id="company_website" placeholder="Website" style="width: 100%; padding: 8px; margin: 8px 0;">
                <input type="text" id="company_gst" placeholder="GST Number" style="width: 100%; padding: 8px; margin: 8px 0;">
                <input type="text" id="company_pan" placeholder="PAN Number" style="width: 100%; padding: 8px; margin: 8px 0;">
                <button type="submit" style="background: #3b82f6; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer;">Save Profile</button>
            </form>
        </div>
    `;
    
    displayResults('mainContent', html);
    
    document.getElementById('companyForm').onsubmit = async (e) => {
        e.preventDefault();
        const data = {
            name: document.getElementById('company_name').value,
            address: document.getElementById('company_address').value,
            phone: document.getElementById('company_phone').value,
            email: document.getElementById('company_email').value,
            website: document.getElementById('company_website').value,
            gst: document.getElementById('company_gst').value,
            pan: document.getElementById('company_pan').value
        };
        
        const response = await fetch(`${API_BASE}/api/admin/settings/company-profile`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        const result = await response.json();
        alert(result.message);
    };
}

function showWorkingDaysConfig() {
    const html = `
        <div style="background: white; padding: 24px; border-radius: 8px; max-width: 500px;">
            <h3>Configure Working Days</h3>
            <form id="workingDaysForm">
                <label><input type="checkbox" value="Monday" checked> Monday</label><br>
                <label><input type="checkbox" value="Tuesday" checked> Tuesday</label><br>
                <label><input type="checkbox" value="Wednesday" checked> Wednesday</label><br>
                <label><input type="checkbox" value="Thursday" checked> Thursday</label><br>
                <label><input type="checkbox" value="Friday" checked> Friday</label><br>
                <label><input type="checkbox" value="Saturday"> Saturday</label><br>
                <label><input type="checkbox" value="Sunday"> Sunday</label><br>
                <button type="submit" style="background: #3b82f6; color: white; padding: 10px 20px; border: none; border-radius: 4px; margin-top: 10px; cursor: pointer;">Save Configuration</button>
            </form>
        </div>
    `;
    
    displayResults('mainContent', html);
    
    document.getElementById('workingDaysForm').onsubmit = async (e) => {
        e.preventDefault();
        const checkboxes = document.querySelectorAll('#workingDaysForm input[type="checkbox"]:checked');
        const working_days = Array.from(checkboxes).map(cb => cb.value);
        
        const response = await fetch(`${API_BASE}/api/admin/settings/working-days`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({working_days: working_days})
        });
        const result = await response.json();
        alert(result.message);
    };
}

function showAddHolidayForm() {
    const html = `
        <div style="background: white; padding: 24px; border-radius: 8px; max-width: 500px;">
            <h3>Add Holiday</h3>
            <form id="holidayForm">
                <input type="date" id="holiday_date" style="width: 100%; padding: 8px; margin: 8px 0;" required>
                <input type="text" id="holiday_name" placeholder="Holiday Name" style="width: 100%; padding: 8px; margin: 8px 0;" required>
                <textarea id="holiday_desc" placeholder="Description (optional)" style="width: 100%; padding: 8px; margin: 8px 0;"></textarea>
                <button type="submit" style="background: #3b82f6; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer;">Add Holiday</button>
            </form>
        </div>
    `;
    
    displayResults('mainContent', html);
    
    document.getElementById('holidayForm').onsubmit = async (e) => {
        e.preventDefault();
        const data = {
            date: document.getElementById('holiday_date').value,
            name: document.getElementById('holiday_name').value,
            description: document.getElementById('holiday_desc').value
        };
        
        const response = await fetch(`${API_BASE}/api/admin/settings/holidays`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        const result = await response.json();
        alert(result.message);
        if(result.success) viewHolidayCalendar();
    };
}

function viewHolidayCalendar() {
    const year = prompt('Enter year (e.g., 2025):', new Date().getFullYear());
    const url = year ? `${API_BASE}/api/admin/settings/holidays?year=${year}` : `${API_BASE}/api/admin/settings/holidays`;
    
    fetch(url)
    .then(r => r.json())
    .then(data => {
        let html = '<h3>Holiday Calendar</h3><table style="width: 100%; border-collapse: collapse;">';
        html += '<tr><th>Date</th><th>Holiday Name</th><th>Description</th></tr>';
        
        data.holidays.forEach(holiday => {
            html += `<tr>
                <td>${holiday.date}</td>
                <td>${holiday.name}</td>
                <td>${holiday.description || '-'}</td>
            </tr>`;
        });
        
        html += '</table>';
        displayResults('mainContent', html);
    });
}

// ==================== SECURITY & AUDIT ====================

function viewAdminActivityLogs() {
    fetch(`${API_BASE}/api/admin/logs/admin-activity?limit=100`)
    .then(r => r.json())
    .then(data => {
        let html = '<h3>Admin Activity Logs</h3><table style="width: 100%; border-collapse: collapse; font-size: 12px;">';
        html += '<tr><th>Admin ID</th><th>Action</th><th>Details</th><th>IP Address</th><th>Timestamp</th></tr>';
        
        data.logs.forEach(log => {
            html += `<tr>
                <td>${log.admin_id}</td>
                <td>${log.action}</td>
                <td>${log.details || '-'}</td>
                <td>${log.ip_address}</td>
                <td>${new Date(log.timestamp).toLocaleString()}</td>
            </tr>`;
        });
        
        html += '</table>';
        displayResults('mainContent', html);
    });
}

function viewEmployeeActivityLogs(employeeId = null) {
    const url = employeeId ? 
        `${API_BASE}/api/admin/logs/employee-activity?employee_id=${employeeId}&limit=100` : 
        `${API_BASE}/api/admin/logs/employee-activity?limit=100`;
    
    fetch(url)
    .then(r => r.json())
    .then(data => {
        let html = '<h3>Employee Activity Logs</h3><table style="width: 100%; border-collapse: collapse; font-size: 12px;">';
        html += '<tr><th>Employee ID</th><th>Action</th><th>Details</th><th>IP Address</th><th>Timestamp</th></tr>';
        
        data.logs.forEach(log => {
            html += `<tr>
                <td>${log.employee_id}</td>
                <td>${log.action}</td>
                <td>${log.details || '-'}</td>
                <td>${log.ip_address}</td>
                <td>${new Date(log.timestamp).toLocaleString()}</td>
            </tr>`;
        });
        
        html += '</table>';
        displayResults('mainContent', html);
    });
}

// ==================== DASHBOARD WIDGETS ====================

function showTodaysAttendanceWidget() {
    const today = new Date().toISOString().split('T')[0];
    fetch(`${API_BASE}/api/admin/attendance/calendar?month=${today.slice(0, 7)}`)
    .then(r => r.json())
    .then(data => {
        const todayRecords = data.records.filter(r => r.date === today);
        const present = todayRecords.filter(r => r.status === 'Present').length;
        const absent = todayRecords.filter(r => r.status === 'Absent').length;
        const leave = todayRecords.filter(r => r.status === 'Leave').length;
        
        const html = `
            <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <h3>Today's Attendance</h3>
                <p>Present: <strong>${present}</strong></p>
                <p>Absent: <strong>${absent}</strong></p>
                <p>On Leave: <strong>${leave}</strong></p>
                <p>Total: <strong>${todayRecords.length}</strong></p>
            </div>
        `;
        
        displayResults('attendanceWidget', html);
    });
}

function showPendingSupportTicketsWidget() {
    fetch(`${API_BASE}/api/tickets/stats?user_id=admin&user_role=admin`)
    .then(r => r.json())
    .then(data => {
        const html = `
            <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <h3>Support Tickets</h3>
                <p>Open: <strong>${data.stats.open || 0}</strong></p>
                <p>In Progress: <strong>${data.stats.in_progress || 0}</strong></p>
                <p>Pending: <strong>${data.stats.pending || 0}</strong></p>
            </div>
        `;
        
        displayResults('ticketsWidget', html);
    });
}

function showPayrollSummaryWidget() {
    fetch(`${API_BASE}/api/reports/payroll_report`)
    .then(r => r.json())
    .then(data => {
        const html = `
            <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <h3>Payroll Summary</h3>
                <p>Total Monthly: <strong>₹${data.data.total_monthly_payroll.toLocaleString()}</strong></p>
                <p>Average Salary: <strong>₹${data.data.average_salary.toLocaleString()}</strong></p>
                <p>Employees: <strong>${data.data.employees_with_salary}</strong></p>
            </div>
        `;
        
        displayResults('payrollWidget', html);
    });
}

// ==================== EXPORT FUNCTIONS ====================

function exportAttendanceReport() {
    const month = prompt('Enter month (YYYY-MM):', new Date().toISOString().slice(0, 7));
    window.open(`${API_BASE}/api/admin/attendance/export?month=${month}&format=excel`, '_blank');
}

function exportPayrollReport() {
    const month = prompt('Enter month (YYYY-MM):', new Date().toISOString().slice(0, 7));
    window.open(`${API_BASE}/api/admin/payroll/export?month=${month}&format=pdf`, '_blank');
}

// ==================== UTILITY FUNCTION ====================

function displayResults(containerId, content) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = content;
    } else {
        // Fallback to main content area
        const mainContent = document.getElementById('mainContent') || document.body;
        mainContent.innerHTML = content;
    }
}

// Initialize dashboard widgets on load
document.addEventListener('DOMContentLoaded', function() {
    if(currentUser && currentUser.role === 'admin') {
        showTodaysAttendanceWidget();
        showPendingSupportTicketsWidget();
        showPayrollSummaryWidget();
    }
});
