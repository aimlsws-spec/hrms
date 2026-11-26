import React, { useState, useEffect, useCallback } from 'react'
import {
  hrReimbursementsApi,
  type HRReimbursementItem,
  type HRReimbursementsStats,
} from '../../api/hrReimbursementsApi'
import { useAuthStore } from '../../store/authStore'

function fmt(n: number) {
  return '₹' + Math.round(n).toLocaleString('en-IN')
}

export default function HRReimbursementsPage() {
  const { user } = useAuthStore()
  const isHR = user?.role === 'admin' || user?.role === 'hr' || user?.role === 'sub_hr'

  const [items, setItems] = useState<HRReimbursementItem[]>([])
  const [stats, setStats] = useState<HRReimbursementsStats>({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    pending_amount: 0,
    approved_amount: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending')
  const [search, setSearch] = useState('')
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const fetchReimbursements = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await hrReimbursementsApi.getReimbursements({
        status: statusFilter === 'all' ? undefined : statusFilter,
        search: search.trim() || undefined,
      })
      if (res.data?.success) {
        setItems(res.data.reimbursements || [])
        if (res.data.stats) setStats(res.data.stats)
      } else {
        setError(res.data?.message || 'Could not load reimbursements.')
      }
    } catch {
      setError('Failed to communicate with reimbursement server.')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, search])

  useEffect(() => {
    if (isHR) {
      fetchReimbursements()
    }
  }, [fetchReimbursements, isHR])

  if (!isHR) {
    return (
      <div className="p-8 text-center text-gray-500 text-sm">
        You do not have permission to view HR Reimbursements.
      </div>
    )
  }

  const handleReview = async (id: number, action: 'APPROVED' | 'REJECTED') => {
    const item = items.find((i) => i.id === id)
    const actionLabel = action === 'APPROVED' ? 'approve payment for' : 'reject'
    const promptText = action === 'REJECTED'
      ? `Are you sure you want to reject reimbursement #${id}? Enter optional rejection reason:`
      : `Are you sure you want to approve payment of ₹${item?.amount.toFixed(2)} for ${item?.employee_name}?`

    let comments = ''
    if (action === 'REJECTED') {
      const reason = window.prompt(promptText, '')
      if (reason === null) return
      comments = reason
    } else {
      if (!window.confirm(promptText)) return
    }

    try {
      setActionLoadingId(id)
      const roleTag = user?.role === 'sub_hr' ? 'Sub-HR' : user?.role === 'hr' ? 'HR Head' : 'HR'
      const actorName = `${user?.full_name || 'HR Admin'} (${roleTag})`

      const res = await hrReimbursementsApi.reviewReimbursement(id, {
        action,
        comments,
        reviewed_by: actorName,
        actor_role: user?.role || 'hr',
      })

      if (res.data?.success) {
        await fetchReimbursements()
      } else {
        alert(res.data?.message || 'Failed to review reimbursement.')
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to process review.')
    } finally {
      setActionLoadingId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-sm shadow-emerald-200">
              <i className="fa-solid fa-money-check-dollar text-lg" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Reimbursement &amp; Expense Approvals</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                HR reviews and authorizes employee reimbursement payments. HR approval authorizes payment directly.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={fetchReimbursements}
          disabled={loading}
          className="self-end sm:self-auto h-9 px-3 text-xs font-semibold border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 rounded-xl shadow-2xs transition inline-flex items-center gap-1.5"
        >
          <i className={`fa-solid fa-rotate-right text-[11px] ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ── Summary Stats ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Pending Review</span>
            <span className="w-7 h-7 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-xs">
              <i className="fa-solid fa-clock" />
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-2">{stats.pending}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">Pending amount: <strong className="text-amber-600">{fmt(stats.pending_amount)}</strong></p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Approved &amp; Paid</span>
            <span className="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs">
              <i className="fa-solid fa-check-circle" />
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-2">{stats.approved}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">Total approved: <strong className="text-emerald-600">{fmt(stats.approved_amount)}</strong></p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-700 uppercase tracking-wide">Rejected</span>
            <span className="w-7 h-7 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center text-xs">
              <i className="fa-solid fa-ban" />
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-2">{stats.rejected}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">Claims turned down</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Total Claims</span>
            <span className="w-7 h-7 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs">
              <i className="fa-solid fa-file-invoice" />
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-2">{stats.total}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">All reimbursement records</p>
        </div>
      </div>

      {/* ── Filters Bar ── */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-3.5 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
            <input
              type="text"
              placeholder="Search by employee name, ID, or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 text-xs border border-gray-200 rounded-xl bg-gray-50/50 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
            />
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl self-start sm:self-auto">
            {(
              [
                { id: 'pending', label: 'Pending Review' },
                { id: 'approved', label: 'Approved' },
                { id: 'rejected', label: 'Rejected' },
                { id: 'all', label: 'All' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setStatusFilter(t.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  statusFilter === t.id
                    ? 'bg-white text-gray-900 shadow-2xs'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Error state ── */}
      {error && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-xs text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={fetchReimbursements} className="font-semibold underline">Retry</button>
        </div>
      )}

      {/* ── Main Table ── */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Date &amp; Claim</th>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Reason / Description</th>
                <th className="py-3 px-4">Payment Method</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Receipt / Proof</th>
                <th className="py-3 px-4">Status &amp; Reviewer</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={8} className="py-4 px-4">
                      <div className="h-5 bg-gray-100 rounded-lg w-full" />
                    </td>
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-2">
                      <i className="fa-solid fa-receipt text-sm" />
                    </div>
                    <p className="font-semibold text-gray-700 text-xs">No reimbursement claims found</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Try selecting another status tab or search query.</p>
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const isPending = item.status === 'Pending'
                  const isCash = item.payment_method.toLowerCase() === 'cash'

                  return (
                    <tr key={item.id} className="hover:bg-gray-50/60 transition-colors">
                      {/* Date */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-bold text-gray-800 block text-xs">#{item.id}</span>
                        <span className="text-gray-400 font-mono text-[11px]">{item.expense_date}</span>
                      </td>

                      {/* Employee */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-700 font-bold flex items-center justify-center text-[10px] shrink-0">
                            {item.employee_name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{item.employee_name}</p>
                            <p className="text-[10px] text-gray-400 font-mono">{item.employee_id} • {item.department}</p>
                          </div>
                        </div>
                      </td>

                      {/* Reason */}
                      <td className="py-3 px-4 max-w-[240px]">
                        <p className="text-gray-800 font-medium truncate" title={item.reason}>
                          {item.reason}
                        </p>
                        {item.comments && (
                          <p className="text-[10px] text-gray-400 italic mt-0.5 truncate" title={`Note: ${item.comments}`}>
                            Note: {item.comments}
                          </p>
                        )}
                      </td>

                      {/* Payment Method */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                          isCash
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        }`}>
                          <i className={`fa-solid ${isCash ? 'fa-money-bill-wave' : 'fa-qrcode'} text-[10px]`} />
                          {isCash ? 'Cash' : 'UPI Transfer'}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-4 whitespace-nowrap font-bold text-sm text-gray-900">
                        ₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Receipt Proof */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {item.receipt_path ? (
                          <a
                            href={item.receipt_path}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-indigo-600 bg-indigo-50/70 hover:bg-indigo-100 hover:text-indigo-800 transition-colors"
                          >
                            <i className="fa-solid fa-arrow-up-right-from-square text-[10px]" />
                            View Proof
                          </a>
                        ) : (
                          <span className="text-gray-400 text-xs italic">No screenshot</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          item.status === 'Approved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.status === 'Rejected'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {item.status === 'Approved' ? '✓ Approved' : item.status === 'Rejected' ? '✕ Rejected' : '● Pending'}
                        </span>
                        {item.reviewed_by && (
                          <p className="text-[10px] text-gray-400 mt-0.5 font-mono truncate max-w-[130px]" title={`By ${item.reviewed_by}`}>
                            By: {item.reviewed_by}
                          </p>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {isPending ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              disabled={actionLoadingId === item.id}
                              onClick={() => handleReview(item.id, 'APPROVED')}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-2xs"
                              title="Directly approve payment"
                            >
                              <i className="fa-solid fa-check text-[10px]" />
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={actionLoadingId === item.id}
                              onClick={() => handleReview(item.id, 'REJECTED')}
                              className="px-2.5 py-1 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 disabled:opacity-50 rounded-lg text-xs font-semibold transition flex items-center gap-1"
                              title="Reject claim"
                            >
                              <i className="fa-solid fa-xmark text-[10px]" />
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-gray-400 italic">Completed</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
