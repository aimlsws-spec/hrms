import EmptyState from '../../ui/EmptyState'
import type { Holiday } from '../../../types/dashboard'

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAY_SHORT   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function formatHolidayDate(dateStr: string) {
  const d = new Date(dateStr)
  return { day: d.getDate(), month: MONTH_SHORT[d.getMonth()], weekday: DAY_SHORT[d.getDay()] }
}

interface Props {
  holidays: Holiday[]
  isLoading: boolean
  error: string | null
}

export default function UpcomingHolidaysCard({ holidays, isLoading, error }: Props) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
          <i className="fa-solid fa-star text-purple-500 text-[12px]" />
        </div>
        <div>
          <p className="text-[13px] font-semibold text-gray-800">Upcoming Holidays</p>
          <p className="text-[11px] text-gray-400">Next {holidays.length || '—'} public holidays</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0,1,2].map(i => <div key={i} className="h-12 bg-gray-50 rounded-xl animate-pulse" />)}
        </div>
      ) : error ? (
        <EmptyState message="Could not load holidays" icon="⚠️" />
      ) : holidays.length === 0 ? (
        <EmptyState message="No upcoming holidays" icon="🎉" />
      ) : (
        <ul className="space-y-2">
          {holidays.map((h, i) => {
            const { day, month, weekday } = formatHolidayDate(h.holiday_date)
            return (
              <li key={i} className="flex items-center gap-3 bg-gray-50 hover:bg-gray-100 transition-colors rounded-xl px-3 py-2 cursor-default">
                <div className="w-10 h-10 rounded-xl bg-white border border-gray-100 shadow-sm flex flex-col items-center justify-center shrink-0">
                  <span className="text-[11px] font-bold text-blue-600 leading-none">{day}</span>
                  <span className="text-[9px] text-gray-400 uppercase tracking-wide mt-0.5">{month}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-gray-800 truncate">{h.holiday_name}</p>
                  <p className="text-[11px] text-gray-400">{weekday}</p>
                </div>
                <div className="ml-auto shrink-0">
                  <span className="text-[10px] font-medium text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-md">
                    Holiday
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
