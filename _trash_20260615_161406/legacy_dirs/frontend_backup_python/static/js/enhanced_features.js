
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
// Enhanced Features Module for HRMS
const EnhancedFeatures = {
    API_BASE: '',
    
    // Profile Picture Upload
    initProfilePictureUpload(containerId, userId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.innerHTML = `
            <div class="profile-pic-upload">
                <div class="current-pic" id="currentProfilePic">
                    <img src="/static/default-avatar.svg" alt="Profile" class="profile-avatar">
                </div>
                <input type="file" id="profilePicInput" accept="image/*" style="display:none">
                <button onclick="EnhancedFeatures.uploadProfilePic('${userId}')" class="btn-upload">
                    📸 Change Picture
                </button>
            </div>
        `;
        
        this.loadCurrentProfilePic(userId);
    },
    
    async loadCurrentProfilePic(userId) {
        try {
            const response = await fetch(`${this.API_BASE}/api/profile/picture/${userId}`);
            const data = await response.json();
            if (data.success && data.picture) {
                document.querySelector('.profile-avatar').src = `/${data.picture.file_path}`;
            }
        } catch (error) {
            console.error('Error loading profile picture:', error);
        }
    },
    
    uploadProfilePic(userId) {
        const input = document.getElementById('profilePicInput');
        input.click();
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const formData = new FormData();
            formData.append('file', file);
            formData.append('employee_id', userId);
            
            try {
                const response = await fetch(`${this.API_BASE}/api/profile/upload-picture`, {
                    method: 'POST',
                    body: formData
                });
                const data = await response.json();
                if (data.success) {
                    this.showToast('Profile picture updated!', 'success');
                    this.loadCurrentProfilePic(userId);
                }
            } catch (error) {
                this.showToast('Error uploading picture', 'error');
            }
        };
    },
    
    // Task File Attachments
    initTaskAttachments(taskId, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.innerHTML = `
            <div class="task-attachments">
                <div class="upload-zone" id="taskUploadZone">
                    <p>📎 Drag files here or click to upload</p>
                    <input type="file" id="taskFileInput" multiple style="display:none">
                </div>
                <div class="attachment-list" id="attachmentList"></div>
            </div>
        `;
        
        this.setupTaskUpload(taskId);
        this.loadTaskAttachments(taskId);
    },
    
    setupTaskUpload(taskId) {
        const zone = document.getElementById('taskUploadZone');
        const input = document.getElementById('taskFileInput');
        
        zone.onclick = () => input.click();
        zone.ondragover = (e) => { e.preventDefault(); zone.classList.add('dragover'); };
        zone.ondragleave = () => zone.classList.remove('dragover');
        zone.ondrop = (e) => {
            e.preventDefault();
            zone.classList.remove('dragover');
            Array.from(e.dataTransfer.files).forEach(file => this.uploadTaskFile(taskId, file));
        };
        
        input.onchange = (e) => {
            Array.from(e.target.files).forEach(file => this.uploadTaskFile(taskId, file));
        };
    },
    
    async uploadTaskFile(taskId, file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('user_id', this.getCurrentUserId());
        
        try {
            const response = await fetch(`${this.API_BASE}/api/tasks/${taskId}/attachments`, {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            if (data.success) {
                this.showToast('File attached!', 'success');
                this.loadTaskAttachments(taskId);
            }
        } catch (error) {
            this.showToast('Error uploading file', 'error');
        }
    },
    
    async loadTaskAttachments(taskId) {
        try {
            const response = await fetch(`${this.API_BASE}/api/tasks/${taskId}/attachments`);
            const data = await response.json();
            const list = document.getElementById('attachmentList');
            if (data.success && data.attachments.length > 0) {
                list.innerHTML = data.attachments.map(att => `
                    <div class="attachment-item">
                        <span>📄 ${att.file_name}</span>
                        <a href="${this.API_BASE}/api/tasks/attachments/download/${att.id}" download>Download</a>
                    </div>
                `).join('');
            }
        } catch (error) {
            console.error('Error loading attachments:', error);
        }
    },
    
    // Leave Balance Widget
    initLeaveBalance(userId, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.innerHTML = '<div class="leave-balance-widget" id="leaveBalanceContent"></div>';
        this.loadLeaveBalance(userId);
    },
    
    async loadLeaveBalance(userId) {
        try {
            const response = await fetch(`${this.API_BASE}/api/leave/balance/${userId}`);
            const data = await response.json();
            const content = document.getElementById('leaveBalanceContent');
            
            if (!content) {
                console.log('leaveBalanceContent element not found, skipping');
                return;
            }
            
            if (data.success && data.balance) {
                const balance = data.balance;
                const sick = parseFloat(balance.sick_balance) || 0;
                const casual = parseFloat(balance.casual_balance) || 0;
                const paid = parseFloat(balance.paid_balance) || 0;
                const total = sick + casual + paid;
                
                // Calculate percentages for pie chart
                const sickPercent = total > 0 ? (sick / total) * 100 : 33.33;
                const casualPercent = total > 0 ? (casual / total) * 100 : 33.33;
                const paidPercent = total > 0 ? (paid / total) * 100 : 33.33;
                
                // Create pie chart using conic-gradient
                content.innerHTML = `
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 20px;">
                        <div style="position: relative; width: 200px; height: 200px;">
                            <div style="width: 200px; height: 200px; border-radius: 50%; background: conic-gradient(
                                #667eea 0% ${sickPercent}%,
                                #764ba2 ${sickPercent}% ${sickPercent + casualPercent}%,
                                #f093fb ${sickPercent + casualPercent}% 100%
                            ); box-shadow: 0 4px 12px rgba(0,0,0,0.15);"></div>
                            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; background: white; width: 120px; height: 120px; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                                <div style="font-size: 32px; font-weight: bold; color: #1e3a8a;">${total.toFixed(1)}</div>
                                <div style="font-size: 12px; color: #64748b;">Total Days</div>
                            </div>
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; width: 100%;">
                            <div style="text-align: center; padding: 12px; background: #f8fafc; border-radius: 8px; border-left: 4px solid #667eea;">
                                <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">Sick Leave</div>
                                <div style="font-size: 20px; font-weight: bold; color: #667eea;">${sick.toFixed(1)}</div>
                                <div style="font-size: 10px; color: #94a3b8;">of 6 days</div>
                            </div>
                            <div style="text-align: center; padding: 12px; background: #f8fafc; border-radius: 8px; border-left: 4px solid #764ba2;">
                                <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">Casual Leave</div>
                                <div style="font-size: 20px; font-weight: bold; color: #764ba2;">${casual.toFixed(1)}</div>
                                <div style="font-size: 10px; color: #94a3b8;">of 6 days</div>
                            </div>
                            <div style="text-align: center; padding: 12px; background: #f8fafc; border-radius: 8px; border-left: 4px solid #f093fb;">
                                <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">Paid Leave</div>
                                <div style="font-size: 20px; font-weight: bold; color: #f093fb;">${paid.toFixed(1)}</div>
                                <div style="font-size: 10px; color: #94a3b8;">of 6 days</div>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                content.innerHTML = '<p style="color: #666; text-align: center;">No leave balance data available</p>';
            }
        } catch (error) {
            console.error('Error loading leave balance:', error);
            const content = document.getElementById('leaveBalanceContent');
            if (content) {
                content.innerHTML = '<p style="color: #f44336;">Error loading leave balance</p>';
            }
        }
    },
    
    // Leave Calendar
    initLeaveCalendar(userId, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const now = new Date();
        container.innerHTML = `
            <div style="max-width:100%;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                    <button onclick="EnhancedFeatures.changeMonth(-1)" style="background:#f1f5f9;border:none;padding:4px 10px;border-radius:6px;cursor:pointer;font-weight:600;font-size:14px;">◀</button>
                    <h4 id="calendarMonth" style="margin:0;font-size:14px;font-weight:600;color:#1e293b;">${now.toLocaleString('default', { month: 'long', year: 'numeric' })}</h4>
                    <button onclick="EnhancedFeatures.changeMonth(1)" style="background:#f1f5f9;border:none;padding:4px 10px;border-radius:6px;cursor:pointer;font-weight:600;font-size:14px;">▶</button>
                </div>
                <div id="calendarGrid" style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;"></div>
            </div>
        `;
        
        this.currentMonth = now.getMonth() + 1;
        this.currentYear = now.getFullYear();
        this.loadLeaveCalendar(userId);
    },
    
    async loadLeaveCalendar(userId) {
        try {
            const response = await fetch(`${this.API_BASE}/api/leave/calendar/${userId}?year=${this.currentYear}&month=${this.currentMonth}`);
            const data = await response.json();
            const grid = document.getElementById('calendarGrid');
            
            if (data.success) {
                const daysInMonth = new Date(data.year, data.month, 0).getDate();
                const firstDay = new Date(data.year, data.month - 1, 1).getDay();
                
                let html = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
                    .map(day => `<div style="font-weight:600;font-size:11px;color:#64748b;padding:6px;text-align:center;">${day}</div>`).join('');
                
                for (let i = 0; i < firstDay; i++) html += '<div></div>';
                
                for (let day = 1; day <= daysInMonth; day++) {
                    const dt = new Date(data.year, data.month - 1, day);
                    const dow = dt.getDay();
                    let bg = '#fff', col = '#1e293b', icon = '', tooltip = '';
                    let isLeave = false, isHoliday = false;
                    
                    if (data.leaves && data.leaves.length > 0) {
                        for (let k = 0; k < data.leaves.length; k++) {
                            const s = new Date(data.leaves[k].start_date);
                            const e = new Date(data.leaves[k].end_date);
                            s.setHours(0,0,0,0); e.setHours(23,59,59,999); dt.setHours(12,0,0,0);
                            
                            if (dt >= s && dt <= e) {
                                if (data.leaves[k].status === 'Approved') {
                                    bg = '#d1fae5'; col = '#065f46'; icon = '✓'; tooltip = data.leaves[k].leave_type;
                                } else if (data.leaves[k].status === 'Pending') {
                                    bg = '#fef3c7'; col = '#78350f'; icon = '⏳'; tooltip = data.leaves[k].leave_type;
                                } else if (data.leaves[k].status === 'Rejected') {
                                    bg = '#fee2e2'; col = '#991b1b'; icon = '✗'; tooltip = data.leaves[k].leave_type;
                                }
                                isLeave = true; break;
                            }
                        }
                    }
                    
                    if (!isLeave && data.holidays && data.holidays.length > 0) {
                        for (let j = 0; j < data.holidays.length; j++) {
                            const hDate = data.holidays[j].holiday_date;
                            if (typeof hDate === 'string') {
                                const parts = hDate.split('-');
                                if (parseInt(parts[0]) === data.year && parseInt(parts[1]) === data.month && parseInt(parts[2]) === day) {
                                    bg = '#fce7f3'; col = '#831843'; icon = '🎉'; tooltip = data.holidays[j].holiday_name;
                                    isHoliday = true; break;
                                }
                            }
                        }
                    }
                    
                    if (!isLeave && !isHoliday && dow === 0) {
                        bg = '#fee2e2'; col = '#991b1b'; icon = '☀'; tooltip = 'Sunday';
                        isHoliday = true;
                    }
                    
                    if (!isLeave && !isHoliday && data.saturdays && data.saturdays.indexOf(day) >= 0) {
                        bg = '#fef3c7'; col = '#78350f'; icon = '🏖'; tooltip = '2nd/4th Sat';
                        isHoliday = true;
                    }
                    
                    html += `<div title="${tooltip}" style="background:${bg};color:${col};padding:6px;border-radius:6px;font-size:12px;font-weight:600;min-height:32px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;transition:all 0.2s;" onmouseover="this.style.transform='scale(1.08)';this.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)'" onmouseout="this.style.transform='scale(1)';this.style.boxShadow='none'">${icon ? `<span style="font-size:8px;">${icon}</span>` : ''}<span style="font-size:11px;">${day}</span></div>`;
                }
                
                grid.innerHTML = html;
            }
        } catch (error) {
            console.error('Error loading calendar:', error);
        }
    },
    
    changeMonth(delta) {
        this.currentMonth += delta;
        if (this.currentMonth > 12) { this.currentMonth = 1; this.currentYear++; }
        if (this.currentMonth < 1) { this.currentMonth = 12; this.currentYear--; }
        
        const monthName = new Date(this.currentYear, this.currentMonth - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
        document.getElementById('calendarMonth').textContent = monthName;
        this.loadLeaveCalendar(this.getCurrentUserId());
    },
    
    // Utility Functions
    getCurrentUserId() {
        const userData = localStorage.getItem('hrms_user');
        if (userData) {
            try {
                const user = JSON.parse(userData);
                return user.user_id;
            } catch (e) {
                console.error('Error parsing user data:', e);
            }
        }
        return null;
    },
    
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = 'position:fixed;top:20px;right:20px;padding:15px 20px;background:#4CAF50;color:white;border-radius:4px;z-index:9999;animation:slideIn 0.3s';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }
};

// Auto-initialize on page load
window.addEventListener('load', () => {
    setTimeout(() => {
        const userId = EnhancedFeatures.getCurrentUserId();
        if (!userId) {
            console.log('No user ID found, skipping enhanced features initialization');
            return;
        }
        
        // Get user role from localStorage
        const userData = localStorage.getItem('hrms_user');
        let userRole = 'employee';
        if (userData) {
            try {
                const user = JSON.parse(userData);
                userRole = user.role;
            } catch (e) {
                console.error('Error parsing user data:', e);
            }
        }
        
        console.log('Initializing enhanced features for user:', userId, 'role:', userRole);
        
        // Initialize features if containers exist
        if (document.getElementById('profilePictureContainer')) {
            console.log('Initializing profile picture');
            EnhancedFeatures.initProfilePictureUpload('profilePictureContainer', userId);
        }
        
        // Only show leave balance for HR and employees, NOT admin
        if (userRole !== 'admin') {
            if (document.getElementById('leaveBalanceContainer')) {
                console.log('Initializing leave balance');
                EnhancedFeatures.initLeaveBalance(userId, 'leaveBalanceContainer');
            }
            
            // Calendar now handled by fix_calendar.js
            // if (document.getElementById('leaveCalendarContainer')) {
            //     console.log('Initializing leave calendar');
            //     EnhancedFeatures.initLeaveCalendar(userId, 'leaveCalendarContainer');
            // }
        } else {
            // Hide leave widgets for admin
            const leaveContainer = document.getElementById('leaveBalanceContainer');
            const calendarContainer = document.getElementById('leaveCalendarContainer');
            if (leaveContainer) leaveContainer.closest('div[style*="background: white"]').style.display = 'none';
            if (calendarContainer) calendarContainer.closest('div[style*="background: white"]').style.display = 'none';
        }
    }, 1000); // Wait 1 second for user data to load
});

// Make EnhancedFeatures globally available
window.EnhancedFeatures = EnhancedFeatures;
