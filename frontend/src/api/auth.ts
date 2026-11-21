import axios from 'axios'
import type { UserRole } from '../types/user'

const authClient = axios.create({ baseURL: import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : '', timeout: 10000 })

export interface LoginPayload    { username: string; password: string }
export interface OtpPayload      { username: string; otp: string }

export interface SignupPayload {
  full_name: string
  username: string
  email: string
  password: string
  phone: string
  department: string
  work_mode?: 'WFO' | 'WFH'
  enroll_id?: string
}

export interface SignupResponse {
  success: boolean
  message?: string
  employee_id?: string
}

export interface LoginResponse {
  success: boolean
  requires_otp?: boolean
  otp?: string
  message?: string
}

interface BackendUser {
  user_id: number
  username: string
  email: string
  full_name: string
  role: UserRole
  profile_completed?: boolean
}

export interface VerifyOtpResponse {
  success: boolean
  user?: BackendUser
  token?: string
  dashboard?: string
  message?: string
}

export const authApi = {
  login: (data: LoginPayload) =>
    authClient.post<LoginResponse>('/api/auth/login', data),

  verifyOtp: (data: OtpPayload) =>
    authClient.post<VerifyOtpResponse>('/api/auth/verify-otp', data),

  employeeSignup: (data: SignupPayload) =>
    authClient.post<SignupResponse>('/api/auth/signup', data),
}
