import { useEmployees } from '../../hooks/documents/useEmployees'

interface Props {
  value: string
  onChange: (v: string) => void
  required?: boolean
}

export default function EmployeeSelect({ value, onChange, required }: Props) {
  const { employees, isLoading, error, retry } = useEmployees()

  if (isLoading) {
    return <div className="w-full h-11 bg-gray-100 rounded-xl animate-pulse" />
  }

  if (error) {
    return (
      <div className="space-y-1">
        <p className="text-sm text-red-500">{error}</p>
        <button
          type="button"
          onClick={retry}
          className="text-xs text-blue-600 hover:underline"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      required={required}
      className="w-full h-11 px-3 border-2 border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-primary-700"
    >
      <option value="">-- Select Employee --</option>
      {employees.map(emp => (
        <option key={emp.user_id} value={emp.user_id}>
          {emp.user_id} — {emp.full_name}
        </option>
      ))}
    </select>
  )
}
