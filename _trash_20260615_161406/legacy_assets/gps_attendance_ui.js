// GPS Attendance UI Functions

// Mark GPS Attendance
function markGPSAttendance() {
    const html = `
        <div style="background: white; border-radius: 8px; padding: 20px; border: 1px solid #e2e8f0;">
            <h3 style="margin: 0 0 20px 0; color: #1e293b;">📍 Mark GPS Attendance</h3>
            <div id="gpsStatus" style="padding: 12px; background: #eff6ff; border-radius: 6px; margin-bottom: 16px;">
                <p style="margin: 0; color: #1d4ed8;">🔄 Getting your location...</p>
            </div>
            <form id="gpsAttendanceForm" style="display: grid; gap: 16px; display: none;">
                <div>
                    <label style="display: block; margin-bottom: 4px; font-weight: 500;">Employee ID *</label>
                    <input type="text" id="gpsEmpId" required style="width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px;">
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <div>
                        <label style="display: block; margin-bottom: 4px; font-weight: 500;">Latitude</label>
                        <input type="text" id="latitude" readonly style="width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px; background: #f9fafb;">
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 4px; font-weight: 500;">Longitude</label>
                        <input type="text" id="longitude" readonly style="width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px; background: #f9fafb;">
                    </div>
                </div>
                <div>
                    <label style="display: block; margin-bottom: 4px; font-weight: 500;">Attendance Type *</label>
                    <select id="attendanceType" required style="width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px;">
                        <option value="check_in">Check In</option>
                        <option value="check_out">Check Out</option>
                    </select>
                </div>
                <button type="submit" class="btn btn-primary">Mark Attendance</button>
            </form>
        </div>
    `;
    
    document.getElementById('gpsResults').innerHTML = html;
    
    // Get GPS location
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                document.getElementById('latitude').value = position.coords.latitude.toFixed(6);
                document.getElementById('longitude').value = position.coords.longitude.toFixed(6);
                document.getElementById('gpsStatus').innerHTML = '<p style="margin: 0; color: #15803d;">✅ Location obtained successfully!</p>';
                document.getElementById('gpsAttendanceForm').style.display = 'grid';
            },
            (error) => {
                document.getElementById('gpsStatus').innerHTML = '<p style="margin: 0; color: #dc2626;">❌ Error getting location: ' + error.message + '</p>';
            }
        );
    } else {
        document.getElementById('gpsStatus').innerHTML = '<p style="margin: 0; color: #dc2626;">❌ Geolocation not supported by browser</p>';
    }
    
    setTimeout(() => {
        const form = document.getElementById('gpsAttendanceForm');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const data = {
                    employee_id: document.getElementById('gpsEmpId').value,
                    latitude: parseFloat(document.getElementById('latitude').value),
                    longitude: parseFloat(document.getElementById('longitude').value),
                    attendance_type: document.getElementById('attendanceType').value
                };
                
                try {
                    const response = await fetch('/api/gps-attendance/mark', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify(data)
                    });
                    const result = await response.json();
                    
                    if (result.success) {
                        alert('✅ Attendance marked successfully!');
                        viewMyGPSAttendance();
                    } else {
                        alert('❌ Error: ' + result.message);
                    }
                } catch (error) {
                    alert('❌ Error: ' + error.message);
                }
            });
        }
    }, 100);
}

// View GPS Attendance Records
async function viewGPSAttendance() {
    const empId = prompt('Enter Employee ID (or leave blank for all):');
    
    document.getElementById('gpsResults').innerHTML = '<p style="color: #64748b;">Loading GPS attendance records...</p>';
    
    try {
        const url = empId ? `/api/gps-attendance/employee/${empId}` : '/api/gps-attendance/all';
        const response = await fetch(url);
        const result = await response.json();
        
        if (result.success && result.records.length > 0) {
            let html = `
                <div style="background: white; border-radius: 8px; padding: 20px; border: 1px solid #e2e8f0;">
                    <h3 style="margin: 0 0 20px 0;">📍 GPS Attendance Records</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #f1f5f9; border-bottom: 2px solid #e2e8f0;">
                                <th style="padding: 12px; text-align: left;">Employee ID</th>
                                <th style="padding: 12px; text-align: left;">Date</th>
                                <th style="padding: 12px; text-align: left;">Time</th>
                                <th style="padding: 12px; text-align: left;">Type</th>
                                <th style="padding: 12px; text-align: left;">Location</th>
                                <th style="padding: 12px; text-align: left;">Status</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            result.records.forEach(record => {
                const statusColor = record.is_valid ? '#22c55e' : '#ef4444';
                const statusBg = record.is_valid ? '#dcfce7' : '#fee2e2';
                
                html += `
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 12px; font-weight: 600;">${record.employee_id}</td>
                        <td style="padding: 12px;">${new Date(record.timestamp).toLocaleDateString()}</td>
                        <td style="padding: 12px;">${new Date(record.timestamp).toLocaleTimeString()}</td>
                        <td style="padding: 12px;">${record.attendance_type}</td>
                        <td style="padding: 12px; font-size: 11px;">${record.latitude}, ${record.longitude}</td>
                        <td style="padding: 12px;">
                            <span style="background: ${statusBg}; color: ${statusColor}; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">
                                ${record.is_valid ? 'Valid' : 'Out of Range'}
                            </span>
                        </td>
                    </tr>
                `;
            });
            
            html += '</tbody></table></div>';
            document.getElementById('gpsResults').innerHTML = html;
        } else {
            document.getElementById('gpsResults').innerHTML = '<p style="color: #64748b;">No GPS attendance records found.</p>';
        }
    } catch (error) {
        document.getElementById('gpsResults').innerHTML = '<p style="color: #ef4444;">Error loading records.</p>';
    }
}

// View My GPS Attendance (for employees)
async function viewMyGPSAttendance() {
    const userData = JSON.parse(localStorage.getItem('hrms_user') || '{}');
    const empId = userData.user_id;
    
    if (!empId) {
        alert('Employee ID not found');
        return;
    }
    
    document.getElementById('gpsResults').innerHTML = '<p style="color: #64748b;">Loading your GPS attendance...</p>';
    
    try {
        const response = await fetch(`/api/gps-attendance/employee/${empId}`);
        const result = await response.json();
        
        if (result.success && result.records.length > 0) {
            let html = `
                <div style="background: white; border-radius: 8px; padding: 20px; border: 1px solid #e2e8f0;">
                    <h3 style="margin: 0 0 20px 0;">📍 My GPS Attendance</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #f1f5f9;">
                                <th style="padding: 12px; text-align: left;">Date</th>
                                <th style="padding: 12px; text-align: left;">Time</th>
                                <th style="padding: 12px; text-align: left;">Type</th>
                                <th style="padding: 12px; text-align: left;">Status</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            result.records.forEach(record => {
                const statusColor = record.is_valid ? '#22c55e' : '#ef4444';
                const statusBg = record.is_valid ? '#dcfce7' : '#fee2e2';
                
                html += `
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 12px;">${new Date(record.timestamp).toLocaleDateString()}</td>
                        <td style="padding: 12px;">${new Date(record.timestamp).toLocaleTimeString()}</td>
                        <td style="padding: 12px;">${record.attendance_type}</td>
                        <td style="padding: 12px;">
                            <span style="background: ${statusBg}; color: ${statusColor}; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                                ${record.is_valid ? '✅ Valid' : '❌ Out of Range'}
                            </span>
                        </td>
                    </tr>
                `;
            });
            
            html += '</tbody></table></div>';
            document.getElementById('gpsResults').innerHTML = html;
        } else {
            document.getElementById('gpsResults').innerHTML = '<p style="color: #64748b;">No GPS attendance records found.</p>';
        }
    } catch (error) {
        document.getElementById('gpsResults').innerHTML = '<p style="color: #ef4444;">Error loading records.</p>';
    }
}

// Manage Office Locations (Admin only)
function manageOfficeLocations() {
    const html = `
        <div style="background: white; border-radius: 8px; padding: 20px; border: 1px solid #e2e8f0;">
            <h3 style="margin: 0 0 20px 0;">🏢 Manage Office Locations</h3>
            <form id="officeLocationForm" style="display: grid; gap: 16px;">
                <div>
                    <label style="display: block; margin-bottom: 4px; font-weight: 500;">Location Name *</label>
                    <input type="text" id="locationName" required style="width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px;">
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <div>
                        <label style="display: block; margin-bottom: 4px; font-weight: 500;">Latitude *</label>
                        <input type="number" step="0.000001" id="locLatitude" required style="width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px;">
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 4px; font-weight: 500;">Longitude *</label>
                        <input type="number" step="0.000001" id="locLongitude" required style="width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px;">
                    </div>
                </div>
                <div>
                    <label style="display: block; margin-bottom: 4px; font-weight: 500;">Radius (meters) *</label>
                    <input type="number" id="radius" value="100" required style="width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px;">
                </div>
                <button type="submit" class="btn btn-primary">Add Location</button>
            </form>
        </div>
    `;
    
    document.getElementById('gpsResults').innerHTML = html;
    
    document.getElementById('officeLocationForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            location_name: document.getElementById('locationName').value,
            latitude: parseFloat(document.getElementById('locLatitude').value),
            longitude: parseFloat(document.getElementById('locLongitude').value),
            radius: parseInt(document.getElementById('radius').value)
        };
        
        try {
            const response = await fetch('/api/gps-attendance/location/add', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(data)
            });
            const result = await response.json();
            
            if (result.success) {
                alert('✅ Office location added successfully!');
                viewOfficeLocations();
            } else {
                alert('❌ Error: ' + result.message);
            }
        } catch (error) {
            alert('❌ Error: ' + error.message);
        }
    });
}

// View Office Locations
async function viewOfficeLocations() {
    document.getElementById('gpsResults').innerHTML = '<p style="color: #64748b;">Loading office locations...</p>';
    
    try {
        const response = await fetch('/api/gps-attendance/locations');
        const result = await response.json();
        
        if (result.success && result.locations.length > 0) {
            let html = `
                <div style="background: white; border-radius: 8px; padding: 20px; border: 1px solid #e2e8f0;">
                    <h3 style="margin: 0 0 20px 0;">🏢 Office Locations</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #f1f5f9;">
                                <th style="padding: 12px; text-align: left;">Location Name</th>
                                <th style="padding: 12px; text-align: left;">Latitude</th>
                                <th style="padding: 12px; text-align: left;">Longitude</th>
                                <th style="padding: 12px; text-align: left;">Radius (m)</th>
                                <th style="padding: 12px; text-align: left;">Status</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            result.locations.forEach(loc => {
                html += `
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 12px; font-weight: 600;">${loc.location_name}</td>
                        <td style="padding: 12px;">${loc.latitude}</td>
                        <td style="padding: 12px;">${loc.longitude}</td>
                        <td style="padding: 12px;">${loc.radius}</td>
                        <td style="padding: 12px;">
                            <span style="background: ${loc.is_active ? '#dcfce7' : '#fee2e2'}; color: ${loc.is_active ? '#15803d' : '#991b1b'}; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                                ${loc.is_active ? 'Active' : 'Inactive'}
                            </span>
                        </td>
                    </tr>
                `;
            });
            
            html += '</tbody></table></div>';
            document.getElementById('gpsResults').innerHTML = html;
        } else {
            document.getElementById('gpsResults').innerHTML = '<p style="color: #64748b;">No office locations found.</p>';
        }
    } catch (error) {
        document.getElementById('gpsResults').innerHTML = '<p style="color: #ef4444;">Error loading locations.</p>';
    }
}
