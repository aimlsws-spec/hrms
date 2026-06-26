import { useState, useEffect } from 'react'
import { attendanceApi } from '../../../api/attendance'
import type { AttendanceSummary } from '../../../types/employeeDashboard'

export function useAttendanceSummary(employeeId: string) {
  const [summary, setSummary]   = useState<AttendanceSummary | null>(null)
  const [isLoading, setLoading] = useState(true)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    if (!employeeId) { setLoading(false); return }

    let cancelled = false
    const now   = new Date()
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    attendanceApi.getRecords(employeeId, month)
      .then(({ data }) => {
        if (cancelled) return
        const records = data.data ?? []
        const s: AttendanceSummary = { present: 0, absent: 0, halfDay: 0, onLeave: 0, total: 0 }
        for (const r of records) {
          s.total++
          if (r.status === 'PRESENT')   s.present++
          else if (r.status === 'ABSENT')   s.absent++
          else if (r.status === 'HALF_DAY') s.halfDay++
          else if (r.status === 'ON_LEAVE') s.onLeave++
        }
        setSummary(s)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setError('Failed to load attendance.')
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [employeeId])

  return { summary, isLoading, error }
}
