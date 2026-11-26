import client from './client'

export interface HRReimbursementItem {
  id: number
  employee_id: string
  employee_name: string
  department: string
  title: string
  amount: number
  reason: string
  payment_method: string
  receipt_path: string
  expense_date: string
  status: 'Pending' | 'Approved' | 'Rejected'
  submitted_at: string
  reviewed_by: string
  reviewed_at: string
  comments: string
}

export interface HRReimbursementsStats {
  total: number
  pending: number
  approved: number
  rejected: number
  pending_amount: number
  approved_amount: number
}

export interface HRReimbursementsResponse {
  success: boolean
  reimbursements: HRReimbursementItem[]
  stats: HRReimbursementsStats
  message?: string
}

export interface ReviewReimbursementPayload {
  action: 'APPROVED' | 'REJECTED'
  comments?: string
  reviewed_by?: string
  actor_role?: string
}

export const hrReimbursementsApi = {
  getReimbursements: (params?: { status?: string; search?: string }) =>
    client.get<HRReimbursementsResponse>('/hr/reimbursements', { params }),

  reviewReimbursement: (id: number, payload: ReviewReimbursementPayload) =>
    client.post<{ success: boolean; message?: string; status?: string; reviewed_by?: string }>(
      `/hr/reimbursements/${id}/review`,
      payload
    ),
}
