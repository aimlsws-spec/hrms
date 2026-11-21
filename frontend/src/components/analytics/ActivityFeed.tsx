import Card from '../ui/Card'
import LeaveStatusBadge from '../leave/LeaveStatusBadge'
import type { LeaveRequest } from '../../types/leave'

function fmtDate(d?: string) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return d }
}

interface Props {
  requests: LeaveRequest[]
  isLoading: boolean
  totalCount?: number
}

export default function ActivityFeed({ requests, isLoading, totalCount = 0 }: Props) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">Recent Leave Activity</h3>
        {!isLoading && totalCount > 5 && (
          <a
            href="/leave"
            className="text-xs font-medium text-primary-700 hover:text-primary-900 hover:underline transition-colors"
          >
            View All ({totalCount})
          </a>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">No recent activity.</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {requests.map(r => (
            <div key={r.id} className="py-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">
                  {r.employee_name || `Employee ${r.employee_id}`}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {r.leave_type ?? '—'} · {fmtDate(r.start_date)} → {fmtDate(r.end_date)}
                </p>
              </div>
              <div className="shrink-0">
                <LeaveStatusBadge status={r.status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
