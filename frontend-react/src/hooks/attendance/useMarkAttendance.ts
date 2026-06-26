import { useState } from 'react'
import { attendanceApi } from '../../api/attendance'
import type { MarkAttendancePayload } from '../../types/attendance'

export function useMarkAttendance() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError]         = useState('')

  async function mark(payload: MarkAttendancePayload): Promise<boolean> {
    setIsLoading(true)
    setError('')
    try {
      const { data } = await attendanceApi.markAttendance(payload)
      if (!data.success) { setError(data.message || 'Failed to mark attendance.'); return false }
      return true
    } catch {
      setError('Connection failed. Please try again.')
      return false
    } finally {
      setIsLoading(false)
    }
  }

  return { mark, isLoading, error, clearError: () => setError('') }
}
