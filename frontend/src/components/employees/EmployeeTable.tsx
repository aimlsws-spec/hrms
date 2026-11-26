import type { Employee } from '../../types/employee'
import Badge from '../ui/Badge'
import EmployeeActions from './EmployeeActions'
import EmployeeCard from './EmployeeCard'
import PasswordViewer from '../common/PasswordViewer'

interface Props {
  employees: Employee[]
  isLoading: boolean
  onEdit: (emp: Employee) => void
  onView?: (emp: Employee) => void
  onToggleStatus?: (emp: Employee, newActive: boolean) => void
  canEdit: boolean
}

const SKELETON_ROWS = 6

export default function EmployeeTable({
  employees,
  isLoading,
  onEdit,
  onView,
  onToggleStatus,
  canEdit,
}: Props) {
  // ── Loading skeleton ──────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-2 animate-pulse">
        {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
          <div key={i} className="h-14 bg-gray-100 rounded-xl" />
        ))}
      </div>
    )
  }

  // ── Empty state ───────────────────────────────────────────────────────
  if (employees.length === 0) {
    return (
      <div className="py-16 text-center text-gray-400">
        <i className="fas fa-users text-4xl mb-3 block opacity-30" />
        <p className="text-sm">No employees found</p>
      </div>
    )
  }

  // ── Mobile cards (< md) ───────────────────────────────────────────────
  const cardList = (
    <div className="md:hidden space-y-3">
      {employees.map((emp) => (
        <EmployeeCard
          key={emp.employee_id}
          employee={emp}
          onEdit={onEdit}
          onView={onView}
          onToggleStatus={onToggleStatus}
          canEdit={canEdit}
        />
      ))}
    </div>
  )

  // ── Desktop table (≥ md) ──────────────────────────────────────────────
  const table = (
    <div className="hidden md:block overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">ID</th>
            <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
            <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
            <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Department</th>
            <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Title</th>
            <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
            <th className="text-right py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((emp) => {
            const isInactive =
              emp.status === 'inactive' || emp.status === 'deactivated'
            const isProbation = (emp.status || '').toLowerCase() === 'probation'

            return (
              <tr
                key={emp.employee_id}
                className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                  isInactive ? 'opacity-70 bg-gray-50/50' : ''
                }`}
              >
                <td className="py-4 px-3 font-mono text-xs text-left">
                  <span className="font-semibold text-gray-700 block">{emp.employee_id}</span>
                  <PasswordViewer password={emp.assigned_password} className="mt-1" />
                </td>
                <td className="py-4 px-3 text-left">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={emp.name} isInactive={isInactive} />
                    <div>
                      <span className="font-medium text-gray-900 block">{emp.name}</span>
                      {isInactive && (
                        <span className="text-[10px] text-rose-500 font-medium">Login access disabled</span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="py-4 px-3 text-left">
                  {isInactive ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                      Deactivated
                    </span>
                  ) : isProbation ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      Probation
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Active
                    </span>
                  )}
                </td>
                <td className="py-4 px-3 text-left">
                  {emp.department ? (
                    <Badge variant="blue"><span className="inline-flex items-center">{emp.department}</span></Badge>
                  ) : (
                    <span className="text-gray-300 block text-center">—</span>
                  )}
                </td>
                <td className="py-4 px-3 text-gray-600 text-left">{emp.title ?? <span className="text-gray-300 block text-center">—</span>}</td>
                <td className="py-4 px-3 text-gray-500 text-left">{emp.email ?? '—'}</td>
                <td className="py-4 px-3 text-right">
                  <EmployeeActions
                    employee={emp}
                    onEdit={onEdit}
                    onView={onView}
                    onToggleStatus={onToggleStatus}
                    canEdit={canEdit}
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )

  return (
    <>
      {cardList}
      {table}
    </>
  )
}

function Avatar({ name, isInactive }: { name: string; isInactive?: boolean }) {
  const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <span
      className={`w-8 h-8 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${
        isInactive
          ? 'bg-gray-200 text-gray-600'
          : 'bg-primary-100 text-primary-700'
      }`}
    >
      {initials}
    </span>
  )
}
