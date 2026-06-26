import type { Employee } from '../../types/employee'
import Badge from '../ui/Badge'
import EmployeeActions from './EmployeeActions'
import EmployeeCard from './EmployeeCard'

interface Props {
  employees: Employee[]
  isLoading: boolean
  onEdit:    (emp: Employee) => void
  onView?:   (emp: Employee) => void
  canEdit:   boolean
}

const SKELETON_ROWS = 6

export default function EmployeeTable({ employees, isLoading, onEdit, onView, canEdit }: Props) {
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
        <EmployeeCard key={emp.employee_id} employee={emp} onEdit={onEdit} onView={onView} canEdit={canEdit} />
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
            <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Department</th>
            <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Title</th>
            <th className="text-left py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
            <th className="text-right py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((emp) => (
            <tr
              key={emp.employee_id}
              className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
            >
              <td className="py-4 px-3 font-mono text-xs text-gray-400 text-left">{emp.employee_id}</td>
              <td className="py-4 px-3 text-left">
                <div className="flex items-center gap-2.5">
                  <Avatar name={emp.name} />
                  <span className="font-medium text-gray-900">{emp.name}</span>
                </div>
              </td>
              <td className="py-4 px-3 text-left">
                {emp.department
                  ? <Badge variant="blue"><span className="inline-flex items-center">{emp.department}</span></Badge>
                  : <span className="text-gray-300 block text-center">—</span>}
              </td>
              <td className="py-4 px-3 text-gray-600 text-left">{emp.title ?? <span className="text-gray-300 block text-center">—</span>}</td>
              <td className="py-4 px-3 text-gray-500 text-left">{emp.email ?? '—'}</td>
              <td className="py-4 px-3 text-right">
                <EmployeeActions employee={emp} onEdit={onEdit} onView={onView} canEdit={canEdit} />
              </td>
            </tr>
          ))}
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

// Inline avatar — keeps EmployeeTable self-contained for the table view
function Avatar({ name }: { name: string }) {
  const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <span className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center shrink-0">
      {initials}
    </span>
  )
}
