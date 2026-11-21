import Card from '../ui/Card'
import SectionHeader from '../ui/SectionHeader'
import type { LeaveBalance } from '../../types/dashboard'

interface BarRowProps {
  label: string
  days: number
  max: number
  barColor: string
  trackColor: string
}

function BarRow({ label, days, max, barColor, trackColor }: BarRowProps) {
  const pct = max > 0 ? Math.min((days / max) * 100, 100) : 0
  return (
    <div className="mb-3.5 last:mb-0">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-xs font-medium text-gray-600">{label}</span>
        <span className="text-xs font-bold text-gray-900">{days}d</span>
      </div>
      <div className={`h-1.5 rounded-full ${trackColor} overflow-hidden`}>
        <div
          className={`h-full rounded-full ${barColor} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

interface Props {
  balance: LeaveBalance | null
  total: number
  isLoading: boolean
}

export default function LeaveBalanceWidget({ balance, total, isLoading }: Props) {
  return (
    <Card padding="sm">
      <SectionHeader title="Leave Balance" />
      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map(i => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />)}
        </div>
      ) : (
        <>
          <div className="flex items-end gap-1.5 mb-4">
            <span className="text-3xl font-bold text-primary-900 leading-none">{total.toFixed(1)}</span>
            <span className="text-xs text-gray-400 mb-0.5">days available</span>
          </div>
          {balance && (
            <div>
              <BarRow label="Annual Leave"  days={balance.paid_balance    ?? 0} max={21} barColor="bg-blue-500"   trackColor="bg-blue-100"   />
              <BarRow label="Sick Leave"    days={balance.sick_balance    ?? 0} max={10} barColor="bg-red-400"    trackColor="bg-red-100"    />
              <BarRow label="Casual Leave"  days={balance.casual_balance  ?? 0} max={12} barColor="bg-amber-400"  trackColor="bg-amber-100"  />
            </div>
          )}
        </>
      )}
    </Card>
  )
}
