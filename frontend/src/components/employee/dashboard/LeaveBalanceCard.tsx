import type { LeaveBalance } from '../../../types/leave'

interface RowProps {
  icon: string
  label: string
  days: number
  totalDays?: number
  iconBg: string
  iconColor: string
  barColor: string
}

function LeaveRow({ icon, label, days, totalDays = 12, iconBg, iconColor, barColor }: RowProps) {
  const total = totalDays
  const usedPercent = total > 0 ? Math.round(Math.min(100, Math.max(0, ((total - days) / total) * 100))) : 0

  return (
    <div className="py-4 border-b border-gray-50 last:border-0">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
            <i className={`${icon} ${iconColor} text-[12px]`} />
          </div>
          <div>
            <p className="text-[13px] text-gray-700 font-medium">{label}</p>
            <p className="text-[11px] text-gray-400">{days.toFixed(1)} / {total.toFixed(0)} days remaining</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-lg font-bold text-gray-800 tabular-nums leading-none">{days.toFixed(1)}</span>
          <span className="text-[11px] text-gray-400 ml-1">days</span>
        </div>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${usedPercent}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
        <span>{usedPercent}% used</span>
        <span>{Math.max(0, total - days).toFixed(1)} days used</span>
      </div>
    </div>
  )
}

interface Props {
  balance: LeaveBalance | null
  total: number
  isLoading: boolean
}

export default function LeaveBalanceCard({ balance, total, isLoading }: Props) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
            <i className="fa-solid fa-calendar-check text-emerald-600 text-[13px]" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-gray-800">Leave Balance</p>
            <p className="text-[11px] text-gray-400">Remaining days</p>
          </div>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-3 py-1.5 text-white text-xs font-semibold shadow-sm">
          <span>{total.toFixed(1)}</span>
          <span className="bg-white/15 px-2 py-0.5 rounded-full text-[11px] text-white/90">days total</span>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2.5">
          {[0,1,2].map(i => <div key={i} className="h-11 bg-gray-50 rounded-lg animate-pulse" />)}
        </div>
      ) : !balance ? (
        <div className="flex flex-col items-center justify-center py-2 text-center">
          <span className="text-2xl mb-2">🗓️</span>
          <p className="text-[12px] font-medium text-gray-500">Balance unavailable</p>
        </div>
      ) : (
        <div>
          <LeaveRow
            icon="fa-solid fa-thermometer-half"
            label="Sick Leave"
            days={balance.sick_balance ?? 0}
            totalDays={balance.sick_total ?? 12}
            iconBg="bg-red-50"
            iconColor="text-red-500"
            barColor="bg-red-400"
          />
          <LeaveRow
            icon="fa-solid fa-mug-hot"
            label="Casual Leave"
            days={balance.casual_balance ?? 0}
            totalDays={balance.casual_total ?? 12}
            iconBg="bg-amber-50"
            iconColor="text-amber-500"
            barColor="bg-amber-400"
          />
          <LeaveRow
            icon="fa-solid fa-umbrella-beach"
            label="Paid Leave"
            days={balance.paid_balance ?? balance.earned_balance ?? 0}
            totalDays={balance.earned_total ?? 12}
            iconBg="bg-emerald-50"
            iconColor="text-emerald-500"
            barColor="bg-emerald-400"
          />
          {(balance.unpaid_taken ?? 0) > 0 && (
            <div className="py-3 border-t border-gray-50 mt-1">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                    <i className="fa-solid fa-clock text-amber-500 text-[12px]" />
                  </div>
                  <div>
                    <p className="text-[13px] text-gray-700 font-medium">Unpaid Leave Taken</p>
                    <p className="text-[11px] text-amber-500">Salary deduction applied</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold text-amber-600 tabular-nums leading-none">{(balance.unpaid_taken ?? 0).toFixed(1)}</span>
                  <span className="text-[11px] text-gray-400 ml-1">days</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
