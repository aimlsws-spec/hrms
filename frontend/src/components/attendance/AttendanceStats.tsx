import type { AttendanceStats } from '../../types/attendance'

interface StatItemProps {
  label: string
  value: number
  suffix?: string
  color: string
  bg: string
}

function StatItem({ label, value, suffix = '', color, bg }: StatItemProps) {
  return (
    <div className={`${bg} rounded-xl p-4 text-center`}>
      <p className={`text-2xl font-bold ${color}`}>{value}{suffix}</p>
      <p className="text-xs text-gray-500 mt-0.5 font-medium">{label}</p>
    </div>
  )
}

interface Props {
  stats: AttendanceStats
  isLoading?: boolean
}

export default function AttendanceStats({ stats, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
        ))}
        {/* 5th card spans 2 cols on mobile so it stays centered */}
        <div className="h-20 bg-gray-100 rounded-xl animate-pulse col-span-2 sm:col-span-1" />
      </div>
    )
  }

  const pct = stats.total > 0
    ? Math.round((stats.present / stats.total) * 100)
    : 0

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      <StatItem label="Present"    value={stats.present}  color="text-emerald-600" bg="bg-emerald-50" />
      <StatItem label="Absent"     value={stats.absent}   color="text-red-600"     bg="bg-red-50"     />
      <StatItem label="Half Day"   value={stats.half_day} color="text-amber-600"   bg="bg-amber-50"   />
      <StatItem label="On Leave"   value={stats.on_leave} color="text-blue-600"    bg="bg-blue-50"    />
      {/* Spans 2 columns on mobile so it's centered in the last row; 1 col on sm+ */}
      <div className="col-span-2 sm:col-span-1">
        <StatItem label="Attendance" value={pct} suffix="%" color="text-primary-900" bg="bg-primary-50" />
      </div>
    </div>
  )
}
