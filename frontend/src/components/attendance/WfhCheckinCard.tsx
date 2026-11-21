/**
 * WfhCheckinCard — employee-facing WFH punch-in / punch-out card.
 *
 * Shown on the Employee Attendance page.
 * Supports two attendance methods:
 *   SELFIE — existing webcam selfie flow (unchanged)
 *   GEO    — new geo-location flow (validates against registered home coordinates)
 *
 * Flow:
 *   idle → method-select → [selfie: confirming → selfie-capture → done]
 *                        → [geo:   GeoCheckinFlow → done]
 */
import { useState, useCallback, useEffect } from 'react'
import { v4 as uuidv4 }          from 'uuid'
import { wfhApi }                 from '../../api/wfhApi'
import { wfhGeoApi }              from '../../api/wfhApi'
import type { WfhStatus }         from '../../api/wfhApi'
import type { GeoCheckinResult }  from '../../api/wfhApi'
import type { GeoCheckoutResult } from '../../api/wfhApi'
import type { HomeLocation }      from '../../api/wfhApi'
import WebcamCapture              from './WebcamCapture'
import type { CaptureResult }     from './WebcamCapture'
import GeoCheckinFlow             from './GeoCheckinFlow'
import GeoCheckoutFlow            from './GeoCheckoutFlow'
import SetHomeLocationModal       from './SetHomeLocationModal'

interface Props {
  employeeId:     string
  status:         WfhStatus | null
  onRefresh:      () => void
  /** When set, clicking Punch In skips method-selection and starts this method directly. */
  defaultMethod?: 'SELFIE' | 'GEO'
}

type Step =
  | 'idle'
  | 'method-select'
  | 'selfie-confirming'
  | 'selfie'
  | 'geo'
  | 'geo-checkout'
  | 'done'

function fmtTime(iso: string | undefined | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

const STATUS_LABEL: Record<string, string> = {
  PENDING_SELFIE:  'Selfie Required',
  AUTO_APPROVED:   'Approved',
  FLAGGED:         'Under Review',
  PENDING_REVIEW:  'Pending HR Review',
  APPROVED:        'Approved by HR',
  REJECTED:        'Rejected by HR',
}

const STATUS_COLOR: Record<string, string> = {
  PENDING_SELFIE:  'bg-amber-50 text-amber-600 border-amber-100',
  AUTO_APPROVED:   'bg-emerald-50 text-emerald-600 border-emerald-100',
  FLAGGED:         'bg-amber-50 text-amber-600 border-amber-100',
  PENDING_REVIEW:  'bg-amber-50 text-amber-700 border-amber-100',
  APPROVED:        'bg-emerald-50 text-emerald-700 border-emerald-100',
  REJECTED:        'bg-red-50 text-red-600 border-red-100',
}

export default function WfhCheckinCard({ employeeId, status, onRefresh, defaultMethod }: Props) {
  const [step,            setStep]            = useState<Step>('idle')
  const [wfhId,           setWfhId]           = useState<number | null>(null)
  const [isCheckingIn,    setIsCheckingIn]    = useState(false)
  const [isCheckingOut,   setIsCheckingOut]   = useState(false)
  const [isUploading,     setIsUploading]     = useState(false)
  const [uploadError,     setUploadError]     = useState<string | null>(null)
  const [actionError,     setActionError]     = useState<string | null>(null)
  const [homeLocation,    setHomeLocation]    = useState<HomeLocation | null>(null)
  const [homeFetched,     setHomeFetched]     = useState(false)
  const [showSetHome,     setShowSetHome]     = useState(false)

  const hasSession    = status?.has_session ?? false
  const isPunchedOut  = !!(status?.punch_out_at)
  const sessionStatus = status?.status ?? null
  const sessionMethod = status?.attendance_method ?? 'SELFIE'

  // ── Fetch home location once (to know if geo option is available) ────────────

  useEffect(() => {
    if (!employeeId || homeFetched) return
    wfhGeoApi.getHomeLocation(employeeId)
      .then(({ data }) => setHomeLocation(data))
      .catch(() => setHomeLocation({ found: false }))
      .finally(() => setHomeFetched(true))
  }, [employeeId, homeFetched])

  // ── Selfie: Punch-in ────────────────────────────────────────────────────────

  const handleSelfieCheckin = useCallback(async () => {
    setIsCheckingIn(true)
    setActionError(null)
    try {
      const { data } = await wfhApi.checkin(employeeId, {
        idempotency_key:  uuidv4(),
        client_timestamp: new Date().toISOString(),
      })
      if (!data.success) {
        setActionError(data.message ?? 'Check-in failed. Please try again.')
        return
      }
      setWfhId(data.wfh_id ?? null)
      setStep('selfie')
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } }; message?: string }
      const detail   = axiosErr?.response?.data?.detail
      setActionError(detail ?? 'Check-in failed. Please try again.')
    } finally {
      setIsCheckingIn(false)
    }
  }, [employeeId])

  // ── Selfie: upload ─────────────────────────────────────────────────────────

  const handleCapture = useCallback(async (result: CaptureResult) => {
    if (!wfhId) return
    setIsUploading(true)
    setUploadError(null)
    try {
      const { data } = await wfhApi.uploadSelfie(wfhId, employeeId, result.blob, {
        captureType:     'checkin',
        captureAttempts: result.attemptCount,
        cameraLabel:     result.cameraLabel,
      })
      if (!data.success) {
        setUploadError(data.message ?? 'Upload failed. Please try again.')
        return
      }
      setStep('done')
      onRefresh()
    } catch {
      setUploadError('Upload failed. Please check your connection and try again.')
    } finally {
      setIsUploading(false)
    }
  }, [wfhId, employeeId, onRefresh])

  const handleSkipSelfie = useCallback(() => {
    setStep('done')
    onRefresh()
  }, [onRefresh])

  // ── Geo check-in: success callback ────────────────────────────────────────

  const handleGeoSuccess = useCallback((_result: GeoCheckinResult) => {
    setStep('done')
    onRefresh()
  }, [onRefresh])

  // ── Geo punch-out: success callback ───────────────────────────────────────

  const handleGeoCheckoutSuccess = useCallback((_result: GeoCheckoutResult) => {
    setStep('done')
    onRefresh()
  }, [onRefresh])

  // ── Selfie punch-out ────────────────────────────────────────────────────────

  const handlePunchOut = useCallback(async () => {
    setIsCheckingOut(true)
    setActionError(null)
    try {
      const { data } = await wfhApi.checkout(employeeId)
      if (!data.success) {
        setActionError('Punch-out failed. Please try again.')
        return
      }
      onRefresh()
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } }; message?: string }
      setActionError(axiosErr?.response?.data?.detail ?? 'Punch-out failed. Please try again.')
    } finally {
      setIsCheckingOut(false)
    }
  }, [employeeId, onRefresh])

  // ── Shared button classes ───────────────────────────────────────────────────

  const btnPrimary = 'flex items-center justify-center gap-2 h-10 px-5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-[13px] font-semibold rounded-xl transition-colors w-full'
  const btnRed     = 'flex items-center justify-center gap-2 h-10 px-5 bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white text-[13px] font-semibold rounded-xl transition-colors w-full'

  // ── Render: selfie capture step ─────────────────────────────────────────────

  if (step === 'selfie') {
    return (

      
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
            <i className="fa-solid fa-camera text-indigo-600 text-[13px]" />
          </div>
          <div>
            <p className="text-[14px] font-bold text-gray-800">Selfie for Attendance Evidence</p>
            <p className="text-[11px] text-gray-400">Required to complete WFH check-in</p>
          </div>
        </div>
        <WebcamCapture
          onCapture={handleCapture}
          onSkip={handleSkipSelfie}
          isUploading={isUploading}
          uploadError={uploadError}
        />
      </div>
    )
  }

  // ── Render: geo check-in step ───────────────────────────────────────────────

  if (step === 'geo') {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
            <i className="fa-solid fa-location-dot text-indigo-600 text-[13px]" />
          </div>
          <div>
            <p className="text-[14px] font-bold text-gray-800">Geo Punch In</p>
            <p className="text-[11px] text-gray-400">Verify you're at home to start attendance</p>
          </div>
        </div>
        <GeoCheckinFlow
          employeeId={employeeId}
          onSuccess={handleGeoSuccess}
          onBack={() => setStep('method-select')}
        />
      </div>
    )
  }

  // ── Render: geo punch-out step ───────────────────────────────────────────────

  if (step === 'geo-checkout') {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
            <i className="fa-solid fa-location-dot text-red-500 text-[13px]" />
          </div>
          <div>
            <p className="text-[14px] font-bold text-gray-800">Geo Punch Out</p>
            <p className="text-[11px] text-gray-400">Verify you're at home to close attendance</p>
          </div>
        </div>
        <GeoCheckoutFlow
          employeeId={employeeId}
          onSuccess={handleGeoCheckoutSuccess}
          onBack={() => setStep('done')}
        />
      </div>
    )
  }

  // ── Render: session already exists (done / has_session) ────────────────────

  if (step === 'done' || hasSession) {
    const sts = sessionStatus ?? 'AUTO_APPROVED'
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
              <i className="fa-solid fa-house-laptop text-indigo-600 text-[13px]" />
            </div>
            <p className="text-[14px] font-bold text-gray-800">WFH Attendance</p>
          </div>
          <div className="flex items-center gap-2">
            {/* method badge */}
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-gray-50 text-gray-500 border-gray-100">
              {sessionMethod === 'GEO' ? (
                <><i className="fa-solid fa-location-dot mr-1" />Geo</>
              ) : (
                <><i className="fa-solid fa-camera mr-1" />Selfie</>
              )}
            </span>
            <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${STATUS_COLOR[sts] ?? 'bg-gray-50 text-gray-500 border-gray-100'}`}>
              {STATUS_LABEL[sts] ?? sts}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-gray-50 rounded-xl px-4 py-3">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Punch In</p>
            <p className="text-[16px] font-bold text-gray-800 mt-0.5">{fmtTime(status?.punch_in_at)}</p>
          </div>
          <div className="bg-gray-50 rounded-xl px-4 py-3">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Punch Out</p>
            <p className="text-[16px] font-bold text-gray-800 mt-0.5">{fmtTime(status?.punch_out_at)}</p>
          </div>
        </div>

        {/* Dynamic status message */}
        {sessionMethod === 'GEO' && (
          <div className={`flex items-start gap-2 mb-4 px-3 py-2.5 rounded-xl text-[12px] ${
            isPunchedOut
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
              : 'bg-amber-50 text-amber-700 border border-amber-100'
          }`}>
            <i className={`fa-solid mt-0.5 shrink-0 ${isPunchedOut ? 'fa-circle-check' : 'fa-circle-info'}`} />
            {isPunchedOut
              ? 'Geo Attendance Completed Successfully.'
              : 'Geo Check-In Completed. Please Punch Out before ending your workday.'}
          </div>
        )}

        {/* Geo distance badge */}
        {sessionMethod === 'GEO' && status?.geo_distance_meters != null && (
          <div className="flex items-center gap-2 mb-4 text-[12px] text-emerald-600">
            <i className="fa-solid fa-location-dot" />
            Geo verified — {Math.round(status.geo_distance_meters)} m from home
          </div>
        )}

        {/* Selfie captured badge */}
        {sessionMethod === 'SELFIE' && status?.selfie_captured && (
          <div className="flex items-center gap-2 mb-4 text-[12px] text-emerald-600">
            <i className="fa-solid fa-circle-check" />
            Selfie evidence captured
          </div>
        )}

        {actionError && (
          <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2 mb-3">
            <p className="text-[12px] text-red-600">{actionError}</p>
          </div>
        )}

        {/* Punch-out button — Geo sessions get geo-validated checkout; Selfie sessions use plain checkout */}
        {!isPunchedOut && sessionMethod === 'GEO' && (
          <button onClick={() => { setActionError(null); setStep('geo-checkout') }} className={btnRed}>
            <i className="fa-solid fa-location-dot text-[12px]" /> Geo Punch Out
          </button>
        )}

        {!isPunchedOut && sessionMethod !== 'GEO' && (
          <button onClick={handlePunchOut} disabled={isCheckingOut} className={btnRed}>
            {isCheckingOut
              ? <><i className="fa-solid fa-circle-notch animate-spin text-[11px]" /> Punching Out…</>
              : <><i className="fa-solid fa-right-from-bracket text-[12px]" /> Punch Out</>
            }
          </button>
        )}
      </div>
    )
  }

  // ── Render: method selection ────────────────────────────────────────────────

  if (step === 'method-select') {
    const hasHome = homeLocation?.found === true
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
            <i className="fa-solid fa-house-laptop text-indigo-600 text-[13px]" />
          </div>
          <div>
            <p className="text-[14px] font-bold text-gray-800">Choose Attendance Method</p>
            <p className="text-[11px] text-gray-400">Select how you want to mark today's WFH attendance</p>
          </div>
        </div>

        {actionError && (
          <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2 mb-3">
            <p className="text-[12px] text-red-600">{actionError}</p>
          </div>
        )}

        <div className="space-y-3">
          {/* Selfie option */}
          <button
            onClick={handleSelfieCheckin}
            disabled={isCheckingIn}
            className="w-full flex items-center gap-4 p-4 border-2 border-indigo-100 hover:border-indigo-300 hover:bg-indigo-50 rounded-xl transition-colors text-left disabled:opacity-60"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
              {isCheckingIn
                ? <i className="fa-solid fa-circle-notch animate-spin text-indigo-600" />
                : <i className="fa-solid fa-camera text-indigo-600" />
              }
            </div>
            <div>
              <p className="text-[13px] font-semibold text-gray-800">Selfie Attendance</p>
              <p className="text-[11px] text-gray-400">Capture a webcam photo as attendance evidence</p>
            </div>
          </button>

          {/* Geo option */}
          {hasHome ? (
            <button
              onClick={() => setStep('geo')}
              className="w-full flex items-center gap-4 p-4 border-2 border-emerald-100 hover:border-emerald-300 hover:bg-emerald-50 rounded-xl transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                <i className="fa-solid fa-location-dot text-emerald-600" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-gray-800">Geo Attendance</p>
                <p className="text-[11px] text-gray-400">
                  Share your GPS location — auto-approved if you're within {' '}
                  the allowed radius of your home address
                </p>
              </div>
            </button>
          ) : (
            <div className="w-full flex items-center gap-4 p-4 border-2 border-gray-100 bg-gray-50 rounded-xl">
              <div className="w-10 h-10 rounded-xl bg-gray-200 flex items-center justify-center shrink-0">
                <i className="fa-solid fa-location-dot text-gray-400" />
              </div>
              <div className="flex-1">
                <p className="text-[13px] font-semibold text-gray-500">Geo Attendance</p>
                <p className="text-[11px] text-gray-400">
                  Home location not set.{' '}
                  <button
                    onClick={() => setShowSetHome(true)}
                    className="text-indigo-600 underline font-medium"
                  >
                    Set it now
                  </button>
                  {' '}to enable this option.
                </p>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => setStep('idle')}
          className="mt-3 w-full text-[12px] text-gray-400 hover:text-gray-600 py-1 transition-colors"
        >
          Cancel
        </button>

        {/* Set home location modal */}
        {showSetHome && (
          <SetHomeLocationModal
            employeeId={employeeId}
            existingLabel={null}
            onSaved={() => {
              setShowSetHome(false)
              setHomeFetched(false)  // trigger re-fetch
            }}
            onClose={() => setShowSetHome(false)}
          />
        )}
      </div>
    )
  }

  // ── Render: idle (no session, initial state) ────────────────────────────────

  function handlePunchInClick() {
    if (defaultMethod === 'SELFIE') {
      handleSelfieCheckin()
    } else if (defaultMethod === 'GEO') {
      setStep('geo')
    } else {
      setStep('method-select')
    }
  }

  const methodHint =
    defaultMethod === 'SELFIE' ? 'Webcam selfie required after punch-in.'
    : defaultMethod === 'GEO'  ? 'Your GPS location will be verified against your home address.'
    : 'Choose between selfie or geo-location attendance after clicking.'

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
          <i className="fa-solid fa-house-laptop text-indigo-600 text-[13px]" />
        </div>
        <div>
          <p className="text-[14px] font-bold text-gray-800">Work From Home</p>
          <p className="text-[11px] text-gray-400">Not punched in today</p>
        </div>
      </div>

      {actionError && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2 mb-3">
          <p className="text-[12px] text-red-600">{actionError}</p>
        </div>
      )}

      <button onClick={handlePunchInClick} disabled={isCheckingIn} className={btnPrimary}>
        {isCheckingIn
          ? <><i className="fa-solid fa-circle-notch animate-spin text-[11px]" /> Starting…</>
          : <><i className="fa-solid fa-right-to-bracket text-[12px]" /> WFH Punch In</>
        }
      </button>

      <p className="text-[10px] text-gray-400 text-center mt-2">{methodHint}</p>
    </div>
  )
}
