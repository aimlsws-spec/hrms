import EmployeeSearchSelect from './EmployeeSearchSelect'
import type { EmployeeOption } from '../../hooks/attendance/useEmployeeOptions'
import type { AttendanceStatus } from '../../types/attendance'

export interface AttendanceFilterState {
  employeeId: string
  employeeName: string
  month: string
  status: AttendanceStatus | 'ALL'
}

interface Props {
  filters: AttendanceFilterState
  onChange: (f: AttendanceFilterState) => void
}

const STATUS_OPTIONS: { label: string; value: AttendanceStatus | 'ALL' }[] = [
  { label: 'All',      value: 'ALL'      },
  { label: 'Present',  value: 'PRESENT'  },
  { label: 'Absent',   value: 'ABSENT'   },
  { label: 'Half Day', value: 'HALF_DAY' },
  { label: 'On Leave', value: 'ON_LEAVE' },
]

const inputCls = 'h-10 px-3 border-2 border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-primary-700'

export default function AttendanceFilters({ filters, onChange }: Props) {
  function set<K extends keyof AttendanceFilterState>(key: K, value: AttendanceFilterState[K]) {
    onChange({ ...filters, [key]: value })
  }

  function handleEmployeeChange(id: string, emp?: EmployeeOption) {
    onChange({ ...filters, employeeId: id, employeeName: emp?.name ?? '' })
  }

  return (
    <div className="flex flex-wrap gap-3 items-end">
      <div className="flex flex-col gap-1 min-w-[220px] flex-1 sm:flex-none">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Employee</label>
        <EmployeeSearchSelect
          value={filters.employeeId}
          onChange={handleEmployeeChange}
          placeholder="Select employee..."
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Month</label>
        <input
          type="month"
          value={filters.month}
          onChange={e => set('month', e.target.value)}
          className={`${inputCls} w-40`}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</label>
        <select
          value={filters.status}
          onChange={e => set('status', e.target.value as AttendanceStatus | 'ALL')}
          className={`${inputCls} w-36`}
        >
          {STATUS_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
