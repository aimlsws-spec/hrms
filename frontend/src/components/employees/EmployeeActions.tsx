import type { Employee } from '../../types/employee'

interface Props {
  employee: Employee
  onEdit: (emp: Employee) => void
  onView?: (emp: Employee) => void
  onToggleStatus?: (emp: Employee, newActive: boolean) => void
  canEdit: boolean
}

export default function EmployeeActions({
  employee,
  onEdit,
  onView,
  onToggleStatus,
  canEdit,
}: Props) {
  const isInactive =
    employee.status === 'inactive' || employee.status === 'deactivated'

  function handleStatusToggle() {
    if (!onToggleStatus) return
    if (isInactive) {
      if (
        window.confirm(
          `Reactivate account for ${employee.name}? This will restore portal login access.`
        )
      ) {
        onToggleStatus(employee, true)
      }
    } else {
      if (
        window.confirm(
          `Are you sure you want to deactivate ${employee.name}'s account? They will be immediately blocked from logging into the portal.`
        )
      ) {
        onToggleStatus(employee, false)
      }
    }
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      <button
        type="button"
        onClick={() => onView?.(employee)}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-primary-700 bg-primary-50 hover:bg-primary-100 transition-colors"
        title="View profile"
      >
        <i className="fas fa-eye text-xs" />
      </button>

      {canEdit && (
        <button
          type="button"
          onClick={() => onEdit(employee)}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-primary-700 bg-primary-50 hover:bg-primary-100 transition-colors"
          title="Edit employee"
        >
          <i className="fas fa-pencil-alt text-xs" />
        </button>
      )}

      {canEdit && onToggleStatus && (
        <button
          type="button"
          onClick={handleStatusToggle}
          className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
            isInactive
              ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
              : 'text-rose-600 bg-rose-50 hover:bg-rose-100'
          }`}
          title={isInactive ? 'Reactivate employee account' : 'Deactivate employee account'}
        >
          <i
            className={`fa-solid ${
              isInactive ? 'fa-user-check' : 'fa-user-slash'
            } text-xs`}
          />
        </button>
      )}
    </div>
  )
}
