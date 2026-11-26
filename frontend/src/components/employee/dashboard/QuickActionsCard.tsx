import { useNavigate } from 'react-router-dom'

interface Action {
  label: string
  sub: string
  icon: string
  path: string
  iconBg: string
  iconColor: string
  hoverBorder: string
}

const ACTIONS: Action[] = [
  {
    label: 'Apply Leave',
    sub: 'Submit request',
    icon: 'fa-solid fa-calendar-plus',
    path: '/employee/leave',
    iconBg: 'bg-emerald-50 group-hover:bg-emerald-100',
    iconColor: 'text-emerald-600',
    hoverBorder: 'hover:border-emerald-200',
  },
  {
    label: 'Attendance',
    sub: 'Mark today',
    icon: 'fa-solid fa-clock',
    path: '/employee/attendance',
    iconBg: 'bg-blue-50 group-hover:bg-blue-100',
    iconColor: 'text-blue-600',
    hoverBorder: 'hover:border-blue-200',
  },
  {
    label: 'Expenses',
    sub: 'Claim & status',
    icon: 'fa-solid fa-receipt',
    path: '/employee/expenses',
    iconBg: 'bg-amber-50 group-hover:bg-amber-100',
    iconColor: 'text-amber-600',
    hoverBorder: 'hover:border-amber-200',
  },
  {
    label: 'My Profile',
    sub: 'View details',
    icon: 'fa-solid fa-id-card',
    path: '/employee/profile',
    iconBg: 'bg-purple-50 group-hover:bg-purple-100',
    iconColor: 'text-purple-600',
    hoverBorder: 'hover:border-purple-200',
  },
]

export default function QuickActionsCard() {
  const navigate = useNavigate()

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
          <i className="fa-solid fa-bolt text-gray-600 text-[12px]" />
        </div>
        <p className="text-[13px] font-semibold text-gray-800">Quick Actions</p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {ACTIONS.map(a => (
          <button
            key={a.path}
            onClick={() => navigate(a.path)}
            className={`group flex items-center gap-3 p-3.5 rounded-xl border border-gray-100 bg-gray-50 hover:bg-white hover:shadow-sm transition-all text-left ${a.hoverBorder}`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0 ${a.iconBg}`}>
              <i className={`${a.icon} ${a.iconColor} text-[12px]`} />
            </div>
            <div className="flex-1">
              <p className="text-[12px] font-semibold text-gray-800 leading-none">{a.label}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{a.sub}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-3.5 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
        <span>Salary breakdown:</span>
        <button
          onClick={() => navigate('/employee/profile?tab=salary')}
          className="font-semibold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1"
        >
          <span>Profile → Salary</span>
          <i className="fa-solid fa-arrow-right text-[9px]" />
        </button>
      </div>
    </div>
  )
}
