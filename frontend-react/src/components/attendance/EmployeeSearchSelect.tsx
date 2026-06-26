import { useState, useRef, useEffect } from 'react'
import { useEmployeeOptions } from '../../hooks/attendance/useEmployeeOptions'
import type { EmployeeOption } from '../../hooks/attendance/useEmployeeOptions'

interface Props {
  value: string
  onChange: (employeeId: string, employee?: EmployeeOption) => void
  placeholder?: string
  required?: boolean
  className?: string
}

export default function EmployeeSearchSelect({
  value,
  onChange,
  placeholder = 'Select employee...',
  required,
  className = '',
}: Props) {
  const { options, isLoading } = useEmployeeOptions()
  const [query, setQuery] = useState('')
  const [open, setOpen]   = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selected = options.find(e => e.employee_id === value)

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const filtered = query
    ? options.filter(e =>
        e.name.toLowerCase().includes(query.toLowerCase()) ||
        e.employee_id.toLowerCase().includes(query.toLowerCase())
      )
    : options

  function select(emp: EmployeeOption) {
    onChange(emp.employee_id, emp)
    setQuery('')
    setOpen(false)
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange('')
    setQuery('')
    setOpen(false)
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      {/* Trigger button */}
      <div
        role="combobox"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
        className="w-full h-11 px-3 border-2 border-gray-200 rounded-xl text-sm bg-white focus-within:border-primary-700 flex items-center gap-2 cursor-pointer select-none hover:border-gray-300 transition-colors"
      >
        {selected ? (
          <span className="flex-1 text-gray-800 truncate">
            {selected.name}
            <span className="text-gray-400 text-xs ml-1.5">({selected.employee_id})</span>
          </span>
        ) : (
          <span className="flex-1 text-gray-400">{placeholder}</span>
        )}
        {selected && (
          <button
            type="button"
            onClick={clear}
            className="text-gray-400 hover:text-gray-600 leading-none shrink-0 text-xs p-0.5"
            aria-label="Clear selection"
          >
            ✕
          </button>
        )}
        <span className="text-gray-300 text-xs shrink-0">{open ? '▲' : '▼'}</span>
      </div>

      {/* Native hidden input for required validation */}
      <input type="hidden" value={value} required={required} />

      {/* Dropdown */}
      {open && (
        <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-white border-2 border-gray-200 rounded-xl shadow-xl z-50 max-h-64 flex flex-col">
          {/* Search box */}
          <div className="p-2 border-b border-gray-100 shrink-0">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Type name or ID..."
              onClick={e => e.stopPropagation()}
              className="w-full h-9 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary-700"
            />
          </div>

          {/* Options */}
          <div className="overflow-y-auto flex-1">
            {isLoading ? (
              <p className="text-sm text-gray-400 text-center py-4">Loading employees...</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No employees found.</p>
            ) : (
              filtered.map(emp => (
                <button
                  key={emp.employee_id}
                  type="button"
                  onClick={() => select(emp)}
                  className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between hover:bg-gray-50 transition-colors ${
                    emp.employee_id === value
                      ? 'bg-primary-50 text-primary-900 font-medium'
                      : 'text-gray-700'
                  }`}
                >
                  <span>{emp.name}</span>
                  <span className="text-xs text-gray-400 ml-3 shrink-0">{emp.employee_id}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
