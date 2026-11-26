import client from './client'

export interface JoiningDocumentItem {
  id: number
  employee_id: string
  document_type: string
  document_name: string
  file_path: string
  file_type: string
  file_size: number
  uploaded_by: string
  uploaded_at: string
}

export interface JoiningDocumentsResponse {
  success: boolean
  documents: JoiningDocumentItem[]
  message?: string
}

export interface UploadJoiningDocResponse {
  success: boolean
  message?: string
  document?: JoiningDocumentItem
}

export const joiningDocumentsApi = {
  getDocuments: (employeeId: string) =>
    client.get<JoiningDocumentsResponse>(`/employees/${employeeId}/joining-documents`),

  uploadDocument: (employeeId: string, formData: FormData) =>
    client.post<UploadJoiningDocResponse>(
      `/employees/${employeeId}/joining-documents`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    ),

  deleteDocument: (
    employeeId: string,
    documentId: number,
    params?: { deleted_by?: string; actor_role?: string }
  ) =>
    client.delete<{ success: boolean; message?: string }>(
      `/employees/${employeeId}/joining-documents/${documentId}`,
      { params }
    ),
}
