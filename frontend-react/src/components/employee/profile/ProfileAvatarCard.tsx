import { useRef } from 'react'
import { useProfileImageStore } from '../../../store/profileImageStore'
import type { MyProfile } from '../../../types/profile'

function initials(name: string) {
  return name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

interface Props {
  profile:  MyProfile
  editable?: boolean
}

const STATUS_STYLES: Record<string, string> = {
  Active:     'text-emerald-600 bg-emerald-50',
  active:     'text-emerald-600 bg-emerald-50',
  Inactive:   'text-red-600 bg-red-50',
  'On Leave': 'text-amber-600 bg-amber-50',
}

export default function ProfileAvatarCard({ profile, editable }: Props) {
  const fileRef  = useRef<HTMLInputElement>(null)
  const { images, setImage } = useProfileImageStore()
  const imageUrl = profile.email ? (images[profile.email.toLowerCase()] ?? null) : null

  const statusKey = profile.status ?? 'Active'
  const statusCls = STATUS_STYLES[statusKey] ?? STATUS_STYLES['Active']

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !profile.email) return
    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be under 2 MB')
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string
      setImage(profile.email!, base64)
    }
    reader.readAsDataURL(file)
    // reset so same file can be re-selected
    e.target.value = ''
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col items-center text-center">

      {/* Avatar with optional upload overlay */}
      <div className="relative mb-3">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={profile.full_name}
            className="w-16 h-16 rounded-2xl object-cover ring-4 ring-blue-100"
          />
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-2xl font-bold text-white ring-4 ring-blue-100">
            {initials(profile.full_name)}
          </div>
        )}

        {editable && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
            title="Change photo"
          >
            <i className="fa-solid fa-camera text-white text-sm" />
          </button>
        )}
      </div>

      {editable && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="text-[11px] text-blue-600 hover:text-blue-700 font-medium mb-2 flex items-center gap-1"
          >
            <i className="fa-solid fa-arrow-up-from-bracket text-[10px]" />
            {imageUrl ? 'Change Photo' : 'Upload Photo'}
          </button>
        </>
      )}

      <p className="text-[14px] font-bold text-gray-800 leading-tight">{profile.full_name}</p>
      {profile.title && <p className="text-[11px] text-gray-500 mt-0.5">{profile.title}</p>}

      <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full mt-2.5 ${statusCls}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />
        {statusKey.charAt(0).toUpperCase() + statusKey.slice(1)}
      </span>

      {/* Quick stats */}
      <div className="w-full mt-4 space-y-2 text-left">
        {profile.department && (
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl">
            <div className="w-6 h-6 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <i className="fa-solid fa-building text-blue-500 text-[10px]" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] text-gray-400 leading-none">Department</p>
              <p className="text-[11px] font-semibold text-gray-700 mt-0.5 truncate">{profile.department}</p>
            </div>
          </div>
        )}
        {profile.employee_id && (
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl">
            <div className="w-6 h-6 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
              <i className="fa-solid fa-id-badge text-indigo-500 text-[10px]" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] text-gray-400 leading-none">Employee ID</p>
              <p className="text-[11px] font-semibold text-gray-700 mt-0.5 font-mono">{profile.employee_id}</p>
            </div>
          </div>
        )}
        {profile.joining_date && (
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl">
            <div className="w-6 h-6 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
              <i className="fa-solid fa-calendar-check text-emerald-500 text-[10px]" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] text-gray-400 leading-none">Joined</p>
              <p className="text-[11px] font-semibold text-gray-700 mt-0.5">
                {new Date(profile.joining_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
