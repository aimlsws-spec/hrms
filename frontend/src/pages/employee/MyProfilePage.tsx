import { useState, useCallback, useEffect, useRef } from 'react'
import { useAuthStore }      from '../../store/authStore'
import { useMyProfile }      from '../../hooks/employee/profile/useMyProfile'
import { useUpdateProfile }  from '../../hooks/employee/profile/useUpdateProfile'
import { employeesApi }      from '../../api/employees'
import { profileApi }        from '../../api/profile'
import { documentsApi }      from '../../api/documents'
import { useMyDocumentRequests } from '../../hooks/employee/documents/useMyDocumentRequests'
import { useProfileImageStore } from '../../store/profileImageStore'
import type { UpdateProfilePayload } from '../../types/profile'
import type { DocumentRequest, DocumentRequestStatus } from '../../types/document'

import PersonalInfoCard     from '../../components/employee/profile/PersonalInfoCard'
import ContactInfoCard      from '../../components/employee/profile/ContactInfoCard'
import HomeLocationCard     from '../../components/employee/profile/HomeLocationCard'
import EmploymentInfoCard   from '../../components/employee/profile/EmploymentInfoCard'
import SalaryInfoCard       from '../../components/employee/profile/SalaryInfoCard'

// ── helpers ───────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

function toEmployeeCode(userId: number | string | undefined): string {
  if (userId == null) return ''
  const s = String(userId)
  if (/^EMP\d+$/i.test(s)) return s.toUpperCase()
  const n = parseInt(s, 10)
  return n > 0 ? `EMP${String(n).padStart(4, '0')}` : s
}

function openHtml(html: string, title: string) {
  const tab = window.open('', '_blank', 'width=900,height=720')
  if (!tab) return
  tab.document.open(); tab.document.write(html)
  tab.document.title = title; tab.document.close()
}

const now = new Date()
const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

const STATUS_STYLES: Record<string, string> = {
  Active:     'text-emerald-800 bg-emerald-100',
  active:     'text-emerald-800 bg-emerald-100',
  Inactive:   'text-red-800 bg-red-100',
  'On Leave': 'text-amber-800 bg-amber-100',
}

// ── Tab config ────────────────────────────────────────────────────────────────

type TabId = 'personal' | 'job' | 'salary' | 'payslips' | 'documents'

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'personal',  label: 'Personal',  icon: 'fa-solid fa-circle-user'          },
  { id: 'job',       label: 'Job',       icon: 'fa-solid fa-briefcase'            },
  { id: 'salary',    label: 'Salary',    icon: 'fa-solid fa-indian-rupee-sign'    },
  { id: 'payslips',  label: 'Payslips',  icon: 'fa-solid fa-file-invoice-dollar'  },
  { id: 'documents', label: 'Documents', icon: 'fa-solid fa-folder-open'          },
]

// ── Payslips tab — request-based, official Seawind Solutions format ────────────

function fmtMonthLabel(yyyyMM?: string | null): string {
  if (!yyyyMM) return ''
  try {
    const [y, m] = yyyyMM.split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  } catch {
    return yyyyMM
  }
}

function PayslipsTab({ employeeCode }: { employeeCode: string }) {
  const {
    requests, loading: reqLoading, submitting,
    submitError, submitSuccess, submitRequest,
  } = useMyDocumentRequests(employeeCode)

  const [month, setMonth] = useState(defaultMonth)

  // Only salary slips concern this tab
  const slips        = requests.filter(r => r.document_type === 'salary-slip')
  const readySlips   = slips.filter(r => r.status === 'generated' && r.file_url)
  const pendingSlips = slips.filter(r => !(r.status === 'generated' && r.file_url))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await submitRequest({
      employee_id:     employeeCode,
      document_type:   'salary-slip',
      requested_month: month,
    })
  }

  // The accountant-generated payslip is served as a PDF in the Seawind format.
  function buildSlipUrl(req: DocumentRequest, forceDownload = false): string {
    const base = `${req.file_url}?employee_id=${encodeURIComponent(employeeCode)}`
    return forceDownload ? `${base}&force_download=true` : base
  }

  const inputCls = 'h-10 px-3 border border-gray-200 rounded-xl text-sm bg-gray-50 text-gray-900 focus:outline-none focus:border-primary-700 focus:bg-white transition-all'

  return (
    <div className="space-y-5">
      {/* Request a payslip */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">Request Payslip</p>
        <p className="text-[12px] text-gray-500 mb-4">
          Submit a request for your official payslip. Once HR approves and the accountant generates it,
          it appears below in the Seawind Solutions format.
        </p>
        <form onSubmit={handleSubmit} className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Month</label>
            <input
              type="month"
              className={inputCls + ' w-full'}
              value={month}
              onChange={e => setMonth(e.target.value)}
              max={defaultMonth}
              required
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="h-10 px-5 bg-primary-900 hover:bg-primary-800 disabled:opacity-60 text-white text-[13px] font-semibold rounded-xl transition-colors shrink-0 flex items-center gap-2"
          >
            {submitting
              ? <><i className="fa-solid fa-circle-notch animate-spin text-[11px]" /> Submitting…</>
              : <><i className="fa-solid fa-paper-plane text-[11px]" /> Request Payslip</>}
          </button>
        </form>
        <div className="mt-3 min-h-[18px]">
          {submitSuccess && (
            <span className="text-[12px] text-emerald-600 font-medium flex items-center gap-1.5">
              <i className="fa-solid fa-circle-check text-[11px]" /> Request submitted — HR will review it shortly
            </span>
          )}
          {submitError && (
            <span className="text-[12px] text-red-500 flex items-center gap-1.5">
              <i className="fa-solid fa-circle-exclamation text-[11px]" />{submitError}
            </span>
          )}
        </div>
      </div>

      {/* Generated payslips */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Generated Payslips</p>
        </div>
        {reqLoading ? (
          <div className="space-y-2 p-4">{[0,1].map(i => <div key={i} className="h-12 bg-gray-50 rounded-xl animate-pulse" />)}</div>
        ) : readySlips.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center px-4">
            <i className="fa-solid fa-file-invoice-dollar text-gray-200 text-[28px] mb-3" />
            <p className="text-[13px] font-medium text-gray-400">No payslips ready yet</p>
            <p className="text-[11px] text-gray-400 mt-1">Approved &amp; generated payslips appear here</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {readySlips.map(req => (
              <li key={req.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                  <i className="fa-solid fa-file-invoice-dollar text-emerald-500 text-[12px]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-gray-800">
                    Payslip
                    {req.requested_month && <span className="ml-1 text-[11px] font-normal text-gray-500">— {fmtMonthLabel(req.requested_month)}</span>}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    Generated {new Date(req.updated_at ?? req.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <DocStatusBadge status={req.status} />
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => window.open(buildSlipUrl(req), '_blank')}
                    className="flex items-center gap-1.5 text-[11px] font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <i className="fa-solid fa-arrow-up-right-from-square text-[10px]" /> View
                  </button>
                  <button
                    onClick={() => window.open(buildSlipUrl(req, true), '_blank')}
                    className="flex items-center gap-1.5 text-[11px] font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <i className="fa-solid fa-download text-[10px]" /> Download
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* My payslip requests */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">My Payslip Requests</p>
        </div>
        {reqLoading ? (
          <div className="space-y-2 p-4">{[0,1].map(i => <div key={i} className="h-12 bg-gray-50 rounded-xl animate-pulse" />)}</div>
        ) : pendingSlips.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center px-4">
            <i className="fa-solid fa-inbox text-gray-200 text-[28px] mb-3" />
            <p className="text-[13px] font-medium text-gray-400">No payslip requests yet</p>
            <p className="text-[11px] text-gray-400 mt-1">Request one above and track its status here</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {pendingSlips.map(req => (
              <li key={req.id} className="px-5 py-3 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
                    <i className="fa-solid fa-file-invoice-dollar text-slate-400 text-[12px]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-gray-800">
                      Payslip
                      {req.requested_month && <span className="ml-1 text-[11px] font-normal text-gray-500">— {fmtMonthLabel(req.requested_month)}</span>}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      Requested {new Date(req.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <DocStatusBadge status={req.status} />
                </div>
                {req.status === 'rejected' && req.rejected_reason && (
                  <p className="mt-2 ml-11 text-[11px] text-red-500 flex items-center gap-1.5">
                    <i className="fa-solid fa-circle-info text-[10px]" />{req.rejected_reason}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// ── Documents tab ─────────────────────────────────────────────────────────────

const DOC_TYPES = [
  { value: 'salary-slip',        label: 'Salary Slip' },
  { value: 'offer-letter',       label: 'Offer Letter' },
  { value: 'experience-letter',  label: 'Experience Letter' },
  { value: 'relieving-letter',   label: 'Relieving Letter' },
  { value: 'appointment-letter', label: 'Appointment Letter' },
]

const DOC_STATUS_STYLES: Record<DocumentRequestStatus, { cls: string; icon: string; label: string }> = {
  pending:     { cls: 'bg-amber-100 text-amber-800 ring-1 ring-amber-300',      icon: 'fa-solid fa-clock',             label: 'Pending'            },
  approved:    { cls: 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300', icon: 'fa-solid fa-check',             label: 'Approved'           },
  hr_approved: { cls: 'bg-teal-100 text-teal-700 ring-1 ring-teal-300',         icon: 'fa-solid fa-paper-plane',       label: 'Sent to Accountant' },
  rejected:    { cls: 'bg-red-100 text-red-800 ring-1 ring-red-300',            icon: 'fa-solid fa-xmark',             label: 'Rejected'           },
  generated:   { cls: 'bg-blue-100 text-blue-700',                              icon: 'fa-solid fa-file-circle-check', label: 'Generated'          },
}

function DocStatusBadge({ status }: { status: DocumentRequestStatus }) {
  const s = DOC_STATUS_STYLES[status] ?? DOC_STATUS_STYLES.pending
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${s.cls}`}>
      <i className={`${s.icon} text-[9px]`} />{s.label}
    </span>
  )
}

function DocumentsTab({ employeeCode }: { employeeCode: string }) {
  const {
    requests, loading: reqLoading, submitting,
    submitError, submitSuccess, submitRequest,
  } = useMyDocumentRequests(employeeCode)

  const [docType,      setDocType]      = useState(DOC_TYPES[0].value)
  const [reason,       setReason]       = useState('')
  const [generatingId, setGeneratingId] = useState<number | null>(null)
  const [genError,     setGenError]     = useState<string | null>(null)

  useEffect(() => { if (submitSuccess) { setDocType(DOC_TYPES[0].value); setReason('') } }, [submitSuccess])

  const readyDocs    = requests.filter(r => r.status === 'generated' || (r.status === 'approved' && (r.file_html || r.file_url)))
  const pendingReqs  = requests.filter(r => !readyDocs.includes(r))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await submitRequest({ employee_id: employeeCode, document_type: docType, reason: reason.trim() || undefined })
  }

  async function handleView(req: DocumentRequest) {
    if (generatingId !== null) return
    setGenError(null)
    if (req.file_html) { openHtml(req.file_html, req.document_type); return }
    if (req.file_url)  { window.open(req.file_url, '_blank'); return }
    setGeneratingId(req.id)
    try {
      if (req.document_type === 'salary-slip') {
        const { data } = await documentsApi.generateSalarySlip({ employee_id: employeeCode, month: now.getMonth() + 1, year: now.getFullYear() })
        if (!data.success) { setGenError(data.message ?? 'Generation failed'); return }
        if (data.html) openHtml(data.html, 'Salary Slip')
      } else {
        setGenError('Document not yet available. Please wait for HR to generate it.')
      }
    } catch { setGenError('Failed to load document') }
    finally { setGeneratingId(null) }
  }

  const inputCls = 'w-full text-[12px] text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400'

  return (
    <div className="space-y-5">
      {/* Request */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Request a Document</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Document Type</label>
              <select className={inputCls} value={docType} onChange={e => setDocType(e.target.value)}>
                {DOC_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1.5">Reason <span className="font-normal text-gray-400">(optional)</span></label>
              <input type="text" className={inputCls} placeholder="e.g. Visa application, loan…" value={reason} onChange={e => setReason(e.target.value)} maxLength={300} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={submitting}
              className="flex items-center gap-2 bg-primary-900 hover:bg-primary-800 disabled:opacity-60 text-white text-[12px] font-semibold px-5 py-2.5 rounded-xl transition-colors">
              {submitting
                ? <><i className="fa-solid fa-circle-notch animate-spin text-[11px]" /> Submitting…</>
                : <><i className="fa-solid fa-paper-plane text-[11px]" /> Submit Request</>}
            </button>
            {submitSuccess && <span className="text-[12px] text-emerald-600 font-medium flex items-center gap-1.5"><i className="fa-solid fa-circle-check text-[11px]" /> Submitted</span>}
            {submitError  && <span className="text-[12px] text-red-500 flex items-center gap-1.5"><i className="fa-solid fa-circle-exclamation text-[11px]" />{submitError}</span>}
          </div>
        </form>
      </div>

      {/* Generated docs */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Generated Documents</p>
        </div>
        {reqLoading ? (
          <div className="space-y-2 p-4">{[0,1].map(i => <div key={i} className="h-12 bg-gray-50 rounded-xl animate-pulse" />)}</div>
        ) : readyDocs.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center px-4">
            <i className="fa-solid fa-file-circle-check text-gray-200 text-[28px] mb-3" />
            <p className="text-[13px] font-medium text-gray-400">No generated documents yet</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {readyDocs.map(req => (
              <li key={req.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                  <i className="fa-solid fa-file-circle-check text-blue-500 text-[12px]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-gray-800">{DOC_TYPES.find(d => d.value === req.document_type)?.label ?? req.document_type}</p>
                  <p className="text-[10px] text-gray-400">{new Date(req.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
                <DocStatusBadge status={req.status} />
                <button onClick={() => handleView(req)} disabled={generatingId !== null}
                  className="flex items-center gap-1.5 text-[11px] font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 disabled:opacity-60 px-3 py-1.5 rounded-lg transition-colors shrink-0">
                  {generatingId === req.id
                    ? <><i className="fa-solid fa-circle-notch animate-spin text-[10px]" /> Loading…</>
                    : <><i className="fa-solid fa-eye text-[10px]" /> View</>}
                </button>
              </li>
            ))}
          </ul>
        )}
        {genError && <p className="text-[11px] text-red-500 flex items-center gap-1.5 px-5 py-3 border-t border-gray-50"><i className="fa-solid fa-circle-exclamation text-[10px]" />{genError}</p>}
      </div>

      {/* Pending requests */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">My Requests</p>
        </div>
        {reqLoading ? (
          <div className="space-y-2 p-4">{[0,1,2].map(i => <div key={i} className="h-12 bg-gray-50 rounded-xl animate-pulse" />)}</div>
        ) : pendingReqs.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center px-4">
            <i className="fa-solid fa-inbox text-gray-200 text-[28px] mb-3" />
            <p className="text-[13px] font-medium text-gray-400">No requests yet</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {pendingReqs.map(req => (
              <li key={req.id} className="px-5 py-3 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
                    <i className="fa-solid fa-file-lines text-slate-400 text-[12px]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-gray-800">{DOC_TYPES.find(d => d.value === req.document_type)?.label ?? req.document_type}</p>
                    <p className="text-[10px] text-gray-400">{new Date(req.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}{req.reason && ` · ${req.reason}`}</p>
                  </div>
                  <DocStatusBadge status={req.status} />
                </div>
                {req.status === 'rejected' && req.rejected_reason && (
                  <p className="mt-2 ml-11 text-[11px] text-red-500 flex items-center gap-1.5">
                    <i className="fa-solid fa-circle-info text-[10px]" />{req.rejected_reason}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// ── Sidebar avatar upload ─────────────────────────────────────────────────────

function SidebarAvatar({ profile }: { profile: NonNullable<ReturnType<typeof useMyProfile>['profile']> }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const { images, setImage } = useProfileImageStore()
  const imageUrl = profile.email ? (images[profile.email.toLowerCase()] ?? null) : null
  const statusKey = profile.status ?? 'Active'
  const statusCls = STATUS_STYLES[statusKey] ?? STATUS_STYLES['Active']

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !profile.email) return
    if (file.size > 2 * 1024 * 1024) { alert('Image must be under 2 MB'); return }
    const reader = new FileReader()
    reader.onload = ev => setImage(profile.email!, ev.target?.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  return (
    <div className="flex flex-col items-center text-center">
      {/* Avatar */}
      <div className="relative mb-3">
        {imageUrl ? (
          <img src={imageUrl} alt={profile.full_name} className="w-20 h-20 rounded-2xl object-cover ring-4 ring-primary-100" />
        ) : (
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-700 to-primary-900 flex items-center justify-center text-2xl font-bold text-white ring-4 ring-primary-100">
            {initials(profile.full_name)}
          </div>
        )}
        <button type="button" onClick={() => fileRef.current?.click()}
          className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
          title="Change photo">
          <i className="fa-solid fa-camera text-white text-sm" />
        </button>
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <button type="button" onClick={() => fileRef.current?.click()}
        className="text-[11px] text-primary-700 hover:text-primary-900 font-medium mb-3 flex items-center gap-1">
        <i className="fa-solid fa-arrow-up-from-bracket text-[10px]" />
        {imageUrl ? 'Change Photo' : 'Upload Photo'}
      </button>

      {/* Name + title */}
      <p className="text-[15px] font-bold text-gray-900 leading-tight">{profile.full_name}</p>
      {profile.title && <p className="text-[12px] text-gray-500 mt-0.5">{profile.title}</p>}

      {/* Status pill */}
      <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full mt-2.5 ${statusCls}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />
        {statusKey.charAt(0).toUpperCase() + statusKey.slice(1)}
      </span>

      {/* Divider */}
      <div className="w-full border-t border-gray-100 my-4" />

      {/* Basic info rows */}
      <div className="w-full space-y-3 text-left">
        {[
          { icon: 'fa-solid fa-envelope',     color: 'text-blue-500',    label: 'Email',       value: profile.email       },
          { icon: 'fa-solid fa-phone',         color: 'text-emerald-500', label: 'Phone',       value: profile.phone       },
          { icon: 'fa-solid fa-id-badge',      color: 'text-indigo-500',  label: 'Employee ID', value: profile.employee_id },
          { icon: 'fa-solid fa-building',      color: 'text-violet-500',  label: 'Department',  value: profile.department  },
        ].map(row => row.value ? (
          <div key={row.label} className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center shrink-0 mt-0.5">
              <i className={`${row.icon} ${row.color} text-[11px]`} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-gray-400 leading-none">{row.label}</p>
              <p className="text-[12px] font-semibold text-gray-700 mt-0.5 break-all">{row.value}</p>
            </div>
          </div>
        ) : null)}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MyProfilePage() {
  const { user, setUser } = useAuthStore()
  const userId = user?.user_id ?? null
  const employeeCode = toEmployeeCode(user?.user_id)

  const { profile, isLoading, error, setProfile } = useMyProfile(user ?? null)
  const contactUpdate   = useUpdateProfile(userId)

  const [activeTab,       setActiveTab]       = useState<TabId>('personal')
  const [personalSaving,  setPersonalSaving]  = useState(false)
  const [personalError,   setPersonalError]   = useState<string | null>(null)
  const [personalSuccess, setPersonalSuccess] = useState(false)

  async function handleContactSave(data: UpdateProfilePayload) {
    const ok = await contactUpdate.updateProfile(data)
    if (ok && profile) setProfile({ ...profile, ...data })
  }

  async function handlePersonalSave(data: UpdateProfilePayload) {
    if (!profile) return
    setPersonalSaving(true); setPersonalError(null); setPersonalSuccess(false)
    try {
      if (data.full_name && profile.employee_id) {
        const res = await employeesApi.update(profile.employee_id, { full_name: data.full_name })
        if (res.data.success && user) setUser({ ...user, full_name: data.full_name })
      }
      const { full_name: _n, ...fields } = data
      if (Object.values(fields).some(v => v !== undefined) && userId) {
        await profileApi.updateMyProfile(userId, fields)
      }
      setProfile({ ...profile, ...data })
      setPersonalSuccess(true)
      setTimeout(() => setPersonalSuccess(false), 3000)
    } catch {
      setPersonalError('Failed to save personal details')
    } finally {
      setPersonalSaving(false)
    }
  }

  if (!user) return null

  if (isLoading) {
    return (
      <div className="flex gap-6">
        <div className="w-64 shrink-0 h-96 rounded-2xl bg-gray-100 animate-pulse" />
        <div className="flex-1 space-y-4">
          <div className="h-12 bg-gray-100 rounded-2xl animate-pulse" />
          <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
        </div>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-center">
          <i className="fa-solid fa-circle-exclamation text-2xl text-red-300 mb-3" />
          <p className="text-[13px] font-semibold text-gray-600">Failed to load profile</p>
          <p className="text-[11px] text-gray-400 mt-1">{error ?? 'Unknown error'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col lg:flex-row gap-5 items-start">

      {/* ── Left sidebar ── */}
      <aside className="w-full lg:w-64 shrink-0">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 lg:sticky lg:top-6">
          <SidebarAvatar profile={profile} />
        </div>
      </aside>

      {/* ── Right content ── */}
      <div className="flex-1 min-w-0">

        {/* Tab bar */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm mb-5 overflow-x-auto">
          <nav className="flex min-w-max">
            {TABS.map((tab, i) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3.5 text-[13px] font-semibold transition-colors whitespace-nowrap ${
                  i > 0 ? 'border-l border-gray-100' : ''
                } ${
                  activeTab === tab.id
                    ? 'text-primary-900 border-b-2 border-primary-900 bg-white/15'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 border-b-2 border-transparent'
                }`}
              >
                <i className={`${tab.icon} text-[12px]`} />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab content */}
        <div>
          {activeTab === 'personal' && (
            <div className="space-y-5">
              <PersonalInfoCard
                profile={profile}
                isSaving={personalSaving}
                saveError={personalError}
                saveSuccess={personalSuccess}
                onSave={handlePersonalSave}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <ContactInfoCard
                  profile={profile}
                  isSaving={contactUpdate.isSaving}
                  saveError={contactUpdate.saveError}
                  saveSuccess={contactUpdate.saveSuccess}
                  onSave={handleContactSave}
                />
                {profile.default_work_mode === 'WFO' ? (
                  <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                      <i className="fa-solid fa-building text-blue-600" />
                    </div>
                    <div>
                      <p className="text-[14px] font-semibold text-gray-800">Work from Office</p>
                      <p className="text-[12px] text-gray-500 mt-0.5">
                        Your attendance is marked at the office with location and a selfie.
                        No home location is needed.
                      </p>
                    </div>
                  </div>
                ) : (
                <HomeLocationCard
                  profile={profile}
                  onSaved={(lat, lon, address) =>
                    setProfile({
                      ...profile,
                      home_location_set: true,
                      home_latitude:     lat,
                      home_longitude:    lon,
                      home_address:      address ?? profile.home_address,
                      home_updated_at:   new Date().toISOString(),
                    })
                  }
                />
                )}
              </div>
            </div>
          )}

          {activeTab === 'job' && (
            <EmploymentInfoCard profile={profile} />
          )}

          {activeTab === 'salary' && profile.employee_id && (
            <SalaryInfoCard employeeId={profile.employee_id} />
          )}

          {activeTab === 'salary' && !profile.employee_id && (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
              <i className="fa-solid fa-indian-rupee-sign text-gray-200 text-[28px] mb-3" />
              <p className="text-[13px] text-gray-400">No salary information available.</p>
            </div>
          )}

          {activeTab === 'payslips' && (
            <PayslipsTab employeeCode={employeeCode} />
          )}

          {activeTab === 'documents' && (
            <DocumentsTab employeeCode={employeeCode} />
          )}
        </div>
      </div>
    </div>
  )
}
