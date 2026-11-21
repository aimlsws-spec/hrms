import { useState, useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { useAttendanceRecords } from '../hooks/attendance/useAttendanceRecords'
import AttendanceStats from '../components/attendance/AttendanceStats'
import AttendanceFilters from '../components/attendance/AttendanceFilters'
import AttendanceTable from '../components/attendance/AttendanceTable'
import AttendanceForm from '../components/attendance/AttendanceForm'
import RegularizationPanel from '../components/attendance/RegularizationPanel'
import WfhSelfieReviewPage from './WfhSelfieReviewPage'
import WfhGeoLogsPage     from './WfhGeoLogsPage'
import Card from '../components/ui/Card'
import type { AttendanceFilterState } from '../components/attendance/AttendanceFilters'
import type { AttendanceStatus } from '../types/attendance'
import { downloadCsv, safeFileName } from '../utils/exportCsv'

type Tab = 'records' | 'mark' | 'regularization' | 'wfh-selfie' | 'wfh-geo'

const currentMonth = new Date().toISOString().slice(0, 7)

function toEmployeeCode(userId: number | string | undefined): string {
  if (userId == null) return ''
  const s = String(userId)
  if (/^EMP\d+$/i.test(s)) return s.toUpperCase()
  const n = parseInt(s, 10)
  return n > 0 ? `EMP${String(n).padStart(4, '0')}` : s
}

// Office start: 09:30 → 570 mins from midnight
function isLate(r: { late_minutes?: number; check_in?: string }) {
  if ((r.late_minutes ?? 0) > 0) return true
  if (!r.check_in) return false
  const match = r.check_in.match(/^(\d{1,2}):(\d{2})/)
  if (!match) return false
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10) > 570
}

export default function AttendancePage() {
  const { user } = useAuthStore()
  const isHRAdmin = user?.role === 'admin' || user?.role === 'hr'

  const [tab, setTab] = useState<Tab>('records')

  const [filters, setFilters] = useState<AttendanceFilterState>({
    employeeId:   '',
    employeeName: '',
    month:        currentMonth,
    status:       'ALL',
  })

  // Pre-fill for Employee
  useEffect(() => {
    if (!isHRAdmin && user?.user_id && !filters.employeeId) {
      setFilters(f => ({
        ...f,
        employeeId: toEmployeeCode(user.user_id),
        employeeName: user.full_name || 'My Attendance'
      }))
    }
  }, [isHRAdmin, user])

  const { records, stats, isLoading, refetch } = useAttendanceRecords(
    filters.employeeId || null,
    filters.month || undefined,
  )

  const filtered = filters.status === 'ALL'
    ? records
    : records.filter(r => r.status === (filters.status as AttendanceStatus))

  /** Export exactly what is on screen: the selected employee, month and status filter. */
  function exportRows() {
    const fmtDay = (d?: string) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '')
    const hm = (sec?: number | null) => (sec == null ? '' : `${Math.floor(sec / 3600)}h ${String(Math.floor((sec % 3600) / 60)).padStart(2, '0')}m`)
    const header = ['Employee', 'Employee ID', 'Date', 'Status', 'Check in', 'Check out', 'Late (min)', 'Beyond 09:50',
                    'Early (min)', 'Overtime (min)', 'Break time (min)', 'Net hours', 'Remarks']
    const rows = filtered.map(r => [
      filters.employeeName || r.employee_id, r.employee_id, fmtDay(r.date), r.status,
      (r.check_in ?? '').slice(0, 5), (r.check_out ?? '').slice(0, 5),
      r.late_minutes ?? 0, r.beyond_grace ? 'Yes' : 'No', r.early_minutes ?? 0, r.overtime_minutes ?? 0,
      r.break_seconds != null ? (r.break_seconds / 60).toFixed(1) : (r.break_minutes ?? 0),
      hm(r.net_seconds ?? (r.work_minutes != null ? r.work_minutes * 60 : null)), r.remarks ?? '',
    ])
    const part = [filters.employeeName || filters.employeeId, filters.month, filters.status !== 'ALL' ? filters.status : '']
      .filter(Boolean).join('_')
    downloadCsv(`attendance_${safeFileName(part)}.csv`, header, rows)
  }

  const lateCount = records.filter(r => isLate(r) && (r.status === 'PRESENT' || r.status === 'HALF_DAY')).length

  const TABS: { id: Tab; label: string }[] = isHRAdmin ? [
    { id: 'records',        label: 'Regular Attendance'  },
    { id: 'mark',           label: 'Mark Attendance'     },
    { id: 'regularization', label: 'Regularization'      },
    { id: 'wfh-selfie',     label: 'WFH Selfie Review'   },
    { id: 'wfh-geo',        label: 'WFH Geo Logs'        },
  ] : [
    { id: 'records',        label: 'Records'                  },
    { id: 'regularization', label: 'Request Regularization'   },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{isHRAdmin ? 'Attendance Management' : 'My Attendance'}</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {isHRAdmin ? 'Track, mark, and manage employee attendance' : 'View your attendance records and request corrections'}
        </p>
      </div>

      {/* Stats — visible when an employee is selected */}
      {filters.employeeId && (
        !isHRAdmin ? (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-emerald-50 rounded-2xl p-5 text-center shadow-sm border border-emerald-100">
              <p className="text-3xl font-bold text-emerald-600">{stats.present}</p>
              <p className="text-sm text-gray-500 mt-1 font-semibold uppercase tracking-wide">Present</p>
            </div>
            <div className="bg-red-50 rounded-2xl p-5 text-center shadow-sm border border-red-100">
              <p className="text-3xl font-bold text-red-600">{stats.absent}</p>
              <p className="text-sm text-gray-500 mt-1 font-semibold uppercase tracking-wide">Absent</p>
            </div>
            <div className="bg-amber-50 rounded-2xl p-5 text-center shadow-sm border border-amber-100">
              <p className="text-3xl font-bold text-amber-600">{lateCount}</p>
              <p className="text-sm text-gray-500 mt-1 font-semibold uppercase tracking-wide">Late</p>
            </div>
          </div>
        ) : (
          <AttendanceStats stats={stats} isLoading={isLoading} />
        )
      )}

      {/* Tab navigation */}
      <div className="flex gap-2 flex-wrap border-b border-gray-200">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.id
                ? 'border-primary-900 text-primary-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Records tab ── */}
      {tab === 'records' && (
        <Card>
          <div className="mb-5">
            {isHRAdmin ? (
              <AttendanceFilters filters={filters} onChange={setFilters} />
            ) : (
              <div className="flex gap-4">
                <input
                  type="month"
                  value={filters.month}
                  onChange={e => setFilters(f => ({ ...f, month: e.target.value }))}
                  className="h-10 px-3 border-2 border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-primary-700"
                />
                <select
                  value={filters.status}
                  onChange={e => setFilters(f => ({ ...f, status: e.target.value as AttendanceStatus | 'ALL' }))}
                  className="h-10 px-3 border-2 border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-primary-700"
                >
                  <option value="ALL">All Status</option>
                  <option value="PRESENT">Present</option>
                  <option value="ABSENT">Absent</option>
                  <option value="HALF_DAY">Half Day</option>
                  <option value="ON_LEAVE">On Leave</option>
                </select>
              </div>
            )}
          </div>

          {!filters.employeeId ? (
            <div className="text-center py-12">
              <p className="text-sm text-gray-400">Select an employee above to load their records.</p>
            </div>
          ) : (
            <>
              {/* Employee context bar (only for HR admin) */}
              <div className="mb-4 flex items-center gap-2 text-sm flex-wrap">
                {isHRAdmin && filters.employeeName && (
                  <>
                    <span className="font-semibold text-gray-800">{filters.employeeName}</span>
                    <span className="text-gray-300">•</span>
                    <span className="text-gray-500">{filters.employeeId}</span>
                    <span className="text-gray-300">•</span>
                  </>
                )}
                <span className="text-gray-500">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
                <button
                  onClick={exportRows}
                  disabled={isLoading || filtered.length === 0}
                  title="Download the rows shown below as a CSV file (opens in Excel)"
                  className="ml-auto inline-flex items-center gap-2 h-9 px-4 rounded-xl border-2 border-gray-200 bg-white text-[13px] font-semibold text-gray-700 hover:border-primary-700 hover:text-primary-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <i className="fa-solid fa-file-export text-[12px]" /> Export
                </button>
              </div>
              <AttendanceTable
                records={filtered}
                isLoading={isLoading}
                employeeName={isHRAdmin ? filters.employeeName || undefined : undefined}
              />
            </>
          )}
        </Card>
      )}

      {/* ── Mark Attendance tab — HR/Admin only ── */}
      {tab === 'mark' && isHRAdmin && (
        <Card>
          <h3 className="text-base font-semibold text-gray-900 mb-5">Mark / Edit Attendance</h3>
          <AttendanceForm onSuccess={refetch} />
        </Card>
      )}

      {/* ── Regularization tab ── */}
      {tab === 'regularization' && (
        <Card>
          <h3 className="text-base font-semibold text-gray-900 mb-5">
            {isHRAdmin ? 'Regularization Requests' : 'Request Attendance Correction'}
          </h3>
          <RegularizationPanel isHRAdmin={isHRAdmin} />
        </Card>
      )}

      {/* ── WFH Selfie Review tab — HR/Admin only ── */}
      {tab === 'wfh-selfie' && isHRAdmin && <WfhSelfieReviewPage />}

      {/* ── WFH Geo Logs tab — HR/Admin only ── */}
      {tab === 'wfh-geo' && isHRAdmin && <WfhGeoLogsPage />}
    </div>
  )
}
