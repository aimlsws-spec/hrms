/**
 * Salary Model (MVC data layer)
 *
 * Owns data access + domain shaping for the salary feature. Components and
 * controllers never call the HTTP client directly — they go through the model.
 *
 * The shared `EmployeeSalaryRecord` type still lives in api/hrSalaryApi (used by
 * several other features); we re-export it so the model is the single import
 * point for this feature.
 */
import client from '../api/client'
import type { EmployeeSalaryRecord } from '../api/hrSalaryApi'

export type { EmployeeSalaryRecord }

export interface SalarySaveResult {
  success: boolean
  message?: string
}

export const salaryModel = {
  /** Active employees that still need a salary set (domain rule: !has_salary). */
  async fetchPending(): Promise<EmployeeSalaryRecord[]> {
    const { data } = await client.get<EmployeeSalaryRecord[]>('/hr/salary')
    return (data ?? []).filter((e) => !e.has_salary)
  },

  /** Create/update an employee's salary from an annual CTC (backend computes the breakdown). */
  async setSalaryFromCtc(employeeId: string, ctc: number, designation?: string): Promise<SalarySaveResult> {
    const { data } = await client.post<SalarySaveResult>('/hr/salary', {
      employee_id: employeeId,
      ctc,
      designation: designation?.trim() || undefined,
    })
    return data
  },
}
