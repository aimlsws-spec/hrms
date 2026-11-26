import type { Employee } from '../../types/employee'
import Badge from '../ui/Badge'
import EmployeeActions from './EmployeeActions'

interface Props {
  employee: Employee
  onEdit: (emp: Employee) => void
  onView?: (emp: Employee) => void
  onToggleStatus?: (emp: Employee, newActive: boolean) => void
  canEdit: boolean
}

export default function EmployeeCard({
  employee,
  onEdit,
  onView,
  onToggleStatus,
  canEdit,
}: Props) {
  const initials = employee.name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const isInactive =
    employee.status === 'inactive' || employee.status === 'deactivated'
  const isProbation = (employee.status || '').toLowerCase() === 'probation'

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-start gap-4 shadow-sm">
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 font-bold text-sm flex items-center justify-center shrink-0">
        {initials}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-gray-900 truncate">{employee.name}</p>
          {isInactive ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
              Deactivated
            </span>
          ) : isProbation ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
              Probation
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Active
            </span>
          )}
        </div>
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
        <EmployeeActions
          employee={employee}
          onEdit={onEdit}
          onView={onView}
          onToggleStatus={onToggleStatus}
          canEdit={canEdit}
        />
      </div>
    </div>
  )
}
