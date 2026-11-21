import { useState } from 'react'
import { attendanceApi } from '../../api/attendance'
import type { MarkAttendancePayload } from '../../types/attendance'
import { useAuthStore } from '../../store/authStore'

export function useMarkAttendance() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError]         = useState('')
  const user = useAuthStore((st) => st.user)

  async function mark(payload: MarkAttendancePayload): Promise<boolean> {
    setIsLoading(true)
    setError('')
    try {
      const { data } = await attendanceApi.markAttendance({ ...payload, modified_by: String(user?.user_id ?? ''), reason: payload.reason ?? payload.remarks })
      if (!data.success) { setError(data.message || 'Failed to mark attendance.'); return false }
      return true
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(detail ?? 'Connection failed. Please try again.')
      return false
    } finally {
      setIsLoading(false)
    }
  }

  return { mark, isLoading, error, clearError: () => setError('') }
}
