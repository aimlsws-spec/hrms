import Badge from '../ui/Badge'
import type { AttendanceStatus } from '../../types/attendance'

const CONFIG: Record<AttendanceStatus, { label: string; variant: 'green' | 'red' | 'yellow' | 'blue' }> = {
  PRESENT:  { label: 'Present',  variant: 'green'  },
  ABSENT:   { label: 'Absent',   variant: 'red'    },
  HALF_DAY: { label: 'Half Day', variant: 'yellow' },
  ON_LEAVE: { label: 'On Leave', variant: 'blue'   },
}

export default function AttendanceStatusBadge({ status }: { status: AttendanceStatus }) {
  const cfg = CONFIG[status] ?? { label: status, variant: 'gray' as const }
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>
}
