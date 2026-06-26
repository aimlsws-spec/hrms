import type { Employee } from '../../types/employee'
import Badge from '../ui/Badge'
import EmployeeActions from './EmployeeActions'

interface Props {
  employee: Employee
  onEdit:   (emp: Employee) => void
  onView?:  (emp: Employee) => void
  canEdit:  boolean
}

export default function EmployeeCard({ employee, onEdit, onView, canEdit }: Props) {
  const initials = employee.name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-start gap-4 shadow-sm">
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 font-bold text-sm flex items-center justify-center shrink-0">
        {initials}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{employee.name}</p>
        <p className="text-xs text-gray-500 truncate">{employee.title ?? '—'}</p>
        {employee.department && (
          <div className="mt-1.5">
            <Badge variant="blue">{employee.department}</Badge>
          </div>
        )}
        {employee.email && (
          <p className="text-xs text-gray-400 mt-1 truncate">{employee.email}</p>
        )}
      </div>

      {/* ID + actions */}
      <div className="text-right shrink-0 space-y-2">
        <p className="text-xs font-mono text-gray-400">{employee.employee_id}</p>
        <EmployeeActions employee={employee} onEdit={onEdit} onView={onView} canEdit={canEdit} />
      </div>
    </div>
  )
}
