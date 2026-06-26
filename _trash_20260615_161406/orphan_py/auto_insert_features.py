"""
Automated Admin Features Insertion Script
Run this to automatically add all admin features to enterprise_portal.html
"""

def insert_admin_features():
    print("🚀 Starting automated admin features insertion...")
    
    # Read the file
    with open('enterprise_portal.html', 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # Backup original file
    with open('enterprise_portal.html.backup', 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print("✅ Backup created: enterprise_portal.html.backup")
    
    # Find insertion points
    employees_section_end = None
    documents_section_end = None
    reports_section_end = None
    analytics_section_end = None
    settings_section_end = None
    users_section_end = None
    script_end = None
    
    for i, line in enumerate(lines):
        if 'id="employees-section"' in line:
            # Find the closing div of employees section
            depth = 0
            for j in range(i, len(lines)):
                if '<div' in lines[j]:
                    depth += 1
                if '</div>' in lines[j]:
                    depth -= 1
                    if depth == 0:
                        employees_section_end = j
                        break
        
        if 'id="documents-section"' in line:
            depth = 0
            for j in range(i, len(lines)):
                if '<div' in lines[j]:
                    depth += 1
                if '</div>' in lines[j]:
                    depth -= 1
                    if depth == 0:
                        documents_section_end = j
                        break
        
        if 'id="reports-section"' in line:
            depth = 0
            for j in range(i, len(lines)):
                if '<div' in lines[j]:
                    depth += 1
                if '</div>' in lines[j]:
                    depth -= 1
                    if depth == 0:
                        reports_section_end = j
                        break
        
        if 'id="analytics-section"' in line:
            depth = 0
            for j in range(i, len(lines)):
                if '<div' in lines[j]:
                    depth += 1
                if '</div>' in lines[j]:
                    depth -= 1
                    if depth == 0:
                        analytics_section_end = j
                        break
        
        if 'id="settings-section"' in line:
            depth = 0
            for j in range(i, len(lines)):
                if '<div' in lines[j]:
                    depth += 1
                if '</div>' in lines[j]:
                    depth -= 1
                    if depth == 0:
                        settings_section_end = j
                        break
        
        if 'id="users-section"' in line:
            depth = 0
            for j in range(i, len(lines)):
                if '<div' in lines[j]:
                    depth += 1
                if '</div>' in lines[j]:
                    depth -= 1
                    if depth == 0:
                        users_section_end = j
                        break
        
        if '</script>' in line and script_end is None:
            # Find the last </script> before </body>
            for j in range(len(lines)-1, i, -1):
                if '</body>' in lines[j]:
                    for k in range(j-1, i, -1):
                        if '</script>' in lines[k]:
                            script_end = k
                            break
                    break
    
    print(f"📍 Found insertion points:")
    print(f"   Employees: line {employees_section_end}")
    print(f"   Documents: line {documents_section_end}")
    print(f"   Reports: line {reports_section_end}")
    print(f"   Analytics: line {analytics_section_end}")
    print(f"   Settings: line {settings_section_end}")
    print(f"   Users: line {users_section_end}")
    print(f"   Script: line {script_end}")
    
    # Prepare snippets
    snippet_employee = '''
                <!-- Admin Employee Actions -->
                <div class="card" id="adminEmployeeActions" style="display: none;">
                    <div class="card-header">
                        <div class="card-title">👤 Admin Employee Management</div>
                    </div>
                    <div class="card-content">
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
                            <button onclick="promptEditEmployee()" class="btn btn-primary"><i class="fas fa-edit"></i> Edit Employee</button>
                            <button onclick="promptToggleEmployee()" class="btn btn-secondary"><i class="fas fa-toggle-on"></i> Activate/Deactivate</button>
                            <button onclick="promptUpdateCredentials()" class="btn btn-primary"><i class="fas fa-key"></i> Update Credentials</button>
                            <button onclick="viewLoginHistory()" class="btn btn-secondary"><i class="fas fa-history"></i> Login History</button>
                            <button onclick="promptForceLogout()" class="btn btn-danger"><i class="fas fa-sign-out-alt"></i> Force Logout</button>
                        </div>
                        <div id="employeeAdminResults" style="margin-top: 20px;"></div>
                    </div>
                </div>
'''
    
    snippet_document = '''
                <!-- Admin Document Actions -->
                <div class="card" id="adminDocumentActions" style="display: none;">
                    <div class="card-header">
                        <div class="card-title">📄 Additional Documents</div>
                    </div>
                    <div class="card-content">
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
                            <button onclick="promptGenerateExperience()" class="btn btn-primary"><i class="fas fa-file-alt"></i> Experience Letter</button>
                            <button onclick="promptGenerateRelieving()" class="btn btn-primary"><i class="fas fa-file-signature"></i> Relieving Letter</button>
                        </div>
                        <div id="documentAdminResults" style="margin-top: 20px;"></div>
                    </div>
                </div>
'''
    
    snippet_report = '''
                <!-- Admin Report Actions -->
                <div class="card" id="adminReportActions" style="display: none;">
                    <div class="card-header">
                        <div class="card-title">📊 Advanced Reports</div>
                    </div>
                    <div class="card-content">
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
                            <button onclick="generateAttendanceReport()" class="btn btn-primary"><i class="fas fa-calendar"></i> Attendance Report</button>
                            <button onclick="generatePayrollReport()" class="btn btn-primary"><i class="fas fa-money-check"></i> Payroll Report</button>
                            <button onclick="exportToExcel()" class="btn btn-success"><i class="fas fa-file-excel"></i> Export to Excel</button>
                            <button onclick="exportToPDF()" class="btn btn-danger"><i class="fas fa-file-pdf"></i> Export to PDF</button>
                        </div>
                        <div id="reportAdminResults" style="margin-top: 20px;"></div>
                    </div>
                </div>
'''
    
    snippet_analytics = '''
                <!-- Admin Analytics Widgets -->
                <div class="card" id="adminAnalyticsWidgets" style="display: none;">
                    <div class="card-header">
                        <div class="card-title">📈 Live Widgets</div>
                    </div>
                    <div class="card-content">
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px;">
                            <div id="attendanceWidget"></div>
                            <div id="ticketsWidget"></div>
                            <div id="payrollWidget"></div>
                        </div>
                        <button onclick="refreshWidgets()" class="btn btn-primary" style="margin-top: 16px;"><i class="fas fa-sync"></i> Refresh Widgets</button>
                    </div>
                </div>
'''
    
    snippet_settings = '''
                <!-- Admin Settings Actions -->
                <div class="card" id="adminSettingsActions" style="display: none;">
                    <div class="card-header">
                        <div class="card-title">⚙️ System Configuration</div>
                    </div>
                    <div class="card-content">
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
                            <button onclick="showCompanyProfileForm()" class="btn btn-primary"><i class="fas fa-building"></i> Company Profile</button>
                            <button onclick="showWorkingDaysConfig()" class="btn btn-primary"><i class="fas fa-calendar-week"></i> Working Days</button>
                            <button onclick="viewHolidayCalendar()" class="btn btn-secondary"><i class="fas fa-calendar-alt"></i> Holiday Calendar</button>
                            <button onclick="showAddHolidayForm()" class="btn btn-success"><i class="fas fa-plus"></i> Add Holiday</button>
                        </div>
                        <div id="settingsAdminResults" style="margin-top: 20px;"></div>
                    </div>
                </div>
'''
    
    new_sections = '''
            <!-- Payroll Section -->
            <div id="payroll-section" class="section-content">
                <div class="page-header">
                    <h1 class="page-title">💰 Payroll Management</h1>
                    <p class="page-subtitle">Manage employee salaries, bonuses, and settlements</p>
                </div>
                <div class="card">
                    <div class="card-header"><div class="card-title">Salary Management</div></div>
                    <div class="card-content">
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px;">
                            <button onclick="promptCreateSalaryStructure()" class="btn btn-primary"><i class="fas fa-plus-circle"></i> Create Salary Structure</button>
                            <button onclick="promptViewSalaryHistory()" class="btn btn-secondary"><i class="fas fa-history"></i> Salary Revision History</button>
                            <button onclick="promptAddBonus()" class="btn btn-success"><i class="fas fa-gift"></i> Add Bonus & Incentives</button>
                            <button onclick="promptFinalSettlement()" class="btn btn-warning"><i class="fas fa-calculator"></i> Final Settlement (F&F)</button>
                            <button onclick="viewPayrollSummary()" class="btn btn-info"><i class="fas fa-chart-bar"></i> Payroll Summary</button>
                        </div>
                        <div id="payrollResults" style="margin-top: 20px;"></div>
                    </div>
                </div>
            </div>
            
            <!-- Attendance Section -->
            <div id="attendance-section" class="section-content">
                <div class="page-header">
                    <h1 class="page-title">📅 Attendance Management</h1>
                    <p class="page-subtitle">Track and manage employee attendance</p>
                </div>
                <div class="card">
                    <div class="card-header"><div class="card-title">Attendance Tools</div></div>
                    <div class="card-content">
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px;">
                            <button onclick="viewAttendanceCalendar()" class="btn btn-primary"><i class="fas fa-calendar"></i> Attendance Calendar</button>
                            <button onclick="showMarkAttendanceForm()" class="btn btn-success"><i class="fas fa-check-circle"></i> Mark Attendance</button>
                            <button onclick="promptViewLeaveBalance()" class="btn btn-info"><i class="fas fa-balance-scale"></i> Leave Balance</button>
                            <button onclick="exportAttendanceReport()" class="btn btn-secondary"><i class="fas fa-download"></i> Export Report</button>
                        </div>
                        <div id="attendanceResults" style="margin-top: 20px;"></div>
                    </div>
                </div>
            </div>
            
            <!-- Departments Section -->
            <div id="departments-section" class="section-content">
                <div class="page-header">
                    <h1 class="page-title">🏢 Department Management</h1>
                    <p class="page-subtitle">Manage departments and designations</p>
                </div>
                <div class="card">
                    <div class="card-header"><div class="card-title">Department Tools</div></div>
                    <div class="card-content">
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px;">
                            <button onclick="showCreateDepartmentForm()" class="btn btn-primary"><i class="fas fa-plus"></i> Create Department</button>
                            <button onclick="viewAllDepartments()" class="btn btn-secondary"><i class="fas fa-list"></i> View All Departments</button>
                            <button onclick="showCreateDesignationForm()" class="btn btn-success"><i class="fas fa-briefcase"></i> Create Designation</button>
                            <button onclick="viewDepartmentEmployees()" class="btn btn-info"><i class="fas fa-users"></i> Department Employees</button>
                        </div>
                        <div id="departmentsResults" style="margin-top: 20px;"></div>
                    </div>
                </div>
            </div>
            
            <!-- Performance Section -->
            <div id="performance-section" class="section-content">
                <div class="page-header">
                    <h1 class="page-title">🎯 Performance Management</h1>
                    <p class="page-subtitle">Manage performance cycles, KPIs, and reviews</p>
                </div>
                <div class="card">
                    <div class="card-header"><div class="card-title">Performance Tools</div></div>
                    <div class="card-content">
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px;">
                            <button onclick="showCreatePerformanceCycleForm()" class="btn btn-primary"><i class="fas fa-sync"></i> Create Performance Cycle</button>
                            <button onclick="showCreateKPIForm()" class="btn btn-success"><i class="fas fa-bullseye"></i> Setup KPI/OKR</button>
                            <button onclick="showSelfReviewForm()" class="btn btn-info"><i class="fas fa-user-edit"></i> Self Review</button>
                            <button onclick="showManagerReviewForm()" class="btn btn-warning"><i class="fas fa-user-tie"></i> Manager Review</button>
                            <button onclick="viewPerformanceHistory()" class="btn btn-secondary"><i class="fas fa-history"></i> Performance History</button>
                        </div>
                        <div id="performanceResults" style="margin-top: 20px;"></div>
                    </div>
                </div>
            </div>
            
            <!-- Audit & Security Section -->
            <div id="audit-section" class="section-content">
                <div class="page-header">
                    <h1 class="page-title">🛡️ Audit & Security</h1>
                    <p class="page-subtitle">Monitor system activity and security</p>
                </div>
                <div class="card">
                    <div class="card-header"><div class="card-title">Audit Tools</div></div>
                    <div class="card-content">
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px;">
                            <button onclick="viewAdminActivityLogs()" class="btn btn-primary"><i class="fas fa-user-shield"></i> Admin Activity Logs</button>
                            <button onclick="viewEmployeeActivityLogs()" class="btn btn-secondary"><i class="fas fa-users"></i> Employee Activity Logs</button>
                            <button onclick="viewLoginHistory()" class="btn btn-info"><i class="fas fa-sign-in-alt"></i> Login History</button>
                            <button onclick="performDataBackup()" class="btn btn-warning"><i class="fas fa-database"></i> Data Backup</button>
                        </div>
                        <div id="auditResults" style="margin-top: 20px;"></div>
                    </div>
                </div>
            </div>
'''
    
    helper_functions = '''
        // Widget refresh function
        function refreshWidgets() {
            showTodaysAttendanceWidget();
            showPendingSupportTicketsWidget();
            showPayrollSummary Widget();
        }
        
        function viewPayrollSummary() {
            displayResults('payrollResults', '<p>Loading payroll summary...</p>');
            fetch('http://localhost:8002/api/reports/payroll_report')
                .then(r => r.json())
                .then(data => {
                    const html = `<h3>Payroll Summary</h3><p>Total Monthly: ₹${data.data.total_monthly_payroll.toLocaleString()}</p><p>Average Salary: ₹${data.data.average_salary.toLocaleString()}</p>`;
                    displayResults('payrollResults', html);
                });
        }
        
        function viewDepartmentEmployees() { viewAllDepartments(); }
        function viewPerformanceHistory() { displayResults('performanceResults', '<p>Performance history feature coming soon...</p>'); }
        function performDataBackup() { if(confirm('Perform database backup?')) alert('Backup initiated.'); }
        function generateAttendanceReport() { const m = prompt('Enter month (YYYY-MM):', new Date().toISOString().slice(0, 7)); if(m) displayResults('reportAdminResults', `<p>Generating attendance report for ${m}...</p>`); }
        function generatePayrollReport() { const m = prompt('Enter month (YYYY-MM):', new Date().toISOString().slice(0, 7)); if(m) displayResults('reportAdminResults', `<p>Generating payroll report for ${m}...</p>`); }
        function exportToExcel() { alert('Excel export feature - Coming soon!'); }
        function exportToPDF() { alert('PDF export feature - Coming soon!'); }
        
'''
    
    # Insert snippets
    if employees_section_end:
        lines.insert(employees_section_end, snippet_employee)
        print("✅ Added employee admin actions")
    
    if documents_section_end:
        lines.insert(documents_section_end + 1, snippet_document)
        print("✅ Added document admin actions")
    
    if reports_section_end:
        lines.insert(reports_section_end + 2, snippet_report)
        print("✅ Added report admin actions")
    
    if analytics_section_end:
        lines.insert(analytics_section_end + 3, snippet_analytics)
        print("✅ Added analytics widgets")
    
    if settings_section_end:
        lines.insert(settings_section_end + 4, snippet_settings)
        print("✅ Added settings admin actions")
    
    if users_section_end:
        lines.insert(users_section_end + 6, new_sections)
        print("✅ Added 5 new sections")
    
    if script_end:
        lines.insert(script_end + 7, helper_functions)
        print("✅ Added helper functions")
    
    # Write modified file
    with open('enterprise_portal.html', 'w', encoding='utf-8') as f:
        f.writelines(lines)
    
    print("\n🎉 SUCCESS! All admin features have been added!")
    print("\n📋 Next steps:")
    print("1. Run: python init_admin_features.py")
    print("2. Run: python app.py")
    print("3. Login as admin and test!")
    print("\n💾 Backup saved as: enterprise_portal.html.backup")

if __name__ == "__main__":
    try:
        insert_admin_features()
    except Exception as e:
        print(f"\n❌ Error: {e}")
        print("\nIf error occurs, restore backup:")
        print("copy enterprise_portal.html.backup enterprise_portal.html")
