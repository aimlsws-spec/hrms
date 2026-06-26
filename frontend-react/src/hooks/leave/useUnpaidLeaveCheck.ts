import { useState, useEffect } from 'react'
import { leavesApi } from '../../api/leaves'
import type { LeaveBalance, LeaveDuration, UnpaidLeaveWarning } from '../../types/leave'

interface HookArgs {
  userId: number | string | null
  leaveType: string
  startDate: string
  endDate: string
  leaveDuration?: LeaveDuration
  /** @deprecated use leaveDuration instead */
  halfDay?: boolean
}

const leaveTypeFieldMap: Record<string, keyof LeaveBalance> = {
  'casual leave': 'casual_balance',
  'sick leave': 'sick_balance',
  'earned leave': 'earned_balance',
}

function calculateRequestedDays(startDate: string, endDate: string, leaveDuration?: LeaveDuration) {
  if (!startDate || !endDate) return 0
  const start = new Date(startDate)
  const end = new Date(endDate)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0
  const msPerDay = 24 * 60 * 60 * 1000
  const rawDays = Math.floor((end.getTime() - start.getTime()) / msPerDay) + 1
  if (rawDays <= 0) return 0
  if ((leaveDuration === 'first_half' || leaveDuration === 'second_half') && startDate === endDate) return 0.5
  return rawDays
}

export function useUnpaidLeaveCheck({ userId, leaveType, startDate, endDate, leaveDuration, halfDay }: HookArgs) {
  const [warning, setWarning] = useState<UnpaidLeaveWarning | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Support legacy halfDay flag by normalising to leaveDuration
  const resolvedDuration: LeaveDuration | undefined =
    leaveDuration ?? (halfDay ? 'first_half' : undefined)

  useEffect(() => {
    if (!userId || !leaveType || !startDate || !endDate) {
      setWarning(null)
      setIsLoading(false)
      return
    }

    let cancelled = false
    async function check() {
      setIsLoading(true)
      try {
        const { data } = await leavesApi.getBalance(userId)
        if (cancelled) return

        const balance = data.balance as LeaveBalance | undefined
        const requested_days = calculateRequestedDays(startDate, endDate, resolvedDuration)
        const key = leaveTypeFieldMap[leaveType.toLowerCase()] ?? 'paid_balance'
        const available_paid_days = Number(balance?.[key] ?? 0)
        const unpaid_days = Math.max(0, requested_days - available_paid_days)

        if (requested_days > 0 && unpaid_days > 0) {
          setWarning({
            exceeds_balance: true,
            leave_category: leaveType,
            requested_days,
            available_paid_days,
            unpaid_days,
          })
        } else {
          setWarning(null)
        }
      } catch {
        if (!cancelled) {
          setWarning(null)
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    check()
    return () => { cancelled = true }
  }, [userId, leaveType, startDate, endDate, resolvedDuration])

  return { warning, isLoading }
}
