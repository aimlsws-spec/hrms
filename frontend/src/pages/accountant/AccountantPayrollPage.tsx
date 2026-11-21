import { useState, useEffect, useCallback } from 'react'
import { accountantApi, type PayrollRow } from '../../api/accountantApi'

function fmt(n: number) {
  return '₹' + n.toLocaleString('en-IN')
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

const now = new Date()
const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

export default function AccountantPayrollPage() {
  const [rows,      setRows]      = useState<PayrollRow[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [paying,    setPaying]    = useState<Set<string>>(new Set())
  const [monthYear, setMonthYear] = useState(defaultMonth)

  const load = useCallback(async (month: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await accountantApi.getPayroll(month)
      setRows(res.data)
    } catch {
      setError('Failed to load payroll data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(monthYear) }, [load, monthYear])

  async function markPaid(row: PayrollRow) {
    setPaying(prev => new Set(prev).add(row.id))
    setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: 'Paid' } : r))
    try {
      await accountantApi.markPaid(row.id, row.month ?? monthYear)
    } catch {
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: 'Pending' } : r))
    } finally {
      setPaying(prev => { const s = new Set(prev); s.delete(row.id); return s })
    }
  }

  const total   = rows.reduce((s, r) => s + (r.net_payable || r.salary || 0), 0)
  const pending = rows.filter(r => r.status === 'Pending').length
  const paid    = rows.filter(r => r.status === 'Paid').length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Payroll</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage and process employee salaries</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          <input
            type="month"
            value={monthYear}
            max={defaultMonth}
            onChange={e => setMonthYear(e.target.value)}
            className="h-8 px-2.5 text-[12px] border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:border-indigo-400"
          />
          {!loading && (
            <>
              <span className="text-[11px] font-semibold bg-gray-100 text-gray-600 px-2.5 py-1 rounded-lg">
                Total: {fmt(total)}
              </span>
              <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-lg">
                Paid: {paid}
              </span>
              <span className="text-[11px] font-semibold bg-amber-50 text-amber-600 px-2.5 py-1 rounded-lg">
                Pending: {pending}
              </span>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-2xl px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-circle-exclamation text-red-400 text-[13px]" />
            <p className="text-[13px] text-red-600">{error}</p>
          </div>
          <button onClick={() => load(monthYear)} className="text-[12px] font-semibold text-red-500 hover:text-red-600">
            Retry
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Employee', 'Dept', 'Monthly Salary', 'Paid Leave', 'Unpaid Days', 'PT', 'Leave Deduction', 'Net Payable', 'Status', 'Action'].map(h => (
                  <th key={h} className="text-left px-3.5 py-3 text-[10px] font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? [...Array(6)].map((_, i) => (
                    <tr key={i} className="border-b border-gray-50 last:border-0">
                      <td className="px-3.5 py-3">
                        <div className="flex items-center gap-2 animate-pulse">
                          <div className="w-7 h-7 rounded-full bg-gray-200 shrink-0" />
                          <div className="space-y-1">
                            <div className="h-2.5 w-24 bg-gray-200 rounded" />
                            <div className="h-2 w-16 bg-gray-100 rounded" />
                          </div>
                        </div>
                      </td>
                      {[...Array(9)].map((_, j) => (
                        <td key={j} className="px-3.5 py-3">
                          <div className="h-2.5 w-14 bg-gray-100 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                : rows.map(row => (
                    <tr key={row.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors">
                      <td className="px-3.5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                            {initials(row.name)}
                          </span>
                          <div>
                            <p className="font-medium text-gray-800 text-[12px]">{row.name}</p>
                            <p className="text-[9px] text-gray-400 font-mono">{row.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3.5 py-3 text-gray-600 whitespace-nowrap">{row.dept}</td>
                      <td className="px-3.5 py-3 font-semibold text-gray-800 whitespace-nowrap">{fmt(row.monthly_salary || row.salary)}</td>
                      <td className="px-3.5 py-3 text-emerald-700 whitespace-nowrap">
                        {(row.paid_leave_used ?? 0) > 0
                          ? <span className="font-semibold">{Number(row.paid_leave_used).toFixed(1)} day{row.paid_leave_used !== 1 ? 's' : ''}</span>
                          : <span className="text-gray-300">—</span>
                        }
                      </td>
                      <td className="px-3.5 py-3 text-amber-600 font-semibold whitespace-nowrap">
                        {(row.unpaid_days ?? 0) > 0
                          ? <>{Number(row.unpaid_days).toFixed(1)}<span className="text-gray-400 text-[11px] font-normal"> day{row.unpaid_days !== 1 ? 's' : ''}</span></>
                          : <span className="text-gray-300">—</span>
                        }
                      </td>
                      <td className="px-3.5 py-3 text-red-600 font-semibold whitespace-nowrap">{fmt(row.pt_deduction || 0)}</td>
                      <td className="px-3.5 py-3 text-red-600 font-semibold whitespace-nowrap">{fmt(row.leave_deduction || 0)}</td>
                      <td className="px-3.5 py-3 font-bold text-gray-900 whitespace-nowrap">{fmt(row.net_payable || row.salary)}</td>
                      <td className="px-3.5 py-3">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full whitespace-nowrap ${
                          row.status === 'Paid'
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-amber-50 text-amber-600'
                        }`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />
                          {row.status}
                        </span>
                      </td>
                      <td className="px-3.5 py-3">
                        {row.status === 'Pending' ? (
                          <button
                            onClick={() => markPaid(row)}
                            disabled={paying.has(row.id)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap"
                          >
                            {paying.has(row.id)
                              ? <i className="fa-solid fa-spinner fa-spin text-[9px]" />
                              : <i className="fa-solid fa-check text-[9px]" />
                            }
                            Mark Paid
                          </button>
                        ) : (
                          <span className="text-[11px] text-gray-300 font-medium">—</span>
                        )}
                      </td>
                    </tr>
                  ))
              }
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3.5 py-6 text-center text-[13px] text-gray-400">
                    No payroll records found
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
