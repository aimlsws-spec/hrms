/**
 * AttendancePunchCard — punch in / punch out for every employee (office and home).
 *
 * Location AND selfie are both mandatory:
 *   Step 1  Location check  (office for WFO, registered home for WFH)  → POST /wfh/geo-checkin
 *   Step 2  Selfie capture                                            → POST /wfh/selfie/upload
 * Attendance counts only after step 2. If the page is closed between the steps, the card
 * resumes at the selfie step (session status PENDING_SELFIE).
 * Punch out re-verifies location.
 */
import { useCallback, useEffect, useState } from 'react'
import { wfhApi, wfhGeoApi }      from '../../api/wfhApi'
import type { WfhStatus, HomeLocation } from '../../api/wfhApi'
import WebcamCapture              from './WebcamCapture'
import type { CaptureResult }     from './WebcamCapture'
import GeoCheckinFlow             from './GeoCheckinFlow'
import GeoCheckoutFlow            from './GeoCheckoutFlow'
import SetHomeLocationModal       from './SetHomeLocationModal'
import WorkTimerPanel             from './WorkTimerPanel'
import { isMobileDevice }         from '../../utils/device'

interface Props {
  employeeId: string
  isWFO:      boolean
  status:     WfhStatus | null
  onRefresh:  () => void
}

type Step = 'idle' | 'location' | 'checkout'

function fmtTime(iso: string | undefined | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

const STATUS_LABEL: Record<string, string> = {
  AUTO_APPROVED: 'Approved', APPROVED: 'Approved by HR', FLAGGED: 'Under Review',
  PENDING_REVIEW: 'Pending HR Review', REJECTED: 'Rejected by HR', PENDING_SELFIE: 'Selfie Required',
}

function StepPills({ locationDone, selfieDone }: { locationDone: boolean; selfieDone: boolean }) {
  const pill = (done: boolean, n: number, label: string) => (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[12px] font-semibold ${
      done ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-gray-50 text-gray-500 border-gray-100'
    }`}>
      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${done ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
        {done ? <i className="fa-solid fa-check" /> : n}
      </span>
      {label}
    </div>
  )
  return (
    <div className="flex flex-wrap gap-2">
      {pill(locationDone, 1, 'Location')}
      {pill(selfieDone,   2, 'Selfie')}
    </div>
  )
}

export default function AttendancePunchCard({ employeeId, isWFO, status, onRefresh }: Props) {
  const [step,         setStep]         = useState<Step>('idle')
  const [isUploading,  setIsUploading]  = useState(false)
  const [uploadError,  setUploadError]  = useState<string | null>(null)
  const [homeLocation, setHomeLocation] = useState<HomeLocation | null>(null)
  const [homeFetched,  setHomeFetched]  = useState(isWFO)   // office staff do not need a home location
  const [showSetHome,  setShowSetHome]  = useState(false)

  const place         = isWFO ? 'the office' : 'home'
  const hasSession    = status?.has_session ?? false
  const sessionStatus = status?.status ?? null
  const pendingSelfie = hasSession && sessionStatus === 'PENDING_SELFIE' && !status?.selfie_captured
  const isPunchedOut  = !!status?.punch_out_at

  useEffect(() => {
    if (isWFO || homeFetched || !employeeId) return
    wfhGeoApi.getHomeLocation(employeeId)
      .then(({ data }) => setHomeLocation(data))
      .catch(() => setHomeLocation({ found: false }))
      .finally(() => setHomeFetched(true))
  }, [employeeId, isWFO, homeFetched])

  const handleCapture = useCallback(async (result: CaptureResult): Promise<boolean> => {
    if (!status?.wfh_id) {
      setUploadError('Location check not found. Please start punch-in again.')
      return false
    }
    setIsUploading(true)
    setUploadError(null)
    try {
      const { data } = await wfhApi.uploadSelfie(status.wfh_id, employeeId, result.blob, {
        captureType:     'checkin',
        captureAttempts: result.attemptCount,
        cameraLabel:     result.cameraLabel,
      })
      if (!data.success) {
        setUploadError(data.message ?? 'Upload failed. Please try again.')
        return false
      }
      onRefresh()
      return true
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setUploadError(detail ?? 'Upload failed. Please check your connection and try again.')
      return false
    } finally {
      setIsUploading(false)
    }
  }, [status?.wfh_id, employeeId, onRefresh])

  if (isMobileDevice()) {
    return (
      <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-5 space-y-2">
        <p className="text-[14px] font-bold text-amber-800"><i className="fa-solid fa-laptop mr-2" />Use a computer to mark attendance</p>
        <p className="text-[12px] text-amber-700 leading-relaxed">
          Check-in, check-out and breaks are not allowed from mobile phones or mobile browsers.
          Please open the HRMS on your office or home computer.
        </p>
      </div>
    )
  }

  const btnPrimary = 'flex items-center justify-center gap-2 h-10 px-5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-[13px] font-semibold rounded-xl transition-colors w-full'
  const btnRed     = 'flex items-center justify-center gap-2 h-10 px-5 bg-red-500 hover:bg-red-600 text-white text-[13px] font-semibold rounded-xl transition-colors w-full'
  const shell      = 'rounded-xl border border-gray-100 bg-slate-50/60 p-5 space-y-4'

  // ── Step 2: selfie (also the resume point) ───────────────────────────────────
  if (pendingSelfie) {
    return (
      <div className={shell}>
        <StepPills locationDone selfieDone={false} />
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-[12px] bg-emerald-50 text-emerald-700 border border-emerald-100">
          <i className="fa-solid fa-location-dot shrink-0" />
          Location verified
          {status?.geo_distance_meters != null && <> — {Math.round(status.geo_distance_meters)} m from {place}</>}.
          Your attendance is recorded after the selfie.
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
            <i className="fa-solid fa-camera text-indigo-600 text-[13px]" />
          </div>
          <div>
            <p className="text-[14px] font-bold text-gray-800">Step 2 of 2 — Take your selfie</p>
            <p className="text-[11px] text-gray-400">Required to complete punch-in</p>
          </div>
        </div>
        <WebcamCapture onCapture={handleCapture} isUploading={isUploading} uploadError={uploadError} />
      </div>
    )
  }

  // ── Punched in (location + selfie done) ──────────────────────────────────────
  if (hasSession) {
    if (step === 'checkout') {
      return (
        <div className={shell}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
              <i className="fa-solid fa-location-dot text-red-500 text-[13px]" />
            </div>
            <div>
              <p className="text-[14px] font-bold text-gray-800">Punch Out</p>
              <p className="text-[11px] text-gray-400">Capture your current location to close attendance</p>
            </div>
          </div>
          <GeoCheckoutFlow
            employeeId={employeeId}
            isWFO={isWFO}
            onSuccess={() => { setStep('idle'); onRefresh() }}
            onBack={() => setStep('idle')}
          />
        </div>
      )
    }
    const sts = sessionStatus ?? 'AUTO_APPROVED'
    return (
      <div className={shell}>
        <StepPills locationDone selfieDone />
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-[14px] font-bold text-gray-800">Attendance Recorded</p>
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-100">
            {STATUS_LABEL[sts] ?? sts}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl px-4 py-3 border border-gray-100">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Punch In</p>
            <p className="text-[16px] font-bold text-gray-800 mt-0.5">{fmtTime(status?.punch_in_at)}</p>
          </div>
          <div className="bg-white rounded-xl px-4 py-3 border border-gray-100">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Punch Out</p>
            <p className="text-[16px] font-bold text-gray-800 mt-0.5">{fmtTime(status?.punch_out_at)}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-emerald-600">
          <span><i className="fa-solid fa-location-dot mr-1.5" />
            Location verified{status?.geo_distance_meters != null && <> — {Math.round(status.geo_distance_meters)} m from {place}</>}
          </span>
          <span><i className="fa-solid fa-camera mr-1.5" />Selfie captured</span>
        </div>
        <WorkTimerPanel employeeId={employeeId} onChanged={onRefresh} refreshKey={status?.punch_out_at ?? ''} />
        {isPunchedOut ? (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-[12px] bg-emerald-50 text-emerald-700 border border-emerald-100">
            <i className="fa-solid fa-circle-check mt-0.5 shrink-0" />
            Attendance completed for today.
          </div>
        ) : (
          <button onClick={() => setStep('checkout')} className={btnRed}>
            <i className="fa-solid fa-location-dot text-[12px]" /> Punch Out
          </button>
        )}
      </div>
    )
  }

  // ── Step 1: location ─────────────────────────────────────────────────────────
  if (step === 'location') {
    return (
      <div className={shell}>
        <StepPills locationDone={false} selfieDone={false} />
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
            <i className="fa-solid fa-location-dot text-indigo-600 text-[13px]" />
          </div>
          <div>
            <p className="text-[14px] font-bold text-gray-800">Step 1 of 2 — Capture your location</p>
            <p className="text-[11px] text-gray-400">Flexible attendance — punch in from any location</p>
          </div>
        </div>
        <GeoCheckinFlow
          employeeId={employeeId}
          isWFO={isWFO}
          onSuccess={() => { setStep('idle'); onRefresh() }}
          onBack={() => setStep('idle')}
        />
      </div>
    )
  }

  // ── Not punched in (Flexible attendance) ───────────────────────────
  return (
    <div className={shell}>
      <StepPills locationDone={false} selfieDone={false} />
      <div>
        <p className="text-[14px] font-bold text-gray-800">Flexible Attendance</p>
        <p className="text-[11px] text-gray-400">Not punched in today</p>
      </div>
      <p className="text-[12px] text-gray-500 leading-relaxed">
        Flexible attendance is enabled: you can punch in and punch out from any location.
        Capture your current location and take a quick selfie to complete check-in.
      </p>
      <button onClick={() => setStep('location')} className={btnPrimary}>
        <i className="fa-solid fa-right-to-bracket text-[12px]" /> Punch In
      </button>
    </div>
  )
}
