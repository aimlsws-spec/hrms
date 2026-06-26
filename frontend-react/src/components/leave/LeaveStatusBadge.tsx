import Badge from '../ui/Badge'
import type { BadgeVariant } from '../ui/Badge'
import type { LeaveStatus } from '../../types/leave'

const STATUS_VARIANT: Record<LeaveStatus, BadgeVariant> = {
  Approved: 'green',
  Pending:  'yellow',
  Rejected: 'red',
}

export default function LeaveStatusBadge({ status }: { status: string }) {
  const variant = STATUS_VARIANT[status as LeaveStatus] ?? 'gray'
  return <Badge variant={variant}>{status}</Badge>
}
