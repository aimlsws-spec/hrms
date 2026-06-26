# Complete Web-to-App Implementation Plan

## Current Status
- ✅ API Service: 100% (all endpoints connected)
- ✅ Authentication: 100% (login, OTP, role-based routing)
- ✅ Database: 100% (same MySQL database)
- ❌ **Screens: 30%** (only templates, need full implementation)

## What's Missing - Critical Implementation

### Priority 1: Complete ALL Feature Screens (URGENT)

#### 1. Attendance Screen (COMPLETE IMPLEMENTATION)
**File:** `lib/screens/attendance_screen.dart`

**Must Have:**
- GPS check-in button with location capture
- GPS check-out button
- Today's attendance status card
- Monthly calendar view with attendance marks
- Attendance history list (scrollable)
- Filter by date range
- Export attendance report
- Geofence validation indicator

**API Calls:**
```dart
ApiService.gpsCheckIn(employeeId, lat, lng, location)
ApiService.gpsCheckOut(employeeId, lat, lng, location)
ApiService.getAttendanceHistory(employeeId)
```

#### 2. Leave Screen (COMPLETE IMPLEMENTATION)
**File:** `lib/screens/leave_screen.dart`

**Must Have:**
- Leave balance cards (CL, SL, EL with remaining count)
- Apply leave form (type, from date, to date, reason)
- My leave requests list with status
- Pending approvals section (for HR/Admin)
- Approve/Reject buttons (for HR/Admin)
- Leave calendar view
- Leave history with filters

**API Calls:**
```dart
ApiService.applyLeave(leaveData)
ApiService.getMyLeaves(employeeId)
ApiService.getPendingLeaves() // HR/Admin
ApiService.approveLeave(requestId, approvedBy, comments)
ApiService.rejectLeave(requestId, rejectedBy, comments)
```

#### 3. Tasks Screen (COMPLETE IMPLEMENTATION)
**File:** `lib/screens/tasks_screen.dart`

**Must Have:**
- My tasks list with status badges
- Filter by status (To Do, In Progress, Completed)
- Filter by priority (High, Medium, Low)
- Task details view
- Update task status
- Create task form (Admin only)
- Assign task to employee (Admin only)
- Task performance metrics

**API Calls:**
```dart
ApiService.getMyTasks(userId)
ApiService.getAllTasks() // Admin
ApiService.createTask(taskData) // Admin
ApiService.updateTask(taskId, taskData)
ApiService.deleteTask(taskId) // Admin
```

#### 4. Profile Screen (COMPLETE IMPLEMENTATION)
**File:** `lib/screens/profile_screen.dart`

**Must Have:**
- Personal info display (name, email, phone, address)
- Edit profile button
- Edit form with validation
- Save changes to database
- Profile photo display
- Documents section (view/download)
- Salary information (if available)
- Change password option

**API Calls:**
```dart
ApiService.getEmployeeProfile(userId)
ApiService.updateEmployeeProfile(userId, data)
```

#### 5. Regularization Screen (COMPLETE IMPLEMENTATION)
**File:** `lib/screens/regularization_screen.dart`

**Must Have:**
- Request regularization form (date, check-in, check-out, reason)
- My regularization requests list
- Status tracking (Pending, Approved, Rejected)
- Pending requests (HR/Admin)
- Approve/Reject interface (HR/Admin)

**API Calls:**
```dart
ApiService.requestRegularization(data)
ApiService.getMyRegularizations(employeeId)
ApiService.getPendingRegularizations() // HR/Admin
ApiService.approveRegularization(requestId, approvedBy, comments)
```

### Priority 2: Complete ALL Dashboards

#### Admin Dashboard - Full Implementation
**Must Have:**
- Real-time stats (employees, leaves, attendance)
- Pending approvals queue (leaves, regularizations, salary)
- Employee management (add, edit, deactivate)
- Quick actions (approve leave, assign task, create announcement)
- System analytics charts
- Recent activity feed

#### HR Dashboard - Full Implementation
**Must Have:**
- Leave approval queue with one-click approve/reject
- Regularization approval queue
- Employee directory with search
- Attendance overview (today's present/absent)
- New hire onboarding checklist
- Employee performance metrics

#### Accountant Dashboard - Full Implementation
**Must Have:**
- Pending salary structures list
- Approve salary structure
- Active salaries count
- Total payroll amount
- Generate salary slips
- Payroll processing interface
- Financial reports

#### Support Dashboard - Full Implementation
**Must Have:**
- Ticket list with filters (open, in progress, resolved)
- Create ticket form
- Ticket details view
- Update ticket status
- Add comments to ticket
- Assign ticket to support staff
- Priority management

### Priority 3: Add Missing Screens

#### Employee Directory Screen
**File:** `lib/screens/employee_directory_screen.dart`
- Search employees by name/ID
- Filter by department
- Employee card with photo, name, designation
- Employee details view
- Contact information (call, email)

#### Salary Screen
**File:** `lib/screens/salary_screen.dart`
- Current salary structure display
- Download salary slip button
- Salary history
- Tax information
- Bonus details

#### Reports Screen
**File:** `lib/screens/reports_screen.dart`
- Report type selection
- Date range picker
- Generate report button
- View report
- Download PDF
- Share report

#### Announcements Screen
**File:** `lib/screens/announcements_screen.dart`
- All announcements list
- Create announcement (Admin)
- Announcement details
- Mark as read

#### Shifts Screen
**File:** `lib/screens/shifts_screen.dart`
- My shift schedule
- Shift calendar view
- Shift details
- Shift swap request (if applicable)

## Implementation Steps

### Step 1: Update API Service (if needed)
Ensure all endpoints return proper data format

### Step 2: Implement Each Screen Fully
For each screen:
1. Create state variables for data
2. Implement data loading in initState
3. Create UI with proper widgets
4. Add form validation
5. Implement API calls
6. Add error handling
7. Add loading states
8. Add success/error messages
9. Test with real data

### Step 3: Test Complete Flow
1. Login as each role
2. Test every feature
3. Verify database updates
4. Check web-app sync

### Step 4: Polish & Deploy
1. Add animations
2. Improve error messages
3. Add offline support
4. Build APK
5. Test on real device

## Critical Requirements

### Database Sync
- ✅ All API calls use same MySQL database
- ✅ Changes in app reflect in web immediately
- ✅ Changes in web reflect in app on refresh

### Feature Parity
Every feature in web MUST be in app:
- ✅ GPS Attendance
- ✅ Leave Management
- ✅ Task Management
- ✅ Regularization
- ✅ Employee Management
- ✅ Salary Management
- ✅ Reports
- ✅ Announcements
- ✅ Support Tickets
- ✅ AI Assistant

### Role-Based Access
- Admin: Full access
- HR: Employee management, leave approval, regularization approval
- Accountant: Salary management, payroll
- Support: Ticket management
- Employee: Self-service features

## Timeline

- **Day 1-2:** Complete Attendance, Leave, Tasks screens
- **Day 3:** Complete Profile, Regularization screens
- **Day 4:** Complete all dashboards
- **Day 5:** Add missing screens (Directory, Salary, Reports)
- **Day 6:** Testing and bug fixes
- **Day 7:** Polish and deploy

## Success Criteria

App is complete when:
1. ✅ Every web feature works in app
2. ✅ Database updates from both web and app
3. ✅ All roles have proper access
4. ✅ All screens are fully functional
5. ✅ No errors or crashes
6. ✅ Smooth user experience

---

**Current Status:** 30% Complete
**Target:** 100% Complete
**Estimated Time:** 7 days of focused development
