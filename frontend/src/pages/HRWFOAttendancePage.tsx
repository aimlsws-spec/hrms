import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'

interface WFORecord {
  employee_id:         string
  full_name:           string
  department:          string
  geo_distance_meters: number | null
  selfie_geo_status:   string | null
  wfo_status:          'PENDING' | 'PRESENT' | 'ABSENT' | null
  checkin_at:          string | null
  check_in_method:     'GEO_SELFIE' | 'GEO' | 'SELFIE' | 'BIOMETRIC' | 'MANUAL' | null
  checkout_at:         string | null
  attendance_status:   string | null
  check_in:            string | null
  check_out:           string | null
  check_in_source:     string | null
  is_late:             boolean
  month_late_days:     number
  deduction_half_days: number
  deduction_amount:    number
  deduction_processed: boolean
}

function fmtTime(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

function fmtINR(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
}

type StatusFilter = 'ALL' | 'PRESENT' | 'ABSENT' | 'PENDING' | 'LATE' | 'HALF_DAY' | 'FIRST_HALF_LEAVE' | 'SECOND_HALF_LEAVE'

function StatusBadge({ record }: { record: WFORecord }) {
  const status = record.wfo_status ?? record.attendance_status
  if (status === 'PRESENT')
    return <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100"><i className="fa-solid fa-circle-check" />Present</span>
  if (status === 'ABSENT')
    return <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100"><i className="fa-solid fa-circle-xmark" />Absent</span>
  if (status === 'PENDING')
    return <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200"><i className="fa-solid fa-clock" />Pending</span>
  if (status === 'HALF_DAY')
    return <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100"><i className="fa-solid fa-circle-half-stroke" />Half Day</span>
  if (status === 'FIRST_HALF_LEAVE')
    return <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-100"><i className="fa-solid fa-sun" />1st Half Leave</span>
  if (status === 'SECOND_HALF_LEAVE')
    return <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-100"><i className="fa-solid fa-moon" />2nd Half Leave</span>
  return <span className="text-[11px] text-gray-300">—</span>
}

function MethodBadge({ record }: { record: WFORecord }) {
  const method = record.check_in_method
  if (!method || record.wfo_status !== 'PRESENT') return <span className="text-gray-300 text-[11px]">—</span>
  if (method === 'GEO_SELFIE')
    return <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-emerald-50 text-emerald-600 border border-emerald-100"><i className="fa-solid fa-location-dot mr-1" /><i className="fa-solid fa-camera mr-1" />Geo + Selfie</span>
  if (method === 'GEO')
    return <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-emerald-50 text-emerald-600 border border-emerald-100"><i className="fa-solid fa-location-dot mr-1" />Geo</span>
  if (method === 'SELFIE')
    return <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-indigo-50 text-indigo-600 border border-indigo-100"><i className="fa-solid fa-camera mr-1" />Selfie</span>
  if (method === 'BIOMETRIC')
    return <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-blue-50 text-blue-600 border border-blue-100"><i className="fa-solid fa-fingerprint mr-1" />Biometric (legacy)</span>
  return <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-amber-50 text-amber-600 border border-amber-100"><i className="fa-solid fa-keyboard mr-1" />Manual</span>
}

function DistanceCell({ record }: { record: WFORecord }) {
  if (record.geo_distance_meters == null) return <span className="text-gray-300 text-[11px]">—</span>
  return <span className="text-[11px] font-semibold text-gray-700 tabular-nums">{Math.round(record.geo_distance_meters)} m</span>
}

function DeductionCell({ record }: { record: WFORecord }) {
  const { month_late_days: halfDayEvents, deduction_half_days, deduction_amount, deduction_processed } = record

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <span className={`text-[14px] font-bold tabular-nums leading-none ${
          halfDayEvents >= 3 ? 'text-red-600' :
          halfDayEvents >= 1 ? 'text-amber-600' :
          'text-gray-400'
        }`}>{halfDayEvents}</span>
        <span className="text-[10px] text-gray-400 leading-none">
          {halfDayEvents === 1 ? 'half-day event' : 'half-day events'}
        </span>
      </div>
      {deduction_half_days > 0 && (
        <div className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
          deduction_processed
            ? 'bg-slate-50 text-slate-400 border-slate-200'
            : 'bg-red-50 text-red-600 border-red-200'
        }`}>
          <i className={`fa-solid ${deduction_processed ? 'fa-circle-check' : 'fa-triangle-exclamation'} text-[9px]`} />
          {deduction_processed ? 'Processed' : 'Pending'} · {fmtINR(deduction_amount)}
          <span className="opacity-60">({deduction_half_days} half-day{deduction_half_days > 1 ? 's' : ''})</span>
        </div>
      )}
    </div>
  )
}

export default function HRWFOAttendancePage() {
  const today = new Date().toISOString().slice(0, 10)
  const [date,         setDate]         = useState(today)
  const [records,      setRecords]      = useState<WFORecord[]>([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const { data } = await axios.get('/api/hr/wfo-attendance', { params: { date } })
      setRecords(data.records ?? [])
    } catch {
      setError('Failed to load WFO attendance data')
      setRecords([])
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => { load() }, [load])

  const filtered = records.filter(r => {
    const matchSearch = !search ||
      r.full_name.toLowerCase().includes(search.toLowerCase()) ||
      r.employee_id.toLowerCase().includes(search.toLowerCase())
    const s = r.wfo_status ?? r.attendance_status
    const matchStatus =
      statusFilter === 'ALL'     ? true :
      statusFilter === 'LATE'    ? r.is_late :
      s === statusFilter
    return matchSearch && matchStatus
  })

  // Summary counts
  const totalWFO   = records.length
  const present    = records.filter(r => r.wfo_status === 'PRESENT' || r.attendance_status === 'PRESENT').length
  const lateToday  = records.filter(r => r.is_late).length
  const deducPend  = records.filter(r => r.deduction_half_days > 0 && !r.deduction_processed).length

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-700 flex items-center justify-center shrink-0">
            <i className="fa-solid fa-building text-white text-[13px]" />
          </div>
          <div>
            <h1 className="text-[16px] font-bold text-gray-900 leading-tight">WFO Attendance</h1>
            <p className="text-[11px] text-gray-400">Selfie & geo check-in · Late arrival tracking · Salary deductions</p>
          </div>
        </div>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="h-8 px-3 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-blue-300 transition-colors"
        />
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'WFO Today',        value: totalWFO,  icon: 'fa-building',             bg: 'bg-blue-50',    color: 'text-blue-700'   },
          { label: 'Present',          value: present,   icon: 'fa-circle-check',          bg: 'bg-emerald-50', color: 'text-emerald-700' },
          { label: 'Late Today',       value: lateToday, icon: 'fa-clock',                 bg: 'bg-orange-50',  color: 'text-orange-600'  },
          { label: 'Deduction Pending',value: deducPend, icon: 'fa-triangle-exclamation',  bg: 'bg-red-50',     color: 'text-red-600'     },
        ].map(t => (
          <div key={t.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3.5 flex items-center justify-between">
            <div>
              <p className={`text-[26px] font-bold tabular-nums ${t.color}`}>{loading ? '—' : t.value}</p>
              <p className="text-[11px] text-gray-500 mt-0.5 font-medium">{t.label}</p>
            </div>
            <div className={`w-9 h-9 rounded-xl ${t.bg} flex items-center justify-center shrink-0`}>
              <i className={`fa-solid ${t.icon} ${t.color} text-[14px]`} />
            </div>
          </div>
        ))}
      </div>

      {/* Table card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 text-[12px]" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search employee…"
              className="w-full h-8 pl-8 pr-3 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-blue-300 transition-colors"
            />
          </div>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as StatusFilter)}
            className="h-8 px-3 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-blue-300 transition-colors"
          >
            <option value="ALL">All Status</option>
            <option value="PRESENT">Present</option>
            <option value="ABSENT">Absent</option>
            <option value="PENDING">Pending</option>
            <option value="HALF_DAY">Half Day</option>
            <option value="FIRST_HALF_LEAVE">1st Half Leave</option>
            <option value="SECOND_HALF_LEAVE">2nd Half Leave</option>
            <option value="LATE">Late Arrival</option>
          </select>

          <button
            onClick={load}
            disabled={loading}
            className="h-8 w-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition text-gray-400 shrink-0"
            title="Refresh"
          >
            <i className={`fa-solid fa-rotate-right text-[11px] ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Body */}
        {error ? (
          <div className="flex flex-col items-center py-12 gap-2 text-center">
            <i className="fa-solid fa-circle-exclamation text-red-300 text-[28px]" />
            <p className="text-[13px] text-red-500 font-medium">{error}</p>
            <button onClick={load} className="text-[12px] text-blue-600 font-semibold hover:underline mt-1">Retry</button>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-14 text-gray-400 text-[13px]">
            <i className="fa-solid fa-circle-notch animate-spin mr-2" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-14 text-center gap-2">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mb-1">
              <i className="fa-solid fa-building text-blue-200 text-[22px]" />
            </div>
            <p className="text-[13px] font-semibold text-gray-600">
              {records.length === 0 ? 'No WFO employees for this date' : 'No records match this filter'}
            </p>
            <p className="text-[12px] text-gray-400">Employees appear here once they select WFO mode</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  {['Employee', 'Department', 'Status', 'Check-In', 'Check-Out', 'Method', 'Distance from Office', 'Half Days This Month / Deduction'].map(h => (
                    <th key={h} className="text-left py-2.5 px-4 font-semibold text-gray-400 text-[10px] uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr
                    key={r.employee_id}
                    className={`border-b border-gray-50 last:border-0 hover:bg-slate-50/60 transition-colors ${
                      r.is_late ? 'bg-orange-50/30' : ''
                    }`}
                  >
                    <td className="py-3 px-4">
                      <p className="font-semibold text-gray-800 leading-tight">{r.full_name}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{r.employee_id}</p>
                    </td>
                    <td className="py-3 px-4 text-gray-500">{r.department || '—'}</td>
                    <td className="py-3 px-4"><StatusBadge record={r} /></td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`font-medium ${r.is_late ? 'text-orange-600' : 'text-gray-800'}`}>
                          {fmtTime(r.checkin_at ?? r.check_in)}
                        </span>
                        {r.is_late && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-orange-100 text-orange-700 border border-orange-200">
                            <i className="fa-solid fa-clock mr-0.5" />Late
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-500">{r.check_out ?? '—'}</td>
                    <td className="py-3 px-4"><MethodBadge record={r} /></td>
                    <td className="py-3 px-4"><DistanceCell record={r} /></td>
                    <td className="py-3 px-4"><DeductionCell record={r} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[11px] text-gray-400 px-4 py-2.5 border-t border-gray-100">
              {filtered.length} of {records.length} WFO employees
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
