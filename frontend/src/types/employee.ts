// Shape returned by GET /api/employees/search
export interface Employee {
  employee_id: string
  name: string       // backend employees table uses 'name' column
  title?: string
  email?: string
  department?: string
  city?: string
  state?: string
  phone?: string
  annual_ctc?: number
  address?: string
  pincode?: string
  profile_url?: string
  role?: string
  joining_date?: string | null
  status?: string | null
  // Extended profile fields (present when API populates them)
  date_of_birth?: string | null
  gender?: string | null
  marital_status?: string | null
  nationality?: string | null
  emergency_number?: string | null
  current_address?: string | null
  permanent_address?: string | null
  home_address?: string | null
  home_latitude?: number | null
  home_longitude?: number | null
  home_location_set?: boolean
}

export interface CreateEmployeePayload {
  first_name: string
  middle_name?: string
  last_name: string
  full_name?: string   // composed by the hook before sending
  email: string
  phone?: string
  department: string
  title: string
  password: string
  annual_ctc: number
}

export interface EditEmployeePayload {
  full_name?: string
  email?: string
  department?: string
  title?: string
  phone?: string
  annual_ctc?: number
}

export const DEPARTMENTS = [
  'HR', 'IT', 'Finance', 'Sales', 'Marketing', 'Operations', 'Legal',
] as const

export type Department = typeof DEPARTMENTS[number]
