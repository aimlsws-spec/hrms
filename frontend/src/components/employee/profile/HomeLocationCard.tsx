/**
 * HomeLocationCard — home GPS location for WFH geo attendance.
 *
 * Rules:
 *   • First time  → employee sets location directly (GPS or map picker).
 *   • Already set → employee can only submit a change request; HR must approve
 *                   before the new coordinates take effect.
 */
import { useState, useEffect, lazy, Suspense } from 'react'
import { wfhGeoApi } from '../../../api/wfhApi'
import client from '../../../api/client'
import type { MyProfile } from '../../../types/profile'
import type { HomeLocationChangeRequest } from '../../../api/wfhApi'

const MapPickerModal = lazy(() => import('./MapPickerModal'))

interface Props {
  profile: MyProfile
  onSaved: (lat: number, lon: number, address: string | null) => void
}

interface Coords { latitude: number; longitude: number; accuracy: number }

type SetStage = 'idle' | 'locating' | 'confirming' | 'saving' | 'success' | 'error'
type RequestStage = 'idle' | 'picking' | 'locating' | 'confirming' | 'submitting' | 'done' | 'error'

async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  try {
    const { data } = await client.get<{ address: string | null }>(
      `/wfh/reverse-geocode?lat=${lat}&lon=${lon}`
    )
    return data.address ?? null
  } catch {
    return null
  }
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

// ── Sub-component: set location for the first time ────────────────────────────

function FirstTimeSetPanel({
  employeeId,
  initialLat,
  initialLon,
  onSaved,
}: {
  employeeId: string
  initialLat?: number | null
  initialLon?: number | null
  onSaved: (lat: number, lon: number, address: string | null) => void
}) {
  const [stage,         setStage]         = useState<SetStage>('idle')
  const [note,          setNote]          = useState('')
  const [pendingCoords, setPendingCoords] = useState<Coords | null>(null)
  const [showMap,       setShowMap]       = useState(false)

  function handleGps() {
    if (!navigator.geolocation) { setStage('error'); setNote('Geolocation not supported by your browser.'); return }
    setStage('locating'); setNote(''); setPendingCoords(null)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setPendingCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) })
        setStage('confirming')
      },
      err => {
        setStage('error')
        setNote(err.code === 1 ? 'Location permission denied. Allow access in browser settings.' : 'Could not get your location. Try again or use Pick on Map.')
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    )
  }

  async function saveCoords(lat: number, lon: number) {
    if (!employeeId) {
      setStage('error')
      setNote('Employee record not loaded. Please refresh the page and try again.')
      return
    }
    setStage('saving'); setPendingCoords(null)
    try {
      // Geocode first (best-effort), then make a single save call — no duplicate saves
      const label = await reverseGeocode(lat, lon)
      const { data } = await wfhGeoApi.setHomeLocation(employeeId, lat, lon, {
        registeredVia: 'employee_gps',
        addressLabel:  label ?? undefined,
      })
      if (!data.success) {
        setStage('error')
        setNote('Failed to save location. Please try again.')
        return
      }
      setStage('success'); setNote('Home location saved. Geo attendance is now active.')
      onSaved(lat, lon, label)
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setStage('error')
      setNote(detail ?? 'Connection failed. Please try again.')
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-col items-center py-3 text-center">
        <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center mb-2">
          <i className="fa-solid fa-house-circle-xmark text-amber-400 text-[16px]" />
        </div>
        <p className="text-[13px] font-semibold text-gray-600">No home location saved</p>
        <p className="text-[11px] text-gray-400 mt-1 max-w-xs">
          Set your home GPS location once to enable WFH geo attendance.
          <span className="block mt-1 font-semibold text-amber-600">You can only set this once — later changes require HR approval.</span>
        </p>
      </div>

      {/* GPS confirmation step */}
      {stage === 'confirming' && pendingCoords && (
        <div className="mb-4 space-y-3">
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <i className="fa-solid fa-location-dot text-emerald-500 text-[12px]" />
              <p className="text-[13px] font-semibold text-emerald-700">Location Captured</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-600">
              <div><span className="text-gray-400 block mb-0.5">Latitude</span><span className="font-mono font-semibold">{pendingCoords.latitude.toFixed(6)}</span></div>
              <div><span className="text-gray-400 block mb-0.5">Longitude</span><span className="font-mono font-semibold">{pendingCoords.longitude.toFixed(6)}</span></div>
            </div>
            <p className="text-[10px] text-gray-400 mt-2">GPS accuracy: ±{pendingCoords.accuracy} m</p>
          </div>
          <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
            <i className="fa-solid fa-triangle-exclamation mr-1.5" />
            Only confirm if you are currently at your home.
          </p>
          <div className="flex gap-2">
            <button onClick={() => saveCoords(pendingCoords.latitude, pendingCoords.longitude)}
              className="flex-1 h-9 bg-primary-900 hover:bg-primary-800 text-white text-[12px] font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5">
              <i className="fa-solid fa-floppy-disk text-[11px]" /> Save as Home Location
            </button>
            <button onClick={() => { setPendingCoords(null); setStage('idle') }}
              className="h-9 px-4 border border-gray-200 rounded-lg text-[12px] text-gray-600 hover:bg-gray-50 transition-colors">
              Re-detect
            </button>
          </div>
        </div>
      )}

      {stage === 'locating' && (
        <div className="mb-4 flex flex-col items-center py-4 gap-2">
          <i className="fa-solid fa-circle-notch animate-spin text-indigo-500 text-[22px]" />
          <p className="text-[13px] font-semibold text-gray-700">Detecting your location…</p>
          <p className="text-[11px] text-gray-400">Please allow location access when prompted</p>
        </div>
      )}
      {stage === 'saving' && (
        <div className="mb-4 flex flex-col items-center py-4 gap-2">
          <i className="fa-solid fa-circle-notch animate-spin text-indigo-500 text-[22px]" />
          <p className="text-[13px] font-semibold text-gray-700">Saving location…</p>
        </div>
      )}
      {stage === 'success' && note && (
        <div className="mb-4 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 text-[12px] text-emerald-700 flex items-center gap-2">
          <i className="fa-solid fa-circle-check text-[11px] shrink-0" /> {note}
        </div>
      )}
      {stage === 'error' && note && (
        <div className="mb-4 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-[12px] text-red-600">
          <i className="fa-solid fa-triangle-exclamation mr-1.5" /> {note}
        </div>
      )}

      {stage !== 'locating' && stage !== 'saving' && stage !== 'confirming' && (
        <div className="space-y-2">
          <button onClick={handleGps}
            className="w-full flex items-center gap-3 bg-primary-900 hover:bg-primary-800 text-white text-[12px] font-semibold px-4 py-2.5 rounded-lg transition-colors">
            <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
              <i className="fa-solid fa-location-crosshairs text-[12px]" />
            </div>
            <div className="text-left">
              <p className="leading-none">Use My Current Location</p>
              <p className="text-[10px] font-normal text-primary-200 mt-0.5">Capture GPS coordinates automatically</p>
            </div>
          </button>
          <button onClick={() => { setStage('idle'); setNote(''); setShowMap(true) }}
            className="w-full flex items-center gap-3 border border-primary-300 bg-primary-50 hover:bg-primary-100 text-primary-900 text-[12px] font-semibold px-4 py-2.5 rounded-lg transition-colors">
            <div className="w-7 h-7 rounded-lg bg-primary-100 flex items-center justify-center shrink-0">
              <i className="fa-solid fa-map-location-dot text-primary-700 text-[12px]" />
            </div>
            <div className="text-left">
              <p className="leading-none">Pick on Map</p>
              <p className="text-[10px] font-normal text-primary-600 mt-0.5">Tap your home location on an interactive map</p>
            </div>
          </button>
        </div>
      )}

      {showMap && (
        <Suspense fallback={
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-3">
              <i className="fa-solid fa-circle-notch animate-spin text-indigo-500 text-[22px]" />
              <p className="text-[13px] text-gray-600">Loading map…</p>
            </div>
          </div>
        }>
          <MapPickerModal
            initialLat={initialLat ?? 20.5937}
            initialLon={initialLon ?? 78.9629}
            hasInitialLocation={false}
            onSave={(lat, lon) => { setShowMap(false); saveCoords(lat, lon) }}
            onClose={() => setShowMap(false)}
          />
        </Suspense>
      )}
    </>
  )
}

// ── Sub-component: change request panel ───────────────────────────────────────

function ChangeRequestPanel({
  employeeId,
  currentLat,
  currentLon,
  onRequestSubmitted,
}: {
  employeeId:          string
  currentLat?:         number | null
  currentLon?:         number | null
  onRequestSubmitted:  () => void
}) {
  const [stage,         setStage]         = useState<RequestStage>('idle')
  const [note,          setNote]          = useState('')
  const [pendingCoords, setPendingCoords] = useState<Coords | null>(null)
  const [reason,        setReason]        = useState('')
  const [showMap,       setShowMap]       = useState(false)

  function startPicking() { setStage('picking'); setNote(''); setPendingCoords(null) }
  function cancel()        { setStage('idle'); setNote(''); setPendingCoords(null); setReason('') }

  function captureGps() {
    if (!navigator.geolocation) { setStage('error'); setNote('Geolocation not supported by your browser.'); return }
    setStage('locating'); setNote('')
    navigator.geolocation.getCurrentPosition(
      pos => {
        setPendingCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) })
        setStage('confirming')
      },
      err => {
        setStage('error')
        setNote(err.code === 1 ? 'Location permission denied. Allow access in browser settings.' : 'Could not get your location. Try again or use Pick on Map.')
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    )
  }

  function handleMapSave(lat: number, lon: number) {
    setShowMap(false)
    setPendingCoords({ latitude: lat, longitude: lon, accuracy: 0 })
    setStage('confirming')
  }

  async function submitRequest() {
    if (!pendingCoords) return
    if (!employeeId) {
      setStage('error')
      setNote('Employee record not loaded. Please refresh the page and try again.')
      return
    }
    setStage('submitting')
    try {
      const label = await reverseGeocode(pendingCoords.latitude, pendingCoords.longitude)
      const { data } = await wfhGeoApi.submitChangeRequest(
        employeeId,
        pendingCoords.latitude,
        pendingCoords.longitude,
        { addressLabel: label ?? undefined, reason: reason.trim() || undefined },
      )
      if (data.success) {
        setStage('done')
        setNote('Change request submitted. HR will review and notify you.')
        onRequestSubmitted()
      } else {
        setStage('error'); setNote('Failed to submit request. Please try again.')
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setStage('error'); setNote(msg ?? 'Failed to submit request. Please try again.')
    }
  }

  if (stage === 'idle') {
    return (
      <button onClick={startPicking}
        className="w-full flex items-center gap-3 border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-700 text-[12px] font-semibold px-4 py-2.5 rounded-lg transition-colors mt-3">
        <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
          <i className="fa-solid fa-pen-to-square text-amber-500 text-[12px]" />
        </div>
        <div className="text-left">
          <p className="leading-none">Request Location Change</p>
          <p className="text-[10px] font-normal text-amber-500 mt-0.5">Requires HR approval</p>
        </div>
      </button>
    )
  }

  if (stage === 'done') {
    return (
      <div className="mt-3 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 text-[12px] text-emerald-700 flex items-center gap-2">
        <i className="fa-solid fa-circle-check text-[11px] shrink-0" /> {note}
      </div>
    )
  }

  if (stage === 'error') {
    return (
      <div className="mt-3 space-y-2">
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-[12px] text-red-600">
          <i className="fa-solid fa-triangle-exclamation mr-1.5" /> {note}
        </div>
        <button onClick={cancel} className="text-[11px] text-gray-500 hover:text-gray-700 underline">Try again</button>
      </div>
    )
  }

  return (
    <div className="mt-3 space-y-3">
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 text-[11px] text-blue-700">
        <i className="fa-solid fa-info-circle mr-1.5" />
        Pick your new home location, add a reason, then submit for HR review.
      </div>

      {/* Picking mode: GPS or Map */}
      {stage === 'picking' && (
        <div className="space-y-2">
          <button onClick={captureGps}
            className="w-full flex items-center gap-3 bg-primary-900 hover:bg-primary-800 text-white text-[12px] font-semibold px-4 py-2.5 rounded-lg transition-colors">
            <i className="fa-solid fa-location-crosshairs text-[12px]" />
            <span>Use My Current Location</span>
          </button>
          <button onClick={() => { setStage('picking'); setShowMap(true) }}
            className="w-full flex items-center gap-3 border border-primary-300 bg-primary-50 hover:bg-primary-100 text-primary-900 text-[12px] font-semibold px-4 py-2.5 rounded-lg transition-colors">
            <i className="fa-solid fa-map-location-dot text-[12px]" />
            <span>Pick on Map</span>
          </button>
          <button onClick={cancel} className="text-[11px] text-gray-400 hover:text-gray-600 underline">Cancel</button>
        </div>
      )}

      {stage === 'locating' && (
        <div className="flex flex-col items-center py-3 gap-2">
          <i className="fa-solid fa-circle-notch animate-spin text-indigo-500 text-[22px]" />
          <p className="text-[13px] font-semibold text-gray-700">Detecting your location…</p>
        </div>
      )}

      {stage === 'confirming' && pendingCoords && (
        <div className="space-y-3">
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
            <p className="text-[12px] font-semibold text-emerald-700 mb-2">New Location Captured</p>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-600">
              <div><span className="text-gray-400 block mb-0.5">Latitude</span><span className="font-mono font-semibold">{pendingCoords.latitude.toFixed(6)}</span></div>
              <div><span className="text-gray-400 block mb-0.5">Longitude</span><span className="font-mono font-semibold">{pendingCoords.longitude.toFixed(6)}</span></div>
            </div>
            {pendingCoords.accuracy > 0 && <p className="text-[10px] text-gray-400 mt-2">GPS accuracy: ±{pendingCoords.accuracy} m</p>}
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-600 mb-1">
              Reason for change <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Relocated to a new address"
              rows={2}
              className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </div>

          <div className="flex gap-2">
            <button onClick={submitRequest}
              className="flex-1 h-9 bg-primary-900 hover:bg-primary-800 text-white text-[12px] font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5">
              <i className="fa-solid fa-paper-plane text-[11px]" /> Submit Request
            </button>
            <button onClick={() => { setPendingCoords(null); setStage('picking') }}
              className="h-9 px-4 border border-gray-200 rounded-lg text-[12px] text-gray-600 hover:bg-gray-50 transition-colors">
              Re-pick
            </button>
            <button onClick={cancel}
              className="h-9 px-3 border border-gray-200 rounded-lg text-[12px] text-gray-500 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {stage === 'submitting' && (
        <div className="flex flex-col items-center py-3 gap-2">
          <i className="fa-solid fa-circle-notch animate-spin text-indigo-500 text-[22px]" />
          <p className="text-[13px] font-semibold text-gray-700">Submitting request…</p>
        </div>
      )}

      {showMap && (
        <Suspense fallback={
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-3">
              <i className="fa-solid fa-circle-notch animate-spin text-indigo-500 text-[22px]" />
              <p className="text-[13px] text-gray-600">Loading map…</p>
            </div>
          </div>
        }>
          <MapPickerModal
            initialLat={currentLat ?? 20.5937}
            initialLon={currentLon ?? 78.9629}
            hasInitialLocation={!!(currentLat && currentLon)}
            onSave={handleMapSave}
            onClose={() => setShowMap(false)}
          />
        </Suspense>
      )}
    </div>
  )
}

// ── Main card ─────────────────────────────────────────────────────────────────

export default function HomeLocationCard({ profile, onSaved }: Props) {
  const employeeId  = profile.employee_id ?? ''
  const hasLocation = !!(profile.home_location_set && profile.home_latitude != null)

  const [changeRequest,    setChangeRequest]    = useState<HomeLocationChangeRequest | null>(null)
  const [requestLoading,   setRequestLoading]   = useState(false)
  const [refreshTrigger,   setRefreshTrigger]   = useState(0)

  // Load latest change request status when location is already set
  useEffect(() => {
    if (!employeeId || !hasLocation) return
    setRequestLoading(true)
    wfhGeoApi.getChangeRequestStatus(employeeId)
      .then(({ data }) => setChangeRequest(data))
      .catch(() => setChangeRequest(null))
      .finally(() => setRequestLoading(false))
  }, [employeeId, hasLocation, refreshTrigger])

  const hasPending   = changeRequest?.found && changeRequest.status === 'pending'
  const lastApproved = changeRequest?.found && changeRequest.status === 'approved'
  const lastRejected = changeRequest?.found && changeRequest.status === 'rejected'

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">

      {/* Header */}
      <div className="mb-5">
        <p className="text-[14px] font-semibold text-gray-800">Work Location &amp; Address</p>
        <p className="text-[12px] text-gray-400 mt-0.5">Flexible attendance enabled — punch in and out from anywhere</p>
      </div>

      {/* ── Case 1: No location set — first-time setup ── */}
      {!hasLocation && (
        !employeeId ? (
          <div className="py-4 flex flex-col items-center gap-2 text-center">
            <i className="fa-solid fa-triangle-exclamation text-amber-400 text-[20px]" />
            <p className="text-[12px] font-semibold text-gray-600">Employee record not loaded</p>
            <p className="text-[11px] text-gray-400 max-w-xs">
              Your employee record could not be verified. Please refresh the page and try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-1 px-4 h-8 bg-primary-900 hover:bg-primary-800 text-white text-[11px] font-semibold rounded-lg transition-colors"
            >
              Refresh Page
            </button>
          </div>
        ) : (
          <FirstTimeSetPanel
            employeeId={employeeId}
            initialLat={profile.home_latitude}
            initialLon={profile.home_longitude}
            onSaved={onSaved}
          />
        )
      )}

      {/* ── Case 2: Location already set ── */}
      {hasLocation && (
        <>
          {/* Current location display */}
          <div className="mb-3 space-y-2">
            <div className="flex items-start gap-3 py-1">
              <div className="w-5 flex items-center justify-center shrink-0 mt-1">
                <i className="fa-solid fa-location-dot text-indigo-400 text-[12px]" />
              </div>
              <div className="min-w-0 flex-1">
                {profile.home_address && (
                  <p className="text-[13px] font-semibold text-gray-800 leading-snug mb-0.5">
                    {profile.home_address}
                  </p>
                )}
                <p className="text-[10px] font-mono text-gray-400">
                  {profile.home_latitude?.toFixed(6)}, {profile.home_longitude?.toFixed(6)}
                </p>
                {profile.home_updated_at && (
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Updated {fmtDate(profile.home_updated_at)}
                  </p>
                )}
              </div>
            </div>
            <div className="bg-emerald-50 text-emerald-600 text-[11px] rounded-lg px-3 py-1.5 flex items-center gap-2">
              <i className="fa-solid fa-circle-check text-[10px]" />
              Flexible attendance active — punch in from any location without approval
            </div>
          </div>

          {/* Flexible attendance notice */}
          <div className="mt-3 p-3.5 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700 flex items-start gap-2">
            <i className="fa-solid fa-circle-info text-blue-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-blue-900">Flexible Punch-In Enabled</p>
              <p className="text-blue-700/80 mt-0.5">
                Location requests have been removed. You can punch in and punch out from any location without needing prior HR approval.
              </p>
            </div>
          </div>
</>
      )}
    </div>
  )
}
