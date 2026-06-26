import LeaveStatusBadge from './LeaveStatusBadge'
import type { LeaveRequest } from '../../types/leave'

function fmtDate(d?: string) {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return d }
}

interface Props {
  requests: LeaveRequest[]
  isLoading: boolean
  isHRAdmin: boolean
  onApprove?: (id: number) => void
  onReject?: (id: number) => void
}

export default function LeaveTable({ requests, isLoading, isHRAdmin, onApprove, onReject }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
      </div>
    )
  }

  if (!requests.length) {
    return <p className="text-sm text-gray-400 text-center py-10">No leave requests found.</p>
  }

  return (
    <div className="w-full">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b-2 border-gray-100">
            {isHRAdmin && (
              <th className="text-left pb-3 pr-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Employee</th>
            )}
            <th className="text-left pb-3 pr-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Type</th>
            <th className="text-left pb-3 pr-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Duration</th>
            <th className="text-left pb-3 pr-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">From</th>
            <th className="text-left pb-3 pr-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">To</th>
            <th className="text-left pb-3 pr-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Applied</th>
            <th className="text-left pb-3 pr-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Status</th>
            {isHRAdmin && (
              <th className="text-left pb-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Actions</th>
            )}
          </tr>
        </thead>
        <tbody>
          {requests.map(r => (
            <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
              {isHRAdmin && (
                <td className="py-4 pr-4 font-medium text-gray-800 whitespace-nowrap text-left">
                  {r.employee_name || String(r.employee_id ?? '—')}
                </td>
              )}
              <td className="py-4 pr-4 text-gray-700 text-left">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span>{r.leave_type || '—'}</span>
                    {r.is_unpaid ? (
                      <span className="text-[11px] uppercase bg-red-50 text-red-700 border border-red-100 px-2 py-0.5 rounded-md font-semibold">Unpaid Leave</span>
                    ) : null}
                  </div>
                  <div className="text-xs text-gray-500">
                    {Number(r.requested_days ?? r.days_count ?? 0)} day(s) requested
                    {r.unpaid_days ? (
                      <> · Paid {Math.max(0, Number(r.paid_days ?? ((r.requested_days ?? r.days_count ?? 0) - r.unpaid_days)))} · Unpaid {r.unpaid_days}</>
                    ) : null}
                  </div>
                </div>
              </td>
              <td className="py-4 pr-4 whitespace-nowrap text-left">
                {r.leave_duration === 'first_half'
                  ? <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-100">First Half</span>
                  : r.leave_duration === 'second_half'
                  ? <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-violet-50 text-violet-700 border border-violet-100">Second Half</span>
                  : <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-gray-50 text-gray-500 border border-gray-100">Full Day</span>
                }
              </td>
              <td className="py-4 pr-4 text-gray-600 whitespace-nowrap text-left">{fmtDate(r.start_date)}</td>
              <td className="py-4 pr-4 text-gray-600 whitespace-nowrap text-left">{fmtDate(r.end_date)}</td>
              <td className="py-4 pr-4 text-gray-500 whitespace-nowrap text-left">{fmtDate(r.created_at)}</td>
              <td className="py-4 pr-4 text-left"><LeaveStatusBadge status={r.status} /></td>
              {isHRAdmin && (
                <td className="py-4 text-left">
                  {r.status === 'Pending' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => onApprove?.(r.id)}
                        className="px-3 py-1 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-medium hover:bg-green-100 transition-colors"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => onReject?.(r.id)}
                        className="px-3 py-1 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
