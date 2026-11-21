import Input from '../ui/Input'

interface Props {
  search: string
  onSearch: (v: string) => void
  deptFilter: string
  onDeptFilter: (v: string) => void
  departments: string[]
  total: number
  canAdd: boolean
  onAddEmployee?: () => void
}

export default function EmployeeFilters({
  search, onSearch, deptFilter, onDeptFilter, departments, total, canAdd, onAddEmployee,
}: Props) {
  return (
    <div className="flex items-center gap-3 mb-5">

      {/* Search */}
      <div className="flex-1 min-w-[220px]">
        <Input
          wrapperClass=""
          icon={<i className="fas fa-search text-sm" />}
          type="search"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search name, email, department…"
        />
      </div>

      {/* Department filter */}
      <select
        value={deptFilter}
        onChange={(e) => onDeptFilter(e.target.value)}
        className="h-[52px] px-3 border-2 border-gray-200 rounded-xl text-sm bg-slate-50 text-gray-700 focus:outline-none focus:border-primary-700 min-w-[160px]"
      >
        <option value="">All Departments</option>
        {departments.map((d) => (
          <option key={d} value={d}>{d}</option>
        ))}
      </select>

      {/* Result count — centered between filter and add button */}
      <span className="text-sm text-gray-500 whitespace-nowrap text-center">
        {total} employee{total !== 1 ? 's' : ''}
      </span>

      {/* Add button */}
      {canAdd && (
        <button
          onClick={onAddEmployee}
          className="h-[52px] px-5 bg-primary-700 text-white rounded-xl text-sm font-semibold hover:bg-primary-800 transition-colors flex items-center gap-2 shrink-0"
        >
          <i className="fas fa-user-plus" />
          Add Employee
        </button>
      )}
    </div>
  )
}
