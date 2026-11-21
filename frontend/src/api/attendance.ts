import client from './client'
import type {
  AttendanceRecord,
  MarkAttendancePayload,
  RegularizationRequest,
  RegularizationPayload,
} from '../types/attendance'

// API MISMATCHES DOCUMENTED:
// 1. Legacy JS uses /api/attendance-regularization/* (hyphen-separated) but actual
//    backend routes are /api/attendance/regularization/* — all calls here use correct paths.
// 2. Legacy regularization_ui.js has /reject endpoint — no such route exists in backend.
//    Only /approve/{request_id} exists; rejection is not implemented server-side.
// 3. GET /api/attendance/{employee_id} returns field 'date', not 'attendance_date'.
//    Legacy attendance_ui.js reads r.attendance_date — this is a bug in the legacy code.
// 4. POST /api/attendance/mark expects field 'attendance_date' (maps to DB column 'date').

interface AttendanceResponse {
  success: boolean
  data?: AttendanceRecord[]
  message?: string
}

interface CalendarResponse {
  success: boolean
  records?: AttendanceRecord[]
  message?: string
}

interface RegularizationListResponse {
  success: boolean
  requests?: RegularizationRequest[]
  message?: string
}

interface ActionResponse {
  success: boolean
  message?: string
  request_id?: number
}

export const attendanceApi = {
  // GET /api/attendance/{employee_id}?month=YYYY-MM
  getRecords: (employeeId: string, month?: string) =>
    client.get<AttendanceResponse>(`/attendance/${employeeId}`, {
      params: month ? { month } : undefined,
    }),

  // POST /api/attendance/mark  (upsert on employee_id + date)
  markAttendance: (payload: MarkAttendancePayload) =>
    client.post<ActionResponse>('/attendance/mark', payload),

  // GET /api/admin/attendance/calendar?employee_id=&month=
  getCalendar: (employeeId?: string, month?: string) =>
    client.get<CalendarResponse>('/admin/attendance/calendar', {
      params: { employee_id: employeeId, month },
    }),

  // POST /api/attendance/regularization/request
  requestRegularization: (payload: RegularizationPayload) =>
    client.post<ActionResponse>('/attendance/regularization/request', payload),

  // POST /api/attendance/regularization/approve/{request_id}
  // NOTE: no reject endpoint exists in backend — approval only
  approveRegularization: (requestId: number, approvedBy: string, comments?: string) =>
    client.post<ActionResponse>(`/attendance/regularization/approve/${requestId}`, {
      approved_by: approvedBy,
      comments,
    }),

  // POST /api/attendance/regularization/reject/{request_id}  (HR/admin; a reason is required)
  rejectRegularization: (requestId: number, rejectedBy: string, comments: string) =>
    client.post<ActionResponse>(`/attendance/regularization/reject/${requestId}`, {
      rejected_by: rejectedBy,
      comments,
    }),

  // GET /api/attendance/regularization/pending  → { success, requests }
  getPendingRegularizations: () =>
    client.get<RegularizationListResponse>('/attendance/regularization/pending'),

  // GET /api/attendance/regularization/employee/{employee_id}  → { success, requests }
  getEmployeeRegularizations: (employeeId: string) =>
    client.get<RegularizationListResponse>(`/attendance/regularization/employee/${employeeId}`),
}
