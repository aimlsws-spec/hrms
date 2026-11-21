import { useState, useEffect, useCallback } from 'react'
import { accountantApi, type DashboardStats, type PayrollRow } from '../../api/accountantApi'

function fmtRupee(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

const STATUS_CLS: Record<string, string> = {
  Paid:    'bg-emerald-50 text-emerald-600',
  Pending: 'bg-amber-50 text-amber-600',
}

const STAT_CARDS = [
  {
    key:    'totalPayroll' as keyof DashboardStats,
    label:  'Total Payroll Cost',
    icon:   'fa-indian-rupee-sign',
    bg:     'bg-indigo-50',
    clr:    'text-indigo-600',
    border: 'border-indigo-100',
    sub:    'This month',
    fmt:    (v: number) => fmtRupee(v),
  },
  {
    key:    'pendingSalaries' as keyof DashboardStats,
    label:  'Pending Salaries',
    icon:   'fa-hourglass-half',
    bg:     'bg-amber-50',
    clr:    'text-amber-600',
    border: 'border-amber-100',
    sub:    'Employees awaiting payment',
    fmt:    (v: number) => String(v),
  },
  {
    key:    'paidSalaries' as keyof DashboardStats,
    label:  'Paid Salaries',
    icon:   'fa-circle-check',
    bg:     'bg-emerald-50',
    clr:    'text-emerald-600',
    border: 'border-emerald-100',
    sub:    'Processed this cycle',
    fmt:    (v: number) => String(v),
  },
  {
    key:    'pendingReimbursements' as keyof DashboardStats,
    label:  'Pending Reimbursements',
    icon:   'fa-receipt',
    bg:     'bg-rose-50',
    clr:    'text-rose-500',
    border: 'border-rose-100',
    sub:    'Awaiting approval',
    fmt:    (v: number) => String(v),
  },
]

export default function AccountantDashboardPage() {
  const [stats,   setStats]   = useState<DashboardStats | null>(null)
  const [recent,  setRecent]  = useState<PayrollRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [dashRes, payrollRes] = await Promise.all([
        accountantApi.getDashboard(),
        accountantApi.getPayroll(),
      ])
      setStats(dashRes.data)
      setRecent(payrollRes.data)
    } catch {
      setError('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-5">

      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Finance overview for the current payroll cycle</p>
      </div>

      {/* Error */}
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

      {/* Stat cards — matching Payslips summary card style */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {STAT_CARDS.map(c => (
          <div key={c.key} className={`bg-white rounded-2xl border ${c.border} shadow-sm p-5 flex items-start gap-4`}>
            <div className={`w-9 h-9 rounded-xl ${c.bg} flex items-center justify-center shrink-0`}>
              <i className={`fa-solid ${c.icon} ${c.clr} text-[14px]`} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide leading-tight">{c.label}</p>
              <p className={`text-xl font-bold text-gray-900 mt-1 ${loading ? 'animate-pulse text-gray-200' : ''}`}>
                {loading ? '—' : c.fmt((stats?.[c.key] as number) ?? 0)}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">{c.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Recent payroll table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
          <p className="text-[13px] font-semibold text-gray-800">Recent Payroll</p>
          <p className="text-[11px] text-gray-400">Last 5 salary transactions</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Employee', 'Department', 'Amount', 'Status'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? [...Array(5)].map((_, i) => (
                    <tr key={i} className="border-b border-gray-50 last:border-0">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5 animate-pulse">
                          <div className="w-7 h-7 rounded-full bg-gray-200 shrink-0" />
                          <div className="space-y-1.5">
                            <div className="h-3 w-28 bg-gray-200 rounded" />
                            <div className="h-2.5 w-14 bg-gray-100 rounded" />
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4"><div className="h-3 w-20 bg-gray-100 rounded animate-pulse" /></td>
                      <td className="py-3.5 px-4"><div className="h-3 w-16 bg-gray-100 rounded animate-pulse" /></td>
                      <td className="py-3.5 px-4"><div className="h-5 w-14 bg-gray-100 rounded-full animate-pulse" /></td>
                    </tr>
                  ))
                : recent.length > 0
                  ? recent.map(r => (
                      <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <span className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                              {initials(r.name)}
                            </span>
                            <div>
                              <p className="font-medium text-gray-800 leading-tight whitespace-nowrap">{r.name}</p>
                              <p className="text-[10px] text-gray-400 font-mono">{r.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-gray-600 whitespace-nowrap">{r.dept}</td>
                        <td className="py-3.5 px-4 font-semibold text-gray-800 whitespace-nowrap">
                          ₹{r.salary.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${STATUS_CLS[r.status] ?? 'bg-gray-50 text-gray-500'}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  : (
                      <tr>
                        <td colSpan={4} className="px-5 py-8 text-center text-[13px] text-gray-400">
                          No payroll data available
                        </td>
                      </tr>
                    )
              }
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
