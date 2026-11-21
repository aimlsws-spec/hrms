import client from './client'

export interface EmployeeSalaryRecord {
  employee_id: string
  name: string
  department: string
  has_salary: boolean
  joined_on?: string | null
  work_mode?: 'WFO' | 'WFH' | null
  designation?: string
  ctc: number
  basic_salary: number
  hra: number
  da: number
  transport_allowance: number
  medical_allowance: number
  special_allowance: number
  gross_salary: number
  pf_deduction: number
  esi_deduction: number
  professional_tax: number
  income_tax: number
  total_deductions: number
  net_salary: number
  effective_from: string
}

export interface SalaryPayload {
  employee_id: string
  ctc: number
  basic_salary: number
  hra: number
  da: number
  transport_allowance: number
  medical_allowance: number
  special_allowance: number
  pf_deduction: number
  esi_deduction: number
  professional_tax: number
  income_tax: number
  effective_from: string
}

export interface Mysalary {
  employee_id: string
  ctc: number
  basic_salary: number
  hra: number
  da: number
  transport: number
  medical: number
  special: number
  gross_salary: number
  pf_deduction: number
  esi_deduction: number
  professional_tax: number
  income_tax: number
  total_deductions: number
  net_salary: number
  effective_from: string
}

export const hrSalaryApi = {
  getAllSalaries: () =>
    client.get<EmployeeSalaryRecord[]>('/hr/salary'),

  getEmployeeSalary: (employeeId: string) =>
    client.get<EmployeeSalaryRecord | null>(`/hr/salary/${employeeId}`),

  setSalary: (payload: SalaryPayload) =>
    client.post<{ success: boolean; message?: string }>('/hr/salary', payload),

  // Quick-set from CTC only — backend auto-calculates the full breakdown.
  setSalaryFromCtc: (employeeId: string, ctc: number) =>
    client.post<{ success: boolean; message?: string }>('/hr/salary', {
      employee_id: employeeId,
      ctc,
    }),

  getMySalary: (employeeId: string) =>
    client.get<Mysalary | null>('/employee/salary', {
      params: { employee_id: employeeId },
    }),
}
