import { useState, useEffect } from 'react'
import { dashboardApi } from '../api/dashboard'

export function useDashboardStats() {
  const [totalEmployees, setTotalEmployees] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    dashboardApi.getStats()
      .then(({ data }) => {
        if (cancelled) return
        const total = data.stats?.total_employees ?? data.total_employees ?? 0
        setTotalEmployees(total)
        setIsLoading(false)
      })
      .catch(err => {
        if (cancelled) return
        setError(err.message)
        setIsLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  return { totalEmployees, isLoading, error }
}
