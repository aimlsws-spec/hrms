/**
 * SelfieViewerModal — HR-only lightbox for reviewing a WFH attendance selfie.
 *
 * Privacy design:
 *   - Image is fetched via authenticated API call (not a plain <img src> tag).
 *   - The raw storage path is never exposed to the client.
 *   - The image is loaded into an object URL and revoked on modal close.
 *   - No download button — HR sees the image in context only.
 *   - Every open triggers an audit log entry on the backend (GET /api/wfh/selfie/:id).
 */
import { useEffect, useState, useCallback, useRef } from 'react'

interface Props {
  selfieId:       number
  reviewerUserId: string
  employeeName:   string
  capturedAt:     string
  wfhStatus:      string
  onClose:        () => void
  onApprove:      (comment: string) => Promise<void>
  onReject:       (comment: string) => Promise<void>
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const STATUS_LABEL: Record<string, string> = {
  PENDING_SELFIE:  'Selfie Required',
  AUTO_APPROVED:   'Auto Approved',
  FLAGGED:         'Flagged',
  PENDING_REVIEW:  'Pending Review',
  APPROVED:        'Approved',
  REJECTED:        'Rejected',
}

export default function SelfieViewerModal({
  selfieId, reviewerUserId, employeeName, capturedAt, wfhStatus,
  onClose, onApprove, onReject,
}: Props) {
  const [imageUrl,    setImageUrl]    = useState<string | null>(null)
  const [imgLoading,  setImgLoading]  = useState(true)
  const [imgError,    setImgError]    = useState<string | null>(null)
  const [comment,     setComment]     = useState('')
  const [submitting,  setSubmitting]  = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [blurred,     setBlurred]     = useState(true)  // blurred until HR clicks Reveal
  const objectUrlRef  = useRef<string | null>(null)

  // Fetch and decode the selfie image via authenticated API call
  useEffect(() => {
    let cancelled = false

    async function load() {
      setImgLoading(true)
      setImgError(null)
      try {
        const raw = localStorage.getItem('hrms_user')
        let token = ''
        if (raw) {
          const parsed = JSON.parse(raw)
          token = parsed?.token ?? parsed?.user?.token ?? parsed?.state?.user?.token ?? ''
        }

        const resp = await fetch(
          `/api/wfh/selfie/${selfieId}?reviewer_user_id=${encodeURIComponent(reviewerUserId)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        )

        if (!resp.ok) {
          const msg = resp.status === 404 ? 'Selfie not found.'
            : resp.status === 410 ? 'Selfie has been deleted (retention policy).'
            : resp.status === 403 ? 'Access denied.'
            : `Server error (${resp.status}).`
          throw new Error(msg)
        }

        const blob = await resp.blob()
        if (cancelled) return

        const url = URL.createObjectURL(blob)
        objectUrlRef.current = url
        setImageUrl(url)
      } catch (err: unknown) {
        if (!cancelled) {
          setImgError(err instanceof Error ? err.message : 'Could not load selfie.')
        }
      } finally {
        if (!cancelled) setImgLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
      // Revoke object URL on cleanup to free memory
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
    }
  }, [selfieId])

  // Close on Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleAction = useCallback(async (action: 'approve' | 'reject') => {
    if (!comment.trim()) { setActionError('A comment is required before approving or rejecting.'); return }
    setSubmitting(true)
    setActionError(null)
    try {
      if (action === 'approve') await onApprove(comment.trim())
      else                      await onReject(comment.trim())
      onClose()
    } catch {
      setActionError('Action failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }, [comment, onApprove, onReject, onClose])

  const alreadyDecided = wfhStatus === 'APPROVED' || wfhStatus === 'REJECTED'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      role="dialog"
      aria-modal="true"
      aria-label={`Selfie review — ${employeeName}`}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="text-[14px] font-bold text-gray-900">{employeeName}</p>
            <p className="text-[11px] text-gray-400">{fmtDateTime(capturedAt)}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {STATUS_LABEL[wfhStatus] ?? wfhStatus}
            </span>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
              aria-label="Close"
            >
              <i className="fa-solid fa-xmark text-gray-600 text-[12px]" />
            </button>
          </div>
        </div>

        {/* Compliance notice */}
        <div className="mx-5 mt-4 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5">
          <p className="text-[11px] text-slate-500 leading-relaxed">
            <i className="fa-solid fa-shield-halved mr-1.5 text-slate-400" />
            This selfie is attendance evidence only — not biometric identification.
            Your access to this image is logged for compliance.
          </p>
        </div>

        {/* Image area */}
        <div className="px-5 pt-4">
          {imgLoading && (
            <div className="aspect-video rounded-xl bg-gray-100 animate-pulse flex items-center justify-center">
              <p className="text-[12px] text-gray-400">Loading image…</p>
            </div>
          )}
          {imgError && (
            <div className="aspect-video rounded-xl bg-red-50 border border-red-100 flex items-center justify-center">
              <div className="text-center px-4">
                <i className="fa-solid fa-circle-exclamation text-red-300 text-2xl mb-2" />
                <p className="text-[12px] text-red-500">{imgError}</p>
              </div>
            </div>
          )}
          {imageUrl && !imgError && (
            <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
              <img
                src={imageUrl}
                alt={`Attendance selfie — ${employeeName}`}
                className={`w-full h-full object-contain transition-all duration-300 ${blurred ? 'blur-xl' : ''}`}
              />
              {blurred && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <button
                    onClick={() => setBlurred(false)}
                    className="flex items-center gap-2 bg-white/90 hover:bg-white text-gray-800 text-[13px] font-semibold px-4 py-2 rounded-xl shadow-lg transition-colors"
                  >
                    <i className="fa-solid fa-eye text-[12px]" />
                    Reveal Selfie
                  </button>
                </div>
              )}
              {!blurred && (
                <button
                  onClick={() => setBlurred(true)}
                  className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white text-[11px] px-2.5 py-1 rounded-lg transition-colors"
                >
                  <i className="fa-solid fa-eye-slash mr-1" /> Hide
                </button>
              )}
            </div>
          )}
        </div>

        {/* HR Action panel */}
        <div className="px-5 pt-4 pb-5 space-y-3">
          {alreadyDecided ? (
            <div className={`rounded-xl px-4 py-3 text-[13px] font-semibold ${
              wfhStatus === 'APPROVED'
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-red-50 text-red-600'
            }`}>
              <i className={`fa-solid mr-1.5 ${wfhStatus === 'APPROVED' ? 'fa-circle-check' : 'fa-circle-xmark'}`} />
              This attendance record has already been {wfhStatus === 'APPROVED' ? 'approved' : 'rejected'}.
            </div>
          ) : (
            <>
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1.5">
                  HR Comment <span className="text-red-500">*</span>
                  <span className="font-normal text-gray-400 ml-1">(required to approve or reject)</span>
                </label>
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="Add your review notes here…"
                  rows={2}
                  maxLength={500}
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl text-[12px] text-gray-800 bg-slate-50 focus:outline-none focus:border-indigo-400 resize-none transition-colors"
                />
              </div>

              {actionError && (
                <p className="text-[12px] text-red-600 flex items-center gap-1.5">
                  <i className="fa-solid fa-circle-exclamation text-[11px]" />
                  {actionError}
                </p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => handleAction('approve')}
                  disabled={submitting || imgLoading}
                  className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-[13px] font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {submitting
                    ? <i className="fa-solid fa-circle-notch animate-spin text-[11px]" />
                    : <i className="fa-solid fa-check text-[12px]" />
                  }
                  Approve
                </button>
                <button
                  onClick={() => handleAction('reject')}
                  disabled={submitting || imgLoading}
                  className="flex-1 h-10 bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white text-[13px] font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-xmark text-[12px]" />
                  Reject
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
