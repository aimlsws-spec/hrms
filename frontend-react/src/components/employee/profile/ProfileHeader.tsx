import { useProfileImageStore } from '../../../store/profileImageStore'
import type { MyProfile } from '../../../types/profile'

function initials(name: string) {
  return name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

interface Props { profile: MyProfile }

export default function ProfileHeader({ profile }: Props) {
  const { images } = useProfileImageStore()
  const imageUrl   = profile.email ? (images[profile.email.toLowerCase()] ?? null) : null

  const joinLabel = profile.joining_date
    ? new Date(profile.joining_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  return (
    <div className="relative overflow-hidden rounded-2xl bg-[#0f172a] text-white px-5 py-5">
      <div className="pointer-events-none absolute -right-10 -top-10 w-48 h-48 rounded-full bg-blue-600/10" />
      <div className="pointer-events-none absolute -right-4 top-8 w-28 h-28 rounded-full bg-blue-500/10" />

      <div className="relative flex items-center justify-between flex-wrap gap-4">
        {/* Left: avatar + identity */}
        <div className="flex items-center gap-3.5">
          <div className="shrink-0 ring-2 ring-blue-500/40 rounded-xl">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={profile.full_name}
                className="w-12 h-12 rounded-xl object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-lg font-bold">
                {initials(profile.full_name)}
              </div>
            )}
          </div>
          <div>
            <h2 className="text-[17px] font-bold text-white leading-tight">{profile.full_name}</h2>
            <p className="text-slate-400 text-[11px] mt-0.5">@{profile.username}</p>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {profile.department && (
                <span className="inline-flex items-center gap-1 text-[10px] bg-white/10 text-slate-300 px-1.5 py-0.5 rounded">
                  <i className="fa-solid fa-building text-[8px]" />{profile.department}
                </span>
              )}
              {profile.title && (
                <span className="inline-flex items-center gap-1 text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded">
                  <i className="fa-solid fa-briefcase text-[8px]" />{profile.title}
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded capitalize">
                <i className="fa-solid fa-shield-halved text-[8px]" />{profile.role}
              </span>
            </div>
          </div>
        </div>

        {/* Right: meta */}
        <div className="text-right shrink-0 space-y-1">
          {profile.employee_id && (
            <p className="text-[11px] text-slate-400 font-mono">
              ID: <span className="text-slate-200 font-semibold">{profile.employee_id}</span>
            </p>
          )}
          {joinLabel && (
            <p className="text-[11px] text-slate-400">
              Joined <span className="text-slate-200 font-medium">{joinLabel}</span>
            </p>
          )}
          <div className="flex items-center justify-end gap-1.5 text-[11px] text-emerald-400 mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
            {profile.status ?? 'Active'}
          </div>
        </div>
      </div>
    </div>
  )
}
