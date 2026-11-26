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
  onEdit?: (req: LeaveRequest) => void
  onDelete?: (id: number) => void
}

export default function LeaveTable({ requests, isLoading, isHRAdmin, onApprove, onReject, onEdit, onDelete }: Props) {
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
              <td className="py-4 pr-4 text-left">
                <LeaveStatusBadge status={r.status} />
                {r.approved_by && r.status !== 'Pending' && (
                  <p className="text-[11px] text-gray-500 mt-1 font-medium whitespace-nowrap">
                    {r.status === 'Approved' ? '✓ By' : '✕ By'}: {r.approved_by}
                  </p>
                )}
              </td>
              {isHRAdmin && (
                <td className="py-4 text-left whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    {r.status === 'Pending' && (
                      <>
                        <button
                          onClick={() => onApprove?.(r.id)}
                          className="px-2.5 py-1 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-semibold hover:bg-green-100 transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => onReject?.(r.id)}
                          className="px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-semibold hover:bg-red-100 transition-colors"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => onEdit?.(r)}
                      className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title="Edit Record"
                    >
                      <i className="fa-solid fa-pen-to-square text-xs" />
                    </button>
                    <button
                      onClick={() => onDelete?.(r.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete Record"
                    >
                      <i className="fa-solid fa-trash text-xs" />
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
