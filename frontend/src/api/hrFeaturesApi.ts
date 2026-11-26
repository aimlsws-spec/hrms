import client from './client'

export interface LateRecord {
  date: string
  check_in: string
  late_minutes: number
}

export interface LateDeductionItem {
  id: number
  employee_id: string
  employee_name: string
  department: string
  job_title?: string
  year: number
  month: number
  deduction_type: string
  late_count: number
  half_days_deducted: number
  amount: number
  status: 'PENDING_REVIEW' | 'APPLIED' | 'IGNORED'
  reviewed_by?: string | null
  reviewed_at?: string | null
  review_notes?: string | null
  created_at?: string | null
  late_dates: LateRecord[]
}

export interface LateDeductionResponse {
  success: boolean
  deductions: LateDeductionItem[]
  total: number
  pending_count: number
  year: number
  month: number
  message?: string
}

export interface HRActivityLog {
  id: number
  performed_by: string
  performed_name: string
  performed_role: string
  action: string
  target_employee_id?: string | null
  target_employee_name?: string | null
  details: string
  ip_address: string
  created_at: string
}

export interface HRActivityLogsResponse {
  success: boolean
  logs: HRActivityLog[]
  total: number
  page: number
  limit: number
  total_pages: number
  message?: string
}

export const hrFeaturesApi = {
  // Late deduction review
  getLateDeductions: (params?: { status?: string; year?: number; month?: number }) =>
    client.get<LateDeductionResponse>('/hr/late-deductions', { params }),

  actOnLateDeduction: (
    id: number,
    action: 'APPLY' | 'IGNORE',
    notes: string = '',
    actorId?: string,
    actorName?: string
  ) =>
    client.post<{ success: boolean; status: string; message: string }>(
      `/hr/late-deductions/${id}/action`,
      { action, notes, actor_id: actorId, actor_name: actorName }
    ),

  // HR activity logs
  getActivityLogs: (params?: {
    page?: number
    limit?: number
    action?: string
    search?: string
    start_date?: string
    end_date?: string
  }) => client.get<HRActivityLogsResponse>('/hr/activity-logs', { params }),
}
