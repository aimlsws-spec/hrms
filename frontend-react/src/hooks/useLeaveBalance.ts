import { useState, useEffect } from 'react'
import { leavesApi } from '../api/leaves'
import type { LeaveBalance } from '../types/dashboard'

export function useLeaveBalance(userId: string | number | null) {
  const [balance, setBalance] = useState<LeaveBalance | null>(null)
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (userId === null || userId === '') {
      setIsLoading(false)
      return
    }
    let cancelled = false
    leavesApi.getBalance(userId)
      .then(({ data }) => {
        if (cancelled) return
        if (data.success && data.balance) {
          const b = data.balance
          const t = parseFloat(
            String(b.total_balance ?? ((b.sick_balance ?? 0) + (b.casual_balance ?? 0) + (b.paid_balance ?? 0)))
          )
          setBalance(b)
          setTotal(isNaN(t) ? 0 : t)
        }
        setIsLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setIsLoading(false)
      })
    return () => { cancelled = true }
  }, [userId])

  return { balance, total, isLoading }
}
