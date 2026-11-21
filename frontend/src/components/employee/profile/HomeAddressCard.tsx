/**
 * HomeAddressCard — employee can add/update their home address for WFH geo attendance.
 *
 * On save the address is sent to PUT /api/profile/{userId} with home_address field.
 * The backend geocodes it server-side and stores coordinates in employee_home_locations.
 * Coordinates are never returned to the employee — only the address text is shown.
 */
import { useState, useEffect } from 'react'
import type { MyProfile, UpdateProfilePayload, UpdateProfileResponse } from '../../../types/profile'
import { profileApi } from '../../../api/profile'

interface Props {
  profile: MyProfile
  userId:  string | number
  onSaved: (newAddress: string, locationSet: boolean) => void
}

type SaveStatus = 'idle' | 'saving' | 'success' | 'geocoding_failed' | 'error'

export default function HomeAddressCard({ profile, userId, onSaved }: Props) {
  const [editing,    setEditing]    = useState(false)
  const [address,    setAddress]    = useState('')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [statusNote, setStatusNote] = useState('')

  useEffect(() => {
    setAddress(profile.home_address ?? '')
  }, [profile.home_address])

  async function handleSave() {
    if (!address.trim()) return
    setSaveStatus('saving')
    setStatusNote('')
    try {
      const { data } = await profileApi.updateMyProfile(userId, { home_address: address.trim() } as UpdateProfilePayload)
      const res = data as UpdateProfileResponse & { success: boolean }

      if (!res.success) {
        setSaveStatus('error')
        setStatusNote(res.message ?? 'Failed to save address')
        return
      }

      const gs = res.geocoding_status ?? 'skipped'
      if (gs === 'success') {
        setSaveStatus('success')
        setStatusNote('Address saved and geocoded. Geo attendance is now available.')
        setEditing(false)
        onSaved(address.trim(), true)
      } else if (gs === 'geocoding_failed') {
        setSaveStatus('geocoding_failed')
        setStatusNote(res.geocoding_note ?? 'Address saved but could not be geocoded. Geo attendance may not work.')
        setEditing(false)
        onSaved(address.trim(), false)
      } else {
        setSaveStatus('success')
        setStatusNote('Address saved.')
        setEditing(false)
        onSaved(address.trim(), profile.home_location_set ?? false)
      }
    } catch {
      setSaveStatus('error')
      setStatusNote('Connection failed. Please try again.')
    }
  }

  function handleCancel() {
    setAddress(profile.home_address ?? '')
    setEditing(false)
    setSaveStatus('idle')
    setStatusNote('')
  }

  const hasAddress    = !!(profile.home_address && profile.home_address.trim())
  const locationSet   = profile.home_location_set ?? false
  const inputCls      = 'w-full text-[13px] text-gray-800 bg-white border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition resize-none'

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
            <i className="fa-solid fa-house text-indigo-500 text-[12px]" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-gray-800">Home Address</p>
            <p className="text-[11px] text-gray-400">Required for WFH geo attendance</p>
          </div>
        </div>
        {!editing && (
          <button
            onClick={() => { setEditing(true); setSaveStatus('idle'); setStatusNote('') }}
            className="flex items-center gap-1.5 text-[12px] font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
          >
            <i className="fa-solid fa-pen text-[10px]" />
            {hasAddress ? 'Update' : 'Add'}
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          {/* Info notice */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 flex items-start gap-2">
            <i className="fa-solid fa-circle-info text-blue-400 text-[11px] mt-0.5 shrink-0" />
            <p className="text-[11px] text-blue-600">
              Enter your full home address including area, city, and state.
              The system will convert it to GPS coordinates for attendance validation.
              Your exact coordinates are kept private.
            </p>
          </div>

          <div>
            <label className="text-[11px] font-medium text-gray-500 mb-1 block">
              Home Address <span className="text-red-400">*</span>
            </label>
            <textarea
              className={inputCls}
              rows={3}
              placeholder="e.g. 42 MG Road, Bandra West, Mumbai, Maharashtra 400050"
              value={address}
              onChange={e => { setAddress(e.target.value); setSaveStatus('idle') }}
            />
          </div>

          {saveStatus === 'saving' && (
            <div className="flex items-center gap-2 text-[12px] text-gray-500">
              <i className="fa-solid fa-circle-notch animate-spin text-[11px]" />
              Saving and geocoding address…
            </div>
          )}

          {(saveStatus === 'geocoding_failed' || saveStatus === 'error') && statusNote && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 text-[12px] text-amber-700">
              <i className="fa-solid fa-triangle-exclamation mr-1.5" />
              {statusNote}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saveStatus === 'saving' || !address.trim()}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-[12px] font-semibold py-2 rounded-lg transition-colors"
            >
              {saveStatus === 'saving'
                ? <><i className="fa-solid fa-circle-notch animate-spin text-[11px]" /> Saving…</>
                : <><i className="fa-solid fa-check text-[11px]" /> Save Address</>
              }
            </button>
            <button
              onClick={handleCancel}
              disabled={saveStatus === 'saving'}
              className="px-4 text-[12px] font-medium text-gray-500 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div>
          {hasAddress ? (
            <div className="space-y-2">
              <div className="flex items-start gap-3 py-1">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0 mt-0.5">
                  <i className="fa-solid fa-location-dot text-indigo-400 text-[11px]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-gray-400 leading-none mb-0.5">Home Address</p>
                  <p className="text-[13px] font-semibold text-gray-800 leading-snug">{profile.home_address}</p>
                </div>
              </div>
              {/* Geo status indicator */}
              <div className={`flex items-center gap-2 text-[11px] rounded-lg px-3 py-1.5 ${
                locationSet
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-amber-50 text-amber-600'
              }`}>
                <i className={`fa-solid ${locationSet ? 'fa-circle-check' : 'fa-triangle-exclamation'} text-[10px]`} />
                {locationSet
                  ? 'Coordinates verified — geo attendance is active'
                  : 'Coordinates not yet verified — contact HR or re-save your address'}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center py-4 text-center">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center mb-2">
                <i className="fa-solid fa-house-circle-xmark text-amber-400 text-[16px]" />
              </div>
              <p className="text-[13px] font-semibold text-gray-600">No home address saved</p>
              <p className="text-[11px] text-gray-400 mt-1 max-w-xs">
                Add your home address to enable WFH geo attendance. The system will geocode it for validation.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Success toast */}
      {saveStatus === 'success' && statusNote && (
        <p className="text-[12px] text-emerald-600 flex items-center gap-1.5 mt-3">
          <i className="fa-solid fa-circle-check text-[11px]" />
          {statusNote}
        </p>
      )}
    </div>
  )
}
