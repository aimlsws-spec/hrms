import AttendanceStatusBadge from './AttendanceStatusBadge'
import type { AttendanceRecord } from '../../types/attendance'

function fmt(t?: string) {
  if (!t) return '—'
  return t.length > 5 ? t.slice(0, 5) : t
}

function fmtDate(d?: string) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  } catch { return d }
}

function LateBadge({ minutes, beyondGrace }: { minutes: number; beyondGrace?: number }) {
  if (minutes <= 0) return null
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider whitespace-nowrap ${beyondGrace ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>
      {beyondGrace ? 'Late✱' : 'Late'}
    </span>
  )
}

function EarlyBadge({ minutes }: { minutes: number }) {
  if (minutes <= 0) return null
  return (
    <span className="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider whitespace-nowrap">
      Early
    </span>
  )
}

function MinutesCell({ minutes, color }: { minutes: number; color: 'amber' | 'violet' | 'emerald' | 'red' }) {
  if (minutes <= 0) return <span className="text-gray-400">—</span>
  const cls =
    color === 'amber'   ? 'text-amber-700 font-semibold' :
    color === 'violet'  ? 'text-violet-700 font-semibold' :
    color === 'emerald' ? 'text-emerald-700 font-semibold' :
                          'text-red-700 font-semibold'
  return <span className={cls}>{minutes} min{minutes !== 1 ? 's' : ''}</span>
}

interface Props {
  records: AttendanceRecord[]
  isLoading: boolean
  employeeName?: string
}

export default function AttendanceTable({ records, isLoading, employeeName }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (!records.length) {
    return (
      <div className="flex flex-col items-center justify-center py-14 text-center gap-2">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-1">
          <i className="fa-regular fa-calendar-xmark text-slate-300 text-[22px]" />
        </div>
        <p className="text-[13px] font-semibold text-gray-600">
          No records{employeeName ? ` for ${employeeName}` : ' this month'}
        </p>
        <p className="text-[12px] text-gray-400 max-w-[220px] leading-relaxed">
          Attendance records will appear here once marked for the selected period.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b-2 border-gray-100">
            {employeeName && (
              <th className="text-left pb-3 pr-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">
                Employee
              </th>
            )}
            <th className="text-left pb-3 pr-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Date</th>
            <th className="text-left pb-3 pr-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Status</th>
            <th className="text-left pb-3 pr-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Check In</th>
            <th className="text-left pb-3 pr-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Check Out</th>
            <th className="text-left pb-3 pr-4 font-semibold text-emerald-600 text-xs uppercase tracking-wide">Early By</th>
            <th className="text-left pb-3 pr-4 font-semibold text-amber-600 text-xs uppercase tracking-wide">Late By</th>
            <th className="text-left pb-3 pr-4 font-semibold text-violet-600 text-xs uppercase tracking-wide">Overtime</th>
            <th className="text-left pb-3 pr-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Hours</th>
            <th className="text-left pb-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Remarks</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r, i) => {
            const lateMin  = r.late_minutes ?? 0
            const earlyMin = r.early_minutes ?? 0
            const beyondG  = r.beyond_grace ?? 0
            const otMin    = r.overtime_minutes ?? 0

            return (
              <tr key={r.id ?? i} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                {employeeName && (
                  <td className="py-3 pr-4 font-medium text-gray-800 whitespace-nowrap">{employeeName}</td>
                )}
                <td className="py-3 pr-4 text-gray-700 whitespace-nowrap">{fmtDate(r.date)}</td>
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <AttendanceStatusBadge status={r.status} />
                    <LateBadge minutes={lateMin} beyondGrace={beyondG} />
                    <EarlyBadge minutes={earlyMin} />
                  </div>
                </td>
                <td className="py-3 pr-4 text-gray-600 whitespace-nowrap">{fmt(r.check_in)}</td>
                <td className="py-3 pr-4 text-gray-600 whitespace-nowrap">{fmt(r.check_out)}</td>
                <td className="py-3 pr-4 whitespace-nowrap">
                  <MinutesCell minutes={earlyMin} color="emerald" />
                </td>
                <td className="py-3 pr-4 whitespace-nowrap">
                  <MinutesCell minutes={lateMin} color="amber" />
                </td>
                <td className="py-3 pr-4 whitespace-nowrap">
                  <MinutesCell minutes={otMin} color="violet" />
                </td>
                <td className="py-3 pr-4 text-gray-500">
                  {r.work_hours != null ? `${r.work_hours}h` : '—'}
                </td>
                <td
                  className="py-3 text-gray-500 max-w-[160px] truncate"
                  title={r.remarks}
                >
                  {r.remarks || '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
