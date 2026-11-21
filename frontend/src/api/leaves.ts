import client from './client'
import type { Holiday } from '../types/dashboard'
import type {
  LeaveBalance,
  LeaveRequest,
  CalendarData,
  SandwichCheckResponse,
  EmployeeLeaveBalance,
  ApplyLeavePayload,
  AdminCreateLeavePayload,
} from '../types/leave'

// ── Response shapes ────────────────────────────────────────────────────────

interface LeaveBalanceResponse {
  success: boolean
  balance?: LeaveBalance
  data?: LeaveBalance
  summary?: LeaveBalance
}

// Backend returns `leave_requests` for /all and `requests` for /employee/:id
interface LeaveRequestsResponse {
  success: boolean
  leave_requests?: LeaveRequest[]
  requests?: LeaveRequest[]
}

interface CalendarResponse extends CalendarData {
  success: boolean
}

interface HolidaysResponse {
  success: boolean
  holidays: Holiday[]
}

interface AllBalancesResponse {
  success: boolean
  employees: EmployeeLeaveBalance[]
}

// ── API ────────────────────────────────────────────────────────────────────

export const leavesApi = {
  // Employee leave balance
  getBalance: (userId: number | string) =>
    client.get<LeaveBalanceResponse>(`/leave/balance/${userId}`),

  // All employees' balances (HR/Admin only)
  getAllBalances: () =>
    client.get<AllBalancesResponse>('/leave/all-balances'),

  // Calendar for a given month
  // Endpoint: GET /api/leave/calendar/:userId?year=&month=
  getCalendar: (userId: number | string, year: number, month: number) =>
    client.get<CalendarResponse>(`/leave/calendar/${userId}`, { params: { year, month } }),

  // All leave requests — backend returns `leave_requests` field
  getAllRequests: () =>
    client.get<LeaveRequestsResponse>('/leave_requests/all'),

  // Employee's own requests — backend returns `requests` field
  getEmployeeRequests: (userId: number) =>
    client.get<LeaveRequestsResponse>(`/leave_requests/employee/${userId}`),

  // Submit leave application
  // Endpoint: POST /api/leave/apply (legacy used /leave/request — mismatch fixed)
  applyLeave: (data: ApplyLeavePayload) =>
    client.post<{ success: boolean; message?: string }>('/leave/apply', data),

  // Sandwich policy check before applying
  checkSandwich: (startDate: string, endDate: string) =>
    client.post<SandwichCheckResponse>('/leave/check-sandwich', {
      start_date: startDate,
      end_date:   endDate,
    }),

  // Approve leave (HR/Admin) — POST /api/leave/approve/:id
  // Legacy used: { approved_by, leave_type, comments }
  approveLeave: (id: number, approvedBy: string, leaveType: string, comments: string) =>
    client.post<{ success: boolean; message?: string; warning?: string | null }>(`/leave/approve/${id}`, {
      approved_by: approvedBy,
      leave_type:  leaveType,
      comments,
    }),

  // Reject leave — POST /api/leave/reject/:id
  rejectLeave: (id: number, approvedBy: string, comments: string) =>
    client.post<{ success: boolean; message?: string }>(`/leave/reject/${id}`, {
      rejected_by: approvedBy,
      comments:    comments || `Rejected by ${approvedBy}`,
    }),

  // Holidays list
  getHolidays: () =>
    client.get<HolidaysResponse>('/leave/holidays'),

  // HR/Admin: create leave record for employee or self
  adminCreateLeave: (data: AdminCreateLeavePayload) =>
    client.post<{ success: boolean; message?: string; request_id?: number }>('/leaves/admin-create', data),

  // HR/Admin: update leave record
  updateLeave: (id: number, data: any) =>
    client.put<{ success: boolean; message?: string }>(`/leaves/${id}`, data),

  // HR/Admin: delete / cancel leave record
  deleteLeave: (id: number) =>
    client.delete<{ success: boolean; message?: string }>(`/leaves/${id}`),

  // HR/Admin: update leave balance
  updateBalance: (employeeId: string, data: any) =>
    client.put<{ success: boolean; message?: string }>(`/leaves/balance/${employeeId}`, data),

  // ── Legacy aliases kept for dashboard compatibility ──────────────────────
  // NOTE: approve() uses wrong endpoint (PUT /leave/requests/:id) — kept for compat only
  getRequests: (params?: { status?: string; employee_id?: string }) =>
    client.get('/leave/requests', { params }),
  approve: (id: number, status: 'approved' | 'rejected') =>
    client.put(`/leave/requests/${id}`, { status }),
}
