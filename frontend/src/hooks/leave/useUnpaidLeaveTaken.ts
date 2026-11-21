import { useState, useEffect } from 'react'
import { leavesApi } from '../../api/leaves'

interface HookResult {
  unpaidDaysTaken: number
  isLoading: boolean
}

export function useUnpaidLeaveTaken(userId: number | string | null): HookResult {
  const [unpaidDaysTaken, setUnpaidDaysTaken] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!userId) {
      setUnpaidDaysTaken(0)
      setIsLoading(false)
      return
    }

    let cancelled = false
    async function fetch_data() {
      setIsLoading(true)
      try {
        const { data } = await leavesApi.getEmployeeRequests(Number(userId))
        if (cancelled) return

        // Filter approved unpaid leave requests
        const requests = data.requests || data.leave_requests || []
        const totalUnpaidDays = requests
          .filter(
            (req: any) =>
              req.status?.toLowerCase() === 'approved' &&
              (req.is_unpaid === 1 || req.is_unpaid === true)
          )
          .reduce((sum: number, req: any) => sum + (Number(req.unpaid_days) || 0), 0)

        if (!cancelled) {
          setUnpaidDaysTaken(totalUnpaidDays)
        }
      } catch (error) {
        if (!cancelled) {
          setUnpaidDaysTaken(0)
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    fetch_data()
    return () => { cancelled = true }
  }, [userId])

  return { unpaidDaysTaken, isLoading }
}
