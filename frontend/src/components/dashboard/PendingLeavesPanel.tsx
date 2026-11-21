import { useNavigate } from 'react-router-dom'
import Card from '../ui/Card'
import SectionHeader from '../ui/SectionHeader'
import Badge from '../ui/Badge'
import Avatar from '../ui/Avatar'
import EmptyState from '../ui/EmptyState'
import type { LeaveRequest } from '../../types/dashboard'

interface Props {
  requests: LeaveRequest[]
  isLoading: boolean
}

export default function PendingLeavesPanel({ requests, isLoading }: Props) {
  const navigate = useNavigate()

  return (
    <Card>
      <SectionHeader
        title="Pending Leave Requests"
        action={
          <button
            onClick={() => navigate('/leaves')}
            className="text-xs bg-primary-50 text-primary-700 hover:bg-primary-100 px-3 py-1.5 rounded-lg font-semibold transition-colors"
          >
            View All →
          </button>
        }
      />
      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gray-100 rounded-full animate-pulse shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-gray-100 rounded animate-pulse w-1/3" />
                <div className="h-3 bg-gray-100 rounded animate-pulse w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : requests.length === 0 ? (
        <EmptyState message="No pending requests" />
      ) : (
        <div className="space-y-2">
          {requests.slice(0, 5).map((req, i) => {
            const name = req.employee_name ?? 'Employee'
            return (
              <div key={req.id ?? i} className="flex items-center gap-3 p-3 bg-gray-50 hover:bg-primary-50 rounded-xl transition-colors duration-150">
                <Avatar name={name} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900 truncate">{name}</div>
                  <div className="text-xs text-gray-400 mt-0.5 truncate">
                    {req.leave_type ?? 'Leave'} · {req.start_date ?? 'N/A'}
                  </div>
                </div>
                <Badge variant="yellow">Pending</Badge>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
