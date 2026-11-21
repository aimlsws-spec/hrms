/**
 * GeoCheckoutFlow — employee-facing geo punch-out component.
 *
 * Identical structure and styling to GeoCheckinFlow.
 * Stages:
 *   idle       → employee clicks "Share My Location"
 *   locating   → browser Geolocation API in progress
 *   confirming → show detected coordinates, ask to confirm
 *   submitting → posting to /api/wfh/geo-checkout
 *   done       → punch-out recorded (auto-approved, shows duration)
 *   error      → outside radius or GPS/permission/network failure
 */
import { useState, useCallback } from 'react'
import { wfhGeoApi }              from '../../api/wfhApi'
import type { GeoCheckoutResult } from '../../api/wfhApi'

interface Props {
  /** WFO employees are checked against the office location instead of home */
  isWFO?: boolean
  employeeId: string
  onSuccess:  (result: GeoCheckoutResult) => void
  onBack:     () => void
}

type Stage = 'idle' | 'locating' | 'confirming' | 'submitting' | 'done' | 'error'

interface Coords {
  latitude:  number
  longitude: number
  accuracy:  number
}

function fmtDuration(minutes: number | undefined | null): string {
  if (minutes == null) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export default function GeoCheckoutFlow({ employeeId, onSuccess, onBack, isWFO = false }: Props) {
  const [stage,    setStage]    = useState<Stage>('idle')
  const [coords,   setCoords]   = useState<Coords | null>(null)
  const [result,   setResult]   = useState<GeoCheckoutResult | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // ── Get location ────────────────────────────────────────────────────────────

  const handleGetLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setErrorMsg('Your browser does not support geolocation. Please use selfie attendance instead.')
      setStage('error')
      return
    }
    setStage('locating')
    setErrorMsg(null)

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          latitude:  pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy:  Math.round(pos.coords.accuracy),
        })
        setStage('confirming')
      },
      (err) => {
        let msg = 'Could not get your location. '
        if (err.code === err.PERMISSION_DENIED) {
          msg += 'Location access was denied. Please allow location access in your browser settings and try again.'
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg += 'Location information is unavailable. Please check your device GPS and try again.'
        } else {
          msg += 'Location request timed out. Please try again or use selfie attendance.'
        }
        setErrorMsg(msg)
        setStage('error')
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 }
    )
  }, [])

  // ── Submit geo punch-out ─────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (!coords) return
    setStage('submitting')
    setErrorMsg(null)
    try {
      const { data } = await wfhGeoApi.geoCheckout({
        employee_id:      employeeId,
        latitude:         coords.latitude,
        longitude:        coords.longitude,
        client_timestamp: new Date().toISOString(),
      })
      setResult(data)
      if (data.success) {
        setStage('done')
        onSuccess(data)
      } else {
        setErrorMsg(data.message ?? 'Location validation failed.')
        setStage('error')
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } }; message?: string }
      const detail   = axiosErr?.response?.data?.detail
      if (detail) {
        setErrorMsg(detail)
      } else if (axiosErr?.message?.includes('Network') || axiosErr?.message?.includes('net::')) {
        setErrorMsg('Network error. Please check your internet connection and try again.')
      } else {
        setErrorMsg('Punch-out failed. Please try again or contact HR if the issue persists.')
      }
      setStage('error')
    }
  }, [coords, employeeId, onSuccess])

  // ── Shared button styles ──────────────────────────────────────────────────────
  const btnPrimary = 'flex items-center justify-center gap-2 h-10 px-5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-[13px] font-semibold rounded-xl transition-colors w-full'
  const btnGhost   = 'flex items-center justify-center gap-2 h-10 px-4 border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 text-[13px] font-medium rounded-xl transition-colors'

  // ── Idle ─────────────────────────────────────────────────────────────────────
  if (stage === 'idle') {
    return (
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
          <div className="flex items-start gap-2">
            <i className="fa-solid fa-circle-info text-blue-500 text-[13px] mt-0.5" />
            <p className="text-[12px] text-blue-700">
              Your browser will ask for location permission. Your GPS coordinates will be
              compared against {isWFO ? 'the office location' : 'your registered home address'} to verify you are {isWFO ? 'punching out from the office' : 'punching out from home'}.
            </p>
          </div>
        </div>
        <button onClick={handleGetLocation} className={btnPrimary}>
          <i className="fa-solid fa-location-dot text-[12px]" />
          Share My Location
        </button>
        <button onClick={onBack} className={btnGhost}>
          <i className="fa-solid fa-arrow-left text-[11px]" />
          Back
        </button>
      </div>
    )
  }

  // ── Locating ─────────────────────────────────────────────────────────────────
  if (stage === 'locating') {
    return (
      <div className="flex flex-col items-center py-6 gap-3">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center">
          <i className="fa-solid fa-circle-notch animate-spin text-indigo-500 text-[18px]" />
        </div>
        <p className="text-[13px] font-semibold text-gray-700">Detecting your location…</p>
        <p className="text-[11px] text-gray-400">Please allow location access when prompted</p>
      </div>
    )
  }

  // ── Confirming ───────────────────────────────────────────────────────────────
  if (stage === 'confirming' && coords) {
    return (
      <div className="space-y-4">
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <i className="fa-solid fa-location-dot text-emerald-500 text-[13px]" />
            <p className="text-[13px] font-semibold text-emerald-700">Location Detected</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-600">
            <div>
              <span className="text-gray-400 block">Latitude</span>
              <span className="font-mono font-semibold">{coords.latitude.toFixed(6)}</span>
            </div>
            <div>
              <span className="text-gray-400 block">Longitude</span>
              <span className="font-mono font-semibold">{coords.longitude.toFixed(6)}</span>
            </div>
          </div>
          {coords.accuracy > 100 && (
            <p className="text-[11px] text-amber-600 mt-2">
              <i className="fa-solid fa-triangle-exclamation mr-1" />
              GPS accuracy is {coords.accuracy} m — validation may fail. Try moving to an open area.
            </p>
          )}
        </div>

        <button onClick={handleSubmit} className={btnPrimary}>
          <i className="fa-solid fa-check text-[11px]" />
          Confirm &amp; Punch Out
        </button>
        <button onClick={() => setStage('idle')} className={btnGhost}>
          <i className="fa-solid fa-rotate-right text-[11px]" />
          Re-detect Location
        </button>
      </div>
    )
  }

  // ── Submitting ───────────────────────────────────────────────────────────────
  if (stage === 'submitting') {
    return (
      <div className="flex flex-col items-center py-6 gap-3">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center">
          <i className="fa-solid fa-circle-notch animate-spin text-indigo-500 text-[18px]" />
        </div>
        <p className="text-[13px] font-semibold text-gray-700">Validating location…</p>
        <p className="text-[11px] text-gray-400">Comparing with {isWFO ? 'the office location' : 'your registered home address'}</p>
      </div>
    )
  }

  // ── Done ─────────────────────────────────────────────────────────────────────
  if (stage === 'done' && result) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center py-4 gap-2">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
            <i className="fa-solid fa-circle-check text-emerald-500 text-[22px]" />
          </div>
          <p className="text-[14px] font-bold text-emerald-700">Geo Punch-Out Recorded!</p>
          <p className="text-[11px] text-gray-400">Your workday has been completed successfully</p>
        </div>
        {result.duration_minutes != null && (
          <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center gap-3 text-[12px]">
            <i className="fa-solid fa-clock text-gray-400" />
            <span className="text-gray-600">
              Total duration:{' '}
              <span className="font-semibold text-gray-800">{fmtDuration(result.duration_minutes)}</span>
            </span>
          </div>
        )}
        {result.distance_meters != null && (
          <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center gap-3 text-[12px]">
            <i className="fa-solid fa-ruler text-gray-400" />
            <span className="text-gray-600">
              <span className="font-semibold text-gray-800">{Math.round(result.distance_meters)} m</span>
              {' '}from {isWFO ? 'the office' : 'your registered home location'}
            </span>
          </div>
        )}
      </div>
    )
  }

  // ── Error ─────────────────────────────────────────────────────────────────────
  const isLocationMismatch = result != null && !result.success && result.within_radius === false

  return (
    <div className="space-y-4">
      {isLocationMismatch ? (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
              <i className="fa-solid fa-location-xmark text-red-500 text-[15px]" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-red-700 mb-1">Location Mismatch</p>
              <p className="text-[12px] text-red-600 leading-relaxed">
                {isWFO ? 'You are not at the office.' : 'You are not at your registered WFH location.'}{' '}
                {isWFO ? 'Please move to the office premises or use Selfie Attendance.' : 'Please use Selfie Attendance or contact HR if your address has changed.'}
              </p>
            </div>
          </div>
          {result.distance_meters != null && (
            <div className="mt-3 pt-3 border-t border-red-100 flex items-center gap-3 text-[11px] text-red-500">
              <span><span className="font-semibold">Your distance:</span> {Math.round(result.distance_meters)} m</span>
              {result.radius_meters && (
                <span className="text-red-300">·</span>
              )}
              {result.radius_meters && (
                <span><span className="font-semibold">Allowed radius:</span> {result.radius_meters} m</span>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <div className="flex items-start gap-2">
            <i className="fa-solid fa-triangle-exclamation text-red-500 text-[13px] mt-0.5" />
            <p className="text-[12px] text-red-700">{errorMsg ?? 'An unexpected error occurred.'}</p>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={() => { setStage('idle'); setErrorMsg(null) }} className={btnPrimary}>
          <i className="fa-solid fa-rotate-right text-[11px]" />
          Try Again
        </button>
        <button onClick={onBack} className={btnGhost}>
          <i className="fa-solid fa-arrow-left text-[11px]" />
          Back
        </button>
      </div>
    </div>
  )
}
