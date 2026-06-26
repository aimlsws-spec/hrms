import { useState, useEffect, useCallback } from 'react'
import { leavesApi } from '../../api/leaves'
import type { LeaveRequest } from '../../types/leave'

export function useLeaveRequests(isHRAdmin: boolean, userId?: number) {
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    if (!isHRAdmin && !userId) { setIsLoading(false); return }
    setIsLoading(true)
    try {
      if (isHRAdmin) {
        const { data } = await leavesApi.getAllRequests()
        // Backend returns `leave_requests`; `requests` is a legacy fallback
        const rows = (data as any).leave_requests ?? data.requests ?? []
        setRequests(rows)
      } else if (userId) {
        const { data } = await leavesApi.getEmployeeRequests(userId)
        setRequests(data.requests ?? [])
      }
    } catch {
      setRequests([])
    } finally {
      setIsLoading(false)
    }
  }, [isHRAdmin, userId])

  useEffect(() => { load() }, [load])

  async function rejectRequest(id: number, approvedBy: string, comments: string) {
    await leavesApi.rejectLeave(id, approvedBy, comments)
    await load()
  }

  return { requests, isLoading, refetch: load, rejectRequest }
}
