import { useState } from 'react'
import { useAuthStore }          from '../store/authStore'
import { documentsApi }          from '../api/documents'
import { useDocumentRequests }   from '../hooks/documents/useDocumentRequests'
import Card                      from '../components/ui/Card'
import DocumentCard              from '../components/documents/DocumentCard'
import OfferLetterForm           from '../components/documents/OfferLetterForm'
import ExperienceLetterForm      from '../components/documents/ExperienceLetterForm'
import RelievingLetterForm       from '../components/documents/RelievingLetterForm'
import AppointmentLetterForm     from '../components/documents/AppointmentLetterForm'
import type { DocumentRequest, DocumentRequestStatus, GenerateResult } from '../types/document'

type ActiveDoc = 'offer' | 'experience' | 'relieving' | 'appointment' | null
type Tab       = 'generate' | 'requests'

const DOCS = [
  {
    id: 'appointment' as const,
    title: 'Appointment Letter',
    description: 'Create appointment letter',
    color: 'green' as const,
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    id: 'offer' as const,
    title: 'Offer Letter',
    description: 'Create job offer letter',
    color: 'blue' as const,
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    id: 'relieving' as const,
    title: 'Relieving Letter',
    description: 'Exit documentation',
    color: 'orange' as const,
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
      </svg>
    ),
  },
  {
    id: 'experience' as const,
    title: 'Experience Certificate',
    description: 'Work experience proof',
    color: 'purple' as const,
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
      </svg>
    ),
  },
] as const

// ── Helpers ──────────────────────────────────────────────────────────────────

const DOC_TYPE_LABELS: Record<string, string> = {
  'salary-slip':        'Salary Slip',
  'appointment-letter': 'Appointment Letter',
  'offer-letter':       'Offer Letter',
  'experience-letter':  'Experience Letter',
  'relieving-letter':   'Relieving Letter',
}

function docTypeLabel(v: string) { return DOC_TYPE_LABELS[v] ?? v }

function openHtmlInTab(html: string, title: string) {
  const blob = new Blob([html], { type: 'text/html' })
  const url  = URL.createObjectURL(blob)
  const tab  = window.open(url, '_blank', 'width=960,height=700')
  if (tab) tab.document.title = title
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

const NOW = new Date()
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<DocumentRequestStatus, { cls: string; label: string }> = {
  pending:     { cls: 'bg-amber-50 text-amber-600',     label: 'Pending'              },
  approved:    { cls: 'bg-emerald-50 text-emerald-600', label: 'Approved'             },
  hr_approved: { cls: 'bg-teal-50 text-teal-600',       label: 'Sent to Accountant'  },
  rejected:    { cls: 'bg-red-50 text-red-500',         label: 'Rejected'             },
  generated:   { cls: 'bg-blue-50 text-blue-600',       label: 'Generated'            },
}

function StatusBadge({ status }: { status: DocumentRequestStatus }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.pending
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${s.cls}`}>
      {s.label}
    </span>
  )
}

// ── Inline generate panel ────────────────────────────────────────────────────

interface GeneratePanelProps {
  request:      DocumentRequest
  onGenerated:  (id: number, html?: string, fileUrl?: string) => void
  onClose:      () => void
}

function GeneratePanel({ request, onGenerated, onClose }: GeneratePanelProps) {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  // Salary-slip extra fields
  const [month, setMonth] = useState(NOW.getMonth() + 1)
  const [year,  setYear]  = useState(NOW.getFullYear())

  // Offer-letter extra fields
  const [position,    setPosition]    = useState('')
  const [salary,      setSalary]      = useState('')
  const [joiningDate, setJoiningDate] = useState('')

  // Relieving-letter extra field
  const [lastWorkingDate, setLastWorkingDate] = useState('')

  const inputCls = 'text-[12px] text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400'

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    const empId = request.employee_id
    try {
      let html:    string | undefined
      let fileUrl: string | undefined
      let extra:   Record<string, unknown> = {}

      if (request.document_type === 'salary-slip') {
        const { data } = await documentsApi.generateSalarySlip({ employee_id: empId, month, year })
        if (!data.success) { setError(data.message ?? 'Generation failed'); setLoading(false); return }
        html  = data.html
        extra = { month, year }

      } else if (request.document_type === 'offer-letter') {
        const { data } = await documentsApi.generateOfferLetter({
          employee_id: empId, position, salary: Number(salary), joining_date: joiningDate,
        })
        if (!data.success) { setError(data.message ?? 'Generation failed'); setLoading(false); return }
        // Offer letter now returns a PDF file, not HTML
        fileUrl = data.filepath || data.download_url
        if (fileUrl) window.open(fileUrl, '_blank')
        extra = { file_url: fileUrl }

      }

      // Open HTML-based documents for HR to verify
      if (html) openHtmlInTab(html, docTypeLabel(request.document_type))

      // Persist generated status + file_url in document_requests
      documentsApi.generateForRequest(request.id, extra).catch(() => {})

      onGenerated(request.id, html, fileUrl)
    } catch {
      setError('Failed to generate document')
    } finally {
      setLoading(false)
    }
  }

  const yearOptions = [NOW.getFullYear(), NOW.getFullYear() - 1, NOW.getFullYear() - 2]

  return (
    <div className="mt-3 p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-3">
      <p className="text-[11px] font-semibold text-gray-500">
        Generate for <span className="text-gray-800">{request.employee_id}</span>
        {request.employee_name && <> · {request.employee_name}</>}
      </p>

      {request.document_type === 'salary-slip' && (
        <div className="flex gap-2">
          <select className={inputCls} value={month} onChange={e => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select className={inputCls} value={year} onChange={e => setYear(Number(e.target.value))}>
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      )}

      {request.document_type === 'offer-letter' && (
        <div className="grid grid-cols-3 gap-2">
          <input className={inputCls} placeholder="Position" value={position} onChange={e => setPosition(e.target.value)} />
          <input className={`${inputCls} col-span-1`} placeholder="Salary" type="number" value={salary} onChange={e => setSalary(e.target.value)} />
          <input className={inputCls} type="date" value={joiningDate} onChange={e => setJoiningDate(e.target.value)} />
        </div>
      )}

      {request.document_type === 'relieving-letter' && (
        <input className={inputCls} type="date" value={lastWorkingDate} onChange={e => setLastWorkingDate(e.target.value)} />
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-[11px] font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          {loading
            ? <><i className="fa-solid fa-circle-notch animate-spin text-[10px]" /> Generating…</>
            : <><i className="fa-solid fa-bolt text-[10px]" /> Generate & Assign</>
          }
        </button>
        <button onClick={onClose} className="text-[11px] text-gray-400 hover:text-gray-600 px-2 py-2">
          Cancel
        </button>
        {error && <span className="text-[11px] text-red-500">{error}</span>}
      </div>
    </div>
  )
}

// ── Requests tab ──────────────────────────────────────────────────────────────

function RequestsTab() {
  const { requests, loading, error, approve, reject, markGenerated, forwardToAccountant, refetch } = useDocumentRequests()

  const [rejectingId,    setRejectingId]    = useState<number | null>(null)
  const [rejectReason,   setRejectReason]   = useState('')
  const [generatingId,   setGeneratingId]   = useState<number | null>(null)
  const [actionLoading,  setActionLoading]  = useState<number | null>(null)
  const [offerLetterReq,       setOfferLetterReq]       = useState<DocumentRequest | null>(null)
  const [experienceLetterReq,  setExperienceLetterReq]  = useState<DocumentRequest | null>(null)
  const [relievingLetterReq,   setRelievingLetterReq]   = useState<DocumentRequest | null>(null)
  const [appointmentLetterReq, setAppointmentLetterReq] = useState<DocumentRequest | null>(null)

  async function handleApprove(id: number) {
    setActionLoading(id)
    await approve(id)
    setActionLoading(null)
  }

  async function handleForwardToAccountant(id: number) {
    setActionLoading(id)
    await forwardToAccountant(id)
    setActionLoading(null)
  }

  async function handleRejectSubmit(id: number) {
    if (!rejectReason.trim()) return
    setActionLoading(id)
    await reject(id, rejectReason.trim())
    setRejectingId(null)
    setRejectReason('')
    setActionLoading(null)
  }

  function handleOfferLetterSuccess(req: DocumentRequest, result: GenerateResult) {
    const fileUrl = result.filepath || result.download_url
    documentsApi.generateForRequest(req.id, { file_url: fileUrl }).catch(() => {})
    markGenerated(req.id, undefined, fileUrl)
    setOfferLetterReq(null)
  }

  function handleExperienceLetterSuccess(req: DocumentRequest, result: GenerateResult) {
    const fileUrl = result.filepath || result.download_url
    documentsApi.generateForRequest(req.id, { file_url: fileUrl }).catch(() => {})
    markGenerated(req.id, undefined, fileUrl)
    setExperienceLetterReq(null)
  }

  function handleRelievingLetterSuccess(req: DocumentRequest, result: GenerateResult) {
    const fileUrl = result.filepath || result.download_url
    documentsApi.generateForRequest(req.id, { file_url: fileUrl }).catch(() => {})
    markGenerated(req.id, undefined, fileUrl)
    setRelievingLetterReq(null)
  }

  function handleAppointmentLetterSuccess(req: DocumentRequest, result: GenerateResult) {
    const fileUrl = result.filepath || result.download_url
    documentsApi.generateForRequest(req.id, { file_url: fileUrl }).catch(() => {})
    markGenerated(req.id, undefined, fileUrl)
    setAppointmentLetterReq(null)
  }

  if (loading) {
    return (
      <div className="space-y-2 p-1">
        {[0,1,2,3].map(i => <div key={i} className="h-14 bg-gray-50 rounded-xl animate-pulse" />)}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <i className="fa-solid fa-circle-exclamation text-red-300 text-2xl mb-2" />
        <p className="text-[13px] text-gray-500">{error}</p>
        <button onClick={refetch} className="mt-3 text-[12px] text-blue-600 hover:underline">Retry</button>
      </div>
    )
  }

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mb-3">
          <i className="fa-solid fa-inbox text-gray-300 text-[18px]" />
        </div>
        <p className="text-[13px] font-medium text-gray-500">No document requests</p>
        <p className="text-[11px] text-gray-400 mt-1">Requests from employees will appear here</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400 px-4 py-3">Employee</th>
            <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400 px-4 py-3">Document</th>
            <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400 px-4 py-3">Reason</th>
            <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400 px-4 py-3">Status</th>
            <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400 px-4 py-3">Date</th>
            <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400 px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {requests.map(req => (
            <tr key={req.id} className="border-b border-gray-50 hover:bg-gray-50/50 align-top">
              <td className="px-4 py-3 font-medium text-gray-800">
                {req.employee_name ?? req.employee_id}
                <div className="text-[10px] text-gray-400 font-normal">{req.employee_id}</div>
              </td>
              <td className="px-4 py-3 text-gray-700">{docTypeLabel(req.document_type)}</td>
              <td className="px-4 py-3 text-gray-500 max-w-[160px]">
                <span className="line-clamp-2">{req.reason || <span className="text-gray-300">—</span>}</span>
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={req.status} />
                {req.status === 'rejected' && req.rejected_reason && (
                  <p className="text-[10px] text-red-400 mt-1">{req.rejected_reason}</p>
                )}
              </td>
              <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                {new Date(req.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </td>
              <td className="px-4 py-3">
                {/* Pending actions */}
                {req.status === 'pending' && (
                  rejectingId === req.id ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        autoFocus
                        className="text-[11px] border border-gray-200 rounded-lg px-2 py-1 bg-gray-50 focus:outline-none focus:border-blue-400 w-36"
                        placeholder="Reason…"
                        value={rejectReason}
                        onChange={e => setRejectReason(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleRejectSubmit(req.id) }}
                      />
                      <button
                        onClick={() => handleRejectSubmit(req.id)}
                        disabled={actionLoading === req.id || !rejectReason.trim()}
                        className="text-[11px] font-medium text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 px-2.5 py-1 rounded-lg transition-colors"
                      >
                        {actionLoading === req.id ? '…' : 'Reject'}
                      </button>
                      <button
                        onClick={() => { setRejectingId(null); setRejectReason('') }}
                        className="text-[11px] text-gray-400 hover:text-gray-600"
                      >
                        ✕
                      </button>
                    </div>
                  ) : req.document_type === 'salary-slip' ? (
                    /* Salary-slip: Approve (forwards to accountant) or Reject */
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleForwardToAccountant(req.id)}
                        disabled={actionLoading === req.id}
                        className="flex items-center gap-1.5 text-[11px] font-medium text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <i className="fa-solid fa-check text-[10px]" />
                        {actionLoading === req.id ? '…' : 'Approve'}
                      </button>
                      <button
                        onClick={() => setRejectingId(req.id)}
                        className="text-[11px] font-medium text-red-500 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Reject
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleApprove(req.id)}
                        disabled={actionLoading === req.id}
                        className="text-[11px] font-medium text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        {actionLoading === req.id ? '…' : 'Approve'}
                      </button>
                      <button
                        onClick={() => setRejectingId(req.id)}
                        className="text-[11px] font-medium text-red-500 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Reject
                      </button>
                    </div>
                  )
                )}

                {/* hr_approved: forwarded to accountant — HR has no more action */}
                {req.status === 'hr_approved' && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-teal-600 bg-teal-50 px-3 py-1.5 rounded-lg">
                    <i className="fa-solid fa-check-double text-[10px]" />
                    Forwarded to Accountant
                  </span>
                )}

                {/* Approved (legacy salary-slip): forward to accountant */}
                {req.status === 'approved' && req.document_type === 'salary-slip' && (
                  <button
                    onClick={() => handleForwardToAccountant(req.id)}
                    disabled={actionLoading === req.id}
                    className="flex items-center gap-1.5 text-[11px] font-medium text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <i className="fa-solid fa-paper-plane text-[10px]" />
                    {actionLoading === req.id ? '…' : 'Forward to Accountant'}
                  </button>
                )}

                {/* Approved: show Generate button for non-salary-slip types */}
                {req.status === 'approved' && req.document_type !== 'salary-slip' && (
                  <div>
                    {req.document_type === 'offer-letter' ? (
                      <button
                        onClick={() => { setExperienceLetterReq(null); setOfferLetterReq(req) }}
                        disabled={!!offerLetterReq || !!experienceLetterReq}
                        className="flex items-center gap-1.5 text-[11px] font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <i className="fa-solid fa-file-pen text-[10px]" />
                        Fill &amp; Generate
                      </button>
                    ) : req.document_type === 'experience-letter' ? (
                      <button
                        onClick={() => { setOfferLetterReq(null); setRelievingLetterReq(null); setExperienceLetterReq(req) }}
                        disabled={!!offerLetterReq || !!experienceLetterReq || !!relievingLetterReq}
                        className="flex items-center gap-1.5 text-[11px] font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <i className="fa-solid fa-file-pen text-[10px]" />
                        Fill &amp; Generate
                      </button>
                    ) : req.document_type === 'relieving-letter' ? (
                      <button
                        onClick={() => { setOfferLetterReq(null); setExperienceLetterReq(null); setRelievingLetterReq(req) }}
                        disabled={!!offerLetterReq || !!experienceLetterReq || !!relievingLetterReq}
                        className="flex items-center gap-1.5 text-[11px] font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <i className="fa-solid fa-file-pen text-[10px]" />
                        Fill &amp; Generate
                      </button>
                    ) : req.document_type === 'appointment-letter' ? (
                      <button
                        onClick={() => { setOfferLetterReq(null); setExperienceLetterReq(null); setRelievingLetterReq(null); setAppointmentLetterReq(req) }}
                        disabled={!!offerLetterReq || !!experienceLetterReq || !!relievingLetterReq || !!appointmentLetterReq}
                        className="flex items-center gap-1.5 text-[11px] font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <i className="fa-solid fa-file-pen text-[10px]" />
                        Fill &amp; Generate
                      </button>
                    ) : generatingId === req.id ? (
                      <GeneratePanel
                        request={req}
                        onGenerated={(id, html, fileUrl) => { markGenerated(id, html, fileUrl); setGeneratingId(null) }}
                        onClose={() => setGeneratingId(null)}
                      />
                    ) : (
                      <button
                        onClick={() => setGeneratingId(req.id)}
                        className="flex items-center gap-1.5 text-[11px] font-medium text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <i className="fa-solid fa-bolt text-[10px]" />
                        Generate
                      </button>
                    )}
                  </div>
                )}

                {/* Generated: view and download */}
                {req.status === 'generated' && (
                  (req.file_html || req.file_url) ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          if (req.file_url) {
                            // Salary slips require employee_id for the ownership check
                            const sep = req.file_url.includes('?') ? '&' : '?'
                            const url = req.file_url.startsWith('/api/documents/download/salary_slip')
                              ? `${req.file_url}${sep}employee_id=${encodeURIComponent(req.employee_id)}`
                              : req.file_url
                            window.open(url, '_blank')
                          } else if (req.file_html) {
                            openHtmlInTab(req.file_html, docTypeLabel(req.document_type))
                          }
                        }}
                        className="flex items-center gap-1.5 text-[11px] font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <i className="fa-solid fa-arrow-up-right-from-square text-[10px]" />
                        View
                      </button>
                      {req.file_url && (
                        <a
                          href={(() => {
                            const sep = req.file_url.includes('?') ? '&' : '?'
                            const base = req.file_url.startsWith('/api/documents/download/salary_slip')
                              ? `${req.file_url}${sep}employee_id=${encodeURIComponent(req.employee_id)}`
                              : req.file_url
                            return `${base}${base.includes('?') ? '&' : '?'}force_download=true`
                          })()}
                          download
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 text-[11px] font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          <i className="fa-solid fa-download text-[10px]" />
                          Download
                        </a>
                      )}
                    </div>
                  ) : (
                    <span className="text-[11px] text-gray-400">Generated</span>
                  )
                )}

                {req.status === 'rejected' && (
                  <span className="text-[11px] text-gray-400">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Offer Letter Form panel (Modal) ─────────────────── */}
      {offerLetterReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div>
                <h4 className="text-[16px] font-bold text-gray-900">Generate Offer Letter</h4>
                <p className="text-[12px] text-gray-500 mt-0.5">
                  For <span className="font-semibold text-gray-700">
                    {offerLetterReq.employee_name || offerLetterReq.employee_id}
                  </span>
                </p>
              </div>
              <button onClick={() => setOfferLetterReq(null)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                ✕
              </button>
            </div>
            <div className="p-6 max-h-[75vh] overflow-y-auto">
              <OfferLetterForm
                initialEmployeeId={offerLetterReq.employee_id}
                onCancel={() => setOfferLetterReq(null)}
                onSuccess={(result: GenerateResult) => handleOfferLetterSuccess(offerLetterReq, result)}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Experience Letter Form panel (Modal) ──────────────── */}
      {experienceLetterReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div>
                <h4 className="text-[16px] font-bold text-gray-900">Generate Experience Letter</h4>
                <p className="text-[12px] text-gray-500 mt-0.5">
                  For <span className="font-semibold text-gray-700">
                    {experienceLetterReq.employee_name || experienceLetterReq.employee_id}
                  </span>
                </p>
              </div>
              <button onClick={() => setExperienceLetterReq(null)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                ✕
              </button>
            </div>
            <div className="p-6 max-h-[75vh] overflow-y-auto">
              <ExperienceLetterForm
                initialEmployeeId={experienceLetterReq.employee_id}
                onCancel={() => setExperienceLetterReq(null)}
                onSuccess={(result: GenerateResult) => handleExperienceLetterSuccess(experienceLetterReq, result)}
              />
            </div>
          </div>
        </div>
      )}

      {/* 📝 Relieving Letter Form panel (Modal) */}
      {relievingLetterReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div>
                <h4 className="text-[16px] font-bold text-gray-900">Generate Relieving Letter</h4>
                <p className="text-[12px] text-gray-500 mt-0.5">
                  For <span className="font-semibold text-gray-700">
                    {relievingLetterReq.employee_name || relievingLetterReq.employee_id}
                  </span>
                </p>
              </div>
              <button onClick={() => setRelievingLetterReq(null)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                ✕
              </button>
            </div>
            <div className="p-6 max-h-[75vh] overflow-y-auto">
              <RelievingLetterForm
                initialEmployeeId={relievingLetterReq.employee_id}
                onCancel={() => setRelievingLetterReq(null)}
                onSuccess={(result: GenerateResult) => handleRelievingLetterSuccess(relievingLetterReq, result)}
              />
            </div>
          </div>
        </div>
      )}

      {/* 📝 Appointment Letter Form panel (Modal) */}
      {appointmentLetterReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div>
                <h4 className="text-[16px] font-bold text-gray-900">Generate Appointment Letter</h4>
                <p className="text-[12px] text-gray-500 mt-0.5">
                  For <span className="font-semibold text-gray-700">
                    {appointmentLetterReq.employee_name || appointmentLetterReq.employee_id}
                  </span>
                </p>
              </div>
              <button onClick={() => setAppointmentLetterReq(null)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                ✕
              </button>
            </div>
            <div className="p-6 max-h-[75vh] overflow-y-auto">
              <AppointmentLetterForm
                initialEmployeeId={appointmentLetterReq.employee_id}
                onCancel={() => setAppointmentLetterReq(null)}
                onSuccess={(result: GenerateResult) => handleAppointmentLetterSuccess(appointmentLetterReq, result)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const { user } = useAuthStore()
  const isHRAdmin = user?.role === 'admin' || user?.role === 'hr'

  const [activeDoc, setActiveDoc] = useState<ActiveDoc>(null)
  const [tab,       setTab]       = useState<Tab>('generate')

  function handleCardClick(id: ActiveDoc) { setActiveDoc(prev => (prev === id ? null : id)) }
  function handleCancel() { setActiveDoc(null) }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
        <p className="text-sm text-gray-500 mt-0.5">Generate HR documents and manage employee requests</p>
      </div>

      {!isHRAdmin ? (
        /* Employee view — should not reach here (routed to /employee/documents) */
        <Card>
          <div className="text-center py-8">
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <i className="fa-solid fa-folder-open text-blue-600 text-xl" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Documents Managed by HR</h3>
            <p className="text-sm text-gray-500 max-w-sm mx-auto">
              Your salary slips, offer letters, and certificates are generated by HR.
              Contact your HR team to request a document.
            </p>
          </div>
        </Card>
      ) : (
        <>
          {/* Tab bar */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
            <button
              onClick={() => setTab('generate')}
              className={`text-[13px] font-medium px-5 py-2 rounded-lg transition-colors ${
                tab === 'generate'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Generate
            </button>
            <button
              onClick={() => setTab('requests')}
              className={`text-[13px] font-medium px-5 py-2 rounded-lg transition-colors ${
                tab === 'requests'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Requests
            </button>
          </div>

          {/* ── Generate tab (original, unchanged) ── */}
          {tab === 'generate' && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {DOCS.map(doc => (
                  <DocumentCard
                    key={doc.id}
                    title={doc.title}
                    description={doc.description}
                    icon={doc.icon}
                    color={doc.color}
                    isActive={activeDoc === doc.id}
                    onClick={() => handleCardClick(doc.id)}
                  />
                ))}
              </div>

              {activeDoc && (
                <Card>
                  <h3 className="text-base font-semibold text-gray-900 mb-5">
                    {DOCS.find(d => d.id === activeDoc)?.title}
                  </h3>
                  {activeDoc === 'offer'      && <OfferLetterForm     onCancel={handleCancel} />}
                  {activeDoc === 'experience' && <ExperienceLetterForm onCancel={handleCancel} />}
                  {activeDoc === 'relieving'  && <RelievingLetterForm  onCancel={handleCancel} />}
                  {activeDoc === 'appointment'&& <AppointmentLetterForm onCancel={handleCancel} />}
                </Card>
              )}

              {!activeDoc && (
                <Card>
                  <p className="text-sm text-gray-400 text-center py-6">
                    Select a document type above to begin generation.
                  </p>
                </Card>
              )}
            </>
          )}

          {/* ── Requests tab ── */}
          {tab === 'requests' && (
            <Card>
              <RequestsTab />
            </Card>
          )}
        </>
      )}
    </div>
  )
}
