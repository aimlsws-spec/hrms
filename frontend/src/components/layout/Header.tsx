import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import NotificationBell from './NotificationBell'

interface HeaderProps {
  leftContent?: React.ReactNode
}

export default function Header({ leftContent }: HeaderProps) {
  const { user, clearUser } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    clearUser()
    navigate('/login')
  }

  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-6 shadow-sm shrink-0">
      {leftContent ?? (
        <div className="flex items-center gap-2">
          <img src="/seawind-logo.png" alt="SeaWind" className="h-7 w-auto object-contain md:hidden" />
        </div>
      )}

      <div className="flex items-center gap-3">
        <NotificationBell />
        <div className="text-right hidden sm:block">
          <p className="text-xs font-semibold text-gray-800 leading-tight">
            {user?.full_name}
          </p>
          <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
        </div>
        <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-800 text-xs font-bold shrink-0">
          {user?.full_name
            ? user.full_name.trim().split(' ').filter(Boolean).map(p => p[0]).slice(0, 2).join('').toUpperCase()
            : '?'}
        </div>
        <div className="h-5 w-px bg-gray-200" />
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-600 font-medium transition-colors px-2 py-1.5 rounded-lg hover:bg-red-50"
        >
          <i className="fas fa-sign-out-alt text-xs" />
          <span>Logout</span>
        </button>
      </div>
    </header>
  )
}
