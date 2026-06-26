/**
 * SetHomeLocationModal — lets an employee register their home GPS coordinates.
 *
 * Used when geo attendance is selected but no home location is saved yet.
 * The employee navigates to this modal while at home and clicks "Use My Current Location".
 * Browser geolocation is captured and POSTed to /api/wfh/home-location.
 */
import { useState, useCallback } from 'react'
import { wfhGeoApi }             from '../../api/wfhApi'

interface Props {
  employeeId:    string
  existingLabel?: string | null
  onSaved:       () => void
  onClose:       () => void
}

type Stage = 'idle' | 'locating' | 'confirming' | 'saving' | 'done'

interface Coords {
  latitude:  number
  longitude: number
  accuracy:  number
}

export default function SetHomeLocationModal({ employeeId, existingLabel, onSaved, onClose }: Props) {
  const [stage,    setStage]    = useState<Stage>('idle')
  const [coords,   setCoords]   = useState<Coords | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleGetLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setErrorMsg('Your browser does not support geolocation.')
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
          msg += 'Please allow location access in your browser settings.'
        } else {
          msg += 'Please try again.'
        }
        setErrorMsg(msg)
        setStage('idle')
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 }
    )
  }, [])

  const handleSave = useCallback(async () => {
    if (!coords) return
    setStage('saving')
    setErrorMsg(null)
    try {
      const { data } = await wfhGeoApi.setHomeLocation(
        employeeId,
        coords.latitude,
        coords.longitude,
        { registeredVia: 'employee_gps' }
      )
      if (data.success) {
        setStage('done')
        onSaved()
      } else {
        setErrorMsg('Failed to save home location. Please try again.')
        setStage('confirming')
      }
    } catch {
      setErrorMsg('Connection failed. Please try again.')
      setStage('confirming')
    }
  }, [coords, employeeId, onSaved])

  const btnPrimary = 'flex items-center justify-center gap-2 h-10 px-5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-[13px] font-semibold rounded-xl transition-colors w-full'
  const btnGhost   = 'flex items-center justify-center gap-2 h-10 px-4 border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 text-[13px] font-medium rounded-xl transition-colors w-full'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
              <i className="fa-solid fa-house text-indigo-600 text-[13px]" />
            </div>
            <div>
              <p className="text-[14px] font-bold text-gray-800">Set Home Location</p>
              <p className="text-[11px] text-gray-400">Required for geo attendance</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <i className="fa-solid fa-xmark text-[16px]" />
          </button>
        </div>

        {/* Existing address hint */}
        {existingLabel && (
          <div className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 mb-4">
            <p className="text-[11px] text-gray-400 mb-0.5">Home address on file</p>
            <p className="text-[12px] text-gray-700">{existingLabel}</p>
          </div>
        )}

        {/* Done */}
        {stage === 'done' && (
          <div className="flex flex-col items-center py-4 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
              <i className="fa-solid fa-circle-check text-emerald-500 text-[22px]" />
            </div>
            <p className="text-[13px] font-bold text-emerald-700">Home location saved!</p>
            <p className="text-[11px] text-gray-400 text-center">
              You can now use geo attendance for WFH days.
            </p>
            <button onClick={onClose} className={btnPrimary}>
              Continue
            </button>
          </div>
        )}

        {/* Locating */}
        {stage === 'locating' && (
          <div className="flex flex-col items-center py-6 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center">
              <i className="fa-solid fa-circle-notch animate-spin text-indigo-500 text-[18px]" />
            </div>
            <p className="text-[13px] font-semibold text-gray-700">Detecting your location…</p>
            <p className="text-[11px] text-gray-400">Please allow location access when prompted</p>
          </div>
        )}

        {/* Saving */}
        {stage === 'saving' && (
          <div className="flex flex-col items-center py-6 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center">
              <i className="fa-solid fa-circle-notch animate-spin text-indigo-500 text-[18px]" />
            </div>
            <p className="text-[13px] font-semibold text-gray-700">Saving home location…</p>
          </div>
        )}

        {/* Idle */}
        {stage === 'idle' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
              <p className="text-[12px] text-blue-700">
                <i className="fa-solid fa-circle-info mr-1.5" />
                You must be at home when you do this. Your current GPS coordinates will be saved
                and used to verify future geo attendance.
              </p>
            </div>
            {errorMsg && (
              <p className="text-[12px] text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                {errorMsg}
              </p>
            )}
            <button onClick={handleGetLocation} className={btnPrimary}>
              <i className="fa-solid fa-location-dot text-[12px]" />
              Use My Current Location
            </button>
            <button onClick={onClose} className={btnGhost}>Cancel</button>
          </div>
        )}

        {/* Confirming */}
        {stage === 'confirming' && coords && (
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <i className="fa-solid fa-location-dot text-emerald-500 text-[13px]" />
                <p className="text-[13px] font-semibold text-emerald-700">Location Captured</p>
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
              <p className="text-[11px] text-gray-400 mt-1.5">
                GPS accuracy: ±{coords.accuracy} m
              </p>
            </div>
            {errorMsg && (
              <p className="text-[12px] text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                {errorMsg}
              </p>
            )}
            <button onClick={handleSave} className={btnPrimary}>
              <i className="fa-solid fa-floppy-disk text-[11px]" />
              Save as Home Location
            </button>
            <button onClick={() => setStage('idle')} className={btnGhost}>
              <i className="fa-solid fa-rotate-right text-[11px]" />
              Re-detect
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
