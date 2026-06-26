export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'ON_LEAVE'
export type RegularizationStatus = 'Pending' | 'Approved' | 'Rejected'

export interface AttendanceRecord {
  id?: number
  employee_id: string
  // GET /api/attendance/{id} returns column name 'date', not 'attendance_date'
  date?: string
  check_in?: string
  check_out?: string
  status: AttendanceStatus
  remarks?: string
  work_hours?: number
  late_minutes?: number
  early_minutes?: number
  beyond_grace?: number       // 1 = checked in after 09:45
  overtime_minutes?: number
  created_at?: string
}

export interface MarkAttendancePayload {
  employee_id: string
  attendance_date: string   // POST body field maps to DB column 'date'
  check_in: string
  check_out?: string
  status: AttendanceStatus
  remarks?: string
}

export interface RegularizationRequest {
  id?: number
  employee_id: string
  employee_name?: string
  attendance_date?: string
  original_check_in?: string
  original_check_out?: string
  requested_check_in?: string
  requested_check_out?: string
  reason: string
  status: RegularizationStatus
  approved_by?: string
  approval_comments?: string
  approved_at?: string
  created_at?: string
}

export interface RegularizationPayload {
  employee_id: string
  attendance_date: string
  requested_check_in: string
  requested_check_out: string
  reason: string
}

export interface AttendanceStats {
  present: number
  absent: number
  half_day: number
  on_leave: number
  total: number
}
