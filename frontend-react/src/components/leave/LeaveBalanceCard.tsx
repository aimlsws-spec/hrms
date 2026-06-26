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

  return (
    <Card>
      <h3 className="text-base font-semibold text-gray-900 mb-4">My Leave Balance</h3>
      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map(i => <div key={i} className="h-8 bg-gray-100 rounded-lg animate-pulse" />)}
        </div>
      ) : (
        <>
          <div className="text-center mb-4">
            <div className="text-4xl font-bold text-primary-900">{total.toFixed(1)}</div>
            <p className="text-xs text-gray-400 mt-1">Total Remaining Leave</p>
          </div>
          {balance && (
            <div>
              <div className="text-xs text-gray-400 mb-3">Policy: 0.5 day per leave type.</div>
              <BalanceRow label="Sick Leave"   remaining={sick}   used={Math.max(0, 0.5 - sick)}   color="bg-red-400"    />
              <BalanceRow label="Casual Leave" remaining={casual} used={Math.max(0, 0.5 - casual)} color="bg-yellow-400" />
              <BalanceRow label="Paid Leave"   remaining={earned} used={Math.max(0, 0.5 - earned)} color="bg-blue-400"   />
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
