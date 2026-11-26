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
  title = 'Company Calendar & Holidays',
  subtitle = 'Sundays and 2nd & 4th Saturdays are observed company holidays',
  compact = false,
}: Props) {
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  const today = new Date()
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month
  const todayDate = isCurrentMonth ? today.getDate() : -1

  // Days in month calculation
  const { cells, sundaysList, sat2nd4thList, allSats } = useMemo(() => {
    const firstWeekday = new Date(year, month - 1, 1).getDay()
    const totalDays = new Date(year, month, 0).getDate()

    // Compute all saturdays & sundays
    const sats: number[] = []
    const sundays: number[] = []
    for (let d = 1; d <= totalDays; d++) {
      const dow = new Date(year, month - 1, d).getDay()
      if (dow === 6) sats.push(d)
      if (dow === 0) sundays.push(d)
    }

    // 2nd and 4th saturdays (indices 1 and 3)
    const sat2nd4th: number[] = []
    if (sats.length >= 2) sat2nd4th.push(sats[1])
    if (sats.length >= 4) sat2nd4th.push(sats[3])

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
      allSats: sats,
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

    let satOrder: 2 | 4 | null = null
    if (dow === 6) {
      if (allSats.length >= 2 && day === allSats[1]) satOrder = 2
      else if (allSats.length >= 4 && day === allSats[3]) satOrder = 4
    }

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
      satOrder,
      isWorkingDay: !isSunday && !is2nd4thSat && !holidayMatch,
      holiday: holidayMatch,
      leaves: leaveMatches,
    }
  }

  const selectedInfo = selectedDay ? getDayInfo(selectedDay) : null

  return (
    <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden transition-all">
      {/* ── Top Header Bar ── */}
      <div className="p-3.5 sm:p-5 border-b border-gray-100 bg-gradient-to-r from-slate-50 via-white to-indigo-50/30">
        <div className={`flex ${compact ? 'flex-col gap-2.5' : 'flex-col sm:flex-row sm:items-center justify-between gap-3'}`}>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 shrink-0 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm shadow-xs">
                <i className="fa-solid fa-calendar-days" />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm sm:text-base font-bold text-gray-900 tracking-tight truncate">{title}</h2>
                {subtitle && (
                  <p className="text-[11px] text-gray-500 truncate hidden sm:block">{subtitle}</p>
                )}
              </div>
            </div>
          </div>

          {/* Month Navigation Controls */}
          <div className={`flex items-center ${compact ? 'justify-between w-full' : 'gap-2 self-end sm:self-auto'}`}>
            {onToday && (
              <button
                type="button"
                onClick={onToday}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 shadow-xs transition-colors shrink-0"
              >
                Today
              </button>
            )}
            <div className={`flex items-center bg-white border border-gray-200 rounded-xl p-1 shadow-xs ${compact ? 'w-full justify-between' : ''}`}>
              <button
                type="button"
                onClick={onPrevMonth}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors shrink-0"
                title="Previous Month"
              >
                <i className="fa-solid fa-chevron-left text-xs" />
              </button>
              <span className="px-2 sm:px-3 text-xs sm:text-sm font-bold text-gray-800 tracking-wide select-none text-center min-w-[100px]">
                {MONTH_NAMES[month - 1]} {year}
              </span>
              <button
                type="button"
                onClick={onNextMonth}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors shrink-0"
                title="Next Month"
              >
                <i className="fa-solid fa-chevron-right text-xs" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Monthly Summary Badges ── */}
        <div className="mt-2.5 flex items-center gap-1.5 flex-wrap text-[10px] sm:text-[11px]">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200/60 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            {compact ? `Sundays: ${holidaySummary.sundaysCount}` : `Sundays (Holiday): ${holidaySummary.sundaysCount}`}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/60 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            {compact ? `2nd/4th Sat: ${holidaySummary.satCount}` : `2nd & 4th Sat (Holiday): ${holidaySummary.satCount}`}
          </span>
          {holidaySummary.pubCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200/60 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-500" />
              {compact ? `Holidays: ${holidaySummary.pubCount}` : `Official Holidays: ${holidaySummary.pubCount}`}
            </span>
          )}
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-semibold ml-auto">
            <i className="fa-solid fa-circle-info text-[9px]" />
            {compact ? `${holidaySummary.totalOffs} Offs` : `Total Offs: ${holidaySummary.totalOffs} Days`}
          </span>
        </div>
      </div>

      {/* ── Calendar Grid ── */}
      <div className="p-2.5 sm:p-4">
        {/* Day-of-week header */}
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5 mb-1.5">
          {DAY_LABELS.map((d, i) => {
            const isSun = i === 0
            const isSat = i === 6
            return (
              <div
                key={d}
                className={`py-1.5 text-center text-[10px] sm:text-xs font-bold rounded-lg uppercase tracking-wider select-none ${
                  isSun
                    ? 'text-red-700 bg-red-50/90 border border-red-100 font-extrabold'
                    : isSat
                    ? 'text-amber-800 bg-amber-50/80 border border-amber-100 font-bold'
                    : 'text-gray-600 bg-gray-50 border border-gray-100 font-semibold'
                }`}
              >
                {compact ? d.slice(0, 3) : d}
              </div>
            )
          })}
        </div>

        {/* Calendar days */}
        {isLoading ? (
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {Array.from({ length: 35 }).map((_, i) => (
              <div
                key={i}
                className={`${compact ? 'h-10 sm:h-11' : 'min-h-[52px] sm:min-h-[64px]'} bg-gray-100 rounded-lg sm:rounded-xl animate-pulse`}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {cells.map((day, idx) => {
              if (day === null) {
                return (
                  <div
                    key={`empty-${idx}`}
                    className={`${compact ? 'h-10 sm:h-11' : 'min-h-[52px] sm:min-h-[64px]'} rounded-lg sm:rounded-xl border border-dashed border-gray-100 bg-gray-50/20`}
                  />
                )
              }

              const info = getDayInfo(day)
              const isToday = day === todayDate
              const isSelected = selectedDay === day
              const hasApprovedLeave = info.leaves.some((l) => l.status === 'Approved')
              const hasPendingLeave = info.leaves.some((l) => l.status === 'Pending')

              // Style classes
              let bgClass = 'bg-white hover:bg-slate-50 border-gray-200/80'
              let textColor = 'text-gray-800'

              if (info.isSunday) {
                bgClass = 'bg-red-50/40 hover:bg-red-50/80 border-red-200'
                textColor = 'text-red-700 font-bold'
              } else if (info.is2nd4thSat) {
                bgClass = 'bg-amber-50/50 hover:bg-amber-50/90 border-amber-200'
                textColor = 'text-amber-900 font-bold'
              }

              if (info.holiday) {
                bgClass = 'bg-fuchsia-50/70 hover:bg-fuchsia-100/70 border-fuchsia-300'
                textColor = 'text-fuchsia-900 font-bold'
              }

              // Tooltip description
              const tooltipParts: string[] = []
              if (isToday) tooltipParts.push('Today')
              if (info.isSunday) tooltipParts.push('Sunday (Weekly Off)')
              if (info.is2nd4thSat) tooltipParts.push(`${info.satOrder ? `${info.satOrder}${info.satOrder === 2 ? 'nd' : 'th'}` : '2nd/4th'} Saturday (Company Holiday)`)
              if (info.holiday) tooltipParts.push(`Official Holiday: ${info.holiday.holiday_name}`)
              if (hasApprovedLeave) tooltipParts.push('Approved Leave')
              if (hasPendingLeave) tooltipParts.push('Pending Leave')
              const tooltipText = tooltipParts.length > 0 ? tooltipParts.join(' • ') : 'Working Day'

              return (
                <div
                  key={`day-${day}`}
                  onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                  title={tooltipText}
                  className={`relative ${
                    compact ? 'h-10 sm:h-11 p-1' : 'min-h-[52px] sm:min-h-[64px] p-1 sm:p-1.5'
                  } rounded-lg sm:rounded-xl border flex flex-col justify-between items-center cursor-pointer transition-all select-none ${bgClass} ${
                    isToday ? 'ring-2 ring-indigo-500 ring-offset-1 shadow-xs font-bold' : ''
                  } ${isSelected ? 'ring-2 ring-primary-700 border-primary-500 shadow-md scale-[1.03] z-10' : ''}`}
                >
                  {/* Day number */}
                  <span
                    className={`text-xs sm:text-sm font-bold leading-none ${textColor} ${
                      isToday
                        ? 'w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] sm:text-[11px] shadow-xs'
                        : 'mt-0.5'
                    }`}
                  >
                    {day}
                  </span>

                  {/* Day Indicators / Badges */}
                  {compact ? (
                    /* Compact Indicator Row (Dots / Mini Icons) - NEVER crops or overflows */
                    <div className="flex items-center justify-center gap-1 mt-auto pb-0.5 w-full">
                      {info.isSunday && (
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                      )}
                      {info.is2nd4thSat && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                      )}
                      {info.holiday && (
                        <span className="text-[9px] leading-none shrink-0" role="img" aria-label="Holiday">🎉</span>
                      )}
                      {hasApprovedLeave && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      )}
                      {hasPendingLeave && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                      )}
                    </div>
                  ) : (
                    /* Full View Badges */
                    <div className="w-full space-y-0.5 overflow-hidden text-center">
                      {info.isSunday && (
                        <span className="block text-[8px] sm:text-[9px] font-bold text-red-600 bg-red-100/80 px-1 rounded truncate">
                          Sunday
                        </span>
                      )}
                      {info.is2nd4thSat && (
                        <span className="block text-[8px] sm:text-[9px] font-bold text-amber-700 bg-amber-100/80 px-1 rounded truncate">
                          {info.satOrder ? `${info.satOrder}${info.satOrder === 2 ? 'nd' : 'th'} Sat` : '2nd/4th Sat'}
                        </span>
                      )}
                      {info.holiday && (
                        <span className="block text-[8px] sm:text-[9px] font-bold text-fuchsia-700 bg-fuchsia-100 px-1 rounded truncate" title={info.holiday.holiday_name}>
                          🎉 {info.holiday.holiday_name}
                        </span>
                      )}
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
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── Selected Day Details Card (Opens on click) ── */}
        {selectedInfo && (
          <div className="mt-3 p-3 sm:p-4 rounded-xl border border-indigo-200 bg-indigo-50/50 animate-fadeIn">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 shrink-0 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">
                  {selectedInfo.day}
                </span>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-gray-900">
                    {DAY_LABELS[selectedInfo.dow]}, {selectedInfo.day} {MONTH_NAMES[month - 1]} {year}
                  </h4>
                  <p className="text-[11px] sm:text-xs text-gray-600">
                    {selectedInfo.isSunday && 'Weekly Off — All Sundays are official company holidays.'}
                    {selectedInfo.is2nd4thSat && (
                      `Company Holiday — ${selectedInfo.satOrder ? `${selectedInfo.satOrder}${selectedInfo.satOrder === 2 ? 'nd' : 'th'} Saturday` : '2nd & 4th Saturday'} observed holiday.`
                    )}
                    {selectedInfo.isOtherSat && 'Working Saturday — Regular office working day.'}
                    {selectedInfo.isWorkingDay && 'Standard Working Day.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDay(null)}
                className="text-gray-400 hover:text-gray-600 text-xs px-2 py-1 rounded shrink-0"
              >
                ✕ Close
              </button>
            </div>

            {selectedInfo.holiday && (
              <div className="mt-2 p-2 rounded-lg bg-fuchsia-100/80 border border-fuchsia-200 text-xs text-fuchsia-900 font-semibold flex items-center gap-2">
                <i className="fa-solid fa-cake-candles text-fuchsia-600" />
                <span>Official Holiday: <strong>{selectedInfo.holiday.holiday_name}</strong></span>
              </div>
            )}

            {selectedInfo.leaves.length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Leave Applications:</p>
                {selectedInfo.leaves.map((l, i) => (
                  <div
                    key={i}
                    className={`p-1.5 rounded-lg text-xs font-medium border flex items-center justify-between ${
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
                    <span className="text-[10px] opacity-80">
                      {l.start_date.substring(0, 10)} to {l.end_date.substring(0, 10)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Legend Bar ── */}
        <div className={`mt-3 pt-3 border-t border-gray-100 ${compact ? 'grid grid-cols-2 gap-x-2 gap-y-1.5 text-[10px] sm:text-[11px]' : 'flex items-center gap-x-4 gap-y-2 flex-wrap text-xs'} text-gray-600`}>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
            <span className="font-medium text-gray-700 truncate">Sunday (Holiday)</span>
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
            <span className="font-medium text-gray-700 truncate">2nd & 4th Sat</span>
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-fuchsia-500 shrink-0" />
            <span className="font-medium text-gray-700 truncate">Official Holiday</span>
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
            <span className="font-medium text-gray-700 truncate">Approved Leave</span>
          </div>
          <div className="flex items-center gap-1.5 min-w-0 col-span-2 sm:col-span-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
            <span className="font-medium text-gray-700 truncate">Pending Leave</span>
          </div>
        </div>
      </div>
    </div>
  )
}
