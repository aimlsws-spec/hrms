// Attendance Regularization UI Functions

// Submit Regularization Request
function submitRegularizationRequest() {
    const html = `
        <div style="background: white; border-radius: 8px; padding: 20px; border: 1px solid #e2e8f0;">
            <h3 style="margin: 0 0 20px 0; color: #1e293b;">📝 Submit Attendance Correction Request</h3>
            <form id="regularizationForm" style="display: grid; gap: 16px;">
                <div>
                    <label style="display: block; margin-bottom: 4px; font-weight: 500;">Employee ID *</label>
                    <input type="text" id="regEmpId" required style="width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px;">
                </div>
                <div>
                    <label style="display: block; margin-bottom: 4px; font-weight: 500;">Date *</label>
                    <input type="date" id="regDate" required style="width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px;">
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <div>
                        <label style="display: block; margin-bottom: 4px; font-weight: 500;">Check In Time *</label>
                        <input type="time" id="regCheckIn" required style="width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px;">
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 4px; font-weight: 500;">Check Out Time *</label>
                        <input type="time" id="regCheckOut" required style="width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px;">
                    </div>
                </div>
                <div>
                    <label style="display: block; margin-bottom: 4px; font-weight: 500;">Reason *</label>
                    <textarea id="regReason" rows="4" required style="width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px;" placeholder="Explain why you need this correction..."></textarea>
                </div>
                <button type="submit" class="btn btn-primary">Submit Request</button>
            </form>
        </div>
    `;
    
    document.getElementById('regularizationResults').innerHTML = html;
    
    document.getElementById('regularizationForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            employee_id: document.getElementById('regEmpId').value,
            date: document.getElementById('regDate').value,
            check_in_time: document.getElementById('regCheckIn').value,
            check_out_time: document.getElementById('regCheckOut').value,
            reason: document.getElementById('regReason').value
        };
        
        try {
            const response = await fetch('/api/attendance-regularization/request', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(data)
            });
            const result = await response.json();
            
            if (result.success) {
                alert('✅ Regularization request submitted successfully!');
                viewMyRegularizationRequests();
            } else {
                alert('❌ Error: ' + result.message);
            }
        } catch (error) {
            alert('❌ Error: ' + error.message);
        }
    });
}

// View My Regularization Requests (Employee)
async function viewMyRegularizationRequests() {
    const userData = JSON.parse(localStorage.getItem('hrms_user') || '{}');
    const empId = userData.user_id;
    
    if (!empId) {
        alert('Employee ID not found');
        return;
    }
    
    document.getElementById('regularizationResults').innerHTML = '<p style="color: #64748b;">Loading your requests...</p>';
    
    try {
        const response = await fetch(`/api/attendance-regularization/employee/${empId}`);
        const result = await response.json();
        
        if (result.success && result.requests.length > 0) {
            let html = `
                <div style="background: white; border-radius: 8px; padding: 20px; border: 1px solid #e2e8f0;">
                    <h3 style="margin: 0 0 20px 0;">📋 My Regularization Requests</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #f1f5f9; border-bottom: 2px solid #e2e8f0;">
                                <th style="padding: 12px; text-align: left;">Date</th>
                                <th style="padding: 12px; text-align: left;">Check In</th>
                                <th style="padding: 12px; text-align: left;">Check Out</th>
                                <th style="padding: 12px; text-align: left;">Reason</th>
                                <th style="padding: 12px; text-align: left;">Status</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            result.requests.forEach(req => {
                const statusColor = req.status === 'Approved' ? '#22c55e' : 
                                   req.status === 'Rejected' ? '#ef4444' : '#f59e0b';
                const statusBg = req.status === 'Approved' ? '#dcfce7' : 
                                req.status === 'Rejected' ? '#fee2e2' : '#fef3c7';
                
                html += `
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 12px; font-weight: 600;">${new Date(req.date).toLocaleDateString()}</td>
                        <td style="padding: 12px;">${req.check_in_time}</td>
                        <td style="padding: 12px;">${req.check_out_time}</td>
                        <td style="padding: 12px; max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${req.reason}</td>
                        <td style="padding: 12px;">
                            <span style="background: ${statusBg}; color: ${statusColor}; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">
                                ${req.status}
                            </span>
                        </td>
                    </tr>
                `;
            });
            
            html += '</tbody></table></div>';
            document.getElementById('regularizationResults').innerHTML = html;
        } else {
            document.getElementById('regularizationResults').innerHTML = '<p style="color: #64748b;">No regularization requests found.</p>';
        }
    } catch (error) {
        document.getElementById('regularizationResults').innerHTML = '<p style="color: #ef4444;">Error loading requests.</p>';
    }
}

// View All Regularization Requests (Admin/HR)
async function viewAllRegularizationRequests() {
    document.getElementById('regularizationResults').innerHTML = '<p style="color: #64748b;">Loading all requests...</p>';
    
    try {
        const response = await fetch('/api/attendance-regularization/all');
        const result = await response.json();
        
        if (result.success && result.requests.length > 0) {
            let html = `
                <div style="background: white; border-radius: 8px; padding: 20px; border: 1px solid #e2e8f0;">
                    <h3 style="margin: 0 0 20px 0;">📋 All Regularization Requests</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #f1f5f9; border-bottom: 2px solid #e2e8f0;">
                                <th style="padding: 12px; text-align: left;">Employee ID</th>
                                <th style="padding: 12px; text-align: left;">Date</th>
                                <th style="padding: 12px; text-align: left;">Check In</th>
                                <th style="padding: 12px; text-align: left;">Check Out</th>
                                <th style="padding: 12px; text-align: left;">Reason</th>
                                <th style="padding: 12px; text-align: left;">Status</th>
                                <th style="padding: 12px; text-align: left;">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            result.requests.forEach(req => {
                const statusColor = req.status === 'Approved' ? '#22c55e' : 
                                   req.status === 'Rejected' ? '#ef4444' : '#f59e0b';
                const statusBg = req.status === 'Approved' ? '#dcfce7' : 
                                req.status === 'Rejected' ? '#fee2e2' : '#fef3c7';
                
                html += `
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 12px; font-weight: 600;">${req.employee_id}</td>
                        <td style="padding: 12px;">${new Date(req.date).toLocaleDateString()}</td>
                        <td style="padding: 12px;">${req.check_in_time}</td>
                        <td style="padding: 12px;">${req.check_out_time}</td>
                        <td style="padding: 12px; max-width: 150px; overflow: hidden; text-overflow: ellipsis;" title="${req.reason}">${req.reason}</td>
                        <td style="padding: 12px;">
                            <span style="background: ${statusBg}; color: ${statusColor}; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">
                                ${req.status}
                            </span>
                        </td>
                        <td style="padding: 12px;">
                            ${req.status === 'Pending' ? `
                                <button onclick="approveRegularization(${req.request_id})" class="btn btn-primary" style="padding: 4px 8px; font-size: 12px; margin-right: 4px;">✅ Approve</button>
                                <button onclick="rejectRegularization(${req.request_id})" class="btn btn-secondary" style="padding: 4px 8px; font-size: 12px; background: #ef4444;">❌ Reject</button>
                            ` : '-'}
                        </td>
                    </tr>
                `;
            });
            
            html += '</tbody></table></div>';
            document.getElementById('regularizationResults').innerHTML = html;
        } else {
            document.getElementById('regularizationResults').innerHTML = '<p style="color: #64748b;">No regularization requests found.</p>';
        }
    } catch (error) {
        document.getElementById('regularizationResults').innerHTML = '<p style="color: #ef4444;">Error loading requests.</p>';
    }
}

// View Pending Regularization Requests (Admin/HR)
async function viewPendingRegularizationRequests() {
    document.getElementById('regularizationResults').innerHTML = '<p style="color: #64748b;">Loading pending requests...</p>';
    
    try {
        const response = await fetch('/api/attendance-regularization/pending');
        const result = await response.json();
        
        if (result.success && result.requests.length > 0) {
            let html = `
                <div style="background: white; border-radius: 8px; padding: 20px; border: 1px solid #e2e8f0;">
                    <h3 style="margin: 0 0 20px 0;">⏳ Pending Regularization Requests</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #fef3c7; border-bottom: 2px solid #fcd34d;">
                                <th style="padding: 12px; text-align: left;">Employee ID</th>
                                <th style="padding: 12px; text-align: left;">Date</th>
                                <th style="padding: 12px; text-align: left;">Check In</th>
                                <th style="padding: 12px; text-align: left;">Check Out</th>
                                <th style="padding: 12px; text-align: left;">Reason</th>
                                <th style="padding: 12px; text-align: left;">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            result.requests.forEach(req => {
                html += `
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 12px; font-weight: 600;">${req.employee_id}</td>
                        <td style="padding: 12px;">${new Date(req.date).toLocaleDateString()}</td>
                        <td style="padding: 12px;">${req.check_in_time}</td>
                        <td style="padding: 12px;">${req.check_out_time}</td>
                        <td style="padding: 12px; max-width: 200px;" title="${req.reason}">${req.reason}</td>
                        <td style="padding: 12px;">
                            <button onclick="approveRegularization(${req.request_id})" class="btn btn-primary" style="padding: 4px 8px; font-size: 12px; margin-right: 4px;">✅ Approve</button>
                            <button onclick="rejectRegularization(${req.request_id})" class="btn btn-secondary" style="padding: 4px 8px; font-size: 12px; background: #ef4444;">❌ Reject</button>
                        </td>
                    </tr>
                `;
            });
            
            html += '</tbody></table></div>';
            document.getElementById('regularizationResults').innerHTML = html;
        } else {
            document.getElementById('regularizationResults').innerHTML = '<p style="color: #64748b;">No pending requests found.</p>';
        }
    } catch (error) {
        document.getElementById('regularizationResults').innerHTML = '<p style="color: #ef4444;">Error loading requests.</p>';
    }
}

// Approve Regularization Request
async function approveRegularization(requestId) {
    if (!confirm('Are you sure you want to approve this request?')) return;
    
    const userData = JSON.parse(localStorage.getItem('hrms_user') || '{}');
    
    try {
        const response = await fetch('/api/attendance-regularization/approve', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                request_id: requestId,
                approved_by: userData.user_id
            })
        });
        const result = await response.json();
        
        if (result.success) {
            alert('✅ Request approved successfully!');
            viewPendingRegularizationRequests();
        } else {
            alert('❌ Error: ' + result.message);
        }
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
}

// Reject Regularization Request
async function rejectRegularization(requestId) {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;
    
    const userData = JSON.parse(localStorage.getItem('hrms_user') || '{}');
    
    try {
        const response = await fetch('/api/attendance-regularization/reject', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                request_id: requestId,
                rejected_by: userData.user_id,
                rejection_reason: reason
            })
        });
        const result = await response.json();
        
        if (result.success) {
            alert('✅ Request rejected successfully!');
            viewPendingRegularizationRequests();
        } else {
            alert('❌ Error: ' + result.message);
        }
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
}
