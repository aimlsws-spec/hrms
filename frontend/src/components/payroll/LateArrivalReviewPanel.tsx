import React, { useState, useEffect, useCallback } from 'react'
import { hrFeaturesApi, type LateDeductionItem } from '../../api/hrFeaturesApi'
import { useAuthStore } from '../../store/authStore'

interface Props {
  year: number
  month: number
  onActionCompleted?: () => void
}

function fmt(n: number | null | undefined): string {
  if (n == null) return '₹0.00'
  return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function initials(name: string): string {
  if (!name) return '?'
  return name.trim().split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

export default function LateArrivalReviewPanel({ year, month, onActionCompleted }: Props) {
  const { user } = useAuthStore()
  const [deductions, setDeductions] = useState<LateDeductionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState<number | null>(null)
  const [filter, setFilter] = useState<'ALL' | 'PENDING_REVIEW' | 'APPLIED' | 'IGNORED'>('PENDING_REVIEW')
  const [noteInput, setNoteInput] = useState<{ [id: number]: string }>({})
  const [showNotesFor, setShowNotesFor] = useState<number | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [expandedDates, setExpandedDates] = useState<{ [id: number]: boolean }>({})

  const fetchReviews = useCallback(async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const res = await hrFeaturesApi.getLateDeductions({ year, month })
      if (res.data?.success) {
        setDeductions(res.data.deductions || [])
      }
    } catch {
      setErrorMsg('Could not load late-arrival deduction reviews.')
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => {
    fetchReviews()
  }, [fetchReviews])

  const handleAction = async (id: number, action: 'APPLY' | 'IGNORE') => {
    setActingId(id)
    setErrorMsg(null)
    setSuccessMsg(null)
    try {
      const notes = noteInput[id] || ''
      const actorId = String(user?.user_id || 'hr')
      const actorName = user?.full_name || 'HR Manager'

      const res = await hrFeaturesApi.actOnLateDeduction(id, action, notes, actorId, actorName)
      if (res.data?.success) {
        setSuccessMsg(res.data.message || (action === 'APPLY' ? 'Deduction applied.' : 'Deduction waived.'))
        setShowNotesFor(null)
        await fetchReviews()
        if (onActionCompleted) onActionCompleted()
      } else {
        setErrorMsg(res.data?.message || 'Action failed.')
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || err.response?.data?.message || 'Error processing review action.')
    } finally {
      setActingId(null)
    }
  }

  const toggleDates = (id: number) => {
    setExpandedDates(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const pendingCount = deductions.filter(d => d.status === 'PENDING_REVIEW').length

  const filteredItems = deductions.filter(d => {
    if (filter === 'ALL') return true
    return d.status === filter
  })

  return (
    <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden mb-5">
      {/* Header */}
      <div className="px-5 py-4 bg-gradient-to-r from-amber-50/60 via-orange-50/30 to-white border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-sm shadow-sm shadow-amber-200">
            <i className="fa-solid fa-clock-rotate-left text-[14px]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-gray-900">Late-Arrival Deduction Reviews</h3>
              {pendingCount > 0 ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 animate-pulse">
                  <i className="fa-solid fa-bell text-[9px]" />
                  {pendingCount} Pending Review
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700">
                  All Reviewed
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Rule: On 4th late arrival (after 09:50 AM), HR decides whether to apply a half-day salary deduction or waive it. No automatic deduction.
            </p>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 bg-gray-100/80 p-1 rounded-xl text-[11px] font-semibold">
          <button
            onClick={() => setFilter('PENDING_REVIEW')}
            className={`px-3 py-1 rounded-lg transition-all ${
              filter === 'PENDING_REVIEW' ? 'bg-white text-amber-800 shadow-sm' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Pending ({pendingCount})
          </button>
          <button
            onClick={() => setFilter('APPLIED')}
            className={`px-3 py-1 rounded-lg transition-all ${
              filter === 'APPLIED' ? 'bg-white text-rose-700 shadow-sm' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Applied ({deductions.filter(d => d.status === 'APPLIED').length})
          </button>
          <button
            onClick={() => setFilter('IGNORED')}
            className={`px-3 py-1 rounded-lg transition-all ${
              filter === 'IGNORED' ? 'bg-white text-gray-700 shadow-sm' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Waived ({deductions.filter(d => d.status === 'IGNORED').length})
          </button>
          <button
            onClick={() => setFilter('ALL')}
            className={`px-3 py-1 rounded-lg transition-all ${
              filter === 'ALL' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            All ({deductions.length})
          </button>
        </div>
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="mx-5 mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-[12px] text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-circle-check text-emerald-600" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700 font-bold">×</button>
        </div>
      )}
      {errorMsg && (
        <div className="mx-5 mt-3 p-3 rounded-xl bg-red-50 border border-red-100 text-[12px] text-red-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-triangle-exclamation text-red-600" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-red-500 hover:text-red-700 font-bold">×</button>
        </div>
      )}

      {/* Content */}
      <div className="p-5">
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="h-16 bg-gray-50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-6">
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2 text-sm">
              <i className="fa-solid fa-shield-check" />
            </div>
            <p className="text-[13px] font-semibold text-gray-700">No records in this category</p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {filter === 'PENDING_REVIEW'
                ? 'No employees currently have 4+ late arrivals pending HR decision.'
                : 'No reviews found matching current filter.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map(item => {
              const isActing = actingId === item.id
              const showNotes = showNotesFor === item.id
              const datesOpen = expandedDates[item.id]

              return (
                <div
                  key={item.id}
                  className="rounded-xl border border-gray-100 bg-gray-50/50 p-4 transition-all hover:bg-white hover:border-gray-200 hover:shadow-xs"
                >
                  <div className="flex items-start justify-between flex-wrap gap-4">
                    {/* Employee Info */}
                    <div className="flex items-center gap-3 min-w-[200px]">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                        {initials(item.employee_name)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-[13px] font-bold text-gray-900">{item.employee_name}</p>
                          <span className="text-[10px] font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                            {item.employee_id}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500">
                          {item.department} {item.job_title ? `• ${item.job_title}` : ''}
                        </p>
                      </div>
                    </div>

                    {/* Infraction Summary */}
                    <div className="flex items-center gap-3">
                      <div className="text-left md:text-right">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-100/80 text-amber-900">
                          <i className="fa-solid fa-clock text-[9px]" />
                          {item.late_count} late arrivals
                        </span>
                        <p className="text-[11px] font-semibold text-gray-700 mt-1">
                          Suggested Half-Day: <span className="text-rose-600 font-bold">{fmt(item.amount)}</span>
                        </p>
                      </div>

                      {/* Expandable Late Dates Button */}
                      {item.late_dates && item.late_dates.length > 0 && (
                        <button
                          onClick={() => toggleDates(item.id)}
                          className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1 transition"
                        >
                          <span>{datesOpen ? 'Hide dates' : 'View dates'}</span>
                          <i className={`fa-solid fa-chevron-${datesOpen ? 'up' : 'down'} text-[9px]`} />
                        </button>
                      )}
                    </div>

                    {/* Status & Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {item.status === 'PENDING_REVIEW' ? (
                        <div className="flex items-center gap-2">
                          <button
                            disabled={isActing}
                            onClick={() => handleAction(item.id, 'APPLY')}
                            className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs transition disabled:opacity-50 inline-flex items-center gap-1.5"
                            title="Apply half-day deduction to salary"
                          >
                            <i className="fa-solid fa-circle-minus text-[11px]" />
                            {isActing ? 'Applying...' : 'Apply Deduction'}
                          </button>
                          <button
                            disabled={isActing}
                            onClick={() => handleAction(item.id, 'IGNORE')}
                            className="px-3 py-1.5 rounded-xl bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 text-xs font-semibold shadow-xs transition disabled:opacity-50 inline-flex items-center gap-1.5"
                            title="Waive and ignore deduction (deduct ₹0)"
                          >
                            <i className="fa-solid fa-check text-[11px] text-emerald-600" />
                            {isActing ? 'Waiving...' : 'Ignore / Waive'}
                          </button>
                          <button
                            onClick={() => setShowNotesFor(showNotes ? null : item.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
                            title="Add decision note"
                          >
                            <i className="fa-regular fa-comment-dots text-sm" />
                          </button>
                        </div>
                      ) : item.status === 'APPLIED' ? (
                        <div className="text-right">
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-100">
                            <i className="fa-solid fa-circle-minus text-[10px]" />
                            Deduction Applied ({fmt(item.amount)})
                          </span>
                          {item.reviewed_by && (
                            <p className="text-[10px] text-gray-400 mt-0.5">By {item.reviewed_by} on {item.reviewed_at?.slice(0, 10)}</p>
                          )}
                        </div>
                      ) : (
                        <div className="text-right">
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                            <i className="fa-solid fa-circle-check text-[10px]" />
                            Deduction Waived (₹0.00)
                          </span>
                          {item.reviewed_by && (
                            <p className="text-[10px] text-gray-400 mt-0.5">By {item.reviewed_by} on {item.reviewed_at?.slice(0, 10)}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Optional Note Box */}
                  {showNotes && item.status === 'PENDING_REVIEW' && (
                    <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Optional decision note / explanation..."
                        value={noteInput[item.id] || ''}
                        onChange={e => setNoteInput({ ...noteInput, [item.id]: e.target.value })}
                        className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-800 focus:outline-none focus:border-indigo-500 bg-white"
                      />
                      <span className="text-[11px] text-gray-400">Will be saved to HR activity log</span>
                    </div>
                  )}

                  {/* Expanded Late Dates List */}
                  {datesOpen && item.late_dates && item.late_dates.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-[11px] font-bold text-gray-600 mb-2">Late check-in log for this month:</p>
                      <div className="flex flex-wrap gap-2">
                        {item.late_dates.map((ld, idx) => (
                          <div
                            key={idx}
                            className="inline-flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-gray-200 text-[11px]"
                          >
                            <span className="font-semibold text-gray-800">{ld.date}</span>
                            <span className="text-rose-600 font-mono font-medium">{ld.check_in}</span>
                            <span className="text-gray-400 text-[10px]">({ld.late_minutes}m late)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
