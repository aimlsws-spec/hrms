
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
// GPS Attendance Role-Based Action Cards
(function() {
    function initGPSRoleBasedCards() {
        const user = JSON.parse(localStorage.getItem('hrms_user') || '{}');
        if (!user.role) return;

        const container = document.getElementById('gpsActionCards');
        if (!container) return;

        let html = '';

        // Admin: View Attendance, Office Locations
        if (user.role === 'admin') {
            html = `
                <div class="action-card" onclick="viewGPSAttendance()">
                    <div class="action-icon blue">
                        <i class="fas fa-list"></i>
                    </div>
                    <div class="action-title">View Attendance</div>
                    <div class="action-desc">All GPS attendance</div>
                </div>
                <div class="action-card" onclick="manageOfficeLocations()">
                    <div class="action-icon orange">
                        <i class="fas fa-building"></i>
                    </div>
                    <div class="action-title">Office Locations</div>
                    <div class="action-desc">Manage & set locations</div>
                </div>
            `;
        }
        // HR: All 4 options
        else if (user.role === 'hr') {
            html = `
                <div class="action-card" onclick="markGPSAttendance()">
                    <div class="action-icon green">
                        <i class="fas fa-map-marker-alt"></i>
                    </div>
                    <div class="action-title">Mark Attendance</div>
                    <div class="action-desc">Check in/out with GPS</div>
                </div>
                <div class="action-card" onclick="viewGPSAttendance()">
                    <div class="action-icon blue">
                        <i class="fas fa-list"></i>
                    </div>
                    <div class="action-title">View Records</div>
                    <div class="action-desc">All GPS attendance</div>
                </div>
                <div class="action-card" onclick="viewMyGPSAttendance()">
                    <div class="action-icon purple">
                        <i class="fas fa-user-check"></i>
                    </div>
                    <div class="action-title">My Attendance</div>
                    <div class="action-desc">View my records</div>
                </div>
                <div class="action-card" onclick="manageOfficeLocations()">
                    <div class="action-icon orange">
                        <i class="fas fa-building"></i>
                    </div>
                    <div class="action-title">Office Locations</div>
                    <div class="action-desc">Manage & set locations</div>
                </div>
            `;
        }
        // Other Employees: Mark Attendance, My Attendance only
        else {
            html = `
                <div class="action-card" onclick="markGPSAttendance()">
                    <div class="action-icon green">
                        <i class="fas fa-map-marker-alt"></i>
                    </div>
                    <div class="action-title">Mark Attendance</div>
                    <div class="action-desc">Check in/out with GPS</div>
                </div>
                <div class="action-card" onclick="viewMyGPSAttendance()">
                    <div class="action-icon purple">
                        <i class="fas fa-user-check"></i>
                    </div>
                    <div class="action-title">My Attendance</div>
                    <div class="action-desc">View my records</div>
                </div>
            `;
        }

        container.innerHTML = html;
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initGPSRoleBasedCards);
    } else {
        initGPSRoleBasedCards();
    }

    // Re-initialize when section is shown
    const originalShowSection = window.showSection;
    if (originalShowSection) {
        window.showSection = function(section) {
            originalShowSection(section);
            if (section === 'gps-attendance') {
                setTimeout(initGPSRoleBasedCards, 100);
            }
        };
    }
})();
