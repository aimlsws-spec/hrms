export interface StatItem {
  label: string
  value: number | string
  color: string
  sub?: string
}

interface Props {
  stats: StatItem[]
  isLoading: boolean
}

export default function AnalyticsStats({ stats, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map(s => (
        <div
          key={s.label}
          className="bg-white rounded-2xl px-5 py-4 ring-1 ring-gray-200 shadow-sm hover:shadow-md transition-shadow"
        >
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{s.label}</p>
          <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          {s.sub && <p className="text-xs text-gray-400 mt-1">{s.sub}</p>}
        </div>
      ))}
    </div>
  )
}
