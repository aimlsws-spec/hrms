export interface AnalyticsOverview {
  success: boolean
  total_employees: number
  active_employees: number
  total_users: number
  role_distribution: { admin: number; hr: number; employee: number }
  department_distribution: Record<string, number>
}

export interface EmployeeStatusSummary {
  success: boolean
  data: { active: number; inactive: number; on_leave: number }
}

export interface ChartPoint {
  name: string
  value: number
}

// ── Attendance analytics ─────────────────────────────────────────────────────

export interface AttendanceMonthPoint {
  month:    string
  present:  number
  absent:   number
  half_day: number
  on_leave: number
  total:    number
  rate:     number
}

export interface AttendanceOverall {
  total_marked:    number
  present:         number
  absent:          number
  half_day:        number
  on_leave:        number
  attendance_rate: number
}

export interface DeptAttendance {
  department:   string
  total_days:   number
  present_days: number
  rate:         number
}

export interface AttendanceAnalyticsResponse {
  success:        boolean
  period_months:  number
  monthly_trend:  AttendanceMonthPoint[]
  overall:        AttendanceOverall
  by_department:  DeptAttendance[]
  data_note?:     string
  message?:       string
}

// ── Overtime analytics ───────────────────────────────────────────────────────

export interface OvertimeMonthPoint {
  month:                string
  days_with_data:       number
  unique_employees:     number
  total_overtime_hours: number
  total_work_hours:     number
}

export interface EmployeeOvertime {
  employee_id:    string
  employee_name:  string
  department:     string
  days_worked:    number
  total_hours:    number
  overtime_hours: number
}

export interface OvertimeAnalyticsResponse {
  success:                boolean
  period_months:          number
  standard_hours_per_day: number
  monthly_overtime:       OvertimeMonthPoint[]
  top_by_overtime:        EmployeeOvertime[]
  data_note?:             string
  message?:               string
}

// ── Employee growth analytics ────────────────────────────────────────────────

export interface GrowthMonthPoint {
  month:      string
  new_hires:  number
  cumulative: number
}

export interface DeptHeadcount {
  department: string
  total:      number
  active:     number
}

export interface EmployeeGrowthResponse {
  success:        boolean
  period_months:  number
  monthly_growth: GrowthMonthPoint[]
  dept_breakdown: DeptHeadcount[]
  totals:         { total: number; active: number; inactive: number }
  data_note?:     string
  message?:       string
}

// ── Document analytics ───────────────────────────────────────────────────────

export interface DocumentAnalyticsResponse {
  success:         boolean
  data_available:  boolean
  by_type:         Record<string, number>
  total_generated: number
  reason?:         string
  data_note?:      string
  message?:        string
}
