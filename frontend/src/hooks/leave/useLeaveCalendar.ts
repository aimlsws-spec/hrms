import { useState, useEffect, useCallback } from 'react'
import { leavesApi } from '../../api/leaves'
import type { CalendarData } from '../../types/leave'

export function useLeaveCalendar(userId: number | string | null) {
  const now = new Date()
  const [year, setYear]   = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [data, setData]   = useState<CalendarData | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const load = useCallback(async (y: number, m: number) => {
    const targetId = userId ?? 'all'
    setIsLoading(true)
    try {
      const { data: res } = await leavesApi.getCalendar(targetId, y, m)
      if (res.success) {
        setData({
          leaves: res.leaves ?? [],
          holidays: res.holidays ?? [],
          saturdays: res.saturdays ?? res.second_and_fourth_saturdays ?? [],
          second_and_fourth_saturdays: res.second_and_fourth_saturdays ?? res.saturdays ?? [],
          sundays: res.sundays ?? [],
          all_saturdays: res.all_saturdays ?? [],
        })
      }
    } catch {
      // network error — leave data null, calendar renders empty
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => { load(year, month) }, [load, year, month])

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }

  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  return { year, month, data, isLoading, prevMonth, nextMonth }
}
