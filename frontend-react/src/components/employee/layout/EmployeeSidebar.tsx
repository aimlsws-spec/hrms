import { NavLink } from 'react-router-dom'
import { useAuthStore } from '../../../store/authStore'
import Avatar from '../../ui/Avatar'

const NAV_ITEMS = [
  {
    to: '/employee/dashboard',
    label: 'Dashboard',
    icon: <i className="fa-solid fa-gauge-high w-4 text-center" />,
  },
  {
    to: '/employee/leave',
    label: 'My Leaves',
    icon: <i className="fa-solid fa-calendar-days w-4 text-center" />,
  },
  {
    to: '/employee/attendance',
    label: 'Attendance',
    icon: <i className="fa-solid fa-clock-rotate-left w-4 text-center" />,
  },
  {
    to: '/employee/expenses',
    label: 'Expenses',
    icon: <i className="fa-solid fa-receipt w-4 text-center" />,
  },
  {
    to: '/employee/documents',
    label: 'Documents',
    icon: <i className="fa-solid fa-file-lines w-4 text-center" />,
  },
  {
    to: '/employee/profile',
    label: 'My Profile',
    icon: <i className="fa-solid fa-circle-user w-4 text-center" />,
  },
]

export default function EmployeeSidebar() {
  const { user } = useAuthStore()

  return (
    <aside className="w-56 h-screen bg-primary-900 text-white flex flex-col shrink-0">
      {/* Brand */}
      <div className="px-5 h-14 flex items-center gap-2.5 border-b border-white/10">
        <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
          <i className="fa-solid fa-briefcase text-[11px] text-white" />
        </div>
        <div className="leading-none">
          <p className="text-[13px] font-bold tracking-wide text-white">HRMS</p>
          <p className="text-[10px] text-primary-300 mt-0.5">Employee Portal</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2.5 py-4 space-y-0.5 overflow-y-auto">
        <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-primary-300/60">
          Menu
        </p>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all ${
                isActive
                  ? 'bg-white/15 text-white shadow-sm'
                  : 'text-primary-200 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User footer */}
      <div className="px-3 py-3 border-t border-white/10">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg bg-white/5">
          <Avatar name={user?.full_name ?? 'E'} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold text-white truncate leading-none">
              {user?.full_name ?? 'Employee'}
            </p>
            <p className="text-[11px] text-primary-300 capitalize mt-0.5 truncate">
              {user?.department ?? user?.role ?? 'employee'}
            </p>
          </div>
        </div>
      </div>
    </aside>
  )
}
