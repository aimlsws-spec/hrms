import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'

interface UnifiedRecord {
  employee_id:                string
  full_name:                  string
  department:                 string
  work_mode:                  'WFO' | 'WFH' | null
  wfo_status:                 'PENDING' | 'PRESENT' | 'ABSENT' | null
  wfo_checkin_at:             string | null
  check_in_method:            'BIOMETRIC' | 'MANUAL' | null
  biometric_user_id:          string | null
  attendance_status:          string | null
  check_in:                   string | null
  check_out:                  string | null
  is_late:                    boolean
  wfh_status:                 string | null
  wfh_method:                 'SELFIE' | 'GEO' | null
  wfh_checkin_at:             string | null
  wfh_checkout_at:            string | null
  geo_latitude:               number | null
  geo_longitude:              number | null
  geo_distance_meters:        number | null
  punch_in_lat?:              number | null
  punch_in_lon?:              number | null
  punch_out_lat?:             number | null
  punch_out_lon?:             number | null
  punch_in_addr?:             string | null
  punch_out_addr?:            string | null
  punch_out_distance_meters?: number | null
  work_minutes?:              number | null
  break_minutes?:             number | null
  month_late_days:            number
  deduction_half_days:        number
  deduction_amount:           number
  deduction_processed:        boolean
}

function fmtTime(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

function ModeBadge({ mode }: { mode: 'WFO' | 'WFH' | null }) {
  if (!mode) return <span className="text-[11px] text-gray-400">—</span>
  return mode === 'WFO'
    ? <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100"><i className="fa-solid fa-building" />WFO</span>
    : <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-100"><i className="fa-solid fa-house" />WFH</span>
}

function StatusBadge({ record }: { record: UnifiedRecord }) {
  // Derive effective status
  const isPresent =
    record.wfo_status === 'PRESENT' ||
    record.attendance_status === 'PRESENT' ||
    record.wfh_status === 'AUTO_APPROVED' ||
    record.wfh_status === 'APPROVED'
  const isAbsent  = !isPresent && record.attendance_status === 'ABSENT'
  const isPending = !isPresent && !isAbsent && (record.work_mode !== null)
  const isHalf    = record.attendance_status === 'HALF_DAY'
  const isLeave   = record.attendance_status === 'ON_LEAVE'

  if (isPresent) return <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100"><i className="fa-solid fa-circle-check" />Present</span>
  if (isLeave)   return <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100"><i className="fa-solid fa-umbrella-beach" />On Leave</span>
  if (isHalf)    return <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100"><i className="fa-solid fa-circle-half-stroke" />Half Day</span>
  if (isPending) return <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-50 text-gray-500 border border-gray-200"><i className="fa-solid fa-clock" />Pending</span>
  if (isAbsent)  return <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100"><i className="fa-solid fa-circle-xmark" />Absent</span>
  return <span className="text-[11px] text-gray-400">—</span>
}

function CheckInCell({ record }: { record: UnifiedRecord }) {
  if (record.work_mode === 'WFO') {
    const t = record.wfo_checkin_at ? fmtTime(record.wfo_checkin_at) : (record.check_in ?? '—')
    const isBio = record.check_in_method === 'BIOMETRIC'
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[12px] text-gray-800">{t}</span>
        {record.wfo_status === 'PRESENT' && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${isBio ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
            {isBio ? 'Bio' : 'Manual'}
          </span>
        )}
        {record.is_late && (
          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-orange-50 text-orange-600 border border-orange-100">
            Late
          </span>
        )}
      </div>
    )
  }
  if (record.work_mode === 'WFH') {
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[12px] text-gray-800">{fmtTime(record.wfh_checkin_at)}</span>
        {record.wfh_method && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${record.wfh_method === 'GEO' ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
            {record.wfh_method === 'GEO' ? 'Geo' : 'Selfie'}
          </span>
        )}
        {record.is_late && (
          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-orange-50 text-orange-600 border border-orange-100">
            Late
          </span>
        )}
      </div>
    )
  }
  return <span className="text-[12px] text-gray-800">{record.check_in ?? '—'}</span>
}

function LateCell({ record }: { record: UnifiedRecord }) {
  const { month_late_days, deduction_half_days, deduction_amount, deduction_processed } = record
  const hasDue = deduction_half_days > 0

  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1.5">
        <span className={`text-[13px] font-bold tabular-nums ${month_late_days >= 3 ? 'text-orange-600' : 'text-gray-700'}`}>
          {month_late_days}
        </span>
        <span className="text-[10px] text-gray-400">this month</span>
      </div>
      {hasDue && (
        <div className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${
          deduction_processed
            ? 'bg-gray-50 text-gray-400 border-gray-200'
            : 'bg-red-50 text-red-600 border-red-100'
        }`}>
          <i className={`fa-solid ${deduction_processed ? 'fa-circle-check' : 'fa-triangle-exclamation'} text-[9px]`} />
          {deduction_processed
            ? `₹${deduction_amount.toLocaleString('en-IN')} processed`
            : `₹${deduction_amount.toLocaleString('en-IN')} pending`}
        </div>
      )}
    </div>
  )
}

function GeoCell({ record }: { record: UnifiedRecord }) {
  const inLat = record.punch_in_lat ?? record.geo_latitude
  const inLon = record.punch_in_lon ?? record.geo_longitude
  const outLat = record.punch_out_lat
  const outLon = record.punch_out_lon
  const inAddr = record.punch_in_addr
  const outAddr = record.punch_out_addr

  if (!inLat && !outLat) {
    return <span className="text-[11px] text-gray-300">—</span>
  }

  return (
    <div className="space-y-1 text-[11px]">
      {inLat != null && inLon != null && (
        <div>
          <div className="flex items-center gap-1 text-emerald-600 font-medium">
            <i className="fa-solid fa-location-dot text-[10px]" />
            <span>In:</span>
            <a
              href={`https://www.google.com/maps?q=${inLat},${inLon}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-indigo-600 hover:underline"
              title="View Check-in on Google Maps"
            >
              {inLat.toFixed(4)}, {inLon.toFixed(4)}
            </a>
            {record.geo_distance_meters != null && (
              <span className="text-gray-400 text-[10px]">({Math.round(record.geo_distance_meters)}m)</span>
            )}
          </div>
          {inAddr && <p className="text-[10px] text-gray-400 max-w-[170px] truncate" title={inAddr}>{inAddr}</p>}
        </div>
      )}
      {outLat != null && outLon != null && (
        <div>
          <div className="flex items-center gap-1 text-amber-600 font-medium">
            <i className="fa-solid fa-location-arrow text-[10px]" />
            <span>Out:</span>
            <a
              href={`https://www.google.com/maps?q=${outLat},${outLon}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-indigo-600 hover:underline"
              title="View Check-out on Google Maps"
            >
              {outLat.toFixed(4)}, {outLon.toFixed(4)}
            </a>
            {record.punch_out_distance_meters != null && (
              <span className="text-gray-400 text-[10px]">({Math.round(record.punch_out_distance_meters)}m)</span>
            )}
          </div>
          {outAddr && <p className="text-[10px] text-gray-400 max-w-[170px] truncate" title={outAddr}>{outAddr}</p>}
        </div>
      )}
    </div>
  )
}

export default function HRUnifiedAttendancePage() {
  const today = new Date().toISOString().slice(0, 10)
  const [date,    setDate]    = useState(today)
  const [records, setRecords] = useState<UnifiedRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [search,  setSearch]  = useState('')
  const [modeFilter, setModeFilter] = useState<'ALL' | 'WFO' | 'WFH' | 'NONE'>('ALL')

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const { data } = await axios.get('/api/hr/unified-attendance', { params: { date } })
      setRecords(data.records ?? [])
    } catch {
      setError('Failed to load attendance data')
      setRecords([])
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => { load() }, [load])

  const filtered = records.filter(r => {
    const matchSearch = !search || r.full_name.toLowerCase().includes(search.toLowerCase()) || r.employee_id.toLowerCase().includes(search.toLowerCase())
    const matchMode =
      modeFilter === 'ALL' ? true :
      modeFilter === 'NONE' ? r.work_mode === null :
      r.work_mode === modeFilter
    return matchSearch && matchMode
  })

  // Summary counts
  const present = records.filter(r => r.wfo_status === 'PRESENT' || r.attendance_status === 'PRESENT' || r.wfh_status === 'AUTO_APPROVED' || r.wfh_status === 'APPROVED').length
  const wfoCount = records.filter(r => r.work_mode === 'WFO').length
  const wfhCount = records.filter(r => r.work_mode === 'WFH').length
  const noMode   = records.filter(r => r.work_mode === null).length

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#0f172a] flex items-center justify-center shrink-0">
          <i className="fa-solid fa-users-viewfinder text-white text-[13px]" />
        </div>
        <div>
          <h1 className="text-[16px] font-bold text-gray-900 leading-tight">Unified Attendance</h1>
          <p className="text-[11px] text-gray-400">Live view of WFO and WFH attendance for all employees</p>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Present',  value: present,  icon: 'fa-circle-check',         bg: 'bg-emerald-50', color: 'text-emerald-600' },
          { label: 'WFO',      value: wfoCount, icon: 'fa-building',              bg: 'bg-blue-50',    color: 'text-blue-600'    },
          { label: 'WFH',      value: wfhCount, icon: 'fa-house',                 bg: 'bg-violet-50',  color: 'text-violet-600'  },
          { label: 'No Mode',  value: noMode,   icon: 'fa-circle-question',       bg: 'bg-gray-50',    color: 'text-gray-500'    },
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

      {/* Table */}
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
              className="w-full h-8 pl-8 pr-3 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-indigo-300 transition-colors"
            />
          </div>

          <select
            value={modeFilter}
            onChange={e => setModeFilter(e.target.value as any)}
            className="h-8 px-3 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-indigo-300 transition-colors"
          >
            <option value="ALL">All Modes</option>
            <option value="WFO">WFO Only</option>
            <option value="WFH">WFH Only</option>
            <option value="NONE">No Mode Selected</option>
          </select>

          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="h-8 px-3 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-indigo-300 transition-colors"
          />

          <button
            onClick={load}
            disabled={loading}
            className="h-8 w-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition text-gray-400 shrink-0"
            title="Refresh"
          >
            <i className={`fa-solid fa-rotate-right text-[11px] ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Table */}
        {error ? (
          <div className="flex flex-col items-center py-12 gap-2 text-center">
            <i className="fa-solid fa-circle-exclamation text-red-300 text-[28px]" />
            <p className="text-[13px] text-red-500 font-medium">{error}</p>
            <button onClick={load} className="text-[12px] text-indigo-600 font-semibold hover:underline mt-1">Retry</button>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-14 text-gray-400 text-[13px]">
            <i className="fa-solid fa-circle-notch animate-spin mr-2" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-14 text-center gap-2">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-1">
              <i className="fa-solid fa-users text-slate-300 text-[22px]" />
            </div>
            <p className="text-[13px] font-semibold text-gray-600">No records found</p>
            <p className="text-[12px] text-gray-400">Try changing the date or filter</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  {['Employee', 'Department', 'Work Mode', 'Status', 'Check In', 'Check Out', 'Work Time', 'Late / Deduction', 'Geo Data'].map(h => (
                    <th key={h} className="text-left py-2.5 px-4 font-semibold text-gray-400 text-[10px] uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.employee_id} className="border-b border-gray-50 last:border-0 hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4">
                      <p className="font-semibold text-gray-800 leading-tight">{r.full_name}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{r.employee_id}</p>
                    </td>
                    <td className="py-3 px-4 text-gray-500">{r.department || '—'}</td>
                    <td className="py-3 px-4"><ModeBadge mode={r.work_mode} /></td>
                    <td className="py-3 px-4"><StatusBadge record={r} /></td>
                    <td className="py-3 px-4"><CheckInCell record={r} /></td>
                    <td className="py-3 px-4 text-gray-500">
                      {r.work_mode === 'WFH' ? fmtTime(r.wfh_checkout_at) : (r.check_out ?? '—')}
                    </td>
                    <td className="py-3 px-4">
                      {r.work_minutes != null && r.work_minutes > 0 ? (
                        <div>
                          <span className="font-semibold text-gray-800 text-[12px]">
                            {Math.floor(r.work_minutes / 60)}h {r.work_minutes % 60}m
                          </span>
                          {r.break_minutes != null && r.break_minutes > 0 && (
                            <span className="text-[10px] text-amber-600 block">
                              {r.break_minutes}m break
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4"><LateCell record={r} /></td>
                    <td className="py-3 px-4"><GeoCell record={r} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[11px] text-gray-400 px-4 py-2.5 border-t border-gray-100">
              {filtered.length} of {records.length} employees
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
