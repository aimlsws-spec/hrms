import { useState, useEffect } from 'react'
import { leavesApi } from '../api/leaves'
import type { LeaveRequest } from '../types/dashboard'

export function usePendingLeaves() {
  const [pendingCount, setPendingCount] = useState(0)
  const [pendingRequests, setPendingRequests] = useState<LeaveRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    leavesApi.getAllRequests()
      .then(({ data }) => {
        if (cancelled) return
        const rows = (data as any).leave_requests ?? data.requests ?? []
        if (data.success && rows.length >= 0) {
          const pending = rows.filter((r: { status: string }) => r.status === 'Pending')
          setPendingCount(pending.length)
          setPendingRequests(pending)
        }
        setIsLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setIsLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  return { pendingCount, pendingRequests, isLoading }
}
