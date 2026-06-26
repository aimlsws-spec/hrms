import { useState, useEffect } from 'react'
import type { MyProfile, UpdateProfilePayload } from '../../../types/profile'

interface Props {
  profile:     MyProfile
  isSaving:    boolean
  saveError:   string | null
  saveSuccess: boolean
  onSave:      (data: UpdateProfilePayload) => void
}

export default function EmergencyContactCard({ profile, isSaving, saveError, saveSuccess, onSave }: Props) {
  const [editing, setEditing]     = useState(false)
  const [number,  setNumber]      = useState('')
  const [validErr, setValidErr]   = useState('')

  useEffect(() => { setNumber(profile.emergency_number ?? '') }, [profile])

  useEffect(() => { if (saveSuccess) setEditing(false) }, [saveSuccess])

  function handleSave() {
    if (number && !/^[+\d\s\-()\\.]{7,20}$/.test(number)) {
      setValidErr('Invalid phone number format')
      return
    }
    setValidErr('')
    onSave({ emergency_number: number || undefined })
  }

  const inputCls = 'w-full text-[13px] text-gray-800 bg-white border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400 transition'

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[14px] font-semibold text-gray-800">Emergency Contact</p>
          <p className="text-[12px] text-gray-400 mt-0.5">In case of emergency</p>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            title="Edit"
          >
            <i className="fa-solid fa-pen text-[11px]" />
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-medium text-gray-500 mb-1 block">Emergency Phone Number</label>
            <input
              className={inputCls}
              placeholder="+91 98765 43210"
              value={number}
              onChange={e => { setNumber(e.target.value); setValidErr('') }}
            />
          </div>

          {(validErr || saveError) && (
            <p className="text-[12px] text-red-500 flex items-center gap-1.5">
              <i className="fa-solid fa-circle-exclamation text-[11px]" />
              {validErr || saveError}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-[12px] font-semibold py-2 rounded-lg transition-colors"
            >
              {isSaving
                ? <><i className="fa-solid fa-circle-notch animate-spin text-[11px]" /> Saving…</>
                : <><i className="fa-solid fa-check text-[11px]" /> Save</>
              }
            </button>
            <button
              onClick={() => { setEditing(false); setValidErr('') }}
              disabled={isSaving}
              className="px-4 text-[12px] font-medium text-gray-500 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 py-3">
          <div className="w-5 flex items-center justify-center shrink-0 mt-0.5">
            <i className="fa-solid fa-phone-volume text-red-400 text-[12px]" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-gray-500 leading-none">Emergency Number</p>
            <p className="text-[13px] font-medium text-gray-800 mt-1">
              {profile.emergency_number || <span className="text-gray-300 font-normal">Not set</span>}
            </p>
          </div>
        </div>
      )}

      {saveSuccess && !editing && (
        <p className="text-[12px] text-emerald-600 flex items-center gap-1.5 mt-3">
          <i className="fa-solid fa-circle-check text-[11px]" />
          Emergency contact updated
        </p>
      )}
    </div>
  )
}
