import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { getRoleHome } from '../../hooks/useRoleRedirect'
import type { UserRole } from '../../types/user'

interface Props {
  allowedRoles?: UserRole[]
}

export default function ProtectedRoute({ allowedRoles }: Props) {
  const { isAuthenticated, isHydrated, user } = useAuthStore()

  // Don't make any routing decision until localStorage has been read
  if (!isHydrated) return null

  if (!isAuthenticated) return <Navigate to="/login" replace />

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to={getRoleHome(user.role)} replace />
  }

  return <Outlet />
}
