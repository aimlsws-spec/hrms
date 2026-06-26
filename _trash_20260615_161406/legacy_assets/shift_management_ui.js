// Shift Management UI Functions

// Create Shift
function createShift() {
    const html = `
        <div style="background: white; border-radius: 8px; padding: 20px; border: 1px solid #e2e8f0;">
            <h3 style="margin: 0 0 20px 0; color: #1e293b;">➕ Create New Shift</h3>
            <form id="createShiftForm" style="display: grid; gap: 16px;">
                <div>
                    <label style="display: block; margin-bottom: 4px; font-weight: 500;">Shift Name *</label>
                    <input type="text" id="shiftName" required style="width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px;">
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <div>
                        <label style="display: block; margin-bottom: 4px; font-weight: 500;">Start Time *</label>
                        <input type="time" id="startTime" required style="width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px;">
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 4px; font-weight: 500;">End Time *</label>
                        <input type="time" id="endTime" required style="width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px;">
                    </div>
                </div>
                <div>
                    <label style="display: block; margin-bottom: 4px; font-weight: 500;">Description</label>
                    <textarea id="shiftDescription" rows="3" style="width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px;"></textarea>
                </div>
                <button type="submit" class="btn btn-primary">Create Shift</button>
            </form>
        </div>
    `;
    
    document.getElementById('shiftResults').innerHTML = html;
    
    document.getElementById('createShiftForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            shift_name: document.getElementById('shiftName').value,
            start_time: document.getElementById('startTime').value,
            end_time: document.getElementById('endTime').value,
            description: document.getElementById('shiftDescription').value
        };
        
        try {
            const response = await fetch('/api/shifts/create', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(data)
            });
            const result = await response.json();
            
            if (result.success) {
                alert('✅ Shift created successfully!');
                viewAllShifts();
            } else {
                alert('❌ Error: ' + result.message);
            }
        } catch (error) {
            alert('❌ Error creating shift: ' + error.message);
        }
    });
}

// View All Shifts
async function viewAllShifts() {
    document.getElementById('shiftResults').innerHTML = '<p style="color: #64748b;">Loading shifts...</p>';
    
    try {
        const response = await fetch('/api/shifts/all');
        const result = await response.json();
        
        if (result.success && result.shifts.length > 0) {
            let html = `
                <div style="background: white; border-radius: 8px; padding: 20px; border: 1px solid #e2e8f0;">
                    <h3 style="margin: 0 0 20px 0; color: #1e293b;">📋 All Shifts</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #f1f5f9; border-bottom: 2px solid #e2e8f0;">
                                <th style="padding: 12px; text-align: left;">Shift Name</th>
                                <th style="padding: 12px; text-align: left;">Start Time</th>
                                <th style="padding: 12px; text-align: left;">End Time</th>
                                <th style="padding: 12px; text-align: left;">Description</th>
                                <th style="padding: 12px; text-align: left;">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            result.shifts.forEach(shift => {
                html += `
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 12px; font-weight: 600;">${shift.shift_name}</td>
                        <td style="padding: 12px;">${shift.start_time}</td>
                        <td style="padding: 12px;">${shift.end_time}</td>
                        <td style="padding: 12px;">${shift.description || '-'}</td>
                        <td style="padding: 12px;">
                            <button onclick="assignShiftToEmployee('${shift.shift_id}')" class="btn btn-primary" style="padding: 4px 8px; font-size: 12px;">Assign</button>
                        </td>
                    </tr>
                `;
            });
            
            html += '</tbody></table></div>';
            document.getElementById('shiftResults').innerHTML = html;
        } else {
            document.getElementById('shiftResults').innerHTML = '<p style="color: #64748b;">No shifts found.</p>';
        }
    } catch (error) {
        document.getElementById('shiftResults').innerHTML = '<p style="color: #ef4444;">Error loading shifts.</p>';
    }
}

// Assign Shift to Employee
function assignShiftToEmployee(shiftId) {
    const html = `
        <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 2000; display: flex; align-items: center; justify-content: center;" onclick="closeShiftModal(event)">
            <div style="background: white; border-radius: 12px; padding: 30px; width: 90%; max-width: 500px;" onclick="event.stopPropagation()">
                <h3 style="margin: 0 0 20px 0;">Assign Shift to Employee</h3>
                <form id="assignShiftForm" style="display: grid; gap: 16px;">
                    <div>
                        <label style="display: block; margin-bottom: 4px; font-weight: 500;">Employee ID *</label>
                        <input type="text" id="empId" required style="width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px;">
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 4px; font-weight: 500;">Effective Date *</label>
                        <input type="date" id="effectiveDate" required style="width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px;">
                    </div>
                    <div style="display: flex; gap: 12px;">
                        <button type="submit" class="btn btn-primary">Assign</button>
                        <button type="button" class="btn btn-secondary" onclick="closeShiftModal()">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', html);
    
    document.getElementById('assignShiftForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            employee_id: document.getElementById('empId').value,
            shift_id: shiftId,
            effective_date: document.getElementById('effectiveDate').value
        };
        
        try {
            const response = await fetch('/api/shifts/assign', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(data)
            });
            const result = await response.json();
            
            if (result.success) {
                alert('✅ Shift assigned successfully!');
                closeShiftModal();
            } else {
                alert('❌ Error: ' + result.message);
            }
        } catch (error) {
            alert('❌ Error: ' + error.message);
        }
    });
}

function closeShiftModal(event) {
    if (event && event.target !== event.currentTarget) return;
    const modal = document.querySelector('[style*="position: fixed"]');
    if (modal) modal.remove();
}

// View Employee Shifts
async function viewEmployeeShifts() {
    const empId = prompt('Enter Employee ID:');
    if (!empId) return;
    
    document.getElementById('shiftResults').innerHTML = '<p style="color: #64748b;">Loading employee shifts...</p>';
    
    try {
        const response = await fetch(`/api/shifts/employee/${empId}`);
        const result = await response.json();
        
        if (result.success && result.shifts.length > 0) {
            let html = `
                <div style="background: white; border-radius: 8px; padding: 20px; border: 1px solid #e2e8f0;">
                    <h3 style="margin: 0 0 20px 0;">Shifts for Employee: ${empId}</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #f1f5f9;">
                                <th style="padding: 12px; text-align: left;">Shift Name</th>
                                <th style="padding: 12px; text-align: left;">Start Time</th>
                                <th style="padding: 12px; text-align: left;">End Time</th>
                                <th style="padding: 12px; text-align: left;">Effective Date</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            result.shifts.forEach(shift => {
                html += `
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 12px;">${shift.shift_name}</td>
                        <td style="padding: 12px;">${shift.start_time}</td>
                        <td style="padding: 12px;">${shift.end_time}</td>
                        <td style="padding: 12px;">${new Date(shift.effective_date).toLocaleDateString()}</td>
                    </tr>
                `;
            });
            
            html += '</tbody></table></div>';
            document.getElementById('shiftResults').innerHTML = html;
        } else {
            document.getElementById('shiftResults').innerHTML = '<p style="color: #64748b;">No shifts found for this employee.</p>';
        }
    } catch (error) {
        document.getElementById('shiftResults').innerHTML = '<p style="color: #ef4444;">Error loading shifts.</p>';
    }
}
