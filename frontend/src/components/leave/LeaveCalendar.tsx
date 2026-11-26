import ModernLeaveCalendar from '../common/ModernLeaveCalendar'
import type { CalendarData } from '../../types/leave'

interface Props {
  year: number
  month: number
  data: CalendarData | null
  isLoading: boolean
  onPrevMonth: () => void
  onNextMonth: () => void
}

export default function LeaveCalendar({
  year,
  month,
  data,
  isLoading,
  onPrevMonth,
  onNextMonth,
}: Props) {
  return (
    <ModernLeaveCalendar
      year={year}
      month={month}
      data={data}
      isLoading={isLoading}
      onPrevMonth={onPrevMonth}
      onNextMonth={onNextMonth}
      title="Leave & Holiday Calendar"
      subtitle="Sundays and 2nd & 4th Saturdays are observed company holidays alongside official holidays."
    />
  )
}
