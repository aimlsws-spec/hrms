import { useEffect } from 'react'
import type { Employee, CreateEmployeePayload, EditEmployeePayload } from '../../types/employee'
import type { FormMode } from '../../hooks/employees/useEmployeeForm'
import ErrorAlert from '../ui/ErrorAlert'
import EmployeeForm from './EmployeeForm'

interface Props {
  isOpen: boolean
  onClose: () => void
  mode: FormMode
  editing: Employee | null
  isSubmitting: boolean
  error: string | null
  onSubmitCreate: (data: CreateEmployeePayload) => void
  onSubmitEdit: (id: string, data: EditEmployeePayload) => void
}

export default function EmployeeModal({
  isOpen, onClose, mode, editing, isSubmitting, error,
  onSubmitCreate, onSubmitEdit,
}: Props) {
  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const title = mode === 'create' ? 'Add New Employee' : `Edit — ${editing?.name ?? ''}`

  function handleSubmit(data: CreateEmployeePayload | EditEmployeePayload) {
    if (mode === 'create') {
      onSubmitCreate(data as CreateEmployeePayload)
    } else if (editing) {
      onSubmitEdit(editing.employee_id, data as EditEmployeePayload)
    }
  }

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Panel */}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Close modal"
          >
            <i className="fas fa-times" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {error && <ErrorAlert type="error" message={error} />}

          {mode === 'create' ? (
            <EmployeeForm
              mode="create"
              isSubmitting={isSubmitting}
              onSubmit={handleSubmit as (data: CreateEmployeePayload) => void}
              onCancel={onClose}
            />
          ) : editing ? (
            <EmployeeForm
              mode="edit"
              initial={editing}
              isSubmitting={isSubmitting}
              onSubmit={handleSubmit as (data: EditEmployeePayload) => void}
              onCancel={onClose}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}
