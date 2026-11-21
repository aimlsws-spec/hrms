import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../../store/authStore'
import NotificationBell from '../../layout/NotificationBell'

export default function EmployeeHeader() {
  const { user, clearUser } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    clearUser()
    navigate('/login')
  }

  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-6 shrink-0">
      {/* Left: page breadcrumb feel */}
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <i className="fa-solid fa-house text-xs text-gray-300" />
        <span className="text-gray-300">/</span>
        <span className="text-gray-600 font-medium">Employee Portal</span>
      </div>

      {/* Right: user + logout */}
      <div className="flex items-center gap-3">
        <NotificationBell />
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-full pl-3 pr-1 py-1">
          <span className="text-sm text-gray-700 font-medium">{user?.full_name}</span>
          {user?.department && (
            <span className="hidden sm:inline text-xs text-gray-400 bg-white border border-gray-100 rounded-full px-2 py-0.5">
              {user.department}
            </span>
          )}
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-600 bg-gray-50 hover:bg-red-50 border border-gray-100 hover:border-red-100 rounded-full px-3 py-1.5 transition-all font-medium"
        >
          <i className="fa-solid fa-arrow-right-from-bracket text-[10px]" />
          Logout
        </button>
      </div>
    </header>
  )
}
