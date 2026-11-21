import client from './client'
import type {
  AnalyticsOverview,
  EmployeeStatusSummary,
  AttendanceAnalyticsResponse,
  OvertimeAnalyticsResponse,
  EmployeeGrowthResponse,
  DocumentAnalyticsResponse,
} from '../types/analytics'

// API MISMATCHES DOCUMENTED:
// 1. GET /api/analytics/overview returns attendance_rate: 94.2 — HARDCODED in backend. Not used here.
// 2. GET /api/analytics/overview returns pending_leaves: 12  — HARDCODED in backend. Not used here.
//    Real pending count is derived from /api/leave_requests/all in useLeaveAnalytics hook.
// 3. active_employees from /api/analytics/overview = users WHERE is_active=1 (not employees table).
//    employees/status-summary uses the employees table and gives the real active/inactive/on_leave split.

export const analyticsApi = {
  // GET /api/analytics/overview → department distribution, role distribution, employee totals
  getOverview: () =>
    client.get<AnalyticsOverview>('/analytics/overview'),

  // GET /api/employees/status-summary → { success, data: { active, inactive, on_leave } }
  getEmployeeStatus: () =>
    client.get<EmployeeStatusSummary>('/employees/status-summary'),

  // GET /api/analytics/attendance?months=N → monthly trend, overall rate, dept breakdown
  getAttendance: (months = 6) =>
    client.get<AttendanceAnalyticsResponse>('/analytics/attendance', { params: { months } }),

  // GET /api/analytics/overtime?months=N → monthly totals, top employees by overtime
  getOvertime: (months = 3) =>
    client.get<OvertimeAnalyticsResponse>('/analytics/overtime', { params: { months } }),

  // GET /api/analytics/employees/growth?months=N → new hires per month, cumulative, dept breakdown
  getEmployeeGrowth: (months = 12) =>
    client.get<EmployeeGrowthResponse>('/analytics/employees/growth', { params: { months } }),

  // GET /api/analytics/documents → data_available: false (no DB tracking) or partial from audit log
  getDocuments: () =>
    client.get<DocumentAnalyticsResponse>('/analytics/documents'),
}
