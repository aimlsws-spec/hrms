import { createBrowserRouter, Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { getRoleHome } from '../hooks/useRoleRedirect'
import MainLayout from '../components/layout/MainLayout'
import EmployeeLayout from '../components/employee/layout/EmployeeLayout'
import AccountantLayout from '../components/accountant/AccountantLayout'
import ProtectedRoute from '../components/auth/ProtectedRoute'
import LoginPage from '../pages/LoginPage'
import DashboardPage from '../pages/DashboardPage'
import EmployeesPage from '../pages/EmployeesPage'
import LeavePage from '../pages/LeavePage'
import DocumentsPage from '../pages/DocumentsPage'
import AttendancePage from '../pages/AttendancePage'
import AnalyticsPage from '../pages/AnalyticsPage'
import WfhSelfieReviewPage             from '../pages/WfhSelfieReviewPage'
import WfhGeoLogsPage                 from '../pages/WfhGeoLogsPage'
import HRHomeLocationRequestsPage     from '../pages/HRHomeLocationRequestsPage'
import LiveAttendancePage             from '../pages/LiveAttendancePage'
import HRUnifiedAttendancePage        from '../pages/HRUnifiedAttendancePage'
import HRWFOAttendancePage            from '../pages/HRWFOAttendancePage'
import HRWFHAttendancePage            from '../pages/HRWFHAttendancePage'
import EmployeeDashboardPage    from '../pages/employee/EmployeeDashboardPage'
import EmployeeAttendancePage   from '../pages/employee/EmployeeAttendancePage'
import MyProfilePage            from '../pages/employee/MyProfilePage'
import MyLeavePage              from '../pages/employee/MyLeavePage'
import EmployeeDocumentsPage    from '../pages/employee/EmployeeDocumentsPage'
import EmployeeExpensesPage     from '../pages/employee/EmployeeExpensesPage'
import EmployeeSignupPage       from '../pages/employee/EmployeeSignupPage'
import AccountantDashboardPage  from '../pages/accountant/AccountantDashboardPage'
import AccountantPayrollPage    from '../pages/accountant/AccountantPayrollPage'
import AccountantPayslipsPage   from '../pages/accountant/AccountantPayslipsPage'
import AccountantSalaryPage     from '../pages/accountant/AccountantSalaryPage'
import AccountantFinanceEmployeesPage from '../pages/accountant/AccountantFinanceEmployeesPage'
import AccountantExpensesPage   from '../pages/accountant/AccountantExpensesPage'
import AccountantReportsPage    from '../pages/accountant/AccountantReportsPage'
import AccountantSettingsPage   from '../pages/accountant/AccountantSettingsPage'

function RootRedirect() {
  const { isAuthenticated, isHydrated, user } = useAuthStore()
  if (!isHydrated) return null
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <Navigate to={getRoleHome(user!.role)} replace />
}

export const router = createBrowserRouter([
  // ── Public ────────────────────────────────────────────────────────────
  { path: '/login',           element: <LoginPage /> },
  { path: '/signup',          element: <EmployeeSignupPage /> },
  { path: '/employee/signup', element: <EmployeeSignupPage /> },

  // ── Root redirect ─────────────────────────────────────────────────────
  { path: '/', element: <RootRedirect /> },

  // ── HR / Admin / Manager panel ────────────────────────────────────────
  {
    element: <ProtectedRoute allowedRoles={['admin', 'hr', 'manager']} />,
    children: [{
      element: <MainLayout />,
      children: [
        { path: '/hr/dashboard', element: <DashboardPage /> },
        { path: '/leaves',       element: <LeavePage /> },
        {
          element: <ProtectedRoute allowedRoles={['admin', 'hr']} />,
          children: [
            { path: '/employees',   element: <EmployeesPage /> },
            { path: '/documents',   element: <DocumentsPage /> },
            { path: '/attendance',  element: <AttendancePage /> },
            { path: '/analytics',   element: <AnalyticsPage /> },
            { path: '/wfh-review',    element: <WfhSelfieReviewPage /> },
            { path: '/wfh-geo-logs', element: <WfhGeoLogsPage /> },
            { path: '/hr/home-location-requests', element: <HRHomeLocationRequestsPage /> },
            { path: '/biometric/live',            element: <LiveAttendancePage /> },
            { path: '/hr/unified-attendance',     element: <HRUnifiedAttendancePage /> },
            { path: '/attendance/wfo',            element: <HRWFOAttendancePage /> },
            { path: '/attendance/wfh',            element: <HRWFHAttendancePage /> },
          ],
        },
      ],
    }],
  },  

  // ── Accountant panel ──────────────────────────────────────────────────
  {
    element: <ProtectedRoute allowedRoles={['accountant']} />,
    children: [{
      element: <AccountantLayout />,
      children: [
        { path: '/accountant/dashboard',         element: <AccountantDashboardPage /> },
        { path: '/accountant/payslips',          element: <AccountantPayslipsPage /> },
        { path: '/accountant/salary-requests',   element: <AccountantSalaryPage /> },
        { path: '/accountant/payroll',           element: <AccountantPayrollPage /> },
        { path: '/accountant/employees', element: <AccountantFinanceEmployeesPage /> },
        { path: '/accountant/expenses',  element: <AccountantExpensesPage /> },
        { path: '/accountant/reports',   element: <AccountantReportsPage /> },
        { path: '/accountant/settings',  element: <AccountantSettingsPage /> },
      ],
    }],
  },

  // ── Employee panel ────────────────────────────────────────────────────
  {
    element: <ProtectedRoute allowedRoles={['employee']} />,
    children: [{
      element: <EmployeeLayout />,
      children: [
        { path: '/employee/dashboard',  element: <EmployeeDashboardPage /> },
        { path: '/employee/leave',      element: <MyLeavePage /> },
        { path: '/employee/attendance', element: <EmployeeAttendancePage /> },
        { path: '/employee/profile',    element: <MyProfilePage /> },
        { path: '/employee/expenses',   element: <EmployeeExpensesPage /> },
        { path: '/employee/documents',  element: <EmployeeDocumentsPage /> },
      ],
    }],
  },

  // ── Fallback ──────────────────────────────────────────────────────────
  { path: '*', element: <Navigate to="/" replace /> },
])
