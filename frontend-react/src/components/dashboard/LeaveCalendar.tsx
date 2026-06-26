import { useMemo } from 'react'
import Card from '../ui/Card'
import SectionHeader from '../ui/SectionHeader'

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

export default function LeaveCalendar() {
  const now    = new Date()
  const year   = now.getFullYear()
  const month  = now.getMonth()
  const today  = now.getDate()

  const cells = useMemo(() => {
    const firstWeekday = new Date(year, month, 1).getDay()
    const daysInMonth  = new Date(year, month + 1, 0).getDate()
    return [
      ...Array<null>(firstWeekday).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ]
  }, [year, month])

  return (
    <Card padding="sm">
      <SectionHeader title="Calendar" />
      <p className="text-xs font-semibold text-gray-400 text-center mb-3 uppercase tracking-wider">
        {MONTH_NAMES[month]} {year}
      </p>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {DAY_LABELS.map((d, i) => (
          <div key={i} className="text-xs font-semibold text-gray-400 py-1">{d}</div>
        ))}
        {cells.map((day, i) => (
          <div
            key={i}
            className={`text-xs py-1.5 rounded-lg leading-none ${
              day === null
                ? ''
                : day === today
                ? 'bg-primary-900 text-white font-bold shadow-sm'
                : 'text-gray-600 hover:bg-gray-100 cursor-default'
            }`}
          >
            {day ?? ''}
          </div>
        ))}
      </div>
    </Card>
  )
}
