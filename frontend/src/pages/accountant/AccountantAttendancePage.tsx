import { useState }                   from 'react'
import { useAttendanceRecords }        from '../../hooks/attendance/useAttendanceRecords'
import AttendanceFilters               from '../../components/attendance/AttendanceFilters'
import AttendanceStats                 from '../../components/attendance/AttendanceStats'
import AttendanceTable                 from '../../components/attendance/AttendanceTable'
import Card                            from '../../components/ui/Card'
import type { AttendanceFilterState }  from '../../components/attendance/AttendanceFilters'
import type { AttendanceStatus }       from '../../types/attendance'

const currentMonth = new Date().toISOString().slice(0, 7)

export default function AccountantAttendancePage() {
  const [filters, setFilters] = useState<AttendanceFilterState>({
    employeeId:   '',
    employeeName: '',
    month:        currentMonth,
    status:       'ALL',
  })

  const { records, stats, isLoading } = useAttendanceRecords(
    filters.employeeId || null,
    filters.month || undefined,
  )

  const filtered = filters.status === 'ALL'
    ? records
    : records.filter(r => r.status === (filters.status as AttendanceStatus))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
        <p className="text-sm text-gray-500 mt-0.5">View employee attendance records (read-only)</p>
      </div>

      {filters.employeeId && (
        <AttendanceStats stats={stats} isLoading={isLoading} />
      )}

      <Card>
        <div className="mb-5">
          <AttendanceFilters filters={filters} onChange={setFilters} />
        </div>

        {!filters.employeeId ? (
          <div className="text-center py-12">
            <p className="text-sm text-gray-400">Select an employee above to load their records.</p>
          </div>
        ) : (
          <>
            {filters.employeeName && (
              <div className="mb-4 flex items-center gap-2 text-sm">
                <span className="font-semibold text-gray-800">{filters.employeeName}</span>
                <span className="text-gray-300">•</span>
                <span className="text-gray-500">{filters.employeeId}</span>
                <span className="text-gray-300">•</span>
                <span className="text-gray-500">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
              </div>
            )}
            <AttendanceTable
              records={filtered}
              isLoading={isLoading}
              employeeName={filters.employeeName || undefined}
            />
          </>
        )}
      </Card>
    </div>
  )
}
