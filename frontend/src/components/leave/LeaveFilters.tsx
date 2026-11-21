export type LeaveFilterStatus = 'all' | 'Pending' | 'Approved' | 'Rejected'

const OPTIONS: { label: string; value: LeaveFilterStatus }[] = [
  { label: 'All',      value: 'all'      },
  { label: 'Pending',  value: 'Pending'  },
  { label: 'Approved', value: 'Approved' },
  { label: 'Rejected', value: 'Rejected' },
]

interface Props {
  value: LeaveFilterStatus
  onChange: (v: LeaveFilterStatus) => void
}

export default function LeaveFilters({ value, onChange }: Props) {
  return (
    <div className="inline-flex items-center border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
      {OPTIONS.map((opt, i) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-4 py-1.5 text-sm font-medium transition-colors whitespace-nowrap ${
            i > 0 ? 'border-l border-gray-200' : ''
          } ${
            value === opt.value
              ? 'bg-primary-900 text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
