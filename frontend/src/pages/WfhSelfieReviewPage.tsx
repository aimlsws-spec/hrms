/**
 * WfhSelfieReviewPage — HR panel page for reviewing WFH attendance selfies.
 * Route: /wfh-review  (HR/admin only)
 *
 * Features:
 *   - Paginated table of all WFH attendance records with selfies
 *   - Filter by status (All, Pending, Flagged, Approved, Rejected)
 *   - Click any row to open SelfieViewerModal
 *   - Approve / Reject with mandatory HR comment
 *   - Every image view creates a server-side audit log entry
 */
import { useState, useEffect, useCallback } from 'react'
import { useAuthStore }       from '../store/authStore'
import { wfhApi }             from '../api/wfhApi'
import type { HrReviewRecord } from '../api/wfhApi'
import SelfieViewerModal      from '../components/attendance/SelfieViewerModal'

type StatusFilter = '' | 'PENDING_REVIEW' | 'FLAGGED' | 'AUTO_APPROVED' | 'APPROVED' | 'REJECTED'

const FILTER_OPTIONS: { label: string; value: StatusFilter }[] = [
  { label: 'All Records',    value: '' },
  { label: 'Pending Review', value: 'PENDING_REVIEW' },
  { label: 'Flagged',        value: 'FLAGGED' },
  { label: 'Auto Approved',  value: 'AUTO_APPROVED' },
  { label: 'HR Approved',    value: 'APPROVED' },
  { label: 'HR Rejected',    value: 'REJECTED' },
]

const STATUS_STYLE: Record<string, string> = {
  PENDING_SELFIE:  'bg-slate-50 text-slate-500',
  AUTO_APPROVED:   'bg-emerald-50 text-emerald-600',
  FLAGGED:         'bg-amber-50 text-amber-600',
  PENDING_REVIEW:  'bg-orange-50 text-orange-600',
  APPROVED:        'bg-emerald-50 text-emerald-700',
  REJECTED:        'bg-red-50 text-red-600',
}

const STATUS_LABEL: Record<string, string> = {
  PENDING_SELFIE:  'Selfie Required',
  AUTO_APPROVED:   'Auto Approved',
  FLAGGED:         'Flagged',
  PENDING_REVIEW:  'Pending Review',
  APPROVED:        'HR Approved',
  REJECTED:        'HR Rejected',
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

export default function WfhSelfieReviewPage() {
  const { user } = useAuthStore()
  const reviewerUserId = String(user?.user_id ?? '')

  const [records,    setRecords]    = useState<HrReviewRecord[]>([])
  const [total,      setTotal]      = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page,       setPage]       = useState(1)
  const [filter,     setFilter]     = useState<StatusFilter>('')
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)

  const [viewing,    setViewing]    = useState<HrReviewRecord | null>(null)

  const perPage = 20

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await wfhApi.getReviewList(reviewerUserId, {
        status:   filter || undefined,
        page,
        per_page: perPage,
      })
      setRecords(data.records)
      setTotal(data.total)
      setTotalPages(data.total_pages)
    } catch {
      setError('Failed to load WFH review records.')
    } finally {
      setLoading(false)
    }
  }, [reviewerUserId, filter, page])

  useEffect(() => { load() }, [load])

  function handleFilterChange(f: StatusFilter) {
    setFilter(f)
    setPage(1)
  }

  const handleApprove = useCallback(async (comment: string) => {
    if (!viewing) return
    await wfhApi.selfieAction(viewing.selfie_id, reviewerUserId, 'approve', comment)
    load()
  }, [viewing, reviewerUserId, load])

  const handleReject = useCallback(async (comment: string) => {
    if (!viewing) return
    await wfhApi.selfieAction(viewing.selfie_id, reviewerUserId, 'reject', comment)
    load()
  }, [viewing, reviewerUserId, load])

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">WFH Selfie Review</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Review employee attendance selfie evidence — every view is audit-logged
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 h-9 px-4 border border-gray-200 rounded-xl text-[13px] text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-60"
        >
          <i className={`fa-solid fa-rotate-right text-[11px] ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {FILTER_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => handleFilterChange(opt.value)}
            className={`h-8 px-3 rounded-lg text-[12px] font-medium transition-colors ${
              filter === opt.value
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Compliance notice */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 flex items-start gap-2">
        <i className="fa-solid fa-shield-halved text-blue-400 text-[12px] mt-0.5 shrink-0" />
        <p className="text-[11px] text-blue-600 leading-relaxed">
          These selfies are attendance evidence only — not biometric identification.
          Each image you open is recorded in the audit log with your name, timestamp, and IP address.
          Review only records relevant to a genuine attendance dispute.
        </p>
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
        <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
          <p className="text-[13px] font-semibold text-gray-800">Attendance Records</p>
          {!loading && (
            <p className="text-[11px] text-gray-400">{total} record{total !== 1 ? 's' : ''}</p>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Employee', 'Department', 'Punch In', 'Punch Out', 'Status', 'Selfie', 'Action'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? [...Array(8)].map((_, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2 animate-pulse">
                          <div className="w-7 h-7 rounded-full bg-gray-200 shrink-0" />
                          <div className="h-3 w-28 bg-gray-200 rounded" />
                        </div>
                      </td>
                      {[...Array(5)].map((_, j) => (
                        <td key={j} className="px-4 py-3.5">
                          <div className="h-3 w-20 bg-gray-100 rounded animate-pulse" />
                        </td>
                      ))}
                      <td className="px-4 py-3.5">
                        <div className="h-7 w-20 bg-gray-100 rounded-lg animate-pulse" />
                      </td>
                    </tr>
                  ))
                : records.length > 0
                  ? records.map(r => (
                      <tr key={r.wfh_id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                              {initials(r.employee_name)}
                            </span>
                            <div>
                              <p className="font-medium text-gray-800 leading-tight whitespace-nowrap">{r.employee_name}</p>
                              <p className="text-[10px] text-gray-400 font-mono">{r.employee_id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-gray-600 whitespace-nowrap">{r.department}</td>
                        <td className="px-4 py-3.5 text-gray-600 whitespace-nowrap">{fmtDateTime(r.punch_in_at)}</td>
                        <td className="px-4 py-3.5 text-gray-500 whitespace-nowrap">{fmtDateTime(r.punch_out_at)}</td>
                        <td className="px-4 py-3.5">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[r.wfh_status] ?? 'bg-gray-50 text-gray-500'}`}>
                            {STATUS_LABEL[r.wfh_status] ?? r.wfh_status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          {r.selfie_id
                            ? <span className="text-[10px] text-emerald-600 flex items-center gap-1">
                                <i className="fa-solid fa-circle-check text-[9px]" /> Captured
                              </span>
                            : <span className="text-[10px] text-gray-400">None</span>
                          }
                        </td>
                        <td className="px-4 py-3.5">
                          {r.selfie_id ? (
                            <button
                              onClick={() => setViewing(r)}
                              className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                            >
                              <i className="fa-solid fa-eye text-[10px]" /> Review
                            </button>
                          ) : (
                            <span className="text-[11px] text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  : (
                      <tr>
                        <td colSpan={7} className="px-5 py-10 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center">
                              <i className="fa-solid fa-camera text-gray-300 text-xl" />
                            </div>
                            <p className="text-[13px] text-gray-400">No records found</p>
                          </div>
                        </td>
                      </tr>
                    )
              }
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-3.5 border-t border-gray-50 flex items-center justify-between">
            <p className="text-[11px] text-gray-400">
              Page {page} of {totalPages} · {total} record{total !== 1 ? 's' : ''}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="h-8 w-8 flex items-center justify-center rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                <i className="fa-solid fa-chevron-left text-[11px] text-gray-600" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                className="h-8 w-8 flex items-center justify-center rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                <i className="fa-solid fa-chevron-right text-[11px] text-gray-600" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Selfie viewer modal */}
      {viewing && (
        <SelfieViewerModal
          selfieId={viewing.selfie_id}
          reviewerUserId={reviewerUserId}
          employeeName={viewing.employee_name}
          capturedAt={viewing.captured_at}
          wfhStatus={viewing.wfh_status}
          onClose={() => setViewing(null)}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}
    </div>
  )
}
