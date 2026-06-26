export type UserRole = 'admin' | 'hr' | 'manager' | 'employee' | 'accountant'

export interface User {
  user_id: number
  username: string
  full_name: string
  email: string
  role: UserRole
  department?: string
  token: string
}
