import { useState, useEffect } from 'react'
import { leavesApi } from '../../api/leaves'
import type { LeaveRequest } from '../../types/leave'
import type { ChartPoint } from '../../types/analytics'

export function useLeaveAnalytics() {
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError]         = useState('')

  useEffect(() => {
    async function load() {
      setIsLoading(true)
      setError('')
      try {
        const { data } = await leavesApi.getAllRequests()
        setRequests(data.leave_requests ?? data.requests ?? [])
      } catch {
        setError('Failed to load leave data.')
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  const statusData: ChartPoint[] = (() => {
    const counts: Record<string, number> = { Pending: 0, Approved: 0, Rejected: 0 }
    requests.forEach(r => { counts[r.status] = (counts[r.status] ?? 0) + 1 })
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  })()

  const typeData: ChartPoint[] = (() => {
    const counts: Record<string, number> = {}
    requests.forEach(r => {
      if (r.leave_type) counts[r.leave_type] = (counts[r.leave_type] ?? 0) + 1
    })
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }))
  })()

  const recentRequests = [...requests]
    .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
    .slice(0, 8)

  const pendingCount = requests.filter(r => r.status === 'Pending').length

  return { statusData, typeData, recentRequests, pendingCount, total: requests.length, isLoading, error }
}
