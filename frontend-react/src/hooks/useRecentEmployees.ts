import { useState, useEffect } from 'react'
import { employeesApi } from '../api/employees'
import type { RecentEmployee } from '../types/dashboard'

export function useRecentEmployees(limit = 3) {
  const [employees, setEmployees] = useState<RecentEmployee[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    employeesApi.getRecent(limit)
      .then(({ data }) => {
        if (cancelled) return
        setEmployees(data.success ? data.employees : [])
        setIsLoading(false)
      })
      .catch(err => {
        if (cancelled) return
        setError(err.message)
        setIsLoading(false)
      })
    return () => { cancelled = true }
  }, [limit])

  return { employees, isLoading, error }
}
