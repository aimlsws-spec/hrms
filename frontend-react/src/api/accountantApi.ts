import client from './client'

export interface DashboardStats {
  totalPayroll: number
  pendingSalaries: number
  paidSalaries: number
  pendingReimbursements: number
}

export interface PayrollRow {
  id: string
  name: string
  dept: string
  monthly_salary: number
  salary: number
  paid_leave_used: number
  unpaid_days: number
  pt_deduction: number
  leave_deduction: number
  net_payable: number
  status: 'Paid' | 'Pending'
  month?: string
  transactionDate: string
}

export interface HistoryEntry {
  month: string
  month_raw: string
  monthly_salary: number
  professional_tax: number
  leave_deduction: number
  net_payable: number
  amount: number        // legacy alias for net_payable
  status: 'Paid' | 'Pending'
  paid_at: string | null
}

export interface FinanceEmployee {
  id: string
  name: string
  dept: string
  title: string
  salary: number              // legacy alias for net_payable
  monthly_salary: number
  professional_tax: number
  leave_deduction: number
  unpaid_days: number
  paid_leave_used: number
  net_payable: number
  payroll_month: string
  status: 'Paid' | 'Pending'
  history: HistoryEntry[]
}

export type ExpenseStatus = 'Pending' | 'Approved' | 'Rejected'

export interface Expense {
  id: number
  employee: string
  dept: string
  amount: number
  reason: string
  date: string
  status: ExpenseStatus
}

export interface MonthlyReport {
  month: string
  total: number
  employees: number
  avg: number
}

export interface DeptCost {
  dept: string
  headcount: number
  total: number
  pct: number
}

export interface ReportsData {
  monthly: MonthlyReport[]
  deptCosts: DeptCost[]
}

export interface AccountantSettings {
  companyName: string
  payrollCycle: string
  currency: string
  payDay: string
  fiscalYearStart: string
  notifyOnPayroll: boolean
  notifyOnExpense: boolean
}

// ── Dedicated report types ────────────────────────────────────────────────

export interface MonthlyPayrollRow {
  month: string
  month_raw: string
  total: number
  employees: number
  avg: number
}

export interface DeptCostRow {
  dept: string
  headcount: number
  total: number
  pct: number
}

export interface TaxRow {
  name: string
  dept: string
  gross: number
  tax: number
  net: number
}

export interface OvertimeRow {
  name: string
  dept: string
  hours: number
  payout: number
}

export interface ReimbRow {
  employee: string
  dept: string
  amount: number
  reason: string
  approval_date: string
}

export type ReportType =
  | 'monthly-payroll'
  | 'department-cost'
  | 'tax-summary'
  | 'overtime'
  | 'reimbursements'

export const accountantApi = {
  getDashboard: () =>
    client.get<DashboardStats>('/accountant/dashboard'),

  getPayroll: (month?: string) =>
    client.get<PayrollRow[]>('/accountant/payroll', month ? { params: { month } } : {}),

  markPaid: (employeeId: string, month: string) =>
    client.post('/accountant/payroll/pay', { employeeId, month }),

  getEmployees: () =>
    client.get<FinanceEmployee[]>('/accountant/employees'),

  getReimbursements: () =>
    client.get<Expense[]>('/accountant/reimbursements'),

  updateReimbursementStatus: (id: number, status: 'approved' | 'rejected') =>
    client.post('/accountant/reimbursements/update-status', { id, status }),

  getReports: () =>
    client.get<ReportsData>('/accountant/reports'),

  getMonthlyPayroll: () =>
    client.get<MonthlyPayrollRow[]>('/accountant/reports/monthly-payroll'),

  getDepartmentCost: () =>
    client.get<DeptCostRow[]>('/accountant/reports/department-cost'),

  getTaxSummary: () =>
    client.get<TaxRow[]>('/accountant/reports/tax-summary'),

  getOvertimeReport: () =>
    client.get<OvertimeRow[]>('/accountant/reports/overtime'),

  getReimbursementsReport: () =>
    client.get<ReimbRow[]>('/accountant/reports/reimbursements'),

  getSettings: () =>
    client.get<AccountantSettings>('/accountant/settings'),

  saveSettings: (data: AccountantSettings) =>
    client.put<{ success: boolean; message?: string }>('/accountant/settings', data),
}