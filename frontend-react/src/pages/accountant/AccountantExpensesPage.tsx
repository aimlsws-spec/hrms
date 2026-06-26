import { useState, useEffect, useCallback } from 'react'
import { accountantApi, type Expense, type ExpenseStatus } from '../../api/accountantApi'

const STATUS_STYLE: Record<ExpenseStatus, string> = {
  Pending:  'bg-amber-50 text-amber-600',
  Approved: 'bg-emerald-50 text-emerald-600',
  Rejected: 'bg-red-50 text-red-500',
}

function fmt(n: number) { return '₹' + n.toLocaleString('en-IN') }
function initials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

export default function AccountantExpensesPage() {
  const [rows,    setRows]    = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [acting,  setActing]  = useState<Set<number>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await accountantApi.getReimbursements()
      setRows(res.data)
    } catch {
      setError('Failed to load expense data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function updateStatus(id: number, status: 'approved' | 'rejected') {
    const displayStatus: ExpenseStatus = status === 'approved' ? 'Approved' : 'Rejected'
    setActing(prev => new Set(prev).add(id))
    setRows(prev => prev.map(r => r.id === id ? { ...r, status: displayStatus } : r))
    try {
      await accountantApi.updateReimbursementStatus(id, status)
    } catch {
      setRows(prev => prev.map(r => r.id === id ? { ...r, status: 'Pending' } : r))
    } finally {
      setActing(prev => { const s = new Set(prev); s.delete(id); return s })
    }
  }

  const pending  = rows.filter(r => r.status === 'Pending').length
  const approved = rows.filter(r => r.status === 'Approved').length
  const total    = rows.filter(r => r.status !== 'Rejected').reduce((s, r) => s + r.amount, 0)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Expenses &amp; Reimbursements</h1>
          <p className="text-sm text-gray-500 mt-0.5">Review and action employee expense claims</p>
        </div>
        {!loading && (
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <span className="text-[11px] font-semibold bg-amber-50 text-amber-600 px-2.5 py-1 rounded-lg">
              Pending: {pending}
            </span>
            <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-lg">
              Approved: {approved}
            </span>
            <span className="text-[11px] font-semibold bg-gray-100 text-gray-600 px-2.5 py-1 rounded-lg">
              Total: {fmt(total)}
            </span>
          </div>
        )}
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

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Employee', 'Amount', 'Reason', 'Date', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
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
                          <div className="w-7 h-7 rounded-full bg-gray-200 shrink-0" />
                          <div className="space-y-1.5">
                            <div className="h-3 w-24 bg-gray-200 rounded" />
                            <div className="h-2.5 w-14 bg-gray-100 rounded" />
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5"><div className="h-3 w-14 bg-gray-100 rounded animate-pulse" /></td>
                      <td className="px-5 py-3.5"><div className="h-3 w-28 bg-gray-100 rounded animate-pulse" /></td>
                      <td className="px-5 py-3.5"><div className="h-3 w-20 bg-gray-100 rounded animate-pulse" /></td>
                      <td className="px-5 py-3.5"><div className="h-5 w-16 bg-gray-100 rounded-full animate-pulse" /></td>
                      <td className="px-5 py-3.5"><div className="h-7 w-32 bg-gray-100 rounded-lg animate-pulse" /></td>
                    </tr>
                  ))
                : rows.map(row => (
                    <tr key={row.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <span className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold flex items-center justify-center shrink-0">
                            {initials(row.employee)}
                          </span>
                          <div>
                            <p className="font-medium text-gray-800 leading-tight">{row.employee}</p>
                            <p className="text-[10px] text-gray-400">{row.dept}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-gray-800">{fmt(row.amount)}</td>
                      <td className="px-5 py-3.5 text-gray-600 max-w-[180px]">
                        <span className="line-clamp-1">{row.reason}</span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-400 whitespace-nowrap text-[12px]">{row.date}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLE[row.status]}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />
                          {row.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {row.status === 'Pending' ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => updateStatus(row.id, 'approved')}
                              disabled={acting.has(row.id)}
                              className="text-[11px] font-semibold text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg transition-colors"
                            >
                              {acting.has(row.id) ? <i className="fa-solid fa-spinner fa-spin text-[10px]" /> : 'Approve'}
                            </button>
                            <button
                              onClick={() => updateStatus(row.id, 'rejected')}
                              disabled={acting.has(row.id)}
                              className="text-[11px] font-semibold text-red-500 bg-red-50 hover:bg-red-100 disabled:opacity-60 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg transition-colors"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))
              }
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-center text-[13px] text-gray-400">
                    No expense requests found
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
