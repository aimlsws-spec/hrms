import { NavLink, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuthStore } from '../../store/authStore'
import type { UserRole } from '../../types/user'

interface NavItem {
  to: string
  label: string
  icon: string
  roles?: UserRole[]
  children?: NavItem[]
}

const NAV_ITEMS: NavItem[] = [
  { to: '/hr/dashboard', label: 'Dashboard',       icon: 'fas fa-chart-pie',      roles: ['admin', 'hr', 'sub_hr', 'manager'] },
  { to: '/employees',    label: 'Employees',        icon: 'fas fa-users',          roles: ['admin', 'hr', 'sub_hr'] },
  { to: '/leaves',       label: 'Leave Management', icon: 'fas fa-calendar-alt',   roles: ['admin', 'hr', 'sub_hr', 'manager'] },
  { to: '/payroll',      label: 'Payroll',          icon: 'fas fa-money-bill-wave', roles: ['admin', 'hr', 'sub_hr'] },
  { to: '/hr/reimbursements', label: 'Reimbursements', icon: 'fas fa-money-check-dollar', roles: ['admin', 'hr', 'sub_hr'] },
  { to: '/documents',    label: 'Documents',        icon: 'fas fa-file-alt',       roles: ['admin', 'hr', 'sub_hr'] },
  {
    to: '/attendance',
    label: 'Attendance',
    icon: 'fas fa-clock',
    roles: ['admin', 'hr', 'sub_hr'],
    children: [
      { to: '/attendance',              label: 'Records',         icon: 'fas fa-calendar-check',   roles: ['admin', 'hr', 'sub_hr'] },
      { to: '/attendance/wfo',          label: 'WFO View',        icon: 'fas fa-building',          roles: ['admin', 'hr', 'sub_hr'] },
      { to: '/attendance/wfh',          label: 'WFH View',        icon: 'fas fa-house',             roles: ['admin', 'hr', 'sub_hr'] },
      { to: '/attendance/work-hours',   label: 'Hours & Breaks',  icon: 'fas fa-stopwatch',         roles: ['admin', 'hr', 'sub_hr'] },
      { to: '/attendance/evidence',     label: 'Selfie & Location', icon: 'fas fa-camera-retro',   roles: ['admin', 'hr', 'sub_hr'] },
    ],
  },
  { to: '/analytics',    label: 'Analytics',        icon: 'fas fa-chart-line',     roles: ['admin', 'hr', 'sub_hr'] },
  { to: '/hr/activity-logs', label: 'HR Activity Log', icon: 'fas fa-history', roles: ['admin', 'hr', 'sub_hr'] },
  // LIVE-PUNCH DISABLED: biometric menu hidden while device integration is paused.
  // {
  //   to: '/biometric',
  //   label: 'Biometric',
  //   icon: 'fas fa-fingerprint',
  //   roles: ['admin', 'hr'],
  //   children: [
  //     { to: '/biometric/live',    label: 'Live Feed', icon: 'fas fa-circle-notch', roles: ['admin', 'hr'] },
  //   ],
  // },
]

function roleColor(role: string) {
  const map: Record<string, string> = {
    admin:   'bg-red-500/20 text-red-200',
    hr:      'bg-blue-500/20 text-blue-200',
    manager: 'bg-green-500/20 text-green-200',
  }
  return map[role] ?? 'bg-white/10 text-primary-200'
}

function initials(name: string) {
  const parts = name.trim().split(' ').filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return (parts[0][0] ?? '?').toUpperCase()
  return ((parts[0][0] ?? '') + (parts[parts.length - 1][0] ?? '')).toUpperCase()
}

interface SidebarProps {
  navItems?: NavItem[]
  brandingTitle?: string
  brandingSubtitle?: string
}

function NavGroupItem({ item, userRole }: { item: NavItem; userRole?: UserRole }) {
  const location = useLocation()
  const isChildActive = item.children?.some((c) => location.pathname.startsWith(c.to)) ?? false
  const [open, setOpen] = useState(isChildActive)

  useEffect(() => {
    if (isChildActive) setOpen(true)
  }, [isChildActive])

  const visibleChildren = item.children?.filter(
    (c) => !c.roles || (userRole && c.roles.includes(userRole))
  ) ?? []

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
          isChildActive
            ? 'bg-white/15 text-white shadow-sm'
            : 'text-primary-200 hover:bg-white/10 hover:text-white'
        }`}
      >
        <div className="w-6 h-6 flex items-center justify-center shrink-0">
          <i className={`${item.icon} text-[18px]`}></i>
        </div>
        <span className="flex-1 truncate text-left">{item.label}</span>
        <i className={`fas fa-chevron-${open ? 'down' : 'right'} text-[11px] opacity-60`}></i>
      </button>

      {open && (
        <div className="ml-3 mt-0.5 space-y-0.5 border-l border-white/10 pl-3">
          {visibleChildren.map((child) => (
            <NavLink
              key={child.to}
              to={child.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-white/15 text-white shadow-sm'
                    : 'text-primary-300 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <div className="w-5 h-5 flex items-center justify-center shrink-0">
                <i className={`${child.icon} text-[14px]`}></i>
              </div>
              <span className="truncate">{child.label}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Sidebar({ navItems, brandingTitle, brandingSubtitle }: SidebarProps) {
  const { user } = useAuthStore()

  const itemsToUse = navItems ?? NAV_ITEMS
  const visible = itemsToUse.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role))
  )

  return (
    <aside className="w-60 min-h-screen bg-primary-900 text-white flex flex-col shrink-0">

      {/* Branding */}
      <div className="px-5 py-5 border-b border-white/10">
        <h1 className="text-sm font-bold tracking-wide leading-tight text-white">
          {brandingTitle ?? 'Seawind HRMS'}
        </h1>
        <p className="text-xs text-primary-300 mt-0.5">
          {brandingSubtitle ?? 'Human Resources'}
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {visible.map((item) =>
          item.children ? (
            <NavGroupItem key={item.to} item={item} userRole={user?.role} />
          ) : (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-white/15 text-white shadow-sm'
                    : 'text-primary-200 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <div className="w-6 h-6 flex items-center justify-center shrink-0">
                <i className={`${item.icon} text-[18px]`}></i>
              </div>
              <span className="truncate">{item.label}</span>
            </NavLink>
          )
        )}
      </nav>

      {/* User profile footer */}
      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white/15 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
            {user?.full_name ? initials(user.full_name) : '?'}
          </div>
          <div className="min-w-0 flex-1">
            {user?.full_name && (
              <p className="text-sm font-semibold text-white truncate leading-tight">
                {user.full_name}
              </p>
            )}
            {user?.role && (
              <span className={`inline-block text-xs px-1.5 py-0.5 rounded mt-0.5 font-medium capitalize ${roleColor(user.role)}`}>
                {user.role}
              </span>
            )}
          </div>
        </div>
      </div>
    </aside>
  )
}
