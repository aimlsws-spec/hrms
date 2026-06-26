// Attendance Management UI

function showAttendanceSection() {
    const content = `
        <div class="section-header"><h2>Attendance Management</h2></div>
        <div class="tabs">
            <button class="tab-btn active" onclick="showMarkAttendance()">Mark Attendance</button>
            <button class="tab-btn" onclick="showAttendanceRecords()">Records</button>
            <button class="tab-btn" onclick="showLeaveManagement()">Leave Management</button>
        </div>
        <div id="attendanceContent"></div>
    `;
    document.getElementById('mainContent').innerHTML = content;
    showMarkAttendance();
}

function showMarkAttendance() {
    const content = `
        <div class="form-container">
            <h3>Mark Attendance</h3>
            <form onsubmit="markAttendance(event)">
                <div class="form-group">
                    <label>Employee ID *</label>
                    <input type="text" id="att_emp_id" required>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Date *</label>
                        <input type="date" id="att_date" value="${new Date().toISOString().split('T')[0]}" required>
                    </div>
                    <div class="form-group">
                        <label>Status *</label>
                        <select id="att_status" required>
                            <option value="PRESENT">Present</option>
                            <option value="ABSENT">Absent</option>
                            <option value="HALF_DAY">Half Day</option>
                            <option value="ON_LEAVE">On Leave</option>
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Check In *</label>
                        <input type="time" id="att_checkin" required>
                    </div>
                    <div class="form-group">
                        <label>Check Out</label>
                        <input type="time" id="att_checkout">
                    </div>
                </div>
                <div class="form-group">
                    <label>Remarks</label>
                    <textarea id="att_remarks" rows="2"></textarea>
                </div>
                <button type="submit" class="btn-primary">Mark Attendance</button>
            </form>
        </div>
    `;
    document.getElementById('attendanceContent').innerHTML = content;
}

function markAttendance(e) {
    e.preventDefault();
    const data = {
        employee_id: document.getElementById('att_emp_id').value,
        attendance_date: document.getElementById('att_date').value,
        check_in: document.getElementById('att_checkin').value,
        check_out: document.getElementById('att_checkout').value || null,
        status: document.getElementById('att_status').value,
        remarks: document.getElementById('att_remarks').value
    };
    
    fetch('/api/attendance/mark', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data)
    })
    .then(res => res.json())
    .then(data => {
        if(data.success) {
            showNotification('Attendance marked successfully', 'success');
            e.target.reset();
        }
    });
}

function showAttendanceRecords() {
    const content = `
        <div class="table-container">
            <h3>Attendance Records</h3>
            <input type="text" id="search_emp" placeholder="Employee ID" onchange="loadAttendance(this.value)">
            <div id="recordsList"></div>
        </div>
    `;
    document.getElementById('attendanceContent').innerHTML = content;
}

function loadAttendance(empId) {
    fetch(`/api/attendance/${empId}`)
    .then(res => res.json())
    .then(data => {
        if(data.success) {
            let html = '<table class="data-table"><thead><tr><th>Date</th><th>Check In</th><th>Check Out</th><th>Hours</th><th>Status</th></tr></thead><tbody>';
            data.data.forEach(r => {
                html += `<tr>
                    <td>${r.attendance_date}</td>
                    <td>${r.check_in}</td>
                    <td>${r.check_out || '-'}</td>
                    <td>${r.work_hours}</td>
                    <td><span class="status-badge ${r.status.toLowerCase()}">${r.status}</span></td>
                </tr>`;
            });
            html += '</tbody></table>';
            document.getElementById('recordsList').innerHTML = html;
        }
    });
}

function showLeaveManagement() {
    const content = `
        <div class="form-container">
            <h3>Apply Leave</h3>
            <form onsubmit="applyLeave(event)">
                <div class="form-group">
                    <label>Employee ID *</label>
                    <input type="text" id="leave_emp_id" required>
                </div>
                <div class="form-group">
                    <label>Leave Type *</label>
                    <select id="leave_type" required>
                        <option value="CASUAL">Casual Leave</option>
                        <option value="SICK">Sick Leave</option>
                        <option value="EARNED">Earned Leave</option>
                    </select>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Start Date *</label>
                        <input type="date" id="leave_start" required>
                    </div>
                    <div class="form-group">
                        <label>End Date *</label>
                        <input type="date" id="leave_end" required>
                    </div>
                </div>
                <div class="form-group">
                    <label>Reason *</label>
                    <textarea id="leave_reason" rows="3" required></textarea>
                </div>
                <button type="submit" class="btn-primary">Submit Request</button>
            </form>
            <div style="margin-top:20px">
                <button class="btn-secondary" onclick="showPendingLeaves()">View Pending Requests</button>
            </div>
        </div>
    `;
    document.getElementById('attendanceContent').innerHTML = content;
}

function applyLeave(e) {
    e.preventDefault();
    const data = {
        employee_id: document.getElementById('leave_emp_id').value,
        leave_type: document.getElementById('leave_type').value,
        start_date: document.getElementById('leave_start').value,
        end_date: document.getElementById('leave_end').value,
        reason: document.getElementById('leave_reason').value
    };
    
    fetch('/api/leave/request', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data)
    })
    .then(res => res.json())
    .then(data => {
        if(data.success) {
            showNotification(`Leave request submitted for ${data.days} days`, 'success');
            e.target.reset();
        }
    });
}

function showPendingLeaves() {
    fetch('/api/leave/pending')
    .then(res => res.json())
    .then(data => {
        if(data.success) {
            let html = '<h3>Pending Leave Requests</h3><table class="data-table"><thead><tr><th>Employee</th><th>Type</th><th>From</th><th>To</th><th>Days</th><th>Reason</th><th>Action</th></tr></thead><tbody>';
            data.data.forEach(l => {
                html += `<tr>
                    <td>${l.employee_name}</td>
                    <td>${l.leave_type}</td>
                    <td>${l.start_date}</td>
                    <td>${l.end_date}</td>
                    <td>${l.days_count}</td>
                    <td>${l.reason}</td>
                    <td>
                        <button class="btn-small" onclick="approveLeave(${l.id}, 'approve')">Approve</button>
                        <button class="btn-small" onclick="approveLeave(${l.id}, 'reject')">Reject</button>
                    </td>
                </tr>`;
            });
            html += '</tbody></table>';
            document.getElementById('attendanceContent').innerHTML = html;
        }
    });
}

function approveLeave(id, action) {
    fetch(`/api/leave/approve/${id}?approved_by=${currentUser.employee_id}&action=${action}`, {method: 'PUT'})
    .then(res => res.json())
    .then(data => {
        if(data.success) {
            showNotification(data.message, 'success');
            showPendingLeaves();
        }
    });
}
