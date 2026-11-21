import type { User } from '../../../types/user'

interface Props { user: User }

const DAY   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const MONTH = ['January','February','March','April','May','June',
               'July','August','September','October','November','December']

function formatDate(d: Date) {
  return `${DAY[d.getDay()]}, ${d.getDate()} ${MONTH[d.getMonth()]} ${d.getFullYear()}`
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function EmployeeWelcomeCard({ user }: Props) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-primary-900 text-white px-6 py-5">
      {/* subtle background rings */}
      <div className="pointer-events-none absolute -right-10 -top-10 w-52 h-52 rounded-full bg-white/5" />
      <div className="pointer-events-none absolute -right-4 top-8 w-32 h-32 rounded-full bg-white/10" />

      <div className="relative flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          {/* Avatar with ring */}
          <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center text-lg font-bold shrink-0 ring-2 ring-white/20">
            {user.full_name.trim().split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase()}
          </div>
          <div>
            <p className="text-primary-300 text-xs font-medium">{greeting()}</p>
            <h2 className="text-lg font-bold text-white leading-tight mt-0.5">
              {user.full_name}
            </h2>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {user.department && (
                <span className="inline-flex items-center gap-1 text-[11px] bg-white/10 text-primary-200 px-2 py-0.5 rounded-md">
                  <i className="fa-solid fa-building text-[9px]" />
                  {user.department}
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-[11px] bg-white/15 text-white px-2 py-0.5 rounded-md capitalize">
                <i className="fa-solid fa-shield-halved text-[9px]" />
                {user.role}
              </span>
            </div>
          </div>
        </div>

        {/* Date badge */}
        <div className="text-right shrink-0">
          <p className="text-[10px] uppercase tracking-widest text-primary-300 font-medium">Today</p>
          <p className="text-sm font-semibold text-primary-200 mt-0.5">{formatDate(new Date())}</p>
          <div className="flex items-center justify-end gap-1 mt-2 text-[11px] text-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 inline-block animate-pulse" />
            Active
          </div>
        </div>
      </div>
    </div>
  )
}
