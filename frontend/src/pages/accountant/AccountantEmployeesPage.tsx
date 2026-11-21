import { useState }             from 'react'
import { useEmployees }         from '../../hooks/employees/useEmployees'
import type { Employee }        from '../../types/employee'
import Card                     from '../../components/ui/Card'
import ErrorAlert               from '../../components/ui/ErrorAlert'
import EmployeeFilters          from '../../components/employees/EmployeeFilters'
import EmployeeTable            from '../../components/employees/EmployeeTable'
import EmployeeProfileModal     from '../../components/employees/EmployeeProfileModal'

export default function AccountantEmployeesPage() {
  const {
    employees, total, isLoading, error,
    search, setSearch, deptFilter, setDeptFilter, departments,
  } = useEmployees()

  const [viewing, setViewing] = useState<Employee | null>(null)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
        <p className="text-sm text-gray-500 mt-1">View employee directory (read-only)</p>
      </div>

      {error && <ErrorAlert type="error" message={error} />}

      <Card>
        <EmployeeFilters
          search={search}
          onSearch={setSearch}
          deptFilter={deptFilter}
          onDeptFilter={setDeptFilter}
          departments={departments}
          total={total}
          canAdd={false}
          onAddEmployee={() => {}}
        />
        <EmployeeTable
          employees={employees}
          isLoading={isLoading}
          onEdit={() => {}}
          onView={setViewing}
          canEdit={false}
        />
      </Card>

      <EmployeeProfileModal
        employee={viewing}
        onClose={() => setViewing(null)}
      />
    </div>
  )
}
