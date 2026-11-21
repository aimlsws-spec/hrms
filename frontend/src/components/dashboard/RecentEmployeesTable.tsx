import { useNavigate } from 'react-router-dom'
import Card from '../ui/Card'
import SectionHeader from '../ui/SectionHeader'
import Badge from '../ui/Badge'
import Avatar from '../ui/Avatar'
import EmptyState from '../ui/EmptyState'
import { useRecentEmployees } from '../../hooks/useRecentEmployees'
import type { RecentEmployee } from '../../types/dashboard'

function displayName(emp: RecentEmployee) {
  return (
    emp.name?.trim() ||
    emp.full_name?.trim() ||
    `${emp.first_name ?? ''} ${emp.last_name ?? ''}`.trim() ||
    'Unknown'
  )
}

export default function RecentEmployeesTable() {
  const { employees, isLoading, error } = useRecentEmployees(3)
  const navigate = useNavigate()

  return (
    <Card>
      <SectionHeader
        title="Recent Employees"
        action={
          <button
            onClick={() => navigate('/employees')}
            className="text-xs bg-primary-50 text-primary-700 hover:bg-primary-100 px-3 py-1.5 rounded-lg font-semibold transition-colors"
          >
            View All →
          </button>
        }
      />
      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gray-100 rounded-full animate-pulse shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-gray-100 rounded animate-pulse w-1/3" />
                <div className="h-3 bg-gray-100 rounded animate-pulse w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <EmptyState message="Could not load employees" />
      ) : employees.length === 0 ? (
        <EmptyState message="No recent employees found" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-y-1.5">
            <thead>
              <tr className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                <th className="text-left pb-1 pl-3">Employee</th>
                <th className="text-left pb-1">Department</th>
                <th className="text-left pb-1">Status</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp, i) => {
                const name = displayName(emp)
                return (
                  <tr key={emp.employee_id || i} className="bg-gray-50 hover:bg-primary-50 transition-colors duration-150">
                    <td className="py-3 pl-3 rounded-l-xl">
                      <div className="flex items-center gap-3">
                        <Avatar name={name} size="sm" />
                        <div>
                          <div className="font-semibold text-sm text-gray-900 leading-tight">{name}</div>
                          <div className="text-xs text-gray-400 mt-0.5">{emp.employee_id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 text-sm text-gray-600">{emp.department ?? 'N/A'}</td>
                    <td className="py-3 rounded-r-xl"><Badge variant="green">Active</Badge></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
