import { useLeaveCalendar } from '../../hooks/leave/useLeaveCalendar'
import ModernLeaveCalendar from '../common/ModernLeaveCalendar'

export default function LeaveCalendar() {
  const { year, month, data, isLoading, prevMonth, nextMonth } = useLeaveCalendar('all')

  return (
    <ModernLeaveCalendar
      year={year}
      month={month}
      data={data}
      isLoading={isLoading}
      onPrevMonth={prevMonth}
      onNextMonth={nextMonth}
      title="Company Holidays & Calendar"
      subtitle="Sundays and 2nd & 4th Saturdays are observed company holidays"
      compact={true}
    />
  )
}
