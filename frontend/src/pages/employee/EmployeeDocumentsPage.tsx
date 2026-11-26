import { useState } from 'react'
import { useAuthStore }          from '../../store/authStore'
import { useMyDocumentRequests } from '../../hooks/employee/documents/useMyDocumentRequests'
import type {
  DocumentRequest,
  DocumentRequestStatus,
} from '../../types/document'

// ── helpers ──────────────────────────────────────────────────────────────────

function toEmployeeCode(userId: number | string | undefined): string {
  if (userId == null) return ''
  const s = String(userId)
  if (/^EMP\d+$/i.test(s)) return s.toUpperCase()
  const n = parseInt(s, 10)
  return n > 0 ? `EMP${String(n).padStart(4, '0')}` : s
}

function openHtmlInTab(html: string, title: string) {
  const blob = new Blob([html], { type: 'text/html' })
  const url  = URL.createObjectURL(blob)
  const tab  = window.open(url, '_blank', 'width=960,height=700')
  if (tab) tab.document.title = title
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

function fmtMonth(yyyyMM?: string | null): string {
  if (!yyyyMM) return ''
  try {
    const [y, m] = yyyyMM.split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  } catch {
    return yyyyMM
  }
}

const DOC_TYPES = [
  { value: 'salary-slip',         label: 'Salary Slip' },
  { value: 'offer-letter',        label: 'Offer Letter' },
  { value: 'experience-letter',   label: 'Experience Letter' },
  { value: 'relieving-letter',    label: 'Relieving Letter' },
  { value: 'appointment-letter',  label: 'Appointment Letter' },
]

function docTypeLabel(value: string) {
  return DOC_TYPES.find(d => d.value === value)?.label ?? value
}

// ── Doc-type icon map ─────────────────────────────────────────────────────────

const DOC_ICONS: Record<string, { icon: string; bg: string; color: string }> = {
  'salary-slip':        { icon: 'fa-file-invoice-dollar', bg: 'bg-emerald-50',  color: 'text-emerald-500'  },
  'offer-letter':       { icon: 'fa-file-lines',          bg: 'bg-blue-50',     color: 'text-blue-500'     },
  'experience-letter':  { icon: 'fa-briefcase',           bg: 'bg-violet-50',   color: 'text-violet-500'   },
  'relieving-letter':   { icon: 'fa-file-circle-minus',   bg: 'bg-rose-50',     color: 'text-rose-500'     },
  'appointment-letter': { icon: 'fa-file-circle-plus',    bg: 'bg-indigo-50',   color: 'text-indigo-500'   },
}

function DocTypeIcon({ type, size = 'md' }: { type: string; size?: 'sm' | 'md' }) {
  const t = DOC_ICONS[type] ?? { icon: 'fa-file-lines', bg: 'bg-slate-50', color: 'text-slate-400' }
  const dim  = size === 'sm' ? 'w-8 h-8 rounded-lg' : 'w-9 h-9 rounded-xl'
  const icon = size === 'sm' ? 'text-[12px]' : 'text-[13px]'
  return (
    <div className={`${dim} ${t.bg} flex items-center justify-center shrink-0`}>
      <i className={`fa-solid ${t.icon} ${t.color} ${icon}`} />
    </div>
  )
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<DocumentRequestStatus, { cls: string; icon: string; label: string }> = {
  pending:     { cls: 'bg-amber-50 text-amber-600 border border-amber-100',      icon: 'fa-solid fa-clock',             label: 'Pending'              },
  approved:    { cls: 'bg-emerald-50 text-emerald-600 border border-emerald-100', icon: 'fa-solid fa-check',             label: 'Approved'             },
  hr_approved: { cls: 'bg-teal-50 text-teal-600 border border-teal-100',          icon: 'fa-solid fa-paper-plane',       label: 'Sent to Accountant'  },
  rejected:    { cls: 'bg-red-50 text-red-500 border border-red-100',             icon: 'fa-solid fa-xmark',             label: 'Rejected'             },
  generated:   { cls: 'bg-blue-50 text-blue-600 border border-blue-100',          icon: 'fa-solid fa-file-circle-check', label: 'Ready'                },
}

function StatusBadge({ status }: { status: DocumentRequestStatus }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.pending
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${s.cls}`}>
      <i className={`${s.icon} text-[9px]`} />
      {s.label}
    </span>
  )
}

// ── Card shell ────────────────────────────────────────────────────────────────

interface CardProps {
  icon: string
  iconBg: string
  iconColor: string
  title: string
  subtitle?: string
  badge?: React.ReactNode
  children: React.ReactNode
}

function Card({ icon, iconBg, iconColor, title, subtitle, badge, children }: CardProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
            <i className={`fa-solid ${icon} ${iconColor} text-[13px]`} />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-gray-800 leading-tight">{title}</p>
            {subtitle && <p className="text-[11px] text-gray-400 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {badge}
      </div>
      {children}
    </div>
  )
}

// ── Count chip ────────────────────────────────────────────────────────────────

function CountChip({ n }: { n: number }) {
  return (
    <span className="text-[11px] font-semibold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
      {n}
    </span>
  )
}

// ── Compact empty state ───────────────────────────────────────────────────────

function EmptyState({ icon, message, sub }: { icon: string; message: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3 px-5 py-8">
      <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
        <i className={`fa-solid ${icon} text-gray-300 text-[16px]`} />
      </div>
      <div>
        <p className="text-[13px] font-medium text-gray-600">{message}</p>
        {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Skeleton rows ─────────────────────────────────────────────────────────────

function SkeletonRows({ count }: { count: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-12 bg-gray-50 rounded-xl animate-pulse" />
      ))}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function EmployeeDocumentsPage() {
  const { user } = useAuthStore()
  const employeeCode = toEmployeeCode(user?.user_id)

  const {
    requests, loading: reqLoading,
  } = useMyDocumentRequests(employeeCode)

  const [genError, setGenError] = useState<string | null>(null)

  if (!user) return null

  const readyDocuments = requests.filter(r => r.status === 'generated' || (r.status === 'approved' && (r.file_url || r.file_html)))

  function buildSalarySlipUrl(req: DocumentRequest, forceDownload = false): string {
    const base = `${req.file_url}?employee_id=${encodeURIComponent(employeeCode)}`
    return forceDownload ? `${base}&force_download=true` : base
  }

  function handleView(req: DocumentRequest) {
    setGenError(null)
    if (req.document_type === 'salary-slip') {
      if (req.file_url) {
        window.open(buildSalarySlipUrl(req), '_blank')
      } else {
        setGenError('Salary slip PDF not ready yet — please check back later.')
      }
      return
    }
    // Other documents: prefer HTML preview, fall back to PDF
    if (req.file_html) { openHtmlInTab(req.file_html, docTypeLabel(req.document_type)); return }
    if (req.file_url)  { window.open(req.file_url, '_blank'); return }
    setGenError('Document not ready yet — please check back later.')
  }

  function handleDownload(req: DocumentRequest) {
    setGenError(null)
    if (!req.file_url) { setGenError('File not available for download.'); return }
    const url = req.document_type === 'salary-slip'
      ? buildSalarySlipUrl(req, true)
      : `${req.file_url}${req.file_url.includes('?') ? '&' : '?'}force_download=true`
    const a = document.createElement('a')
    a.href = url
    a.download = ''
    a.target   = '_blank'
    a.rel      = 'noreferrer'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div className="space-y-5">

      {/* ── Page header ── */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
          <i className="fa-solid fa-folder-open text-blue-600 text-[13px]" />
        </div>
        <div>
          <h1 className="text-[16px] font-bold text-gray-800">My Documents</h1>
          <p className="text-[11px] text-gray-400">View and download official documents issued by HR</p>
        </div>
      </div>

      {/* ── Guidance Banner ── */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs">
        <i className="fa-solid fa-circle-info text-blue-600 text-sm mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold text-slate-800">HR Issued Documents</p>
          <p className="text-slate-500 mt-0.5">
            Official letters (Appointment, Offer, Experience, Relieving) and certificates are generated and issued directly by HR. Once issued, your documents appear here for instant viewing and downloading.
          </p>
        </div>
      </div>

      {/* ── Issued Documents Card ── */}
      <Card
        icon="fa-file-circle-check"
        iconBg="bg-emerald-50"
        iconColor="text-emerald-600"
        title="Issued Documents"
        subtitle="Official documents issued by HR ready to view and download"
        badge={!reqLoading && readyDocuments.length > 0 ? <CountChip n={readyDocuments.length} /> : undefined}
      >
        {reqLoading ? (
          <SkeletonRows count={2} />
        ) : readyDocuments.length === 0 ? (
          <EmptyState
            icon="fa-file-circle-check"
            message="No documents issued yet"
            sub="Official documents generated and issued by HR will appear here"
          />
        ) : (
          <>
            <ul className="divide-y divide-gray-50">
              {readyDocuments.map(req => (
                <li key={req.id} className="flex items-center gap-3 px-5 py-4 hover:bg-gray-50/60 transition-colors">
                  <DocTypeIcon type={req.document_type} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-gray-800 leading-tight">
                      {docTypeLabel(req.document_type)}
                      {req.document_type === 'salary-slip' && req.requested_month && (
                        <span className="ml-1.5 text-[11px] font-normal text-gray-500">
                          — {fmtMonth(req.requested_month)}
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      Issued{' '}
                      {new Date(req.updated_at ?? req.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </p>
                  </div>
                  <StatusBadge status={req.status} />
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleView(req)}
                      className="h-9 flex items-center gap-1.5 text-[11px] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 rounded-xl transition-colors border border-blue-100"
                    >
                      <i className="fa-solid fa-arrow-up-right-from-square text-[10px]" /> View
                    </button>
                    {req.file_url && (
                      <button
                        onClick={() => handleDownload(req)}
                        className="h-9 flex items-center gap-1.5 text-[11px] font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 rounded-xl transition-colors"
                      >
                        <i className="fa-solid fa-download text-[10px]" /> Download
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {genError && (
              <div className="flex items-center gap-2 px-5 py-3 border-t border-gray-50 bg-red-50/60">
                <i className="fa-solid fa-circle-exclamation text-red-400 text-[11px] shrink-0" />
                <p className="text-[11px] text-red-500">{genError}</p>
              </div>
            )}
          </>
        )}
      </Card>

    </div>
  )
}
