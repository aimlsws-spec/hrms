import { useMemo } from 'react'
import Card from '../ui/Card'
import type { CalendarData } from '../../types/leave'

const DAY_LABELS  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

const LEGEND_ITEMS = [
  { bg: '#dcfce7', border: '#22c55e', label: 'Approved'     },
  { bg: '#fef9c3', border: '#eab308', label: 'Pending'      },
  { bg: '#fee2e2', border: '#ef4444', label: 'Rejected'     },
  { bg: '#fce7f3', border: '#ec4899', label: 'Holiday'      },
  { bg: '#fee2e2', border: '#ef4444', label: 'Sunday'       },
  { bg: '#fef3c7', border: '#f59e0b', label: '2nd/4th Sat'  },
]

interface DayStyle { bg: string; color: string; border: string; icon: string; tooltip: string }

function getDayStyle(day: number, year: number, month: number, data: CalendarData): DayStyle {
  const date = new Date(year, month - 1, day)
  const dow = date.getDay()
  const isWeekend = dow === 0 || dow === 6
  let bg = isWeekend ? '#f8fafc' : '#ffffff', color = '#1e293b', border = '1.5px solid #e2e8f0', icon = '', tooltip = ''
  let isLeave = false, isHoliday = false

  for (const l of data.leaves) {
    const s = new Date(l.start_date); s.setHours(0, 0, 0, 0)
    const e = new Date(l.end_date);   e.setHours(23, 59, 59, 999)
    const d = new Date(date);         d.setHours(12, 0, 0, 0)
    if (d >= s && d <= e) {
      if (l.status === 'Approved') { bg = '#dcfce7'; color = '#166534'; border = '2px solid #22c55e'; icon = '✓'; tooltip = `${l.leave_type} (Approved)` }
      if (l.status === 'Pending')  { bg = '#fef9c3'; color = '#854d0e'; border = '2px solid #eab308'; icon = '⏳'; tooltip = `${l.leave_type} (Pending)` }
      if (l.status === 'Rejected') { bg = '#fee2e2'; color = '#991b1b'; border = '2px solid #ef4444'; icon = '✗'; tooltip = `${l.leave_type} (Rejected)` }
      isLeave = true; break
    }
  }

  if (!isLeave) {
    for (const h of data.holidays) {
      const parts = h.holiday_date.split('-')
      if (parseInt(parts[0]) === year && parseInt(parts[1]) === month && parseInt(parts[2]) === day) {
        bg = '#fce7f3'; color = '#831843'; border = '2px solid #ec4899'; icon = '🎉'; tooltip = h.holiday_name || 'Holiday'
        isHoliday = true; break
      }
    }
  }

  if (!isLeave && !isHoliday && dow === 0) {
    bg = '#fee2e2'; color = '#991b1b'; border = '2px solid #ef4444'; icon = '☀️'; tooltip = 'Sunday'
    isHoliday = true
  }

  if (!isLeave && !isHoliday && data.saturdays?.includes(day)) {
    bg = '#fef3c7'; color = '#92400e'; border = '2px solid #f59e0b'; icon = '🏖️'; tooltip = '2nd/4th Saturday'
  }

  return { bg, color, border, icon, tooltip }
}

interface Props {
  year: number
  month: number
  data: CalendarData | null
  isLoading: boolean
  onPrevMonth: () => void
  onNextMonth: () => void
}

export default function LeaveCalendar({ year, month, data, isLoading, onPrevMonth, onNextMonth }: Props) {
  const cells = useMemo(() => {
    const firstWeekday = new Date(year, month - 1, 1).getDay()
    const daysInMonth  = new Date(year, month, 0).getDate()
    return [
      ...Array<null>(firstWeekday).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ]
  }, [year, month])

  const emptyData: CalendarData = { leaves: [], holidays: [], saturdays: [] }

  return (
    <Card>
      {/* ── Month navigation header ── */}
      <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 mb-4">
        <button
          onClick={onPrevMonth}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 hover:border-gray-300 transition-colors text-sm font-bold shadow-sm"
        >
          ‹
        </button>
        <h3 className="text-sm font-bold text-gray-800 tracking-wide">
          {MONTH_NAMES[month - 1]} {year}
        </h3>
        <button
          onClick={onNextMonth}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 hover:border-gray-300 transition-colors text-sm font-bold shadow-sm"
        >
          ›
        </button>
      </div>

      {/* ── Day-of-week header row ── */}
      <div className="grid grid-cols-7 gap-1 mb-1.5">
        {DAY_LABELS.map((d, i) => (
          <div
            key={d}
            className={`h-8 flex items-center justify-center text-[11px] font-bold rounded-md ${
              i === 0 ? 'text-red-500 bg-red-50' : 'text-gray-500 bg-gray-50'
            }`}
          >
            {d}
          </div>
        ))}
      </div>

      {/* ── Day cells ── */}
      {isLoading ? (
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (day === null) return <div key={i} className="h-10" />
            const s = getDayStyle(day, year, month, data ?? emptyData)
            return (
              <div
                key={i}
                title={s.tooltip}
                className="h-10 w-full flex flex-col items-center justify-center rounded-lg text-xs font-semibold cursor-default transition-transform hover:scale-105 select-none"
                style={{ background: s.bg, color: s.color, border: s.border }}
              >
                {s.icon && <span className="text-[8px] leading-none mb-px">{s.icon}</span>}
                <span className="leading-none">{day}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Legend ── */}
      <div className="mt-4 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2.5">Legend</p>
        <div className="grid grid-cols-3 gap-x-4 gap-y-2">
          {LEGEND_ITEMS.map(l => (
            <div key={l.label} className="flex items-center gap-2 min-w-0">
              <div
                className="w-3.5 h-3.5 rounded shrink-0"
                style={{ background: l.bg, border: `1.5px solid ${l.border}` }}
              />
              <span className="text-[11px] text-gray-600 font-medium truncate">{l.label}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}
