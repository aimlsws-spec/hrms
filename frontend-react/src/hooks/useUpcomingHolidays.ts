import { useState, useEffect } from 'react'
import { leavesApi } from '../api/leaves'
import type { Holiday } from '../types/dashboard'

export function useUpcomingHolidays() {
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    leavesApi.getHolidays()
      .then(({ data }) => {
        if (cancelled) return
        if (data.success && data.holidays) {
          const now = new Date()
          const upcoming = data.holidays
            .filter(h => new Date(h.holiday_date) > now)
            .sort((a, b) => new Date(a.holiday_date).getTime() - new Date(b.holiday_date).getTime())
            .slice(0, 3)
          setHolidays(upcoming)
        }
        setIsLoading(false)
      })
      .catch(err => {
        if (cancelled) return
        setError(err.message)
        setIsLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  return { holidays, isLoading, error }
}
