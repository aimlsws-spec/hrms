
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
// Add sandwich leave check before submitting leave application
window.submitLeaveApplicationWithSandwichCheck = function() {
    const leaveType = document.getElementById('leaveType').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const reason = document.getElementById('leaveReason').value;
    
    if (!startDate || !endDate || !reason.trim()) {
        alert('Please fill all required fields');
        return;
    }
    
    // Check for sandwich leave first
    fetch('/api/leave/check-sandwich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_date: startDate, end_date: endDate })
    })
    .then(response => response.json())
    .then(sandwichData => {
        let confirmMessage = `Submit leave application from ${startDate} to ${endDate}?`;
        
        if (sandwichData.success && sandwichData.has_sandwich) {
            confirmMessage = `⚠️ SANDWICH LEAVE POLICY ALERT!\n\n` +
                           `${sandwichData.warning}\n\n` +
                           `Working days between holidays/weekends: ${sandwichData.sandwich_days.join(', ')}\n\n` +
                           `These ${sandwichData.count} day(s) will be automatically counted as leave.\n\n` +
                           `Do you want to proceed?`;
        }
        
        if (confirm(confirmMessage)) {
            // Proceed with leave application
            fetch('/api/leave/apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    employee_id: currentUser.user_id, 
                    leave_type: leaveType,
                    start_date: startDate, 
                    end_date: endDate, 
                    reason: reason 
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    let successMsg = `
                        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px;">
                            <h3 style="color: #15803d; margin: 0 0 8px 0;">✅ Leave Application Submitted</h3>
                            <p style="margin: 4px 0; color: #166534;"><strong>Employee:</strong> ${currentUser.full_name}</p>
                            <p style="margin: 4px 0; color: #166534;"><strong>Type:</strong> ${leaveType}</p>
                            <p style="margin: 4px 0; color: #166534;"><strong>Duration:</strong> ${startDate} to ${endDate}</p>
                            <p style="margin: 4px 0; color: #166534;"><strong>Status:</strong> Pending HR Approval</p>`;
                    
                    if (sandwichData.success && sandwichData.has_sandwich) {
                        successMsg += `
                            <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 6px; padding: 12px; margin-top: 12px;">
                                <p style="margin: 0; color: #92400e;"><strong>⚠️ Sandwich Policy Applied:</strong> ${sandwichData.count} additional working day(s) counted as leave</p>
                            </div>`;
                    }
                    
                    successMsg += `</div>`;
                    displayResults('leaveResults', successMsg);
                    if (typeof refreshLeaveAfterApply === 'function') refreshLeaveAfterApply();
                } else {
                    alert('Error: ' + (data.message || 'Failed to submit leave'));
                }
            })
            .catch(error => {
                alert('Error submitting leave application: ' + error.message);
            });
        }
    })
    .catch(error => {
        // If sandwich check fails, proceed without it
        if (confirm(`Submit leave application from ${startDate} to ${endDate}?`)) {
            fetch('/api/leave/apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    employee_id: currentUser.user_id, 
                    leave_type: leaveType,
                    start_date: startDate, 
                    end_date: endDate, 
                    reason: reason 
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    displayResults('leaveResults', `
                        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px;">
                            <h3 style="color: #15803d; margin: 0 0 8px 0;">✅ Leave Application Submitted</h3>
                            <p style="margin: 4px 0; color: #166534;"><strong>Status:</strong> Pending HR Approval</p>
                        </div>
                    `);
                } else {
                    alert('Error: ' + (data.message || 'Failed to submit leave'));
                }
            });
        }
    });
};

