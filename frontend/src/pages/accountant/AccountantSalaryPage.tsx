import { useState, useEffect, useCallback } from 'react'
import { documentsApi }                      from '../../api/documents'
import type { DocumentRequest }              from '../../types/document'

// ── helpers ──────────────────────────────────────────────────────────────────

function openHtmlInTab(html: string, title: string) {
  const blob = new Blob([html], { type: 'text/html' })
  const url  = URL.createObjectURL(blob)
  const tab  = window.open(url, '_blank', 'width=960,height=700')
  if (tab) tab.document.title = title
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

function formatMonth(yyyyMM?: string | null): string {
  if (!yyyyMM) return '—'
  try {
    const [y, m] = yyyyMM.split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  } catch {
    return yyyyMM
  }
}

// ── status badge ─────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  pending:     'bg-amber-50 text-amber-600',
  approved:    'bg-emerald-50 text-emerald-600',
  hr_approved: 'bg-teal-50 text-teal-600',
  rejected:    'bg-red-50 text-red-500',
  generated:   'bg-blue-50 text-blue-600',
}

const STATUS_LABELS: Record<string, string> = {
  pending:     'Pending',
  approved:    'Approved',
  hr_approved: 'HR Approved',
  rejected:    'Rejected',
  generated:   'Generated',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${STATUS_COLORS[status] ?? 'bg-gray-50 text-gray-500'}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

// ── hook ─────────────────────────────────────────────────────────────────────

function useAccountantRequests() {
  const [requests, setRequests] = useState<DocumentRequest[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await documentsApi.getAccountantRequests()
      setRequests(data.requests ?? [])
    } catch {
      setError('Failed to load salary slip requests')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { requests, loading, error, refetch: fetch, setRequests }
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function AccountantSalaryPage() {
  const { requests, loading, error, refetch, setRequests } = useAccountantRequests()

  const [generatingId, setGeneratingId] = useState<number | null>(null)
  const [genError,     setGenError]     = useState<string | null>(null)

  async function handleGenerate(req: DocumentRequest) {
    setGeneratingId(req.id)
    setGenError(null)
    try {
      const { data } = await documentsApi.accountantGenerate(req.id)
      if (!data.success) {
        setGenError(data.message ?? 'Generation failed')
        return
      }
      const fileUrl: string | undefined = data.request?.file_url
      // Update local state — mark as generated with PDF url
      setRequests(prev =>
        prev.map(r =>
          r.id === req.id
            ? { ...r, status: 'generated' as const, file_url: fileUrl, file_html: undefined }
            : r
        )
      )
      // Open the generated PDF directly
      if (fileUrl) {
        const url = fileUrl.includes('salary_slip')
          ? `${fileUrl}?employee_id=${encodeURIComponent(req.employee_id)}`
          : fileUrl
        window.open(url, '_blank')
      }
    } catch (err: unknown) {
      const isTimeout =
        err != null &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code?: string }).code === 'ECONNABORTED'
      setGenError(
        isTimeout
          ? 'Generation timed out — PDF is still being created. Click Refresh in a moment to see the result.'
          : 'Failed to generate salary slip'
      )
    } finally {
      setGeneratingId(null)
    }
  }

  function handleView(req: DocumentRequest) {
    if (req.file_url) {
      const url = req.file_url.includes('salary_slip')
        ? `${req.file_url}?employee_id=${encodeURIComponent(req.employee_id)}`
        : req.file_url
      window.open(url, '_blank')
    } else if (req.file_html) {
      openHtmlInTab(req.file_html, `Salary Slip — ${req.employee_name ?? req.employee_id}`)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Salary Slip Requests</h1>
          <p className="text-sm text-gray-500 mt-1">
            Generate salary slips for requests forwarded by HR
          </p>
        </div>
        <button
          onClick={refetch}
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
        >
          <i className="fas fa-rotate-right text-[11px]" /> Refresh
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-2 p-5">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-gray-50 rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="flex flex-col items-center py-10 text-center">
            <i className="fa-solid fa-circle-exclamation text-red-300 text-2xl mb-2" />
            <p className="text-[13px] text-gray-500">{error}</p>
            <button onClick={refetch} className="mt-3 text-[12px] text-indigo-600 font-semibold hover:underline">
              Retry
            </button>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && requests.length === 0 && (
          <div className="flex flex-col items-center py-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mb-3">
              <i className="fa-solid fa-file-invoice-dollar text-gray-300 text-xl" />
            </div>
            <p className="text-[13px] font-medium text-gray-500">No salary slip requests</p>
            <p className="text-[11px] text-gray-400 mt-1">
              Requests approved &amp; forwarded by HR will appear here
            </p>
          </div>
        )}

        {/* Table */}
        {!loading && !error && requests.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500 px-4 py-3">
                    Employee
                  </th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500 px-4 py-3">
                    Requested Month
                  </th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500 px-4 py-3">
                    Request Date
                  </th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500 px-4 py-3">
                    HR Status
                  </th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500 px-4 py-3">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {requests.map(req => (
                  <tr key={req.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-gray-800 leading-tight">{req.employee_name ?? req.employee_id}</p>
                      <p className="text-[10px] text-gray-400 font-mono">{req.employee_id}</p>
                    </td>
                    <td className="px-4 py-3.5 text-gray-600">
                      {formatMonth(req.requested_month)}
                    </td>
                    <td className="px-4 py-3.5 text-gray-400 whitespace-nowrap">
                      {new Date(req.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={req.status} />
                      {req.hr_approved_by && (
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          by {req.hr_approved_by}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      {(req.status === 'hr_approved' || req.status === 'approved') && (
                        <button
                          onClick={() => handleGenerate(req)}
                          disabled={generatingId === req.id}
                          className="flex items-center gap-1.5 text-[11px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          {generatingId === req.id ? (
                            <><i className="fa-solid fa-circle-notch animate-spin text-[10px]" /> Generating…</>
                          ) : (
                            <><i className="fa-solid fa-bolt text-[10px]" /> Generate Salary Slip</>
                          )}
                        </button>
                      )}

                      {req.status === 'generated' && (
                        <button
                          onClick={() => handleView(req)}
                          disabled={!req.file_html && !req.file_url}
                          className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-40 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          <i className="fa-solid fa-arrow-up-right-from-square text-[10px]" />
                          View / Download
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {genError && (
              <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-100 bg-red-50/60">
                <i className="fa-solid fa-circle-exclamation text-red-400 text-[11px] shrink-0" />
                <p className="text-[11px] text-red-500">{genError}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
