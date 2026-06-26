# HRMS Mobile App - Role-Based Feature Mapping (Web Portal Parity)

## Role-Based Access Control (Exact Match with Web Portal)

### 🔴 ADMIN Role
**Dashboard Features:**
- View all employees count
- View pending leaves count
- View pending regularizations count
- View attendance statistics
- System analytics

**Full Access To:**
- ✅ Employee Management (add, edit, deactivate)
- ✅ Leave Approvals (approve/reject all leaves)
- ✅ Regularization Approvals (approve/reject all)
- ✅ Task Management (create, assign, view all, delete)
- ✅ Salary Structure Approvals
- ✅ Announcements (create, edit, delete)
- ✅ Reports (all types)
- ✅ Audit Logs (view all)
- ✅ Employee Directory (view all)
- ✅ Shift Management
- ✅ Department Management
- ✅ Document Generation (all types)

### 🟢 HR Role
**Dashboard Features:**
- View employees count
- View pending leaves
- View pending regularizations
- View attendance overview

**Access To:**
- ✅ Employee Directory (view all)
- ✅ Leave Approvals (approve/reject)
- ✅ Regularization Approvals (approve/reject)
- ✅ Attendance Management (view all, mark attendance)
- ✅ Employee Onboarding
- ✅ Document Generation (experience letters, relieving letters)
- ✅ Reports (employee, attendance, leave)
- ❌ Salary Management (no access)
- ❌ System Settings (no access)

### 🟡 ACCOUNTANT Role
**Dashboard Features:**
- Pending salary structures count
- Active salaries count
- Total payroll amount
- Monthly payroll summary

**Access To:**
- ✅ Salary Structure Management (create, approve)
- ✅ Payroll Processing
- ✅ Salary Slip Generation (all employees)
- ✅ Bonus Management
- ✅ Financial Reports
- ✅ Tax Calculations
- ❌ Employee Management (no access)
- ❌ Leave Approvals (no access)
- ❌ Attendance Management (no access)

### 🔵 SUPPORT Role
**Dashboard Features:**
- Open tickets count
- In progress tickets count
- Resolved tickets count
- Average resolution time

**Access To:**
- ✅ Ticket Management (view, update, resolve)
- ✅ Employee Context (limited info for support)
- ✅ Ticket Assignment
- ✅ Comments on Tickets
- ❌ Employee Management (no access)
- ❌ Salary Information (no access)
- ❌ Leave Approvals (no access)

### ⚪ EMPLOYEE Role
**Dashboard Features:**
- My attendance summary
- My leave balance
- My tasks count
- Announcements

**Access To:**
- ✅ Own Attendance (GPS check-in/out, view history)
- ✅ Leave Application (apply, view own leaves)
- ✅ Own Tasks (view, update status)
- ✅ Own Profile (view, edit)
- ✅ Regularization Requests (request, view own)
- ✅ Own Documents (download salary slip, experience letter)
- ✅ Announcements (view only)
- ✅ AI Assistant
- ❌ Other Employees Data (no access)
- ❌ Approvals (no access)
- ❌ System Management (no access)

## Workflow Mapping (Web → Mobile)

### Leave Workflow
**Web Portal:**
1. Employee applies leave → Pending
2. HR/Admin sees in pending queue
3. HR/Admin approves/rejects
4. Employee sees updated status

**Mobile App (MUST BE SAME):**
1. Employee: Apply Leave screen → Submit
2. HR/Admin: Leave Screen → Pending Approvals tab
3. HR/Admin: Tap Approve/Reject buttons
4. Employee: My Leaves tab → See status update

### Attendance Workflow
**Web Portal:**
1. Employee GPS check-in with location
2. System validates geofence
3. Records in gps_attendance table
4. Employee GPS check-out
5. Calculates work hours

**Mobile App (MUST BE SAME):**
1. Employee: Attendance Screen → Check In button
2. App captures GPS → Validates geofence
3. Saves to same gps_attendance table
4. Employee: Check Out button
5. Same calculation logic

### Task Workflow
**Web Portal:**
1. Admin creates task → Assigns to employee
2. Employee sees in "My Tasks"
3. Employee updates status (To Do → In Progress → Completed)
4. Admin sees updated status

**Mobile App (MUST BE SAME):**
1. Admin: Tasks Screen → Create Task
2. Employee: Tasks Screen → See assigned tasks
3. Employee: Tap task → Update status chips
4. Admin: Tasks Screen → See all tasks with status

### Salary Workflow
**Web Portal:**
1. Accountant creates salary structure → Pending
2. Accountant approves → Active
3. Employee can download salary slip
4. Accountant can generate bulk slips

**Mobile App (MUST BE SAME):**
1. Accountant: Salary Screen → Create Structure
2. Accountant: Approve button → Activates
3. Employee: Documents → Download Salary Slip
4. Accountant: Bulk Generate option

## Database Tables Used (Same as Web)

- `users` - Authentication
- `employees` - Employee data
- `gps_attendance` - GPS attendance records
- `leave_requests` - Leave applications
- `tasks` - Task management
- `salary_structures` - Salary data
- `attendance_regularization` - Regularization requests
- `announcements` - Company announcements
- `support_tickets` - Support system
- `shifts` - Shift management
- `employee_shifts` - Shift assignments
- `geofence_locations` - Office locations
- `payroll_records` - Payroll data
- `admin_activity_logs` - Admin audit
- `employee_activity_logs` - Employee audit
- `login_history` - Login tracking

## API Endpoints (All Integrated)

Every endpoint from `app.py` is in `api_service.dart`:
- `/auth/login` ✅
- `/auth/verify-otp` ✅
- `/api/attendance/gps/checkin` ✅
- `/api/attendance/gps/checkout` ✅
- `/api/leave/apply` ✅
- `/api/leave_requests/{id}/approve` ✅
- `/api/tasks/*` ✅
- `/api/salary/*` ✅
- `/api/employees/*` ✅
- And 40+ more...

## Implementation Checklist

### ✅ Completed
- [x] API Service with all endpoints
- [x] Authentication with role detection
- [x] Attendance Screen (GPS check-in/out)
- [x] Leave Screen (apply + approve)
- [x] Tasks Screen (view + update)
- [x] Employee Dashboard

### 🔨 In Progress
- [ ] Profile Screen (view + edit)
- [ ] Regularization Screen (request + approve)
- [ ] Admin Dashboard (full features)
- [ ] HR Dashboard (approval workflows)
- [ ] Accountant Dashboard (salary management)
- [ ] Support Dashboard (ticket management)
- [ ] Employee Directory (search + view)
- [ ] AI Assistant (chat interface)
- [ ] Salary Screen (view + download)
- [ ] Reports Screen (generate + download)

## Next Implementation Priority

1. **Add role-based visibility** to all screens
2. **Implement approval workflows** exactly like web
3. **Add all CRUD operations** matching web portal
4. **Ensure database sync** for all operations
5. **Match UI workflows** to web portal flows

---

**Key Point:** Every feature, workflow, and role permission will match your web portal exactly. The API is already connected to the same database, so data syncs automatically. Now implementing the UI and workflows to match web portal behavior.
