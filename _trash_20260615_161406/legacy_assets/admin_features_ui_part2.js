// Admin Features UI Module - Part 2: Attendance, Departments, Performance

const API_BASE = 'http://localhost:8002';

// ==================== ATTENDANCE ====================

function showMarkAttendanceForm() {
    const html = `
        <div style="background: white; padding: 24px; border-radius: 8px; max-width: 500px;">
            <h3>Mark Attendance</h3>
            <form id="attendanceForm">
                <input type="text" id="att_emp_id" placeholder="Employee ID" style="width: 100%; padding: 8px; margin: 8px 0;" required>
                <input type="date" id="att_date" style="width: 100%; padding: 8px; margin: 8px 0;" required>
                <select id="att_status" style="width: 100%; padding: 8px; margin: 8px 0;" required>
                    <option value="Present">Present</option>
                    <option value="Absent">Absent</option>
                    <option value="Half Day">Half Day</option>
                    <option value="Leave">Leave</option>
                </select>
                <input type="time" id="att_checkin" placeholder="Check In" style="width: 100%; padding: 8px; margin: 8px 0;">
                <input type="time" id="att_checkout" placeholder="Check Out" style="width: 100%; padding: 8px; margin: 8px 0;">
                <button type="submit" style="background: #3b82f6; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer;">Mark Attendance</button>
            </form>
        </div>
    `;
    
    displayResults('mainContent', html);
    
    document.getElementById('attendanceForm').onsubmit = async (e) => {
        e.preventDefault();
        const data = {
            employee_id: document.getElementById('att_emp_id').value,
            date: document.getElementById('att_date').value,
            status: document.getElementById('att_status').value,
            check_in: document.getElementById('att_checkin').value || null,
            check_out: document.getElementById('att_checkout').value || null
        };
        
        const response = await fetch(`${API_BASE}/api/admin/attendance/mark`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        const result = await response.json();
        alert(result.message);
    };
}

function viewAttendanceCalendar(employeeId = null) {
    const month = prompt('Enter month (YYYY-MM):', new Date().toISOString().slice(0, 7));
    const url = `${API_BASE}/api/admin/attendance/calendar?${employeeId ? 'employee_id=' + employeeId + '&' : ''}month=${month}`;
    
    fetch(url)
    .then(r => r.json())
    .then(data => {
        let html = '<h3>Attendance Calendar</h3><table style="width: 100%; border-collapse: collapse;">';
        html += '<tr><th>Employee ID</th><th>Date</th><th>Status</th><th>Check In</th><th>Check Out</th></tr>';
        
        data.records.forEach(rec => {
            html += `<tr>
                <td>${rec.employee_id}</td>
                <td>${rec.date}</td>
                <td>${rec.status}</td>
                <td>${rec.check_in || '-'}</td>
                <td>${rec.check_out || '-'}</td>
            </tr>`;
        });
        
        html += '</table>';
        displayResults('mainContent', html);
    });
}

function viewLeaveBalance(employeeId) {
    fetch(`${API_BASE}/api/admin/attendance/leave-balance/${employeeId}`)
    .then(r => r.json())
    .then(data => {
        const b = data.balance;
        alert(`Leave Balance:
Casual Leave: ${b.casual_leave}
Sick Leave: ${b.sick_leave}
Earned Leave: ${b.earned_leave}`);
    });
}

// ==================== DEPARTMENT & DESIGNATION ====================

function showCreateDepartmentForm() {
    const html = `
        <div style="background: white; padding: 24px; border-radius: 8px; max-width: 500px;">
            <h3>Create Department</h3>
            <form id="deptForm">
                <input type="text" id="dept_name" placeholder="Department Name" style="width: 100%; padding: 8px; margin: 8px 0;" required>
                <textarea id="dept_desc" placeholder="Description" style="width: 100%; padding: 8px; margin: 8px 0;"></textarea>
                <input type="text" id="dept_head" placeholder="Department Head ID" style="width: 100%; padding: 8px; margin: 8px 0;">
                <button type="submit" style="background: #3b82f6; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer;">Create Department</button>
            </form>
        </div>
    `;
    
    displayResults('mainContent', html);
    
    document.getElementById('deptForm').onsubmit = async (e) => {
        e.preventDefault();
        const data = {
            name: document.getElementById('dept_name').value,
            description: document.getElementById('dept_desc').value,
            head_id: document.getElementById('dept_head').value || null
        };
        
        const response = await fetch(`${API_BASE}/api/admin/departments`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        const result = await response.json();
        alert(result.message);
        if(result.success) viewAllDepartments();
    };
}

function viewAllDepartments() {
    fetch(`${API_BASE}/api/admin/departments`)
    .then(r => r.json())
    .then(data => {
        let html = '<h3>All Departments</h3><table style="width: 100%; border-collapse: collapse;">';
        html += '<tr><th>ID</th><th>Name</th><th>Description</th><th>Head ID</th><th>Actions</th></tr>';
        
        data.departments.forEach(dept => {
            html += `<tr>
                <td>${dept.id}</td>
                <td>${dept.name}</td>
                <td>${dept.description || '-'}</td>
                <td>${dept.head_id || '-'}</td>
                <td>
                    <button onclick="editDepartment(${dept.id})" style="background: #f59e0b; color: white; padding: 4px 8px; border: none; border-radius: 4px; cursor: pointer;">Edit</button>
                    <button onclick="deleteDepartment(${dept.id})" style="background: #ef4444; color: white; padding: 4px 8px; border: none; border-radius: 4px; cursor: pointer;">Delete</button>
                </td>
            </tr>`;
        });
        
        html += '</table>';
        displayResults('mainContent', html);
    });
}

function editDepartment(deptId) {
    const name = prompt('Enter new department name:');
    const desc = prompt('Enter new description:');
    
    if(!name) return;
    
    fetch(`${API_BASE}/api/admin/departments/${deptId}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({name: name, description: desc})
    })
    .then(r => r.json())
    .then(data => {
        alert(data.message);
        viewAllDepartments();
    });
}

function deleteDepartment(deptId) {
    if(!confirm('Delete this department?')) return;
    
    fetch(`${API_BASE}/api/admin/departments/${deptId}`, {method: 'DELETE'})
    .then(r => r.json())
    .then(data => {
        alert(data.message);
        viewAllDepartments();
    });
}

function showCreateDesignationForm() {
    const html = `
        <div style="background: white; padding: 24px; border-radius: 8px; max-width: 500px;">
            <h3>Create Designation</h3>
            <form id="desigForm">
                <input type="text" id="desig_title" placeholder="Designation Title" style="width: 100%; padding: 8px; margin: 8px 0;" required>
                <input type="number" id="desig_dept" placeholder="Department ID" style="width: 100%; padding: 8px; margin: 8px 0;">
                <input type="text" id="desig_level" placeholder="Level (Junior/Senior/Manager)" style="width: 100%; padding: 8px; margin: 8px 0;">
                <button type="submit" style="background: #3b82f6; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer;">Create Designation</button>
            </form>
        </div>
    `;
    
    displayResults('mainContent', html);
    
    document.getElementById('desigForm').onsubmit = async (e) => {
        e.preventDefault();
        const data = {
            title: document.getElementById('desig_title').value,
            department_id: parseInt(document.getElementById('desig_dept').value) || null,
            level: document.getElementById('desig_level').value || null
        };
        
        const response = await fetch(`${API_BASE}/api/admin/designations`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        const result = await response.json();
        alert(result.message);
    };
}

// ==================== PERFORMANCE MANAGEMENT ====================

function showCreatePerformanceCycleForm() {
    const html = `
        <div style="background: white; padding: 24px; border-radius: 8px; max-width: 500px;">
            <h3>Create Performance Cycle</h3>
            <form id="cycleForm">
                <input type="text" id="cycle_name" placeholder="Cycle Name (e.g., Q1 2025)" style="width: 100%; padding: 8px; margin: 8px 0;" required>
                <input type="date" id="cycle_start" placeholder="Start Date" style="width: 100%; padding: 8px; margin: 8px 0;" required>
                <input type="date" id="cycle_end" placeholder="End Date" style="width: 100%; padding: 8px; margin: 8px 0;" required>
                <textarea id="cycle_desc" placeholder="Description" style="width: 100%; padding: 8px; margin: 8px 0;"></textarea>
                <button type="submit" style="background: #3b82f6; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer;">Create Cycle</button>
            </form>
        </div>
    `;
    
    displayResults('mainContent', html);
    
    document.getElementById('cycleForm').onsubmit = async (e) => {
        e.preventDefault();
        const data = {
            name: document.getElementById('cycle_name').value,
            start_date: document.getElementById('cycle_start').value,
            end_date: document.getElementById('cycle_end').value,
            description: document.getElementById('cycle_desc').value
        };
        
        const response = await fetch(`${API_BASE}/api/admin/performance/cycles`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        const result = await response.json();
        alert(result.message);
    };
}

function showCreateKPIForm() {
    const html = `
        <div style="background: white; padding: 24px; border-radius: 8px; max-width: 500px;">
            <h3>Create KPI/OKR</h3>
            <form id="kpiForm">
                <input type="text" id="kpi_emp" placeholder="Employee ID" style="width: 100%; padding: 8px; margin: 8px 0;" required>
                <input type="number" id="kpi_cycle" placeholder="Cycle ID" style="width: 100%; padding: 8px; margin: 8px 0;" required>
                <input type="text" id="kpi_name" placeholder="KPI Name" style="width: 100%; padding: 8px; margin: 8px 0;" required>
                <textarea id="kpi_target" placeholder="Target Description" style="width: 100%; padding: 8px; margin: 8px 0;" required></textarea>
                <input type="number" step="0.1" id="kpi_weight" placeholder="Weightage (e.g., 1.0)" style="width: 100%; padding: 8px; margin: 8px 0;" required>
                <button type="submit" style="background: #3b82f6; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer;">Create KPI</button>
            </form>
        </div>
    `;
    
    displayResults('mainContent', html);
    
    document.getElementById('kpiForm').onsubmit = async (e) => {
        e.preventDefault();
        const data = {
            employee_id: document.getElementById('kpi_emp').value,
            cycle_id: parseInt(document.getElementById('kpi_cycle').value),
            kpi_name: document.getElementById('kpi_name').value,
            target: document.getElementById('kpi_target').value,
            weightage: parseFloat(document.getElementById('kpi_weight').value)
        };
        
        const response = await fetch(`${API_BASE}/api/admin/performance/kpis`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        const result = await response.json();
        alert(result.message);
    };
}

function showSelfReviewForm() {
    const html = `
        <div style="background: white; padding: 24px; border-radius: 8px; max-width: 600px;">
            <h3>Submit Self Review</h3>
            <form id="selfReviewForm">
                <input type="text" id="sr_emp" placeholder="Employee ID" style="width: 100%; padding: 8px; margin: 8px 0;" required>
                <input type="number" id="sr_cycle" placeholder="Cycle ID" style="width: 100%; padding: 8px; margin: 8px 0;" required>
                <textarea id="sr_achievements" placeholder="Key Achievements" style="width: 100%; padding: 8px; margin: 8px 0; height: 80px;" required></textarea>
                <textarea id="sr_challenges" placeholder="Challenges Faced" style="width: 100%; padding: 8px; margin: 8px 0; height: 80px;"></textarea>
                <textarea id="sr_goals" placeholder="Future Goals" style="width: 100%; padding: 8px; margin: 8px 0; height: 80px;"></textarea>
                <input type="number" step="0.1" id="sr_rating" placeholder="Self Rating (1-5)" style="width: 100%; padding: 8px; margin: 8px 0;" min="1" max="5">
                <button type="submit" style="background: #3b82f6; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer;">Submit Review</button>
            </form>
        </div>
    `;
    
    displayResults('mainContent', html);
    
    document.getElementById('selfReviewForm').onsubmit = async (e) => {
        e.preventDefault();
        const data = {
            employee_id: document.getElementById('sr_emp').value,
            cycle_id: parseInt(document.getElementById('sr_cycle').value),
            achievements: document.getElementById('sr_achievements').value,
            challenges: document.getElementById('sr_challenges').value,
            goals: document.getElementById('sr_goals').value,
            rating: parseFloat(document.getElementById('sr_rating').value)
        };
        
        const response = await fetch(`${API_BASE}/api/admin/performance/self-review`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        const result = await response.json();
        alert(result.message);
    };
}

function showManagerReviewForm() {
    const html = `
        <div style="background: white; padding: 24px; border-radius: 8px; max-width: 600px;">
            <h3>Submit Manager Review</h3>
            <form id="managerReviewForm">
                <input type="text" id="mr_emp" placeholder="Employee ID" style="width: 100%; padding: 8px; margin: 8px 0;" required>
                <input type="number" id="mr_cycle" placeholder="Cycle ID" style="width: 100%; padding: 8px; margin: 8px 0;" required>
                <input type="text" id="mr_manager" placeholder="Manager ID" style="width: 100%; padding: 8px; margin: 8px 0;" required>
                <textarea id="mr_feedback" placeholder="Manager Feedback" style="width: 100%; padding: 8px; margin: 8px 0; height: 100px;" required></textarea>
                <input type="number" step="0.1" id="mr_rating" placeholder="Rating (1-5)" style="width: 100%; padding: 8px; margin: 8px 0;" min="1" max="5" required>
                <label><input type="checkbox" id="mr_promotion"> Recommend for Promotion</label><br>
                <label><input type="checkbox" id="mr_appraisal"> Recommend for Appraisal</label><br>
                <button type="submit" style="background: #3b82f6; color: white; padding: 10px 20px; border: none; border-radius: 4px; margin-top: 10px; cursor: pointer;">Submit Review</button>
            </form>
        </div>
    `;
    
    displayResults('mainContent', html);
    
    document.getElementById('managerReviewForm').onsubmit = async (e) => {
        e.preventDefault();
        const data = {
            employee_id: document.getElementById('mr_emp').value,
            cycle_id: parseInt(document.getElementById('mr_cycle').value),
            manager_id: document.getElementById('mr_manager').value,
            feedback: document.getElementById('mr_feedback').value,
            rating: parseFloat(document.getElementById('mr_rating').value),
            promotion_recommended: document.getElementById('mr_promotion').checked,
            appraisal_recommended: document.getElementById('mr_appraisal').checked
        };
        
        const response = await fetch(`${API_BASE}/api/admin/performance/manager-review`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        const result = await response.json();
        alert(result.message);
    };
}
