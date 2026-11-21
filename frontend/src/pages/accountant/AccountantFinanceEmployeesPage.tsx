import { Fragment, useState, useEffect, useCallback } from 'react'
import { accountantApi, type FinanceEmployee } from '../../api/accountantApi'

function fmt(n: number) { return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function initials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

export default function AccountantFinanceEmployeesPage() {
  const [employees, setEmployees] = useState<FinanceEmployee[]>([])
  const [expanded,  setExpanded]  = useState<string | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await accountantApi.getEmployees()
      setEmployees(res.data)
    } catch {
      setError('Failed to load employee data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function toggle(id: string) {
    setExpanded(prev => prev === id ? null : id)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Employees — Finance View</h1>
          <p className="text-sm text-gray-500 mt-0.5">Salary details and payment history (read-only)</p>
        </div>
        <button
          onClick={load}
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
        >
          <i className="fas fa-rotate-right text-[11px]" /> Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-2xl px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-circle-exclamation text-red-400 text-[13px]" />
            <p className="text-[13px] text-red-600">{error}</p>
          </div>
          <button onClick={load} className="text-[12px] font-semibold text-red-500 hover:text-red-600">
            Retry
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Employee', 'Dept', 'Monthly Salary', 'Net Payable', 'Status', 'Details'].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? [...Array(5)].map((_, i) => (
                    <tr key={i} className="border-b border-gray-50 last:border-0">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5 animate-pulse">
                          <div className="w-8 h-8 rounded-full bg-gray-200 shrink-0" />
                          <div className="space-y-1.5">
                            <div className="h-3 w-28 bg-gray-200 rounded" />
                            <div className="h-2.5 w-14 bg-gray-100 rounded" />
                          </div>
                        </div>
                      </td>
                      {[...Array(5)].map((_, j) => (
                        <td key={j} className="px-5 py-3.5"><div className="h-3 w-16 bg-gray-100 rounded animate-pulse" /></td>
                      ))}
                    </tr>
                  ))
                : employees.map(emp => (
                    <Fragment key={emp.id}>
                      <tr
                        className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors"
                        style={expanded === emp.id ? { borderBottomColor: 'transparent' } : {}}
                      >
                        {/* Employee */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-bold flex items-center justify-center shrink-0">
                              {initials(emp.name)}
                            </span>
                            <div>
                              <p className="font-medium text-gray-800 leading-tight">{emp.name}</p>
                              <p className="text-[10px] text-gray-400 font-mono">{emp.id}</p>
                            </div>
                          </div>
                        </td>

                        {/* Dept */}
                        <td className="px-5 py-3.5 text-gray-600 whitespace-nowrap">{emp.dept}</td>

                        {/* Monthly Salary (gross from payroll engine) */}
                        <td className="px-5 py-3.5 font-semibold text-gray-800 whitespace-nowrap">
                          {fmt(emp.monthly_salary ?? emp.salary)}
                        </td>

                        {/* Net Payable (after PT + leave deduction) */}
                        <td className="px-5 py-3.5 font-bold text-gray-900 whitespace-nowrap">
                          {fmt(emp.net_payable ?? emp.salary)}
                          {(emp.leave_deduction ?? 0) > 0 && (
                            <div className="text-[10px] text-amber-500 font-normal mt-0.5">
                              −{fmt(emp.leave_deduction)} leave
                            </div>
                          )}
                        </td>

                        {/* Status badge */}
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full whitespace-nowrap ${
                            emp.status === 'Paid'
                              ? 'bg-emerald-50 text-emerald-600'
                              : 'bg-amber-50 text-amber-600'
                          }`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />
                            {emp.status} — {emp.payroll_month}
                          </span>
                        </td>

                        {/* Toggle */}
                        <td className="px-5 py-3.5">
                          <button
                            onClick={() => toggle(emp.id)}
                            className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                              expanded === emp.id
                                ? 'bg-indigo-600 text-white'
                                : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                            }`}
                          >
                            <i className="fa-solid fa-clock-rotate-left text-[10px]" />
                            {expanded === emp.id ? 'Hide' : 'View Details'}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded: current month breakdown + payment history */}
                      {expanded === emp.id && (
                        <tr className="border-b border-gray-100">
                          <td colSpan={6} className="px-5 pb-5 pt-1">
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">

                              {/* Current month payroll breakdown */}
                              <div className="bg-slate-50 rounded-xl p-4">
                                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-3">
                                  {emp.payroll_month} — Payroll Breakdown
                                </p>
                                <div className="space-y-2 text-[12px]">
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">Monthly Salary</span>
                                    <span className="font-semibold text-gray-800">{fmt(emp.monthly_salary ?? emp.salary)}</span>
                                  </div>
                                  <div className="flex justify-between text-red-500">
                                    <span>Professional Tax</span>
                                    <span className="font-semibold">− {fmt(emp.professional_tax ?? 200)}</span>
                                  </div>
                                  {(emp.leave_deduction ?? 0) > 0 && (
                                    <div className="flex justify-between text-amber-600">
                                      <span>
                                        Leave Deduction
                                        {(emp.unpaid_days ?? 0) > 0 && (
                                          <span className="text-[10px] text-gray-400 ml-1">({emp.unpaid_days} unpaid day{emp.unpaid_days !== 1 ? 's' : ''})</span>
                                        )}
                                      </span>
                                      <span className="font-semibold">− {fmt(emp.leave_deduction)}</span>
                                    </div>
                                  )}
                                  <div className="border-t border-gray-200 pt-2 flex justify-between">
                                    <span className="font-semibold text-gray-700">Net Payable</span>
                                    <span className="font-bold text-gray-900">{fmt(emp.net_payable ?? emp.salary)}</span>
                                  </div>
                                  <div className="flex justify-between text-[11px]">
                                    <span className="text-gray-400">Payment Status</span>
                                    <span className={`font-semibold ${emp.status === 'Paid' ? 'text-emerald-600' : 'text-amber-600'}`}>
                                      {emp.status}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Payment history */}
                              <div className="bg-slate-50 rounded-xl p-4">
                                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-3">
                                  Payment History
                                </p>
                                {emp.history.length === 0
                                  ? <p className="text-[12px] text-gray-400">No payment history yet</p>
                                  : (
                                    <div className="space-y-2.5">
                                      {emp.history.map((h, i) => (
                                        <div key={i} className="text-[12px]">
                                          <div className="flex items-center justify-between">
                                            <span className="font-medium text-gray-700">{h.month}</span>
                                            <div className="flex items-center gap-2">
                                              <span className="font-bold text-gray-900">{fmt(h.net_payable ?? h.amount)}</span>
                                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                                                h.status === 'Paid'
                                                  ? 'bg-emerald-50 text-emerald-600'
                                                  : 'bg-amber-50 text-amber-600'
                                              }`}>
                                                {h.status}
                                              </span>
                                            </div>
                                          </div>
                                          <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                                            <span>Gross {fmt(h.monthly_salary)}</span>
                                            {(h.leave_deduction ?? 0) > 0 && (
                                              <span className="text-amber-500">Leave −{fmt(h.leave_deduction)}</span>
                                            )}
                                            {h.paid_at && <span>{h.paid_at}</span>}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )
                                }
                              </div>

                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))
              }
              {!loading && employees.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-center text-[13px] text-gray-400">
                    No employee records found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
