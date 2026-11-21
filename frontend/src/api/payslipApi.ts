import client from './client'

export interface PayslipData {
  success:                boolean
  message?:               string
  employee_id:            string
  employee_name:          string
  department:             string
  job_title:              string
  payroll_month:          string
  monthly_salary:         number
  working_days:           number
  present_days:           number
  absent_days:            number
  per_day_salary:         number
  gross_earnings:         number
  professional_tax:       number
  paid_leave_used?:         number
  unpaid_leave_days?:       number
  unpaid_leave_deduction?:  number
  grace_late_count?:        number
  late_deductions_applied?: number
  late_arrival_deduction?:  number
  net_salary:               number
  html?:                    string
}

export type PayslipSummary = Omit<PayslipData, 'html' | 'success' | 'message'>

export interface SlipUrlResponse {
  found:         boolean
  file_url:      string | null
  payroll_month: string | null
}

export const payslipApi = {
  generate: (employeeId: string, month: number, year: number) =>
    client.get<PayslipData>('/payslip/generate', {
      params: { employee_id: employeeId, month, year },
    }),

  getAll: (month: number, year: number) =>
    client.get<PayslipSummary[]>('/payslip/all', {
      params: { month, year },
    }),

  /**
   * Look up whether an official Seawind salary slip PDF was already generated
   * (via the Accountant module) for the given employee + month.
   * Returns the download URL when found so the caller can open the real PDF
   * instead of the generic HTML template.
   */
  getSlipUrl: (employeeId: string, month: number, year: number) =>
    client.get<SlipUrlResponse>('/payslip/slip-url', {
      params: { employee_id: employeeId, month, year },
    }),
}
