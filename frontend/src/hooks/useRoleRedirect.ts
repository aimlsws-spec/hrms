import { useAuthStore } from '../store/authStore'
import type { UserRole } from '../types/user'

const ROLE_HOME: Record<UserRole, string> = {
  admin:      '/hr/dashboard',
  hr:         '/hr/dashboard',
  sub_hr:     '/hr/dashboard',
  manager:    '/hr/dashboard',
  employee:   '/employee/dashboard',
  accountant: '/accountant/dashboard',
}

export function getRoleHome(role: UserRole): string {
  return ROLE_HOME[role]
}

export function useRoleHome(): string {
  const role = useAuthStore((s) => s.user?.role)
  return role ? ROLE_HOME[role] : '/login'
}
