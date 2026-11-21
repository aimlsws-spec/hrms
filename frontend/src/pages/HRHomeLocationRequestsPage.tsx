/**
 * HRHomeLocationRequestsPage — HR review of employee home-location change requests.
 *
 * Route: /hr/home-location-requests  (HR/admin only)
 *
 * Two tabs:
 *   1. Pending   — requests awaiting action
 *   2. History   — all approved / rejected requests
 */
import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '../store/authStore'
import { wfhGeoApi }   from '../api/wfhApi'
import type { HrLocationRequest } from '../api/wfhApi'

type Tab = 'pending' | 'history'

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending:  'bg-amber-50 text-amber-600 border-amber-100',
    approved: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    rejected: 'bg-red-50 text-red-600 border-red-100',
  }
  const cls = map[status] ?? 'bg-gray-50 text-gray-500 border-gray-100'
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize ${cls}`}>
      {status}
    </span>
  )
}

// ── Action modal ───────────────────────────────────────────────────────────────

function ActionModal({
  request,
  action,
  reviewerUserId,
  onDone,
  onClose,
}: {
  request:        HrLocationRequest
  action:         'approve' | 'reject'
  reviewerUserId: string
  onDone:         () => void
  onClose:        () => void
}) {
  const [comment,     setComment]     = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  async function submit() {
    setIsSubmitting(true); setError(null)
    try {
      const { data } = await wfhGeoApi.actionLocationChangeRequest(
        request.id, reviewerUserId, action, comment.trim() || undefined,
      )
      if (data.success) { onDone() }
      else { setError('Action failed. Please try again.') }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg ?? 'Failed to submit action.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const isApprove = action === 'approve'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h3 className={`text-[15px] font-bold mb-1 ${isApprove ? 'text-emerald-700' : 'text-red-600'}`}>
          {isApprove ? 'Approve' : 'Reject'} Location Change
        </h3>
        <p className="text-[12px] text-gray-500 mb-4">
          Employee: <span className="font-semibold text-gray-700">{request.employee_name}</span>
        </p>

        {/* Location summary */}
        <div className="bg-gray-50 rounded-xl px-4 py-3 mb-4 space-y-1 text-[11px]">
          {request.current_address && (
            <div><span className="text-gray-400">Current: </span><span className="text-gray-700">{request.current_address}</span></div>
          )}
          {request.current_latitude && (
            <div><span className="text-gray-400">Current coords: </span>
              <span className="font-mono text-gray-600">{request.current_latitude.toFixed(6)}, {request.current_longitude?.toFixed(6)}</span>
            </div>
          )}
          <div className="pt-1 border-t border-gray-200 mt-1">
            {request.requested_address && (
              <div><span className="text-gray-400">Requested: </span><span className="text-gray-700">{request.requested_address}</span></div>
            )}
            <div><span className="text-gray-400">Requested coords: </span>
              <span className="font-mono text-gray-600">{request.requested_latitude.toFixed(6)}, {request.requested_longitude.toFixed(6)}</span>
            </div>
          </div>
          {request.reason && (
            <div className="pt-1"><span className="text-gray-400">Reason: </span><span className="text-gray-700 italic">"{request.reason}"</span></div>
          )}
        </div>

        <div className="mb-4">
          <label className="block text-[11px] font-semibold text-gray-600 mb-1">
            Comment <span className="font-normal text-gray-400">{isApprove ? '(optional)' : '(recommended)'}</span>
          </label>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder={isApprove ? 'Add a note for the employee…' : 'Reason for rejection…'}
            rows={2}
            className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
        </div>

        {error && (
          <div className="mb-3 bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-[12px] text-red-600">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={submit}
            disabled={isSubmitting}
            className={`flex-1 h-9 text-white text-[12px] font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60 ${
              isApprove ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-500 hover:bg-red-600'
            }`}
          >
            {isSubmitting
              ? <><i className="fa-solid fa-circle-notch animate-spin text-[11px]" /> Processing…</>
              : <><i className={`fa-solid ${isApprove ? 'fa-check' : 'fa-xmark'} text-[11px]`} /> {isApprove ? 'Approve' : 'Reject'}</>
            }
          </button>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="h-9 px-4 border border-gray-200 rounded-lg text-[12px] text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Requests table ─────────────────────────────────────────────────────────────

function RequestsTable({
  records,
  showActions,
  onApprove,
  onReject,
}: {
  records:    HrLocationRequest[]
  showActions: boolean
  onApprove:  (r: HrLocationRequest) => void
  onReject:   (r: HrLocationRequest) => void
}) {
  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
          <i className="fa-solid fa-inbox text-gray-300 text-[18px]" />
        </div>
        <p className="text-[13px] font-semibold text-gray-500">No requests found</p>
        <p className="text-[11px] text-gray-400 mt-1">
          {showActions ? 'No pending location change requests at this time.' : 'No history to display.'}
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Employee</th>
            <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Current Location</th>
            <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Requested Location</th>
            <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Reason</th>
            <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Submitted</th>
            <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Status</th>
            {showActions && <th className="py-3 px-4" />}
          </tr>
        </thead>
        <tbody>
          {records.map(r => (
            <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
              <td className="py-3 px-4">
                <p className="font-semibold text-gray-800">{r.employee_name}</p>
                <p className="text-[10px] text-gray-400">{r.department}</p>
                <p className="text-[10px] font-mono text-gray-400">{r.employee_id}</p>
              </td>
              <td className="py-3 px-4 max-w-[180px]">
                {r.current_address
                  ? <p className="text-gray-600 text-[11px] leading-snug">{r.current_address}</p>
                  : <p className="text-gray-400 italic text-[11px]">Not set</p>
                }
                {r.current_latitude && (
                  <p className="font-mono text-[10px] text-gray-400 mt-0.5">
                    {r.current_latitude.toFixed(5)}, {r.current_longitude?.toFixed(5)}
                  </p>
                )}
              </td>
              <td className="py-3 px-4 max-w-[180px]">
                {r.requested_address
                  ? <p className="text-gray-700 text-[11px] font-medium leading-snug">{r.requested_address}</p>
                  : null
                }
                <p className="font-mono text-[10px] text-indigo-600 mt-0.5">
                  {r.requested_latitude.toFixed(5)}, {r.requested_longitude.toFixed(5)}
                </p>
              </td>
              <td className="py-3 px-4 max-w-[160px]">
                {r.reason
                  ? <p className="text-gray-600 italic text-[11px]">"{r.reason}"</p>
                  : <p className="text-gray-300 text-[11px]">—</p>
                }
                {!showActions && r.hr_comment && (
                  <p className="text-[10px] text-gray-400 mt-1">HR: "{r.hr_comment}"</p>
                )}
              </td>
              <td className="py-3 px-4 whitespace-nowrap text-gray-500 text-[11px]">
                {fmtDate(r.created_at)}
              </td>
              <td className="py-3 px-4">
                <StatusBadge status={r.status} />
                {!showActions && r.reviewed_at && (
                  <p className="text-[10px] text-gray-400 mt-1">{fmtDate(r.reviewed_at)}</p>
                )}
              </td>
              {showActions && (
                <td className="py-3 px-4">
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => onApprove(r)}
                      className="h-7 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold rounded-lg transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => onReject(r)}
                      className="h-7 px-3 bg-red-50 hover:bg-red-100 text-red-600 text-[11px] font-semibold rounded-lg border border-red-100 transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Pagination ─────────────────────────────────────────────────────────────────

function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-center gap-2 mt-4">
      <button onClick={() => onPage(page - 1)} disabled={page <= 1}
        className="h-7 px-3 border border-gray-200 rounded-lg text-[11px] text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors">
        ‹ Prev
      </button>
      <span className="text-[11px] text-gray-500">Page {page} of {totalPages}</span>
      <button onClick={() => onPage(page + 1)} disabled={page >= totalPages}
        className="h-7 px-3 border border-gray-200 rounded-lg text-[11px] text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors">
        Next ›
      </button>
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────────

export default function HRHomeLocationRequestsPage() {
  const { user } = useAuthStore()
  const reviewerUserId = String(user?.user_id ?? '')

  const [tab,       setTab]       = useState<Tab>('pending')
  const [records,   setRecords]   = useState<HrLocationRequest[]>([])
  const [total,     setTotal]     = useState(0)
  const [page,      setPage]      = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [pendingCount, setPendingCount] = useState<number | null>(null)

  // Modal state
  const [modalRequest, setModalRequest] = useState<HrLocationRequest | null>(null)
  const [modalAction,  setModalAction]  = useState<'approve' | 'reject'>('approve')

  const load = useCallback(async (pg: number) => {
    if (!reviewerUserId) return
    setIsLoading(true); setError(null)
    try {
      const statusFilter = tab === 'pending' ? 'pending' : 'all'
      const { data } = await wfhGeoApi.getLocationChangeRequests(reviewerUserId, {
        status: statusFilter, page: pg, per_page: 20,
      })
      setRecords(data.records)
      setTotal(data.total)
      setTotalPages(data.total_pages)
    } catch {
      setError('Failed to load requests. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [reviewerUserId, tab])

  // Load pending count for badge
  useEffect(() => {
    if (!reviewerUserId) return
    wfhGeoApi.getLocationChangeRequests(reviewerUserId, { status: 'pending', per_page: 1 })
      .then(({ data }) => setPendingCount(data.total))
      .catch(() => {})
  }, [reviewerUserId])

  useEffect(() => {
    setPage(1)
  }, [tab])

  useEffect(() => {
    load(page)
  }, [load, page])

  function handleTabChange(t: Tab) {
    setTab(t); setPage(1)
  }

  function openModal(r: HrLocationRequest, action: 'approve' | 'reject') {
    setModalRequest(r); setModalAction(action)
  }

  function closeModal() { setModalRequest(null) }

  function handleActionDone() {
    closeModal()
    load(page)
    // Refresh pending count
    if (reviewerUserId) {
      wfhGeoApi.getLocationChangeRequests(reviewerUserId, { status: 'pending', per_page: 1 })
        .then(({ data }) => setPendingCount(data.total))
        .catch(() => {})
    }
  }

  return (
    <div className="space-y-5">

      {/* Page header */}
      <div>
        <h1 className="text-[18px] font-bold text-gray-900">Home Location Change Requests</h1>
        <p className="text-[12px] text-gray-400 mt-0.5">
          Review and approve/reject employee requests to update their registered home location.
        </p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
          <p className="text-[11px] text-gray-400">Pending Review</p>
          <p className="text-[22px] font-bold text-amber-600 mt-0.5">
            {pendingCount ?? '—'}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
          <p className="text-[11px] text-gray-400">Showing</p>
          <p className="text-[22px] font-bold text-gray-800 mt-0.5">{total}</p>
        </div>
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-5 pt-4">
          {(['pending', 'history'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => handleTabChange(t)}
              className={`mr-5 pb-3 text-[12px] font-semibold capitalize transition-colors border-b-2 -mb-px ${
                tab === t
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {t === 'pending' ? (
                <span className="flex items-center gap-1.5">
                  Pending
                  {pendingCount != null && pendingCount > 0 && (
                    <span className="bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                      {pendingCount}
                    </span>
                  )}
                </span>
              ) : 'History'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="p-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
              <i className="fa-solid fa-circle-notch animate-spin" />
              <span className="text-[13px]">Loading…</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center py-12 gap-3">
              <i className="fa-solid fa-circle-exclamation text-red-300 text-[22px]" />
              <p className="text-[13px] text-red-500">{error}</p>
              <button onClick={() => load(page)} className="text-[12px] text-indigo-600 underline">Retry</button>
            </div>
          ) : (
            <>
              <RequestsTable
                records={records}
                showActions={tab === 'pending'}
                onApprove={r => openModal(r, 'approve')}
                onReject={r  => openModal(r, 'reject')}
              />
              <Pagination page={page} totalPages={totalPages} onPage={setPage} />
            </>
          )}
        </div>
      </div>

      {/* Action modal */}
      {modalRequest && (
        <ActionModal
          request={modalRequest}
          action={modalAction}
          reviewerUserId={reviewerUserId}
          onDone={handleActionDone}
          onClose={closeModal}
        />
      )}
    </div>
  )
}
