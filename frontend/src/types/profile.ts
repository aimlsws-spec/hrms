export interface MyProfile {
  user_id:       number
  username:      string
  full_name:     string
  email:         string
  role:          string
  is_active:     boolean
  // From employees table
  employee_id:   string | null
  department:    string | null
  phone:         string | null
  title:         string | null
  joining_date:  string | null
  status:        string | null
  city:          string | null
  state:         string | null
  // From employee_profiles (optional — present only if profile was completed)
  date_of_birth?:   string | null
  gender?:          string | null
  marital_status?:  string | null
  nationality?:     string | null
  emergency_number?: string | null
  current_address?:  string | null
  permanent_address?: string | null
  default_work_mode?: 'WFO' | 'WFH' | null
  // Home location for WFH geo attendance
  home_address?:     string | null
  home_location_set?: boolean
  home_latitude?:    number | null
  home_longitude?:   number | null
  home_updated_at?:  string | null
}

export interface UpdateProfilePayload {
  phone?:             string
  city?:              string
  state?:             string
  emergency_number?:  string
  // Personal details (sent to profile API; full_name handled separately via employee API)
  full_name?:         string
  date_of_birth?:     string
  gender?:            string
  marital_status?:    string
  nationality?:       string
  current_address?:   string
  // WFH home address — geocoded server-side, coordinates never returned to employee
  home_address?:      string
}

export interface UpdateProfileResponse {
  success:           boolean
  message?:          string
  geocoding_status?: 'success' | 'geocoding_failed' | 'db_error' | 'skipped'
  geocoding_note?:   string
}
