import { useState, useEffect } from 'react'
import { hrFeaturesApi, type LateDeductionItem } from '../../api/hrFeaturesApi'
import { useAuthStore } from '../../store/authStore'

export default function SalaryDeductionsReviewPanel() {
  const { user } = useAuthStore()
  const isHRAdmin = user?.role === 'admin' || user?.role === 'hr'

  const [deductions, setDeductions] = useState<LateDeductionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'PENDING_REVIEW' | 'APPLIED' | 'IGNORED' | 'ALL'>('PENDING_REVIEW')
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null)
  const [notesMap, setNotesMap] = useState<Record<number, string>>({})

  const fetchDeductions = async () => {
    try {
      setLoading(true)
      const statusParam = filter === 'ALL' ? undefined : filter
      const res = await hrFeaturesApi.getLateDeductions({ status: statusParam })
      if (res.data?.success) {
        setDeductions(res.data.deductions || [])
      }
    } catch (err) {
      console.error('Failed to load salary deductions for review', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isHRAdmin) {
      fetchDeductions()
    }
  }, [filter, isHRAdmin])

  if (!isHRAdmin) return null

  const handleAction = async (id: number, action: 'APPLY' | 'IGNORE') => {
    const notes = notesMap[id] || ''
    const actionLabel = action === 'APPLY' ? 'approve and deduct' : 'waive and ignore'
    if (!window.confirm(`Are you sure you want to ${actionLabel} this salary deduction?`)) {
      return
    }

    try {
      setActionLoadingId(id)
      const res = await hrFeaturesApi.actOnLateDeduction(
        id,
        action,
        notes,
        user?.user_id ? String(user.user_id) : undefined,
        user?.full_name || 'HR Admin'
      )
      if (res.data?.success) {
        fetchDeductions()
      } else {
        alert(res.data?.message || 'Failed to process deduction action')
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error processing deduction action')
    } finally {
      setActionLoadingId(null)
    }
  }

  const pendingCount = deductions.filter(d => d.status === 'PENDING_REVIEW').length

  return (
    <div className="bg-white rounded-2xl border border-gray-200/90 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-gray-100 bg-gradient-to-r from-amber-50/50 via-white to-rose-50/30">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center text-sm font-bold">
                <i className="fa-solid fa-file-invoice-dollar" />
              </span>
              <h2 className="text-base font-bold text-gray-900">
                Salary Deductions & Finance Approvals
              </h2>
              {pendingCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500 text-white animate-pulse">
                  {pendingCount} Awaiting Review
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Every salary deduction requires HR approval before deduction. Fixed ₹200 company-policy deduction applies automatically.
            </p>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-1.5 self-end sm:self-auto bg-gray-100/80 p-1 rounded-xl">
            {(['PENDING_REVIEW', 'APPLIED', 'IGNORED', 'ALL'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilter(tab)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                  filter === tab
                    ? 'bg-white text-gray-900 shadow-xs'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'PENDING_REVIEW'
                  ? 'Pending Approval'
                  : tab === 'APPLIED'
                  ? 'Approved / Applied'
                  : tab === 'IGNORED'
                  ? 'Waived / Ignored'
                  : 'All'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* List */}
      <div className="p-4 sm:p-5">
        {loading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-16 bg-gray-100 rounded-xl" />
            <div className="h-16 bg-gray-100 rounded-xl" />
          </div>
        ) : deductions.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <i className="fa-solid fa-check-double text-3xl mb-2 text-emerald-400" />
            <p className="text-xs font-semibold text-gray-600">No salary deductions pending HR review</p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              All leave and late-arrival deductions are up to date.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {deductions.map(item => {
              const isPending = item.status === 'PENDING_REVIEW'
              const isLeave = item.deduction_type === 'UNPAID_LEAVE'

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isPending
                      ? 'border-amber-200 bg-amber-50/20'
                      : item.status === 'APPLIED'
                      ? 'border-emerald-200 bg-emerald-50/10'
                      : 'border-gray-200 bg-gray-50/30'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-gray-900">
                          {item.employee_name}
                        </span>
                        <span className="text-xs font-mono text-gray-400">
                          ({item.employee_id})
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isLeave
                              ? 'bg-purple-100 text-purple-700 border border-purple-200'
                              : 'bg-orange-100 text-orange-700 border border-orange-200'
                          }`}
                        >
                          {isLeave ? 'Unpaid / Probation Leave' : 'Late Arrival (4+)'}
                        </span>
                        <span className="text-xs text-gray-500 font-medium">
                          Period: {String(item.month).padStart(2, '0')}/{item.year}
                        </span>
                      </div>

                      <p className="text-xs text-gray-600">
                        {isLeave ? (
                          <>
                            Took unpaid leave. Estimated deduction:{' '}
                            <strong className="text-gray-900">₹{item.amount.toFixed(2)}</strong>.
                          </>
                        ) : (
                          <>
                            {item.late_count} late arrivals (past 9:50 AM). Half-day deduction:{' '}
                            <strong className="text-gray-900">₹{item.amount.toFixed(2)}</strong>.
                          </>
                        )}
                      </p>

                      {item.status !== 'PENDING_REVIEW' && (
                        <p className="text-[11px] text-gray-500 mt-1">
                          Reviewed by {item.reviewed_by || 'HR'} on{' '}
                          {item.reviewed_at ? item.reviewed_at.substring(0, 10) : '—'}
                          {item.review_notes && ` • Notes: "${item.review_notes}"`}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    {isPending ? (
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <input
                          type="text"
                          placeholder="Optional notes…"
                          value={notesMap[item.id] || ''}
                          onChange={e =>
                            setNotesMap(prev => ({ ...prev, [item.id]: e.target.value }))
                          }
                          className="h-8 px-2.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 min-w-[140px]"
                        />
                        <button
                          type="button"
                          disabled={actionLoadingId === item.id}
                          onClick={() => handleAction(item.id, 'APPLY')}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-1 shadow-xs"
                        >
                          <i className="fa-solid fa-check text-[10px]" />
                          Approve Deduction (₹{item.amount.toFixed(2)})
                        </button>
                        <button
                          type="button"
                          disabled={actionLoadingId === item.id}
                          onClick={() => handleAction(item.id, 'IGNORE')}
                          className="px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                        >
                          <i className="fa-solid fa-ban text-[10px]" />
                          Waive / Ignore
                        </button>
                      </div>
                    ) : (
                      <span
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
                          item.status === 'APPLIED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {item.status === 'APPLIED' ? '✓ Deduction Applied' : 'Waived (No Deduction)'}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
