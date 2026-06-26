import { useState, useEffect, useCallback } from 'react'
import { attendanceApi } from '../../api/attendance'
import type { AttendanceRecord, AttendanceStats } from '../../types/attendance'

function computeStats(records: AttendanceRecord[]): AttendanceStats {
  const stats: AttendanceStats = { present: 0, absent: 0, half_day: 0, on_leave: 0, total: records.length }
  for (const r of records) {
    if      (r.status === 'PRESENT')  stats.present++
    else if (r.status === 'ABSENT')   stats.absent++
    else if (r.status === 'HALF_DAY') stats.half_day++
    else if (r.status === 'ON_LEAVE') stats.on_leave++
  }
  return stats
}

export function useAttendanceRecords(employeeId: string | null, month?: string) {
  const [records, setRecords]     = useState<AttendanceRecord[]>([])
  const [stats, setStats]         = useState<AttendanceStats>({ present: 0, absent: 0, half_day: 0, on_leave: 0, total: 0 })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError]         = useState('')

  const load = useCallback(async () => {
    if (!employeeId) return
    setIsLoading(true)
    setError('')
    try {
      const { data } = await attendanceApi.getRecords(employeeId, month)
      const list = data.data ?? []
      setRecords(list)
      setStats(computeStats(list))
    } catch {
      setError('Failed to load attendance records.')
    } finally {
      setIsLoading(false)
    }
  }, [employeeId, month])

  useEffect(() => { load() }, [load])

  return { records, stats, isLoading, error, refetch: load }
}
