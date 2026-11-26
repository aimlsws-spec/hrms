import { useState }           from 'react'
import { useAuthStore }       from '../store/authStore'
import { useEmployees }       from '../hooks/employees/useEmployees'
import { useEmployeeForm }    from '../hooks/employees/useEmployeeForm'
import { employeesApi }       from '../api/employees'
import type { Employee }      from '../types/employee'
import Card                   from '../components/ui/Card'
import ErrorAlert             from '../components/ui/ErrorAlert'
import EmployeeFilters        from '../components/employees/EmployeeFilters'
import EmployeeTable          from '../components/employees/EmployeeTable'
import EmployeeModal          from '../components/employees/EmployeeModal'
import EmployeeProfileModal   from '../components/employees/EmployeeProfileModal'

export default function EmployeesPage() {
  const { user } = useAuthStore()
  const canEdit  = user?.role === 'admin' || user?.role === 'hr'

  // ── Data ──────────────────────────────────────────────────────────────
  const {
    employees, total, isLoading, error,
    search, setSearch, deptFilter, setDeptFilter, departments, refetch,
  } = useEmployees()

  // ── Edit modal / form state ───────────────────────────────────────────
  const {
    mode, editing, isOpen, isSubmitting, error: formError,
    openCreate, openEdit, close, submitCreate, submitEdit,
  } = useEmployeeForm(refetch)

  // ── Profile view modal ────────────────────────────────────────────────
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null)

  async function handleToggleStatus(emp: Employee, newActive: boolean) {
    try {
      const res = await employeesApi.toggleStatus(emp.employee_id, newActive)
      if (res.data?.success) {
        refetch()
      } else {
        alert(res.data?.message || 'Failed to update employee status')
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error updating employee status')
    }
  }

  return (
    <div>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Employee Management</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your workforce efficiently</p>
      </div>

      {/* Fetch error */}
      {error && <ErrorAlert type="error" message={error} />}

      {/* Main card */}
      <Card>
        <EmployeeFilters
          search={search}
          onSearch={setSearch}
          deptFilter={deptFilter}
          onDeptFilter={setDeptFilter}
          departments={departments}
          total={total}
          canAdd={canEdit}
          onAddEmployee={openCreate}
        />

        <EmployeeTable
          employees={employees}
          isLoading={isLoading}
          onEdit={openEdit}
          onView={setViewingEmployee}
          onToggleStatus={handleToggleStatus}
          canEdit={canEdit}
        />
      </Card>

      {/* Create / Edit modal */}
      <EmployeeModal
        isOpen={isOpen}
        onClose={close}
        mode={mode}
        editing={editing}
        isSubmitting={isSubmitting}
        error={formError}
        onSubmitCreate={submitCreate}
        onSubmitEdit={submitEdit}
      />

      {/* View profile modal */}
      <EmployeeProfileModal
        employee={viewingEmployee}
        onClose={() => setViewingEmployee(null)}
      />
    </div>
  )
}
