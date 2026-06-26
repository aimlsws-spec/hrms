import { useState } from 'react'
import { leavesApi } from '../../api/leaves'
import type { ApplyLeavePayload, SandwichCheckResponse } from '../../types/leave'

export function useApplyLeave() {
  const [isLoading, setIsLoading]             = useState(false)
  const [error, setError]                     = useState('')
  const [sandwichWarning, setSandwichWarning] = useState<SandwichCheckResponse | null>(null)

  async function submit(
    payload: ApplyLeavePayload,
    skipSandwichCheck = false,
  ): Promise<{ success: boolean; needsConfirm?: boolean }> {
    setError('')
    setIsLoading(true)

    try {
      // Sandwich policy check (skipped when user explicitly confirmed)
      if (!skipSandwichCheck) {
        try {
          const { data: sw } = await leavesApi.checkSandwich(payload.start_date, payload.end_date)
          if (sw.success && sw.has_sandwich) {
            setSandwichWarning(sw)
            setIsLoading(false)
            return { success: false, needsConfirm: true }
          }
        } catch {
          // sandwich endpoint unavailable — proceed without check
        }
      }

      setSandwichWarning(null)
      const { data } = await leavesApi.applyLeave(payload)
      if (data.success) return { success: true }
      setError(data.message || 'Failed to submit leave request.')
      return { success: false }
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Connection failed. Please try again.')
      return { success: false }
    } finally {
      setIsLoading(false)
    }
  }

  function clearSandwichWarning() { setSandwichWarning(null) }

  return { submit, isLoading, error, sandwichWarning, clearSandwichWarning }
}
