import { useState } from 'react'
import type { Employee } from '../../types/employee'
import { employeesApi } from '../../api/employees'

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
  const [sendingInvite, setSendingInvite] = useState(false)
  const isInactive =
    employee.status === 'inactive' || employee.status === 'deactivated'

  async function handleResendInvite() {
    if (!employee.email) {
      alert('This employee does not have an email address.')
      return
    }
    if (
      !window.confirm(
        `Resend invitation email with login credentials to ${employee.name} (${employee.email})?`
      )
    ) {
      return
    }
    setSendingInvite(true)
    try {
      const res = await employeesApi.resendInvitation(employee.employee_id)
      if (res.data?.success) {
        alert(res.data.message || `Invitation email sent to ${employee.email}`)
      } else {
        alert(res.data?.message || 'Failed to send invitation email.')
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error sending invitation email.')
    } finally {
      setSendingInvite(false)
    }
  }

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

      {canEdit && !isInactive && (
        <button
          type="button"
          onClick={handleResendInvite}
          disabled={sendingInvite}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 transition-colors"
          title="Resend invitation email"
        >
          {sendingInvite ? (
            <i className="fa-solid fa-circle-notch animate-spin text-xs" />
          ) : (
            <i className="fa-solid fa-paper-plane text-xs" />
          )}
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
