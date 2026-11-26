import client from './client'

export type ExpenseStatus = 'Pending' | 'Approved' | 'Rejected'

export interface MyExpense {
  id: number
  amount: number
  reason: string
  expense_date: string
  submitted_on: string
  status: ExpenseStatus
  payment_method?: string
  receipt_path?: string
  reviewed_by?: string
  reviewed_at?: string
  comments?: string
}

export interface SubmitExpensePayload {
  employee_id: string
  amount: number
  reason: string
  expense_date: string
  payment_method?: string
  receipt?: File | null
}

export const employeeExpenseApi = {
  getMyExpenses: (employeeId: string) =>
    client.get<MyExpense[]>('/employee/expenses', {
      params: { employee_id: employeeId },
    }),

  submitExpense: (payload: SubmitExpensePayload | FormData) =>
    client.post<{ success: boolean; id?: number; message?: string; receipt_path?: string }>(
      '/employee/expenses',
      payload
    ),
}
