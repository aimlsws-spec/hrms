import Card from '../ui/Card'
import type { LeaveBalance } from '../../types/leave'

interface RowProps { label: string; remaining: number; used: number; color: string }

function BalanceRow({ label, remaining, used, color }: RowProps) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-2.5">
        <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
        <div>
          <span className="text-sm text-gray-600">{label}</span>
          <span className="ml-2 text-xs text-gray-400">({used.toFixed(1)} used)</span>
        </div>
      </div>
      <span className="text-sm font-semibold text-gray-900">{remaining.toFixed(1)} days</span>
    </div>
  )
}

interface Props {
  balance: LeaveBalance | null
  isLoading: boolean
}

export default function LeaveBalanceCard({ balance, isLoading }: Props) {
  const casual  = Number(balance?.casual_balance  ?? 0)
  const sick    = Number(balance?.sick_balance    ?? 0)
  const earned  = Number(balance?.paid_balance ?? balance?.earned_balance ?? 0)
  const total   = casual + sick + earned
  const unpaidTaken = Number(balance?.unpaid_taken ?? 0)

  const casualTotal = Number(balance?.casual_total ?? 12)
  const sickTotal   = Number(balance?.sick_total   ?? 12)
  const earnedTotal = Number(balance?.earned_total ?? 12)

  const casualUsed = Number(balance?.casual_used ?? Math.max(0, casualTotal - casual))
  const sickUsed   = Number(balance?.sick_used   ?? Math.max(0, sickTotal - sick))
  const earnedUsed = Number(balance?.paid_used   ?? Math.max(0, earnedTotal - earned))

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-gray-900">Leave Balance</h3>
        <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">Yearly</span>
      </div>
      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map(i => <div key={i} className="h-8 bg-gray-100 rounded-lg animate-pulse" />)}
        </div>
      ) : (
        <>
          <div className="text-center mb-4">
            <div className="text-4xl font-bold text-primary-900">{total.toFixed(1)}</div>
            <p className="text-xs text-gray-400 mt-1">Total Remaining Days</p>
          </div>
          {balance && (
            <div>
              <div className="text-xs text-gray-400 mb-3 flex items-center justify-between">
                <span>Annual quota &amp; carry-forward</span>
                <span className="text-gray-500 font-mono">{(casualTotal + sickTotal + earnedTotal).toFixed(0)}d / yr</span>
              </div>
              <BalanceRow label="Sick Leave"   remaining={sick}   used={sickUsed}   color="bg-red-400"    />
              <BalanceRow label="Casual Leave" remaining={casual} used={casualUsed} color="bg-yellow-400" />
              <BalanceRow label="Paid Leave"   remaining={earned} used={earnedUsed} color="bg-blue-400"   />
              <div className="text-[11px] text-gray-400 mt-2 italic">
                * Unused balances carry forward month-to-month until year end.
              </div>
              {unpaidTaken > 0 && (
                <div className="mt-3 pt-2 border-t border-gray-100">
                  <div className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-gray-400" />
                      <span className="text-sm text-gray-600">Unpaid Leave Taken</span>
                    </div>
                    <span className="text-sm font-semibold text-amber-600">{unpaidTaken.toFixed(1)} days</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </Card>
  )
}
