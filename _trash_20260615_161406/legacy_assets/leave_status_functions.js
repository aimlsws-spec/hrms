// Function to view employee's leave requests with status
function viewMyLeaveRequests() {
    if (!currentUser || !currentUser.user_id) {
        displayResults('leaveResults', '<p style="color: #ef4444;">Error: User not logged in</p>');
        return;
    }
    
    displayResults('leaveResults', '<p style="color: #64748b;">Loading your leave requests...</p>');
    
    fetch(`/api/leave_requests/employee/${currentUser.user_id}`)
        .then(response => response.json())
        .then(data => {
            if (data.success && data.requests && data.requests.length > 0) {
                let html = `
                    <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
                        <h3 style="color: #1d4ed8; margin: 0 0 8px 0;">📋 My Leave Requests</h3>
                        <p style="margin: 0; color: #1e40af;">Track the status of all your leave applications</p>
                    </div>
                `;
                
                data.requests.forEach(request => {
                    const statusColor = request.status === 'Approved' ? '#22c55e' : 
                                       request.status === 'Rejected' ? '#ef4444' : '#f59e0b';
                    const statusBg = request.status === 'Approved' ? '#dcfce7' : 
                                    request.status === 'Rejected' ? '#fee2e2' : '#fef3c7';
                    
                    html += `
                        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 16px;">
                            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                                <div>
                                    <h4 style="margin: 0 0 8px 0; color: #1e293b; font-size: 18px;">${request.leave_type}</h4>
                                    <p style="margin: 0; color: #64748b; font-size: 14px;">
                                        <strong>From:</strong> ${new Date(request.start_date).toLocaleDateString()} 
                                        <strong>To:</strong> ${new Date(request.end_date).toLocaleDateString()}
                                    </p>
                                </div>
                                <div style="background: ${statusBg}; color: ${statusColor}; padding: 6px 12px; border-radius: 6px; font-weight: 600; font-size: 14px;">
                                    ${request.status.toUpperCase()}
                                </div>
                            </div>
                            
                            ${request.reason ? `
                                <div style="margin: 12px 0; padding: 12px; background: #f8fafc; border-radius: 6px;">
                                    <strong style="color: #374151;">Reason:</strong>
                                    <p style="margin: 4px 0 0 0; color: #64748b;">${request.reason}</p>
                                </div>
                            ` : ''}
                            
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; padding-top: 12px; border-top: 1px solid #e2e8f0;">
                                <div>
                                    <p style="margin: 0; font-size: 12px; color: #9ca3af;">Applied On</p>
                                    <p style="margin: 4px 0 0 0; font-weight: 500; color: #1e293b;">${new Date(request.created_at).toLocaleDateString()}</p>
                                </div>
                                ${request.approval_date ? `
                                    <div>
                                        <p style="margin: 0; font-size: 12px; color: #9ca3af;">${request.status} On</p>
                                        <p style="margin: 4px 0 0 0; font-weight: 500; color: #1e293b;">${new Date(request.approval_date).toLocaleDateString()}</p>
                                    </div>
                                ` : ''}
                            </div>
                            
                            ${request.approved_by ? `
                                <div style="margin-top: 12px; padding: 12px; background: #f0fdf4; border-radius: 6px; border-left: 3px solid #22c55e;">
                                    <p style="margin: 0; font-size: 12px; color: #15803d;"><strong>Processed By:</strong> ${request.approved_by}</p>
                                    ${request.approval_comments ? `<p style="margin: 4px 0 0 0; font-size: 14px; color: #166534;">${request.approval_comments}</p>` : ''}
                                </div>
                            ` : ''}
                        </div>
                    `;
                });
                
                displayResults('leaveResults', html);
            } else {
                displayResults('leaveResults', `
                    <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 20px; text-align: center;">
                        <h3 style="color: #b45309; margin: 0 0 8px 0;">📋 No Leave Requests Found</h3>
                        <p style="margin: 0; color: #92400e;">You haven't submitted any leave requests yet.</p>
                        <button onclick="applyForLeave()" style="margin-top: 16px; background: #3b82f6; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: 500;">
                            Apply for Leave
                        </button>
                    </div>
                `);
            }
        })
        .catch(error => {
            console.error('Error loading leave requests:', error);
            displayResults('leaveResults', `
                <div style="background: #fee2e2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px;">
                    <h3 style="color: #dc2626; margin: 0 0 8px 0;">⚠️ Error Loading Leave Requests</h3>
                    <p style="margin: 0; color: #991b1b;">Failed to load your leave requests. Please try again later.</p>
                </div>
            `);
        });
}

// Helper function to display results
function displayResults(elementId, html) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = html;
    }
}
