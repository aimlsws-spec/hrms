import client from './client'

export type ExpenseStatus = 'Pending' | 'Approved' | 'Rejected'

export interface MyExpense {
  id: number
  amount: number
  reason: string
  expense_date: string
  submitted_on: string
  status: ExpenseStatus
}

export interface SubmitExpensePayload {
  employee_id: string
  amount: number
  reason: string
  expense_date: string
}

export const employeeExpenseApi = {
  getMyExpenses: (employeeId: string) =>
    client.get<MyExpense[]>('/employee/expenses', {
      params: { employee_id: employeeId },
    }),

  submitExpense: (payload: SubmitExpensePayload) =>
    client.post<{ success: boolean; id?: number; message?: string }>(
      '/employee/expenses',
      payload
    ),
}
