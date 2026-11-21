import type { Employee } from '../../types/employee'

interface Props {
  employee: Employee
  onEdit:   (emp: Employee) => void
  onView?:  (emp: Employee) => void
  canEdit:  boolean
}

export default function EmployeeActions({ employee, onEdit, onView, canEdit }: Props) {
  return (
    <div className="flex items-center justify-end gap-2">
      <button
        onClick={() => onView?.(employee)}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-primary-700 bg-primary-50 hover:bg-primary-100 transition-colors"
        title="View profile"
      >
        <i className="fas fa-eye text-sm" />
      </button>
      {canEdit && (
        <button
          onClick={() => onEdit(employee)}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-primary-700 bg-primary-50 hover:bg-primary-100 transition-colors"
          title="Edit employee"
        >
          <i className="fas fa-pencil-alt text-sm" />
        </button>
      )}
    </div>
  )
}
