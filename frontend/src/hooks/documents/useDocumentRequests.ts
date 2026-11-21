import { useState, useEffect, useCallback } from 'react'
import { documentsApi } from '../../api/documents'
import type { DocumentRequest } from '../../types/document'

export function useDocumentRequests() {
  const [requests, setRequests] = useState<DocumentRequest[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await documentsApi.getAllRequests()
      setRequests(data.requests ?? [])
    } catch {
      setError('Failed to load requests')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const approve = useCallback(async (id: number) => {
    try {
      const { data } = await documentsApi.approveRequest(id)
      if (data.success && data.request) {
        setRequests(prev => prev.map(r => r.id === id ? data.request! : r))
      }
      return data.success
    } catch { return false }
  }, [])

  const reject = useCallback(async (id: number, reason: string) => {
    try {
      const { data } = await documentsApi.rejectRequest(id, reason)
      if (data.success && data.request) {
        setRequests(prev => prev.map(r => r.id === id ? data.request! : r))
      }
      return data.success
    } catch { return false }
  }, [])

  const markGenerated = useCallback((id: number, html?: string, fileUrl?: string) => {
    setRequests(prev => prev.map(r =>
      r.id === id
        ? { ...r, status: 'generated' as const, file_html: html, file_url: fileUrl }
        : r
    ))
  }, [])

  const forwardToAccountant = useCallback(async (id: number, approvedBy?: string) => {
    try {
      const { data } = await documentsApi.forwardToAccountant(id, approvedBy)
      if (data.success && data.request) {
        setRequests(prev => prev.map(r => r.id === id ? data.request! : r))
      }
      return data.success
    } catch { return false }
  }, [])

  return { requests, loading, error, approve, reject, markGenerated, forwardToAccountant, refetch: fetch }
}
