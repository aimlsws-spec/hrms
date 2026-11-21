import Card from '../ui/Card'
import SectionHeader from '../ui/SectionHeader'
import EmptyState from '../ui/EmptyState'
import { useUpcomingHolidays } from '../../hooks/useUpcomingHolidays'

const PALETTES = [
  { bg: 'bg-amber-50',  badge: 'bg-amber-100 text-amber-800',  dot: 'bg-amber-400'  },
  { bg: 'bg-blue-50',   badge: 'bg-blue-100  text-blue-800',   dot: 'bg-blue-400'   },
  { bg: 'bg-pink-50',   badge: 'bg-pink-100  text-pink-800',   dot: 'bg-pink-400'   },
  { bg: 'bg-green-50',  badge: 'bg-green-100 text-green-800',  dot: 'bg-green-400'  },
  { bg: 'bg-purple-50', badge: 'bg-purple-100 text-purple-800', dot: 'bg-purple-400' },
]

export default function UpcomingHolidays() {
  const { holidays, isLoading } = useUpcomingHolidays()

  return (
    <Card padding="sm">
      <SectionHeader title="Upcoming Holidays" />
      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map(i => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : holidays.length === 0 ? (
        <EmptyState message="No upcoming holidays" />
      ) : (
        <div className="space-y-2">
          {holidays.map((h, i) => {
            const p = PALETTES[i % PALETTES.length]
            const d = new Date(h.holiday_date)
            const monthStr = d.toLocaleDateString('en-US', { month: 'short' })
            const dayStr   = d.toLocaleDateString('en-US', { day: 'numeric' })
            const fullDate = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
            return (
              <div key={h.holiday_name} className={`flex items-center gap-3 p-2 ${p.bg} rounded-lg`}>
                <div className={`w-9 h-9 ${p.badge} rounded flex flex-col items-center justify-center shrink-0`}>
                  <span className="text-[10px] font-bold leading-none uppercase">{monthStr}</span>
                  <span className="text-xs font-bold leading-none mt-0.5">{dayStr}</span>
                </div>
                <div className="min-w-0 flex-1 flex items-center justify-between">
                  <div className="text-sm font-semibold text-gray-900 truncate leading-tight">{h.holiday_name}</div>
                  <div className="text-xs text-gray-500 shrink-0 ml-2">{fullDate}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
