import EmptyState from '../../ui/EmptyState'
import type { AttendanceSummary } from '../../../types/employeeDashboard'

interface StatRowProps {
  label: string
  value: number
  total: number
  dotColor: string
  barColor: string
}

function StatRow({ label, value, total, dotColor, barColor }: StatRowProps) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${dotColor} shrink-0`} />
          <span className="text-gray-600 text-[12px]">{label}</span>
        </div>
        <span className="font-semibold text-gray-800 text-[13px] tabular-nums">{value}</span>
      </div>
      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

interface Props {
  summary:   AttendanceSummary | null
  isLoading: boolean
  error:     string | null
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function AttendanceSummaryCard({ summary, isLoading, error }: Props) {
  const now      = new Date()
  const subtitle = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`
  const hasData  = summary && summary.total > 0
  const rate     = hasData ? Math.round((summary.present / summary.total) * 100) : null

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
            <i className="fa-solid fa-chart-bar text-emerald-600 text-[12px]" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-gray-800">Attendance</p>
            <p className="text-[11px] text-gray-400">{subtitle}</p>
          </div>
        </div>
        {rate !== null && (
          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
            rate >= 80 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
          }`}>
            {rate}%
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0,1,2,3].map(i => <div key={i} className="h-7 bg-gray-50 rounded animate-pulse" />)}
        </div>
      ) : error ? (
        <EmptyState message="Could not load attendance" icon="⚠️" />
      ) : !hasData ? (
        <div className="flex flex-col items-center justify-center py-2 text-center">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center mb-2">
            <i className="fa-solid fa-calendar-xmark text-emerald-400 text-[12px]" />
          </div>
          <p className="text-[12px] font-medium text-gray-500">No attendance recorded</p>
          <p className="text-[10px] text-gray-400 mt-0.5">for {subtitle}</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          <StatRow label="Present"  value={summary!.present}  total={summary!.total} dotColor="bg-emerald-500" barColor="bg-emerald-400" />
          <StatRow label="Absent"   value={summary!.absent}   total={summary!.total} dotColor="bg-red-400"     barColor="bg-red-400"     />
          <StatRow label="Half Day" value={summary!.halfDay}  total={summary!.total} dotColor="bg-amber-400"   barColor="bg-amber-400"   />
          <StatRow label="On Leave" value={summary!.onLeave}  total={summary!.total} dotColor="bg-blue-400"    barColor="bg-blue-400"    />
        </div>
      )}
    </div>
  )
}
