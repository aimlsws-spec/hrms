import { useState, useEffect } from 'react'
import { analyticsApi } from '../../api/analytics'
import { attendanceApi } from '../../api/attendance'
import type { AnalyticsOverview, ChartPoint } from '../../types/analytics'

interface StatusSummary {
  active: number
  inactive: number
  on_leave: number
}

export function useAnalyticsOverview() {
  const [overview, setOverview]             = useState<AnalyticsOverview | null>(null)
  const [statusSummary, setStatusSummary]   = useState<StatusSummary | null>(null)
  const [pendingRegCount, setPendingRegCount] = useState(0)
  const [isLoading, setIsLoading]           = useState(true)
  const [error, setError]                   = useState('')

  useEffect(() => {
    async function load() {
      setIsLoading(true)
      setError('')
      try {
        const [ovRes, statusRes, regRes] = await Promise.allSettled([
          analyticsApi.getOverview(),
          analyticsApi.getEmployeeStatus(),
          attendanceApi.getPendingRegularizations(),
        ])
        if (ovRes.status === 'fulfilled')     setOverview(ovRes.value.data)
        if (statusRes.status === 'fulfilled') setStatusSummary(statusRes.value.data.data)
        if (regRes.status === 'fulfilled')    setPendingRegCount(regRes.value.data.requests?.length ?? 0)
      } catch {
        setError('Failed to load overview data.')
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  const deptData: ChartPoint[] = overview
    ? Object.entries(overview.department_distribution)
        .filter(([, v]) => v > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([name, value]) => ({ name, value }))
    : []

  const statusData: ChartPoint[] = statusSummary
    ? [
        { name: 'Active',   value: statusSummary.active   },
        { name: 'Inactive', value: statusSummary.inactive },
        { name: 'On Leave', value: statusSummary.on_leave },
      ]
    : []

  const totalDepts = deptData.length

  return {
    overview,
    statusSummary,
    deptData,
    statusData,
    pendingRegCount,
    totalDepts,
    isLoading,
    error,
  }
}
