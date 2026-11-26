export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected'

export type LeaveDuration = 'full_day' | 'first_half' | 'second_half'

export type LeaveType =
  | 'Casual Leave'
  | 'Sick Leave'
  | 'Earned Leave'
  | 'Annual Leave'
  | 'Emergency Leave'
  | 'Maternity Leave'
  | 'Paternity Leave'

export interface LeaveBalance {
  year?: number
  sick_balance?: number
  casual_balance?: number
  paid_balance?: number
  earned_balance?: number
  casual_total?: number
  sick_total?: number
  earned_total?: number
  casual_used?: number
  sick_used?: number
  paid_used?: number
  total_balance?: number
  total_remaining?: number
  total_total?: number
  total_used?: number
  unpaid_taken?: number
}

export interface LeaveRequest {
  id: number
  employee_id?: number | string
  employee_name?: string
  leave_type?: string
  start_date?: string
  end_date?: string
  reason?: string
  status: LeaveStatus
  created_at?: string
  approval_date?: string
  half_day?: string
  leave_duration?: LeaveDuration
  is_unpaid?: boolean
  days_count?: number
  requested_days?: number
  paid_days?: number
  unpaid_days?: number
}

export interface UnpaidLeaveWarning {
  exceeds_balance: boolean
  leave_category: string
  requested_days: number
  available_paid_days: number
  unpaid_days: number
}

export interface CalendarLeave {
  start_date: string
  end_date: string
  status: LeaveStatus
  leave_type: string
}

export interface CalendarHoliday {
  holiday_date: string
  holiday_name: string
}

export interface CalendarData {
  leaves: CalendarLeave[]
  holidays: CalendarHoliday[]
  saturdays: number[]
  second_and_fourth_saturdays?: number[]
  sundays?: number[]
  all_saturdays?: number[]
}

export interface ApplyLeavePayload {
  employee_id: number | string
  leave_type: string
  start_date: string
  end_date: string
  reason: string
  leave_duration?: LeaveDuration
  half_day?: string
  is_unpaid?: boolean
  unpaid_days?: number
}

export interface SandwichCheckResponse {
  success: boolean
  has_sandwich: boolean
  warning?: string
  sandwich_days?: string[]
  count?: number
}

export interface AdminCreateLeavePayload {
  employee_id: string | number
  leave_type: string
  start_date: string
  end_date: string
  reason: string
  status?: 'Approved' | 'Pending'
  created_by?: string
  leave_duration?: LeaveDuration
  is_unpaid?: boolean
  unpaid_days?: number
}

export interface EmployeeLeaveBalance {
  employee_id: string
  name: string
  role: string
  department?: string
  year?: number
  casual_leave: number
  sick_leave: number
  earned_leave: number
  casual_total?: number
  sick_total?: number
  earned_total?: number
  casual_used?: number
  sick_used?: number
  earned_used?: number
  total_used: number
  total_remaining: number
  total_total?: number
}
