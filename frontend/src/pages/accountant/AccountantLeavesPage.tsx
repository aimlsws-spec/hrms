import { useState }           from 'react'
import { useLeaveRequests }   from '../../hooks/leave/useLeaveRequests'
import type { LeaveStatus }   from '../../types/leave'
import Card                   from '../../components/ui/Card'

type FilterValue = 'all' | LeaveStatus

const STATUS_STYLES: Record<string, string> = {
  Approved: 'bg-emerald-50 text-emerald-600',
  Pending:  'bg-amber-50 text-amber-600',
  Rejected: 'bg-red-50 text-red-500',
}

function daysBetween(start?: string, end?: string): string {
  if (!start || !end) return '—'
  const diff = (new Date(end).getTime() - new Date(start).getTime()) / 86_400_000
  const days = Math.round(diff) + 1
  return `${days} day${days !== 1 ? 's' : ''}`
}

export default function AccountantLeavesPage() {
  const { requests, isLoading } = useLeaveRequests(true)   // HR mode: fetch all
  const [filter, setFilter]     = useState<FilterValue>('all')

  const visible = filter === 'all' ? requests : requests.filter(r => r.status === filter)

  const FILTERS: { value: FilterValue; label: string }[] = [
    { value: 'all',      label: 'All' },
    { value: 'Approved', label: 'Approved' },
    { value: 'Pending',  label: 'Pending' },
    { value: 'Rejected', label: 'Rejected' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Leave Requests</h1>
        <p className="text-sm text-gray-500 mt-0.5">View all employee leave records (read-only)</p>
      </div>

      <Card>
        {/* Filter tabs */}
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          {FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === f.value
                  ? 'bg-primary-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
              {f.value === 'all' && (
                <span className="ml-1.5 text-[10px] opacity-70">({requests.length})</span>
              )}
            </button>
          ))}
        </div>

        {isLoading && (
          <div className="space-y-2">
            {[0,1,2,3,4].map(i => <div key={i} className="h-12 bg-gray-50 rounded-xl animate-pulse" />)}
          </div>
        )}

        {!isLoading && visible.length === 0 && (
          <div className="flex flex-col items-center py-14 text-center">
            <i className="fas fa-calendar-xmark text-3xl text-gray-200 mb-3" />
            <p className="text-sm text-gray-400">No {filter !== 'all' ? filter.toLowerCase() : ''} leave requests found.</p>
          </div>
        )}

        {!isLoading && visible.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400 px-3 py-3">Employee</th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400 px-3 py-3">Type</th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400 px-3 py-3">From</th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400 px-3 py-3">To</th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400 px-3 py-3">Duration</th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400 px-3 py-3">Status</th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400 px-3 py-3">Reason</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(req => {
                  const from = req.start_date ? new Date(req.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'
                  const to   = req.end_date   ? new Date(req.end_date).toLocaleDateString('en-IN',   { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
                  return (
                    <tr key={req.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-3 py-3 font-medium text-gray-800">
                        {req.employee_name ?? '—'}
                        {req.employee_id && (
                          <div className="text-[10px] text-gray-400 font-normal">{req.employee_id}</div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-gray-600">{req.leave_type ?? '—'}</td>
                      <td className="px-3 py-3 text-gray-500 whitespace-nowrap">{from}</td>
                      <td className="px-3 py-3 text-gray-500 whitespace-nowrap">{to}</td>
                      <td className="px-3 py-3 text-gray-600 font-medium">{daysBetween(req.start_date, req.end_date)}</td>
                      <td className="px-3 py-3">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[req.status] ?? 'bg-gray-50 text-gray-500'}`}>
                          {req.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-gray-400 max-w-[180px]">
                        <span className="line-clamp-1">{req.reason || '—'}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
