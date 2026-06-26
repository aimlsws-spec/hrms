import { useState, useEffect, useCallback } from 'react'
import { attendanceApi } from '../../api/attendance'
import type { RegularizationRequest, RegularizationPayload } from '../../types/attendance'

export function useRegularization(mode: 'pending' | 'employee', employeeId?: string) {
  const [requests, setRequests]   = useState<RegularizationRequest[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError]         = useState('')

  const load = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      let res
      if (mode === 'pending') {
        res = await attendanceApi.getPendingRegularizations()
      } else {
        if (!employeeId) { setIsLoading(false); return }
        res = await attendanceApi.getEmployeeRegularizations(employeeId)
      }
      if (!res.data.success && res.data.message) {
        setError(res.data.message)
      } else {
        setRequests(res.data.requests ?? [])
      }
    } catch {
      setError('Failed to load regularization requests. Please retry.')
    } finally {
      setIsLoading(false)
    }
  }, [mode, employeeId])

  useEffect(() => { load() }, [load])

  async function submit(payload: RegularizationPayload): Promise<boolean> {
    setError('')
    try {
      const { data } = await attendanceApi.requestRegularization(payload)
      if (!data.success) { setError(data.message || 'Failed to submit request.'); return false }
      await load()
      return true
    } catch {
      setError('Connection failed.')
      return false
    }
  }

  async function approve(requestId: number, approvedBy: string, comments?: string): Promise<boolean> {
    setError('')
    try {
      const { data } = await attendanceApi.approveRegularization(requestId, approvedBy, comments)
      if (!data.success) { setError(data.message || 'Approval failed.'); return false }
      await load()
      return true
    } catch {
      setError('Connection failed.')
      return false
    }
  }

  return { requests, isLoading, error, submit, approve, refetch: load }
}
