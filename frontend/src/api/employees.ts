import client from './client'
import type { Employee, CreateEmployeePayload, EditEmployeePayload } from '../types/employee'
import type { RecentEmployee } from '../types/dashboard'

// GET /api/employees/search  →  { success, results, total }
interface SearchResponse {
  success: boolean
  results: Employee[]
  total: number
}

// GET /api/employees/recent  (used by dashboard RecentEmployeesTable)
interface RecentResponse {
  success: boolean
  employees: RecentEmployee[]
}

interface CreateResponse {
  success: boolean
  employee_id?: string
  message?: string
}

interface UpdateResponse {
  success: boolean
  message?: string
}

export const employeesApi = {
  // Primary list / search — GET /api/employees/search?q=&limit=200
  search: (params?: { q?: string; limit?: number }) =>
    client.get<SearchResponse>('/employees/search', { params }),

  // Dashboard recent widget — GET /api/employees/recent
  getRecent: (limit = 3) =>
    client.get<RecentResponse>('/employees/recent', { params: { limit } }),

  // POST /api/employees/add
  create: (data: CreateEmployeePayload) =>
    client.post<CreateResponse>('/employees/add', data),

  // PUT /api/admin/employees/{id}
  update: (id: string, data: EditEmployeePayload) =>
    client.put<UpdateResponse>(`/admin/employees/${id}`, data),

  // POST /api/admin/employees/{id}/toggle-status
  toggleStatus: (id: string, isActive: boolean) =>
    client.post<UpdateResponse>(`/admin/employees/${id}/toggle-status`, { is_active: isActive }),
}
