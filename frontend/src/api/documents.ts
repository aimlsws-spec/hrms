import client from './client'
import type {
  GenerateResult,
  SalarySlipPayload,
  OfferLetterPayload,
  ExperienceLetterPayload,
  RelievingLetterPayload,
  AppointmentLetterPayload,
  UserOption,
  MyDocumentsResponse,
  EmployeeFilesResponse,
  DocumentRequestPayload,
  DocumentRequestsResponse,
  DocumentRequestActionResponse,
  EmployeePrefillResponse,
} from '../types/document'

// GET /api/users  →  { success, users: [{user_id, full_name, role}] }
interface UsersResponse {
  success:  boolean
  users:    UserOption[]
  message?: string
}

// API MISMATCHES DOCUMENTED:
// 1. Legacy JS uses /api/documents/experience-certificate
//    Original stub used /documents/experience-letter — FIXED below
// 2. Legacy JS returns JSON { success, filename, filepath }
//    Original stub used responseType: 'blob' — FIXED below (no blob)
// 3. Relieving letter endpoint /documents/relieving-letter is unverified
//    (legacy JS generateRelievingLetter() had NO actual API call — only window.prompt + static HTML)

export const documentsApi = {
  // Fetch HR users list for employee dropdown (same source as legacy document_functions.js)
  getUsers: () =>
    client.get<UsersResponse>('/users'),

  // POST /api/documents/salary-slip  →  { success, filename, filepath }
  generateSalarySlip: (data: SalarySlipPayload) =>
    client.post<GenerateResult>('/documents/salary-slip', data),

  // POST /api/documents/offer-letter  →  { success, filename, filepath }
  // Timeout 120s — docx2pdf requires Word startup (~60s on first call)
  generateOfferLetter: (data: OfferLetterPayload) =>
    client.post<GenerateResult>('/documents/offer-letter', data, { timeout: 120_000 }),

  // POST /api/documents/experience-letter  →  { success, filename, filepath }
  // Timeout 120s — docx2pdf requires Word startup (~60s on first call)
  generateExperienceLetter: (data: ExperienceLetterPayload) =>
    client.post<GenerateResult>('/documents/experience-letter', data, { timeout: 120_000 }),

  // POST /api/documents/relieving-letter  →  { success, filename, filepath }
  // Timeout 120s — docx2pdf requires Word startup (~60s on first call)
  generateRelievingLetter: (data: RelievingLetterPayload) =>
    client.post<GenerateResult>('/documents/relieving-letter', data, { timeout: 120_000 }),

  // GET /api/documents/my-salary-slips?user_id=X
  getMySalarySlips: (userId: number) =>
    client.get<MyDocumentsResponse>('/documents/my-salary-slips', { params: { user_id: userId } }),

  // GET /api/documents/my-offer-letters?user_id=X
  getMyOfferLetters: (userId: number) =>
    client.get<MyDocumentsResponse>('/documents/my-offer-letters', { params: { user_id: userId } }),

  // GET /api/documents/my-experience-certs?user_id=X
  getMyExperienceCerts: (userId: number) =>
    client.get<MyDocumentsResponse>('/documents/my-experience-certs', { params: { user_id: userId } }),

  // GET /api/admin/employee-files/{user_id} — lists files uploaded during profile completion
  getEmployeeFiles: (userId: string | number) =>
    client.get<EmployeeFilesResponse>(`/admin/employee-files/${userId}`),

  // ── Document request endpoints ────────────────────────────────────────────

  // POST /api/documents/requests
  requestDocument: (data: DocumentRequestPayload) =>
    client.post<DocumentRequestActionResponse>('/documents/requests', data),

  // GET /api/documents/requests/my?employee_id=EMP0001
  getMyRequests: (employeeId: string) =>
    client.get<DocumentRequestsResponse>('/documents/requests/my', { params: { employee_id: employeeId } }),

  // GET /api/documents/requests/all  (HR only)
  getAllRequests: () =>
    client.get<DocumentRequestsResponse>('/documents/requests/all'),

  // POST /api/documents/requests/{id}/approve
  approveRequest: (requestId: number) =>
    client.post<DocumentRequestActionResponse>(`/documents/requests/${requestId}/approve`),

  // POST /api/documents/requests/{id}/reject
  rejectRequest: (requestId: number, reason: string) =>
    client.post<DocumentRequestActionResponse>(`/documents/requests/${requestId}/reject`, { reason }),

  // POST /api/documents/requests/{id}/generate  →  { success, html, request }
  generateForRequest: (requestId: number, extra?: Record<string, unknown>) =>
    client.post<DocumentRequestActionResponse & GenerateResult>(`/documents/requests/${requestId}/generate`, extra ?? {}),

  // POST /api/documents/requests/{id}/forward-to-accountant
  forwardToAccountant: (requestId: number, approvedBy?: string) =>
    client.post<DocumentRequestActionResponse>(`/documents/requests/${requestId}/forward-to-accountant`, { approved_by: approvedBy }),

  // GET /api/documents/requests/accountant  (accountant only — hr_approved + generated salary slips)
  getAccountantRequests: () =>
    client.get<DocumentRequestsResponse>('/documents/requests/accountant'),

  // POST /api/documents/requests/{id}/accountant-generate
  // Timeout 120s — docx2pdf (MS Word) startup can take 50-90s on first call
  accountantGenerate: (requestId: number) =>
    client.post<DocumentRequestActionResponse & GenerateResult>(
      `/documents/requests/${requestId}/accountant-generate`,
      {},
      { timeout: 120_000 },
    ),

  // POST /api/documents/generate-appointment-letter
  generateAppointmentLetter: (data: AppointmentLetterPayload) =>
    client.post<GenerateResult>(
      '/documents/generate-appointment-letter',
      data,
      { timeout: 120_000 }
    ),

  // GET /api/documents/employee-prefill/{employee_id}
  getEmployeePrefill: (employeeId: string) =>
    client.get<EmployeePrefillResponse>(`/documents/employee-prefill/${encodeURIComponent(employeeId)}`),

  // GET /api/documents/download/{filename}
  getDownloadUrl: (filename: string) => `/api/documents/download/${encodeURIComponent(filename)}`,
}
