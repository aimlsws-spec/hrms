import type { MyProfile } from '../../../types/profile'

interface InfoRowProps {
  icon:      string
  iconBg:    string
  iconColor: string
  label:     string
  value:     string | null | undefined
}

function InfoRow({ icon, iconBg: _bg, iconColor, label, value }: InfoRowProps) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className="w-5 flex items-center justify-center shrink-0 mt-0.5">
        <i className={`${icon} ${iconColor} text-[12px]`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium text-gray-500 leading-none">{label}</p>
        <p className="text-[13px] font-medium text-gray-800 mt-1 truncate">
          {value || <span className="text-gray-300 font-normal">—</span>}
        </p>
      </div>
    </div>
  )
}

interface Props { profile: MyProfile }

export default function EmploymentInfoCard({ profile }: Props) {
  const joinLabel = profile.joining_date
    ? new Date(profile.joining_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <div className="mb-5">
        <p className="text-[14px] font-semibold text-gray-800">Employment Info</p>
        <p className="text-[12px] text-gray-400 mt-0.5">Read-only details set by HR</p>
      </div>

      <InfoRow icon="fa-solid fa-id-badge"      iconBg="" iconColor="text-blue-400"  label="Employee ID"    value={profile.employee_id} />
      <InfoRow icon="fa-solid fa-building"       iconBg="" iconColor="text-violet-400" label="Department"     value={profile.department}  />
      <InfoRow icon="fa-solid fa-briefcase"      iconBg="" iconColor="text-indigo-400" label="Designation"    value={profile.title}       />
      <InfoRow icon="fa-solid fa-shield-halved"  iconBg="" iconColor="text-gray-400"  label="Role"           value={profile.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : null} />
      <InfoRow icon="fa-solid fa-calendar-check" iconBg="" iconColor="text-blue-400" label="Date of Joining" value={joinLabel} />
      <InfoRow icon="fa-solid fa-circle-dot"     iconBg="" iconColor="text-emerald-400"  label="Status"         value={profile.status ?? 'Active'} />
    </div>
  )
}
