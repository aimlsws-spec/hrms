import { useState, useEffect, useCallback } from 'react'
import { documentsApi } from '../../../api/documents'
import type { DocumentRequest, DocumentRequestPayload } from '../../../types/document'

export function useMyDocumentRequests(employeeId: string) {
  const [requests,      setRequests]      = useState<DocumentRequest[]>([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState<string | null>(null)
  const [submitting,    setSubmitting]    = useState(false)
  const [submitError,   setSubmitError]   = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  const fetch = useCallback(async () => {
    if (!employeeId) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const { data } = await documentsApi.getMyRequests(employeeId)
      setRequests(data.requests ?? [])
    } catch {
      setError('Failed to load requests')
    } finally {
      setLoading(false)
    }
  }, [employeeId])

  useEffect(() => { fetch() }, [fetch])

  const submitRequest = useCallback(async (payload: DocumentRequestPayload) => {
    setSubmitting(true)
    setSubmitError(null)
    setSubmitSuccess(false)
    try {
      const { data } = await documentsApi.requestDocument(payload)
      if (data.success) {
        setSubmitSuccess(true)
        if (data.request) setRequests(prev => [data.request!, ...prev])
        return true
      }
      setSubmitError(data.message ?? 'Failed to submit request')
      return false
    } catch {
      setSubmitError('Failed to submit request')
      return false
    } finally {
      setSubmitting(false)
    }
  }, [])

  return {
    requests,
    loading,
    error,
    submitting,
    submitError,
    submitSuccess,
    submitRequest,
    refetch: fetch,
  }
}
