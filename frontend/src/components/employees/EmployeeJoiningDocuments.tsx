import React, { useState, useEffect, useCallback } from 'react'
import {
  joiningDocumentsApi,
  type JoiningDocumentItem,
} from '../../api/joiningDocumentsApi'
import { useAuthStore } from '../../store/authStore'

interface Props {
  employeeId: string
  employeeName: string
}

const DOCUMENT_CATEGORIES = [
  'Signed Appointment Letter',
  'Signed Offer Letter',
  'Signed NDA Agreement',
  'Aadhaar Card Copy',
  'PAN Card Copy',
  'Previous Relieving / Experience Letter',
  'Degree / Educational Certificate',
  'Bank Proof / Cancelled Cheque',
  'Other Joining Document',
] as const

function formatBytes(bytes: number) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export default function EmployeeJoiningDocuments({ employeeId, employeeName }: Props) {
  const { user } = useAuthStore()
  const isHR = user?.role === 'admin' || user?.role === 'hr' || user?.role === 'sub_hr'

  const [docs, setDocs] = useState<JoiningDocumentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Upload form state
  const [category, setCategory] = useState<string>(DOCUMENT_CATEGORIES[0])
  const [customTitle, setCustomTitle] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const fetchDocs = useCallback(async () => {
    if (!employeeId) return
    setLoading(true)
    setError(null)
    try {
      const res = await joiningDocumentsApi.getDocuments(employeeId)
      if (res.data?.success) {
        setDocs(res.data.documents || [])
      } else {
        setError(res.data?.message || 'Could not load joining documents.')
      }
    } catch {
      setError('Failed to fetch joining documents.')
    } finally {
      setLoading(false)
    }
  }, [employeeId])

  useEffect(() => {
    fetchDocs()
  }, [fetchDocs])

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFile) {
      alert('Please select a PDF, PNG, or JPG file to upload.')
      return
    }

    setUploading(true)
    setError(null)
    setUploadSuccess(false)

    try {
      const roleTag = user?.role === 'sub_hr' ? 'Sub-HR' : user?.role === 'hr' ? 'HR Head' : 'HR'
      const uploaderName = `${user?.full_name || 'HR Admin'} (${roleTag})`

      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('document_type', category)
      formData.append('document_name', customTitle.trim() || selectedFile.name)
      formData.append('uploaded_by', uploaderName)
      formData.append('actor_role', user?.role || 'hr')

      const res = await joiningDocumentsApi.uploadDocument(employeeId, formData)
      if (res.data?.success) {
        setSelectedFile(null)
        setCustomTitle('')
        setShowUploadForm(false)
        setUploadSuccess(true)
        setTimeout(() => setUploadSuccess(false), 3000)
        await fetchDocs()
      } else {
        setError(res.data?.message || 'Failed to upload document.')
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to upload file.')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (docId: number, docTitle: string) => {
    if (!window.confirm(`Are you sure you want to delete "${docTitle}"?`)) {
      return
    }

    try {
      setDeletingId(docId)
      const roleTag = user?.role === 'sub_hr' ? 'Sub-HR' : user?.role === 'hr' ? 'HR Head' : 'HR'
      const actorName = `${user?.full_name || 'HR Admin'} (${roleTag})`

      const res = await joiningDocumentsApi.deleteDocument(employeeId, docId, {
        deleted_by: actorName,
        actor_role: user?.role || 'hr',
      })
      if (res.data?.success) {
        await fetchDocs()
      } else {
        alert(res.data?.message || 'Failed to delete document.')
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error deleting document.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
      {/* ── Section Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
            <i className="fa-solid fa-folder-closed text-blue-600 text-[11px]" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-gray-800">Joining Documents &amp; Paperwork</p>
            <p className="text-[10px] text-gray-400">Maintained and stored by HR (PDF, JPG, PNG)</p>
          </div>
        </div>

        {isHR && (
          <button
            type="button"
            onClick={() => setShowUploadForm((v) => !v)}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors flex items-center gap-1 shadow-2xs"
          >
            <i className={`fa-solid ${showUploadForm ? 'fa-xmark' : 'fa-plus'} text-[10px]`} />
            {showUploadForm ? 'Cancel' : 'Upload Document'}
          </button>
        )}
      </div>

      {uploadSuccess && (
        <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-semibold flex items-center gap-2">
          <i className="fa-solid fa-circle-check" />
          <span>Joining document uploaded successfully!</span>
        </div>
      )}

      {error && (
        <div className="p-2.5 rounded-xl bg-red-50 text-red-600 text-xs flex items-center gap-2">
          <i className="fa-solid fa-circle-exclamation" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Upload Form ── */}
      {showUploadForm && (
        <form onSubmit={handleUpload} className="p-3.5 bg-gray-50/70 border border-gray-200 rounded-xl space-y-3 animate-in fade-in duration-150">
          <p className="text-xs font-bold text-gray-800">Upload Joining Document for {employeeName}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">Document Category *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-8 px-2.5 text-xs bg-white border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:border-blue-500"
              >
                {DOCUMENT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">Document Name / Note</label>
              <input
                type="text"
                placeholder="e.g. Signed Offer_2026.pdf"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                className="w-full h-8 px-2.5 text-xs bg-white border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-600 mb-1">Select File (PDF, PNG, JPG) *</label>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              required
              className="w-full text-xs text-gray-600 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowUploadForm(false)}
              className="px-3 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-200 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || !selectedFile}
              className="px-3.5 py-1 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition flex items-center gap-1 shadow-2xs"
            >
              {uploading ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin text-[10px]" />
                  Uploading…
                </>
              ) : (
                <>
                  <i className="fa-solid fa-cloud-arrow-up text-[10px]" />
                  Upload
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* ── Documents List ── */}
      {loading ? (
        <div className="space-y-2 animate-pulse py-2">
          <div className="h-10 bg-gray-100 rounded-xl" />
          <div className="h-10 bg-gray-100 rounded-xl" />
        </div>
      ) : docs.length === 0 ? (
        <div className="py-6 text-center text-gray-400 border border-dashed border-gray-200 rounded-xl bg-gray-50/40">
          <i className="fa-solid fa-file-circle-question text-xl text-gray-300 mb-1 block" />
          <p className="text-xs">No joining documents uploaded yet.</p>
          {isHR && (
            <p className="text-[11px] text-gray-400 mt-0.5">Click "Upload Document" to maintain paperwork.</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => {
            const isPdf = (doc.file_path || '').toLowerCase().endsWith('.pdf') || (doc.file_type || '').includes('pdf')

            return (
              <div
                key={doc.id}
                className="flex items-center justify-between p-2.5 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    isPdf ? 'bg-rose-50 text-rose-600' : 'bg-indigo-50 text-indigo-600'
                  }`}>
                    <i className={`fa-solid ${isPdf ? 'fa-file-pdf' : 'fa-file-image'} text-sm`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate" title={doc.document_name}>
                      {doc.document_name}
                    </p>
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-400 mt-0.5 flex-wrap">
                      <span className="font-medium text-gray-600">{doc.document_type}</span>
                      <span>•</span>
                      <span>{formatBytes(doc.file_size)}</span>
                      <span>•</span>
                      <span>{doc.uploaded_at}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <a
                    href={doc.file_path}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Preview Document"
                  >
                    <i className="fa-solid fa-eye text-xs" />
                  </a>
                  <a
                    href={doc.file_path}
                    download={doc.document_name}
                    className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                    title="Download Document"
                  >
                    <i className="fa-solid fa-download text-xs" />
                  </a>
                  {isHR && (
                    <button
                      type="button"
                      disabled={deletingId === doc.id}
                      onClick={() => handleDelete(doc.id, doc.document_name)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Delete Document"
                    >
                      <i className="fa-solid fa-trash-can text-xs" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
