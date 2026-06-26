import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'

interface WFHRecord {
  employee_id:          string
  full_name:            string
  department:           string
  wfh_mode_status:      'PENDING' | 'PRESENT' | 'ABSENT' | null
  wfh_id:               number | null
  wfh_status:           'PENDING_SELFIE' | 'AUTO_APPROVED' | 'FLAGGED' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | null
  wfh_method:           'SELFIE' | 'GEO' | null
  checkin_at:           string | null
  checkout_at:          string | null
  duration_minutes:     number | null
  geo_latitude:         number | null
  geo_longitude:        number | null
  geo_distance_meters:  number | null
  flag_reason:          string | null
  home_address:         string | null
  attendance_status:    string | null
  attendance_check_in:  string | null
  attendance_check_out: string | null
  is_late:              boolean
}

type MethodFilter = 'ALL' | 'SELFIE' | 'GEO'
type StatusFilter = 'ALL' | 'AUTO_APPROVED' | 'APPROVED' | 'PENDING_SELFIE' | 'PENDING_REVIEW' | 'FLAGGED' | 'REJECTED' | 'NO_CHECKIN'

function fmtTime(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

function fmtDuration(mins: number | null) {
  if (!mins || mins <= 0) return '—'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function WFHStatusBadge({ status }: { status: WFHRecord['wfh_status'] }) {
  if (!status) return <span className="text-[10px] font-medium text-gray-400 border border-dashed border-gray-200 px-2 py-0.5 rounded-full">No Check-in</span>
  const map: Record<string, { bg: string; text: string; icon: string; label: string }> = {
    AUTO_APPROVED:  { bg: 'bg-emerald-50',  text: 'text-emerald-700', icon: 'fa-circle-check',     label: 'Auto Approved'   },
    APPROVED:       { bg: 'bg-emerald-50',  text: 'text-emerald-700', icon: 'fa-circle-check',     label: 'Approved'        },
    PENDING_SELFIE: { bg: 'bg-blue-50',     text: 'text-blue-600',    icon: 'fa-camera',            label: 'Selfie Pending'  },
    PENDING_REVIEW: { bg: 'bg-amber-50',    text: 'text-amber-600',   icon: 'fa-hourglass-half',   label: 'Under Review'    },
    FLAGGED:        { bg: 'bg-red-50',      text: 'text-red-600',     icon: 'fa-flag',              label: 'Flagged'         },
    REJECTED:       { bg: 'bg-red-50',      text: 'text-red-700',     icon: 'fa-circle-xmark',     label: 'Rejected'        },
  }
  const cfg = map[status] ?? { bg: 'bg-gray-50', text: 'text-gray-500', icon: 'fa-circle', label: status }
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.text} border-current/10`}>
      <i className={`fa-solid ${cfg.icon} text-[9px]`} />
      {cfg.label}
    </span>
  )
}

function MethodBadge({ method }: { method: 'SELFIE' | 'GEO' | null }) {
  if (!method) return <span className="text-gray-300 text-[11px]">—</span>
  return method === 'GEO'
    ? <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100"><i className="fa-solid fa-location-dot text-[9px]" />Geo</span>
    : <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100"><i className="fa-solid fa-camera text-[9px]" />Selfie</span>
}

function GeoCell({ record }: { record: WFHRecord }) {
  if (record.wfh_method !== 'GEO' || !record.geo_latitude) {
    return <span className="text-[11px] text-gray-300">—</span>
  }
  const dist = record.geo_distance_meters
  const within = dist !== null && dist <= 300
  return (
    <div className="space-y-0.5">
      <div className={`flex items-center gap-1 text-[11px] font-medium ${within ? 'text-emerald-600' : 'text-red-500'}`}>
        <i className={`fa-solid ${within ? 'fa-house-circle-check' : 'fa-house-circle-xmark'} text-[10px]`} />
        {dist !== null ? `${Math.round(dist)} m` : 'verified'}
      </div>
      <p className="text-[10px] text-gray-400">
        {record.geo_latitude?.toFixed(4)}, {record.geo_longitude?.toFixed(4)}
      </p>
      {record.home_address && (
        <p className="text-[10px] text-gray-400 truncate max-w-[160px]" title={record.home_address}>
          {record.home_address}
        </p>
      )}
    </div>
  )
}

function AttendanceStatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-[10px] text-gray-300">—</span>
  const map: Record<string, { bg: string; text: string; icon: string; label: string }> = {
    PRESENT:           { bg: 'bg-emerald-50',  text: 'text-emerald-700', icon: 'fa-circle-check',       label: 'Present'         },
    ABSENT:            { bg: 'bg-red-50',      text: 'text-red-600',     icon: 'fa-circle-xmark',       label: 'Absent'          },
    HALF_DAY:          { bg: 'bg-amber-50',    text: 'text-amber-700',   icon: 'fa-circle-half-stroke', label: 'Half Day'        },
    FIRST_HALF_LEAVE:  { bg: 'bg-orange-50',   text: 'text-orange-700',  icon: 'fa-sun',                label: '1st Half Leave'  },
    SECOND_HALF_LEAVE: { bg: 'bg-violet-50',   text: 'text-violet-700',  icon: 'fa-moon',               label: '2nd Half Leave'  },
    ON_LEAVE:          { bg: 'bg-gray-50',     text: 'text-gray-500',    icon: 'fa-calendar-xmark',     label: 'On Leave'        },
  }
  const cfg = map[status] ?? { bg: 'bg-gray-50', text: 'text-gray-500', icon: 'fa-circle', label: status }
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.text} border-current/10`}>
      <i className={`fa-solid ${cfg.icon} text-[9px]`} />
      {cfg.label}
    </span>
  )
}

function FlagCell({ reason }: { reason: string | null }) {
  if (!reason) return <span className="text-gray-300 text-[11px]">—</span>
  return (
    <div className="max-w-[180px]">
      <p className="text-[10px] text-red-500 leading-snug line-clamp-2" title={reason}>{reason}</p>
    </div>
  )
}

export default function HRWFHAttendancePage() {
  const today = new Date().toISOString().slice(0, 10)
  const [date,         setDate]         = useState(today)
  const [records,      setRecords]      = useState<WFHRecord[]>([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [search,       setSearch]       = useState('')
  const [methodFilter, setMethodFilter] = useState<MethodFilter>('ALL')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const { data } = await axios.get('/api/hr/wfh-attendance', { params: { date } })
      setRecords(data.records ?? [])
    } catch {
      setError('Failed to load WFH attendance data')
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
    const matchMethod  = methodFilter === 'ALL' ? true : r.wfh_method === methodFilter
    const matchStatus  =
      statusFilter === 'ALL'       ? true :
      statusFilter === 'NO_CHECKIN'? r.wfh_status === null :
      r.wfh_status === statusFilter
    return matchSearch && matchMethod && matchStatus
  })

  // Summary counts
  const totalWFH   = records.length
  const approved   = records.filter(r => r.wfh_status === 'AUTO_APPROVED' || r.wfh_status === 'APPROVED').length
  const flagged    = records.filter(r => r.wfh_status === 'FLAGGED' || r.wfh_status === 'PENDING_REVIEW').length
  const geoVerified = records.filter(r => r.wfh_method === 'GEO' && r.geo_distance_meters !== null && r.geo_distance_meters <= 300).length

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-700 flex items-center justify-center shrink-0">
            <i className="fa-solid fa-house text-white text-[13px]" />
          </div>
          <div>
            <h1 className="text-[16px] font-bold text-gray-900 leading-tight">WFH Attendance</h1>
            <p className="text-[11px] text-gray-400">Selfie verification · Geo-location check-in · Remote session tracking</p>
          </div>
        </div>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="h-8 px-3 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-violet-300 transition-colors"
        />
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'WFH Today',    value: totalWFH,    icon: 'fa-house',              bg: 'bg-violet-50',  color: 'text-violet-700'  },
          { label: 'Approved',     value: approved,    icon: 'fa-circle-check',        bg: 'bg-emerald-50', color: 'text-emerald-700' },
          { label: 'Flagged',      value: flagged,     icon: 'fa-flag',                bg: 'bg-red-50',     color: 'text-red-600'     },
          { label: 'Geo Verified', value: geoVerified, icon: 'fa-location-dot',        bg: 'bg-teal-50',    color: 'text-teal-600'    },
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
              className="w-full h-8 pl-8 pr-3 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-violet-300 transition-colors"
            />
          </div>

          <select
            value={methodFilter}
            onChange={e => setMethodFilter(e.target.value as MethodFilter)}
            className="h-8 px-3 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-violet-300 transition-colors"
          >
            <option value="ALL">All Methods</option>
            <option value="SELFIE">Selfie Only</option>
            <option value="GEO">Geo Only</option>
          </select>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as StatusFilter)}
            className="h-8 px-3 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-violet-300 transition-colors"
          >
            <option value="ALL">All Status</option>
            <option value="AUTO_APPROVED">Auto Approved</option>
            <option value="APPROVED">Approved</option>
            <option value="PENDING_SELFIE">Selfie Pending</option>
            <option value="PENDING_REVIEW">Under Review</option>
            <option value="FLAGGED">Flagged</option>
            <option value="REJECTED">Rejected</option>
            <option value="NO_CHECKIN">No Check-in</option>
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
            <button onClick={load} className="text-[12px] text-violet-600 font-semibold hover:underline mt-1">Retry</button>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-14 text-gray-400 text-[13px]">
            <i className="fa-solid fa-circle-notch animate-spin mr-2" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-14 text-center gap-2">
            <div className="w-14 h-14 rounded-2xl bg-violet-50 flex items-center justify-center mb-1">
              <i className="fa-solid fa-house text-violet-200 text-[22px]" />
            </div>
            <p className="text-[13px] font-semibold text-gray-600">
              {records.length === 0 ? 'No WFH employees for this date' : 'No records match this filter'}
            </p>
            <p className="text-[12px] text-gray-400">Employees appear here once they select WFH mode</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  {['Employee', 'Department', 'WFH Status', 'Attendance Status', 'Method', 'Check-In', 'Check-Out', 'Duration', 'Geo Verification', 'Flag Reason'].map(h => (
                    <th key={h} className="text-left py-2.5 px-4 font-semibold text-gray-400 text-[10px] uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr
                    key={r.employee_id}
                    className={`border-b border-gray-50 last:border-0 hover:bg-slate-50/60 transition-colors ${
                      r.wfh_status === 'FLAGGED' ? 'bg-red-50/20' : ''
                    }`}
                  >
                    <td className="py-3 px-4">
                      <p className="font-semibold text-gray-800 leading-tight">{r.full_name}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{r.employee_id}</p>
                    </td>
                    <td className="py-3 px-4 text-gray-500">{r.department || '—'}</td>
                    <td className="py-3 px-4"><WFHStatusBadge status={r.wfh_status} /></td>
                    <td className="py-3 px-4"><AttendanceStatusBadge status={r.attendance_status} /></td>
                    <td className="py-3 px-4"><MethodBadge method={r.wfh_method} /></td>
                    <td className="py-3 px-4 text-gray-800 font-medium">{fmtTime(r.checkin_at)}</td>
                    <td className="py-3 px-4 text-gray-500">{fmtTime(r.checkout_at)}</td>
                    <td className="py-3 px-4 text-gray-500 tabular-nums">{fmtDuration(r.duration_minutes)}</td>
                    <td className="py-3 px-4"><GeoCell record={r} /></td>
                    <td className="py-3 px-4"><FlagCell reason={r.flag_reason} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[11px] text-gray-400 px-4 py-2.5 border-t border-gray-100">
              {filtered.length} of {records.length} WFH employees
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
