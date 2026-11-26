export type UserRole = 'admin' | 'hr' | 'sub_hr' | 'manager' | 'employee' | 'accountant'

export interface User {
  user_id: number | string
  username: string
  full_name: string
  email: string
  role: UserRole
  department?: string
  token: string
  profile_completed?: boolean
}
