export type DocumentType = 'salary-slip' | 'offer-letter' | 'experience-letter' | 'relieving-letter'

export interface GenerateResult {
  success:       boolean
  filename?:     string
  filepath?:     string
  download_url?: string
  html?:         string
  title?:        string
  message?:      string
  error?:        string
}

export interface AppointmentLetterPayload {
  employee_code: string
  position?:     string
  salary?:       number
  joining_date?: string
  name?:         string
  address?:      string
  email?:        string
  skip_insert?:  boolean
}

export interface SalarySlipPayload {
  employee_id: number | string
  month: number
  year: number
}

export interface OfferLetterPayload {
  employee_id:   number | string
  position:      string
  salary:        number
  joining_date:  string
  // Optional HR overrides — sent when HR edits auto-filled fields
  name?:         string
  address?:      string
  email?:        string
  skip_insert?:  boolean
}

export interface EmployeePrefillData {
  employee_code: string
  full_name:     string
  email:         string
  position:      string
  department:    string
  phone:         string
  address:       string
  joining_date:  string  // YYYY-MM-DD
  annual_salary: number
}

export interface EmployeePrefillResponse {
  success:  boolean
  data?:    EmployeePrefillData
  message?: string
}

export interface ExperienceLetterPayload {
  employee_id:  number | string
  position:     string
  department:   string
  start_date:   string
  end_date:     string
  // Optional HR overrides
  name?:        string
  address?:     string
  contact_no?:  string
  email?:       string
  skip_insert?: boolean
}

export interface RelievingLetterPayload {
  employee_id:       number | string
  last_date:         string   // last working day
  resignation_date?: string   // date of resignation letter
  position?:         string
  // Optional HR overrides
  name?:             string
  address?:          string
  contact_no?:       string
  email?:            string
  skip_insert?:      boolean
}

export interface UserOption {
  user_id: string
  full_name: string
  email: string
  role: string
}

export interface MyDocumentFile {
  path: string
  name: string
}

export interface MyDocumentsResponse {
  success: boolean
  files?: MyDocumentFile[]
}

export interface EmployeeUploadedFile {
  name:         string
  path:         string
  download_url: string
}

export interface EmployeeFilesResponse {
  success: boolean
  files?:  EmployeeUploadedFile[]
}

// ── Document Request types ───────────────────────────────────────────────────

export type DocumentRequestStatus = 'pending' | 'approved' | 'hr_approved' | 'rejected' | 'generated'

export interface DocumentRequest {
  id:               number
  employee_id:      string
  employee_name?:   string
  document_type:    string
  reason?:          string
  status:           DocumentRequestStatus
  file_url?:        string
  file_html?:       string
  created_at:       string
  updated_at?:      string
  rejected_reason?: string
  requested_month?: string   // YYYY-MM
  hr_approved_by?:  string
  hr_forwarded_at?: string
}

export interface DocumentRequestPayload {
  employee_id:      string
  document_type:    string
  reason?:          string
  requested_month?: string   // YYYY-MM — required for salary-slip
}

export interface DocumentRequestsResponse {
  success:   boolean
  requests?: DocumentRequest[]
}

export interface DocumentRequestActionResponse {
  success:  boolean
  message?: string
  request?: DocumentRequest
}
