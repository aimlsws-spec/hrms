import { useState, useEffect } from 'react'
import type { MyProfile, UpdateProfilePayload } from '../../../types/profile'

interface Props {
  profile:       MyProfile
  isSaving:      boolean
  saveError:     string | null
  saveSuccess:   boolean
  onSave:        (data: UpdateProfilePayload) => void
}

interface FormState {
  phone: string
  city:  string
  state: string
}

export default function ContactInfoCard({ profile, isSaving, saveError, saveSuccess, onSave }: Props) {
  const [editing, setEditing] = useState(false)
  const [form, setForm]       = useState<FormState>({ phone: '', city: '', state: '' })
  const [validErr, setValidErr] = useState('')

  useEffect(() => {
    setForm({
      phone: profile.phone  ?? '',
      city:  profile.city   ?? '',
      state: profile.state  ?? '',
    })
  }, [profile])

  // Close edit mode after successful save
  useEffect(() => {
    if (saveSuccess) setEditing(false)
  }, [saveSuccess])

  function validate(): boolean {
    if (form.phone && !/^[+\d\s\-()\\.]{7,20}$/.test(form.phone)) {
      setValidErr('Invalid phone number format')
      return false
    }
    setValidErr('')
    return true
  }

  function handleSave() {
    if (!validate()) return
    onSave({ phone: form.phone || undefined, city: form.city || undefined, state: form.state || undefined })
  }

  function handleChange(field: keyof FormState, val: string) {
    setForm(prev => ({ ...prev, [field]: val }))
    setValidErr('')
  }

  const inputCls = 'w-full text-[13px] text-gray-800 bg-white border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-900/30 focus:border-primary-700 transition'

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[14px] font-semibold text-gray-800">Contact Info</p>
          <p className="text-[12px] text-gray-400 mt-0.5">Phone, city &amp; state</p>
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
            <label className="text-[11px] font-medium text-gray-500 mb-1 block">Phone</label>
            <input
              className={inputCls}
              placeholder="+91 98765 43210"
              value={form.phone}
              onChange={e => handleChange('phone', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-gray-500 mb-1 block">City</label>
              <input
                className={inputCls}
                placeholder="Mumbai"
                value={form.city}
                onChange={e => handleChange('city', e.target.value)}
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-gray-500 mb-1 block">State</label>
              <input
                className={inputCls}
                placeholder="Maharashtra"
                value={form.state}
                onChange={e => handleChange('state', e.target.value)}
              />
            </div>
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
              className="flex-1 flex items-center justify-center gap-2 bg-primary-900 hover:bg-primary-800 disabled:opacity-60 text-white text-[12px] font-semibold py-2 rounded-lg transition-colors"
            >
              {isSaving
                ? <><i className="fa-solid fa-circle-notch animate-spin text-[11px]" /> Saving…</>
                : <><i className="fa-solid fa-check text-[11px]" /> Save Changes</>
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
        <div>
          {[
            { icon: 'fa-solid fa-phone',   iconColor: 'text-emerald-400', label: 'Phone', value: profile.phone },
            { icon: 'fa-solid fa-city',    iconColor: 'text-blue-400',    label: 'City',  value: profile.city  },
            { icon: 'fa-solid fa-map-pin', iconColor: 'text-violet-400',  label: 'State', value: profile.state },
          ].map(row => (
            <div key={row.label} className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
              <div className="w-5 flex items-center justify-center shrink-0 mt-0.5">
                <i className={`${row.icon} ${row.iconColor} text-[12px]`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-gray-500 leading-none">{row.label}</p>
                <p className="text-[13px] font-medium text-gray-800 mt-1">
                  {row.value || <span className="text-gray-300 font-normal">Not set</span>}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {saveSuccess && !editing && (
        <p className="text-[12px] text-emerald-600 flex items-center gap-1.5 mt-3">
          <i className="fa-solid fa-circle-check text-[11px]" />
          Contact info updated
        </p>
      )}
    </div>
  )
}
