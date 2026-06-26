import { useState, useEffect } from 'react'
import type { MyProfile, UpdateProfilePayload } from '../../../types/profile'

interface InfoRowProps {
  icon:      string
  iconBg:    string
  iconColor: string
  label:     string
  value:     string | null | undefined
  readOnly?: boolean
}

function InfoRow({ icon, iconBg: _bg, iconColor, label, value, readOnly }: InfoRowProps) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className="w-5 flex items-center justify-center shrink-0 mt-0.5">
        <i className={`${icon} ${iconColor} text-[12px]`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium text-gray-500 leading-none">{label}</p>
        <p className="text-[13px] font-medium text-gray-800 mt-1">
          {value || <span className="text-gray-300 font-normal">—</span>}
        </p>
      </div>
      {readOnly && (
        <span className="text-[10px] text-gray-300 shrink-0 mt-0.5">read-only</span>
      )}
    </div>
  )
}

interface PersonalForm {
  full_name:      string
  date_of_birth:  string
  gender:         string
  marital_status: string
  nationality:    string
}

interface Props {
  profile:      MyProfile
  isSaving?:    boolean
  saveError?:   string | null
  saveSuccess?: boolean
  onSave?:      (data: UpdateProfilePayload) => void
}

const GENDER_OPTIONS    = ['Male', 'Female', 'Non-binary', 'Prefer not to say']
const MARITAL_OPTIONS   = ['Single', 'Married', 'Divorced', 'Widowed']

const inputCls = 'w-full text-[13px] text-gray-800 bg-white border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-900/30 focus:border-primary-700 transition'
const selectCls = inputCls + ' appearance-none'

export default function PersonalInfoCard({ profile, isSaving, saveError, saveSuccess, onSave }: Props) {
  const [editing, setEditing] = useState(false)
  const [form, setForm]       = useState<PersonalForm>({
    full_name:      '',
    date_of_birth:  '',
    gender:         '',
    marital_status: '',
    nationality:    '',
  })

  useEffect(() => {
    setForm({
      full_name:      profile.full_name      ?? '',
      date_of_birth:  profile.date_of_birth  ?? '',
      gender:         profile.gender         ?? '',
      marital_status: profile.marital_status ?? '',
      nationality:    profile.nationality    ?? '',
    })
  }, [profile])

  useEffect(() => {
    if (saveSuccess) setEditing(false)
  }, [saveSuccess])

  function handleChange(field: keyof PersonalForm, val: string) {
    setForm(prev => ({ ...prev, [field]: val }))
  }

  function handleSave() {
    onSave?.({
      full_name:      form.full_name      || undefined,
      date_of_birth:  form.date_of_birth  || undefined,
      gender:         form.gender         || undefined,
      marital_status: form.marital_status || undefined,
      nationality:    form.nationality    || undefined,
    })
  }

  const dobLabel = profile.date_of_birth
    ? new Date(profile.date_of_birth).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[14px] font-semibold text-gray-800">Personal Details</p>
          <p className="text-[12px] text-gray-400 mt-0.5">Identity &amp; account</p>
        </div>
        {!editing && onSave && (
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
            <label className="text-[11px] font-medium text-gray-500 mb-1 block">Full Name</label>
            <input
              className={inputCls}
              value={form.full_name}
              onChange={e => handleChange('full_name', e.target.value)}
              placeholder="Your full name"
            />
          </div>

          {/* Read-only fields in edit mode */}
          <div className="grid grid-cols-1 gap-1">
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
              <i className="fa-solid fa-envelope text-gray-300 text-[11px]" />
              <div>
                <p className="text-[9px] text-gray-400">Email (read-only)</p>
                <p className="text-[12px] text-gray-500">{profile.email}</p>
              </div>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-medium text-gray-500 mb-1 block">Date of Birth</label>
            <input
              type="date"
              className={inputCls}
              value={form.date_of_birth}
              onChange={e => handleChange('date_of_birth', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-gray-500 mb-1 block">Gender</label>
              <select
                className={selectCls}
                value={form.gender}
                onChange={e => handleChange('gender', e.target.value)}
              >
                <option value="">Select…</option>
                {GENDER_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-gray-500 mb-1 block">Marital Status</label>
              <select
                className={selectCls}
                value={form.marital_status}
                onChange={e => handleChange('marital_status', e.target.value)}
              >
                <option value="">Select…</option>
                {MARITAL_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-medium text-gray-500 mb-1 block">Nationality</label>
            <input
              className={inputCls}
              value={form.nationality}
              onChange={e => handleChange('nationality', e.target.value)}
              placeholder="e.g. Indian"
            />
          </div>

          {saveError && (
            <p className="text-[12px] text-red-500 flex items-center gap-1.5">
              <i className="fa-solid fa-circle-exclamation text-[11px]" />
              {saveError}
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
              onClick={() => setEditing(false)}
              disabled={isSaving}
              className="px-4 text-[12px] font-medium text-gray-500 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <InfoRow icon="fa-solid fa-user"          iconBg="" iconColor="text-purple-400" label="Full Name"     value={profile.full_name}  />
          <InfoRow icon="fa-solid fa-envelope"      iconBg="" iconColor="text-blue-400"   label="Email"         value={profile.email}      readOnly />
          <InfoRow icon="fa-solid fa-at"            iconBg="" iconColor="text-slate-400"  label="Username"      value={profile.username}   readOnly />
          {dobLabel && (
            <InfoRow icon="fa-solid fa-cake-candles" iconBg="" iconColor="text-pink-400"   label="Date of Birth" value={dobLabel} />
          )}
          {profile.gender && (
            <InfoRow icon="fa-solid fa-venus-mars"  iconBg="" iconColor="text-rose-400"   label="Gender"        value={profile.gender} />
          )}
          {profile.marital_status && (
            <InfoRow icon="fa-solid fa-heart"       iconBg="" iconColor="text-red-400"    label="Marital Status" value={profile.marital_status} />
          )}
          {profile.nationality && (
            <InfoRow icon="fa-solid fa-flag"        iconBg="" iconColor="text-amber-400"  label="Nationality"   value={profile.nationality} />
          )}
        </>
      )}

      {saveSuccess && !editing && (
        <p className="text-[12px] text-emerald-600 flex items-center gap-1.5 mt-3">
          <i className="fa-solid fa-circle-check text-[11px]" />
          Personal details updated
        </p>
      )}
    </div>
  )
}
