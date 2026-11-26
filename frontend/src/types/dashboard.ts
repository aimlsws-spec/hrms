export interface DashboardStatsResponse {
  stats?: { total_employees: number }
  total_employees?: number
}

export interface RecentEmployee {
  name?: string        // backend alias: full_name AS name
  full_name?: string
  first_name?: string
  last_name?: string
  employee_id: string
  department?: string
}

export interface Announcement {
  id?: number
  title: string
  message?: string
  content?: string
  created_at?: string
  creator_name?: string
  creator_role?: string
}

export interface Holiday {
  holiday_name: string
  holiday_date: string
}

export interface LeaveBalance {
  sick_balance?: number
  casual_balance?: number
  paid_balance?: number
  total_balance?: number
}

export interface LeaveRequest {
  id: number
  employee_name?: string
  leave_type?: string
  start_date?: string
  end_date?: string
  status: string
  reason?: string
}

export interface CreateAnnouncementPayload {
  title: string
  message: string
  created_by: number | string
  creator_name: string
  creator_role: string
}
