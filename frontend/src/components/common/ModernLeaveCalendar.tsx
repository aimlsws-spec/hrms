import { useState, useMemo } from 'react'
import type { CalendarData, CalendarHoliday, CalendarLeave } from '../../types/leave'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

interface Props {
  year: number
  month: number
  data: CalendarData | null
  isLoading?: boolean
  onPrevMonth: () => void
  onNextMonth: () => void
  onToday?: () => void
  onSelectYearMonth?: (year: number, month: number) => void
  title?: string
  subtitle?: string
  compact?: boolean
}

export default function ModernLeaveCalendar({
  year,
  month,
  data,
  isLoading = false,
  onPrevMonth,
  onNextMonth,
  onToday,
  onSelectYearMonth,
  title = 'Company Calendar & Holidays',
  subtitle = 'All Sundays and 2nd & 4th Saturdays are observed company holidays',
  compact = false,
}: Props) {
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  const today = new Date()
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month
  const todayDate = isCurrentMonth ? today.getDate() : -1

  // Days in month calculation
  const { cells, daysInMonth, sundaysList, sat2nd4thList } = useMemo(() => {
    const firstWeekday = new Date(year, month - 1, 1).getDay()
    const totalDays = new Date(year, month, 0).getDate()

    // Compute all saturdays
    const allSats: number[] = []
    const sundays: number[] = []
    for (let d = 1; d <= totalDays; d++) {
      const dow = new Date(year, month - 1, d).getDay()
      if (dow === 6) allSats.push(d)
      if (dow === 0) sundays.push(d)
    }

    // 2nd and 4th saturdays (indices 1 and 3)
    const sat2nd4th: number[] = []
    if (allSats.length >= 2) sat2nd4th.push(allSats[1])
    if (allSats.length >= 4) sat2nd4th.push(allSats[3])

    const dayCells: (number | null)[] = [
      ...Array<null>(firstWeekday).fill(null),
      ...Array.from({ length: totalDays }, (_, i) => i + 1),
    ]

    return {
      cells: dayCells,
      daysInMonth: totalDays,
      sundaysList: data?.sundays && data.sundays.length > 0 ? data.sundays : sundays,
      sat2nd4thList: data?.second_and_fourth_saturdays && data.second_and_fourth_saturdays.length > 0
        ? data.second_and_fourth_saturdays
        : (data?.saturdays && data.saturdays.length > 0 ? data.saturdays : sat2nd4th),
    }
  }, [year, month, data])

  // Count holidays in this month
  const holidaySummary = useMemo(() => {
    const publicHolidays = data?.holidays ?? []
    const totalOffs = sundaysList.length + sat2nd4thList.length + publicHolidays.length
    return {
      sundaysCount: sundaysList.length,
      satCount: sat2nd4thList.length,
      pubCount: publicHolidays.length,
      totalOffs,
    }
  }, [sundaysList, sat2nd4thList, data?.holidays])

  // Get info for a specific day
  function getDayInfo(day: number) {
    const dow = new Date(year, month - 1, day).getDay()
    const isSunday = dow === 0 || sundaysList.includes(day)
    const is2nd4thSat = dow === 6 && sat2nd4thList.includes(day)
    const isOtherSat = dow === 6 && !is2nd4thSat

    // Check official public holiday
    const holidayMatch = (data?.holidays ?? []).find((h: CalendarHoliday) => {
      const parts = h.holiday_date.split('-')
      return (
        parseInt(parts[0], 10) === year &&
        parseInt(parts[1], 10) === month &&
        parseInt(parts[2], 10) === day
      )
    })

    // Check employee leave
    const leaveMatches = (data?.leaves ?? []).filter((l: CalendarLeave) => {
      const s = new Date(l.start_date); s.setHours(0, 0, 0, 0)
      const e = new Date(l.end_date);   e.setHours(23, 59, 59, 999)
      const d = new Date(year, month - 1, day, 12, 0, 0, 0)
      return d >= s && d <= e
    })

    return {
      day,
      dow,
      isSunday,
      is2nd4thSat,
      isOtherSat,
      isWorkingDay: !isSunday && !is2nd4thSat && !holidayMatch,
      holiday: holidayMatch,
      leaves: leaveMatches,
    }
  }

  const selectedInfo = selectedDay ? getDayInfo(selectedDay) : null

  return (
    <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden transition-all">
      {/* ── Top Header Bar ── */}
      <div className="p-4 sm:p-5 border-b border-gray-100 bg-gradient-to-r from-slate-50 via-white to-indigo-50/30">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm">
                <i className="fa-solid fa-calendar-days" />
              </span>
              <h2 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">{title}</h2>
            </div>
            <p className="text-xs text-gray-500 mt-1 pl-10 hidden sm:block">{subtitle}</p>
          </div>

          {/* Month Navigation Controls */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            {onToday && (
              <button
                type="button"
                onClick={onToday}
                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 shadow-xs transition-colors"
              >
                Today
              </button>
            )}
            <div className="flex items-center bg-white border border-gray-200 rounded-xl p-1 shadow-xs">
              <button
                type="button"
                onClick={onPrevMonth}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                title="Previous Month"
              >
                <i className="fa-solid fa-chevron-left text-xs" />
              </button>
              <span className="px-3 text-xs sm:text-sm font-bold text-gray-800 tracking-wide select-none min-w-[120px] text-center">
                {MONTH_NAMES[month - 1]} {year}
              </span>
              <button
                type="button"
                onClick={onNextMonth}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                title="Next Month"
              >
                <i className="fa-solid fa-chevron-right text-xs" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Monthly Summary Badges ── */}
        <div className="mt-4 flex items-center gap-2 flex-wrap text-[11px]">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-200/60 font-semibold">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            Sundays (Holiday): {holidaySummary.sundaysCount}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200/60 font-semibold">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            2nd & 4th Sat (Holiday): {holidaySummary.satCount}
          </span>
          {holidaySummary.pubCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200/60 font-semibold">
              <span className="w-2 h-2 rounded-full bg-fuchsia-500" />
              Official Holidays: {holidaySummary.pubCount}
            </span>
          )}
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 font-semibold ml-auto">
            <i className="fa-solid fa-circle-info text-[10px]" />
            Total Offs: {holidaySummary.totalOffs} Days
          </span>
        </div>
      </div>

      {/* ── Calendar Grid ── */}
      <div className="p-3 sm:p-5">
        {/* Day-of-week header */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
          {DAY_LABELS.map((d, i) => {
            const isSun = i === 0
            const isSat = i === 6
            return (
              <div
                key={d}
                className={`py-2 text-center text-[11px] sm:text-xs font-bold rounded-lg uppercase tracking-wider select-none ${
                  isSun
                    ? 'text-red-700 bg-red-50 border border-red-100 font-extrabold'
                    : isSat
                    ? 'text-amber-800 bg-amber-50/80 border border-amber-100 font-bold'
                    : 'text-gray-600 bg-gray-50 border border-gray-100 font-semibold'
                }`}
              >
                {d}
              </div>
            )
          })}
        </div>

        {/* Calendar days */}
        {isLoading ? (
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="h-16 sm:h-20 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {cells.map((day, idx) => {
              if (day === null) {
                return (
                  <div
                    key={`empty-${idx}`}
                    className="h-16 sm:h-20 rounded-xl border border-dashed border-gray-100 bg-gray-50/30"
                  />
                )
              }

              const info = getDayInfo(day)
              const isToday = day === todayDate
              const isSelected = selectedDay === day

              // Determine style badges
              let bgClass = 'bg-white hover:bg-slate-50 border-gray-200/80'
              let textColor = 'text-gray-800'
              let tagBadge = null

              if (info.isSunday) {
                bgClass = 'bg-red-50/40 hover:bg-red-50/80 border-red-200'
                textColor = 'text-red-800 font-bold'
                tagBadge = (
                  <span className="text-[9px] font-bold text-red-600 bg-red-100/80 px-1 rounded leading-tight truncate">
                    Sunday
                  </span>
                )
              } else if (info.is2nd4thSat) {
                bgClass = 'bg-amber-50/40 hover:bg-amber-50/80 border-amber-200'
                textColor = 'text-amber-900 font-bold'
                tagBadge = (
                  <span className="text-[9px] font-bold text-amber-700 bg-amber-100/80 px-1 rounded leading-tight truncate">
                    2nd/4th Sat
                  </span>
                )
              }

              if (info.holiday) {
                bgClass = 'bg-fuchsia-50/60 hover:bg-fuchsia-50 border-fuchsia-300'
                textColor = 'text-fuchsia-900 font-bold'
                tagBadge = (
                  <span className="text-[9px] font-bold text-fuchsia-700 bg-fuchsia-100 px-1 rounded leading-tight truncate" title={info.holiday.holiday_name}>
                    🎉 {info.holiday.holiday_name}
                  </span>
                )
              }

              const hasApprovedLeave = info.leaves.some((l) => l.status === 'Approved')
              const hasPendingLeave = info.leaves.some((l) => l.status === 'Pending')

              return (
                <div
                  key={`day-${day}`}
                  onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                  className={`relative h-16 sm:h-20 p-1.5 sm:p-2 rounded-xl border flex flex-col justify-between cursor-pointer transition-all select-none ${bgClass} ${
                    isToday ? 'ring-2 ring-indigo-500 ring-offset-1 shadow-sm' : ''
                  } ${isSelected ? 'ring-2 ring-primary-700 border-primary-500 shadow-md scale-[1.02]' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs sm:text-sm font-bold ${textColor} ${
                        isToday ? 'w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]' : ''
                      }`}
                    >
                      {day}
                    </span>
                    {isToday && (
                      <span className="text-[9px] font-bold text-indigo-700 hidden sm:inline-block">
                        Today
                      </span>
                    )}
                  </div>

                  <div className="space-y-0.5 overflow-hidden">
                    {tagBadge}
                    {hasApprovedLeave && (
                      <span className="block text-[8px] sm:text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1 rounded truncate">
                        ✓ Leave
                      </span>
                    )}
                    {hasPendingLeave && (
                      <span className="block text-[8px] sm:text-[9px] font-bold text-amber-700 bg-amber-100 px-1 rounded truncate">
                        ⏳ Pending
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Selected Day Details Card (Opens on click) ── */}
        {selectedInfo && (
          <div className="mt-4 p-4 rounded-xl border border-indigo-200 bg-indigo-50/40 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">
                  {selectedInfo.day}
                </span>
                <div>
                  <h4 className="text-sm font-bold text-gray-900">
                    {DAY_LABELS[selectedInfo.dow]}, {selectedInfo.day} {MONTH_NAMES[month - 1]} {year}
                  </h4>
                  <p className="text-xs text-gray-600">
                    {selectedInfo.isSunday && 'Weekly Off — All Sundays are official company holidays.'}
                    {selectedInfo.is2nd4thSat && 'Company Holiday — 2nd & 4th Saturday holiday as per HR policy.'}
                    {selectedInfo.isOtherSat && 'Working Saturday — Regular office hours.'}
                    {selectedInfo.isWorkingDay && 'Standard Working Day.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDay(null)}
                className="text-gray-400 hover:text-gray-600 text-xs px-2 py-1 rounded"
              >
                ✕ Close
              </button>
            </div>

            {selectedInfo.holiday && (
              <div className="mt-2.5 p-2.5 rounded-lg bg-fuchsia-100/70 border border-fuchsia-200 text-xs text-fuchsia-900 font-semibold flex items-center gap-2">
                <i className="fa-solid fa-cake-candles text-fuchsia-600" />
                <span>Official Holiday: <strong>{selectedInfo.holiday.holiday_name}</strong></span>
              </div>
            )}

            {selectedInfo.leaves.length > 0 && (
              <div className="mt-2.5 space-y-1.5">
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Leave Applications for this day:</p>
                {selectedInfo.leaves.map((l, i) => (
                  <div
                    key={i}
                    className={`p-2 rounded-lg text-xs font-medium border flex items-center justify-between ${
                      l.status === 'Approved'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : l.status === 'Pending'
                        ? 'bg-amber-50 border-amber-200 text-amber-800'
                        : 'bg-rose-50 border-rose-200 text-rose-800'
                    }`}
                  >
                    <span>
                      <strong>{l.leave_type}</strong> ({l.status})
                    </span>
                    <span className="text-[11px] opacity-80">
                      {l.start_date.substring(0, 10)} to {l.end_date.substring(0, 10)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Legend Bar ── */}
        <div className="mt-5 pt-4 border-t border-gray-100 flex items-center gap-x-4 gap-y-2 flex-wrap text-xs text-gray-600">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-red-100 border border-red-300 inline-block" />
            <span className="font-medium text-gray-700">☀️ Sunday (Holiday)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-amber-100 border border-amber-300 inline-block" />
            <span className="font-medium text-gray-700">🏖️ 2nd & 4th Saturday (Holiday)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-fuchsia-100 border border-fuchsia-300 inline-block" />
            <span className="font-medium text-gray-700">🎉 Official Holiday</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-emerald-100 border border-emerald-300 inline-block" />
            <span className="font-medium text-gray-700">✓ Approved Leave</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-amber-100 border border-amber-300 inline-block" />
            <span className="font-medium text-gray-700">⏳ Pending Leave</span>
          </div>
        </div>
      </div>
    </div>
  )
}
