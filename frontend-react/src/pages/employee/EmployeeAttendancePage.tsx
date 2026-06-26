import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { useAuthStore }                      from '../../store/authStore'
import { useAttendanceRecords }              from '../../hooks/attendance/useAttendanceRecords'
import AttendanceTable                       from '../../components/attendance/AttendanceTable'
import WfhCheckinCard                        from '../../components/attendance/WfhCheckinCard'
import GeoCheckinFlow                        from '../../components/attendance/GeoCheckinFlow'
import SetHomeLocationModal                  from '../../components/attendance/SetHomeLocationModal'
import WorkModeSelector                      from '../../components/attendance/WorkModeSelector'
import WFOCheckinCard                        from '../../components/attendance/WFOCheckinCard'
import { wfhApi, wfhGeoApi }                from '../../api/wfhApi'
import type { WfhStatus, WfhRecord, HomeLocation } from '../../api/wfhApi'
import type { DailyWorkMode }               from '../../components/attendance/WorkModeSelector'
import type { AttendanceStatus }            from '../../types/attendance'
import GeoCheckoutFlow                      from '../../components/attendance/GeoCheckoutFlow'

type Tab = 'regular' | 'selfie' | 'geo' | 'history'

const currentMonth = new Date().toISOString().slice(0, 7)

function toEmployeeCode(userId: number | string | undefined): string {
  if (userId == null) return ''
  const s = String(userId)
  if (/^EMP\d+$/i.test(s)) return s.toUpperCase()
  const n = parseInt(s, 10)
  return n > 0 ? `EMP${String(n).padStart(4, '0')}` : s
}

function isLate(r: { late_minutes?: number; check_in?: string }): boolean {
  if ((r.late_minutes ?? 0) > 0) return true
  if (!r.check_in) return false
  const m = r.check_in.match(/^(\d{1,2}):(\d{2})/)
  if (!m) return false
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10) > 570
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

// ── Stat card ─────────────────────────────────────────────────────────────────

interface StatTileProps {
  icon: string; iconBg: string; iconColor: string
  value: number | string; label: string; valueColor: string
}
function StatTile({ icon, iconBg, iconColor, value, label, valueColor }: StatTileProps) {
  return (
    <div className="flex-1 min-w-[110px] rounded-xl border border-gray-100 bg-slate-50/70 px-4 py-3.5 flex items-center justify-between gap-3">
      <div>
        <p className={`text-[28px] font-bold tabular-nums leading-none ${valueColor}`}>{value}</p>
        <p className="text-[11px] text-gray-500 mt-1 font-medium">{label}</p>
      </div>
      <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
        <i className={`${icon} ${iconColor} text-[14px]`} />
      </div>
    </div>
  )
}

// ── Filter / Refresh bar ──────────────────────────────────────────────────────

interface FilterBarProps {
  monthValue: string
  onMonthChange: (v: string) => void
  onRefresh: () => void
  refreshing?: boolean
  children?: React.ReactNode
}
function FilterBar({ monthValue, onMonthChange, onRefresh, refreshing, children }: FilterBarProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {children}
      <input
        type="month"
        value={monthValue}
        onChange={e => onMonthChange(e.target.value)}
        className="h-8 px-3 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-indigo-300 transition-colors"
      />
      <button
        onClick={onRefresh}
        disabled={refreshing}
        className="h-8 w-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition text-gray-400 shrink-0"
        title="Refresh"
      >
        <i className={`fa-solid fa-rotate-right text-[11px] ${refreshing ? 'animate-spin' : ''}`} />
      </button>
    </div>
  )
}

// ── Tab content header ────────────────────────────────────────────────────────

interface ContentHeaderProps {
  title: string
  subtitle?: string
  right?: React.ReactNode
}
function ContentHeader({ title, subtitle, right }: ContentHeaderProps) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
      <div>
        <p className="text-[14px] font-semibold text-gray-800">{title}</p>
        {subtitle && <p className="text-[11px] text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {right && <div>{right}</div>}
    </div>
  )
}

// ── Info notice ───────────────────────────────────────────────────────────────

function InfoNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-[12px] text-blue-700 mb-4">
      <i className="fa-solid fa-circle-info mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  )
}

// ── WFH History table ─────────────────────────────────────────────────────────

function WfhHistoryTable({ records, isLoading }: { records: WfhRecord[]; isLoading: boolean }) {
  const methodBadge = (m: string) =>
    m === 'GEO'
      ? <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-600 border-emerald-100"><i className="fa-solid fa-location-dot mr-1" />Geo</span>
      : <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-indigo-50 text-indigo-600 border-indigo-100"><i className="fa-solid fa-camera mr-1" />Selfie</span>

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      AUTO_APPROVED:  'bg-emerald-50 text-emerald-600 border-emerald-100',
      APPROVED:       'bg-emerald-50 text-emerald-700 border-emerald-100',
      REJECTED:       'bg-red-50 text-red-600 border-red-100',
      PENDING_SELFIE: 'bg-amber-50 text-amber-600 border-amber-100',
      FLAGGED:        'bg-amber-50 text-amber-600 border-amber-100',
      PENDING_REVIEW: 'bg-amber-50 text-amber-700 border-amber-100',
    }
    const labels: Record<string, string> = {
      AUTO_APPROVED: 'Approved', APPROVED: 'HR Approved', REJECTED: 'Rejected',
      PENDING_SELFIE: 'Selfie Needed', FLAGGED: 'Under Review', PENDING_REVIEW: 'Pending HR',
    }
    const cls = map[s] ?? 'bg-gray-50 text-gray-500 border-gray-100'
    return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cls}`}>{labels[s] ?? s}</span>
  }

  if (isLoading) return (
    <div className="flex items-center justify-center py-10 text-gray-400 text-[13px]">
      <i className="fa-solid fa-circle-notch animate-spin mr-2" />Loading history…
    </div>
  )

  if (records.length === 0) return (
    <div className="flex flex-col items-center justify-center py-14 text-center gap-2">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-1">
        <i className="fa-solid fa-clock-rotate-left text-slate-300 text-[22px]" />
      </div>
      <p className="text-[13px] font-semibold text-gray-600">No WFH records this month</p>
      <p className="text-[12px] text-gray-400 max-w-[240px] leading-relaxed">
        Use the <strong className="font-semibold text-indigo-600">Selfie</strong> or{' '}
        <strong className="font-semibold text-indigo-600">Geo</strong> tabs to mark your
        work-from-home attendance.
      </p>
    </div>
  )

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-gray-100">
            {['Date', 'Method', 'Punch In', 'Punch Out', 'Duration', 'Status'].map(h => (
              <th key={h} className="text-left py-2.5 px-3 font-semibold text-gray-400 text-[10px] uppercase tracking-wider">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map(r => (
            <tr key={r.id} className="border-b border-gray-50 last:border-0 hover:bg-slate-50/60 transition-colors">
              <td className="py-2.5 px-3 font-medium text-gray-800">{fmtDate(r.punch_in_at)}</td>
              <td className="py-2.5 px-3">{methodBadge(r.attendance_method ?? 'SELFIE')}</td>
              <td className="py-2.5 px-3 text-gray-700">{fmtTime(r.punch_in_at)}</td>
              <td className="py-2.5 px-3 text-gray-500">{fmtTime(r.punch_out_at)}</td>
              <td className="py-2.5 px-3 text-gray-500">
                {r.duration_minutes != null
                  ? `${Math.floor(r.duration_minutes / 60)}h ${r.duration_minutes % 60}m`
                  : '—'}
              </td>
              <td className="py-2.5 px-3">{statusBadge(r.status)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Tab: Geo Attendance ───────────────────────────────────────────────────────

function GeoAttendanceTab({
  employeeId,
  wfhStatus,
  onRefresh,
}: {
  employeeId: string
  wfhStatus: WfhStatus | null
  onRefresh: () => void
}) {
  const [homeLocation,  setHomeLocation]  = useState<HomeLocation | null>(null)
  const [homeFetched,   setHomeFetched]   = useState(false)
  const [showSetHome,   setShowSetHome]   = useState(false)
  const [showCheckout,  setShowCheckout]  = useState(false)

  useEffect(() => {
    if (!employeeId || homeFetched) return
    wfhGeoApi.getHomeLocation(employeeId)
      .then(({ data }) => setHomeLocation(data))
      .catch(() => setHomeLocation({ found: false }))
      .finally(() => setHomeFetched(true))
  }, [employeeId, homeFetched])

  const hasSession   = wfhStatus?.has_session
  const method       = wfhStatus?.attendance_method
  const isGeoSession = hasSession && method === 'GEO'
  const isPunchedOut = !!(wfhStatus?.punch_out_at)

  if (isGeoSession) {
    if (showCheckout) {
      return (
        <div className="rounded-xl border border-gray-100 bg-slate-50/60 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
              <i className="fa-solid fa-location-dot text-indigo-600 text-[13px]" />
            </div>
            <div>
              <p className="text-[14px] font-bold text-gray-800">Geo Punch Out</p>
              <p className="text-[11px] text-gray-400">Verify you're at home to close attendance</p>
            </div>
          </div>
          <GeoCheckoutFlow
            employeeId={employeeId}
            onSuccess={() => { setShowCheckout(false); onRefresh() }}
            onBack={() => setShowCheckout(false)}
          />
        </div>
      )
    }

    return (
      <div className="rounded-xl border border-gray-100 bg-slate-50/60 p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
            <i className="fa-solid fa-location-dot text-emerald-600 text-[13px]" />
          </div>
          <div>
            <p className="text-[14px] font-bold text-gray-800">Geo Attendance Recorded</p>
            <p className="text-[11px] text-gray-400">Today's WFH geo check-in is complete</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl px-4 py-3 border border-gray-100">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Punch In</p>
            <p className="text-[16px] font-bold text-gray-800 mt-0.5">{fmtTime(wfhStatus?.punch_in_at)}</p>
          </div>
          <div className="bg-white rounded-xl px-4 py-3 border border-gray-100">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Punch Out</p>
            <p className="text-[16px] font-bold text-gray-800 mt-0.5">{fmtTime(wfhStatus?.punch_out_at)}</p>
          </div>
        </div>
        <div className={`flex items-start gap-2 px-3 py-2.5 rounded-xl text-[12px] ${
          isPunchedOut
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
            : 'bg-amber-50 text-amber-700 border border-amber-100'
        }`}>
          <i className={`fa-solid mt-0.5 shrink-0 ${isPunchedOut ? 'fa-circle-check' : 'fa-circle-info'}`} />
          {isPunchedOut
            ? 'Geo Attendance Completed Successfully.'
            : 'Geo Check-In Completed. Please Punch Out before ending your workday.'}
        </div>
        {wfhStatus?.geo_distance_meters != null && (
          <div className="flex items-center gap-2 text-[12px] text-emerald-600">
            <i className="fa-solid fa-location-dot" />
            Geo verified — {Math.round(wfhStatus.geo_distance_meters)} m from home
          </div>
        )}
        {!isPunchedOut && (
          <button
            onClick={() => setShowCheckout(true)}
            className="flex items-center justify-center gap-2 h-10 px-5 bg-indigo-600 hover:bg-indigo-700 text-white text-[13px] font-semibold rounded-xl transition-colors w-full"
          >
            <i className="fa-solid fa-location-dot text-[12px]" />
            Geo Punch Out
          </button>
        )}
      </div>
    )
  }

  if (hasSession && method === 'SELFIE') {
    return (
      <div className="rounded-xl border border-amber-100 bg-amber-50 px-5 py-4 text-[13px] text-amber-700 flex items-start gap-2">
        <i className="fa-solid fa-circle-info mt-0.5 shrink-0" />
        You've already marked today's attendance via selfie. Only one method per day is allowed.
      </div>
    )
  }

  if (homeFetched && !homeLocation?.found) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-gray-100 bg-slate-50/60 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <i className="fa-solid fa-house text-amber-500 text-[13px]" />
            </div>
            <div>
              <p className="text-[14px] font-bold text-gray-800">Home Location Not Set</p>
              <p className="text-[11px] text-gray-400">Required for geo attendance</p>
            </div>
          </div>
          <p className="text-[12px] text-gray-500 mb-4 leading-relaxed">
            Register your home GPS coordinates before using geo attendance.
            Open this page <strong>while at home</strong> and click the button below.
          </p>
          <button
            onClick={() => setShowSetHome(true)}
            className="flex items-center justify-center gap-2 h-10 px-5 bg-indigo-600 hover:bg-indigo-700 text-white text-[13px] font-semibold rounded-xl transition-colors w-full"
          >
            <i className="fa-solid fa-house-location text-[12px]" />
            Set My Home Location
          </button>
        </div>
        {showSetHome && (
          <SetHomeLocationModal
            employeeId={employeeId}
            existingLabel={null}
            onSaved={() => { setShowSetHome(false); setHomeFetched(false) }}
            onClose={() => setShowSetHome(false)}
          />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {homeLocation?.found && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2.5 text-[12px] text-emerald-700">
          <i className="fa-solid fa-house-circle-check shrink-0" />
          Home location registered — geo attendance is available
        </div>
      )}
      <div className="rounded-xl border border-gray-100 bg-slate-50/60 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
            <i className="fa-solid fa-location-dot text-indigo-600 text-[13px]" />
          </div>
          <div>
            <p className="text-[14px] font-bold text-gray-800">Geo Attendance</p>
            <p className="text-[11px] text-gray-400">Share your GPS to mark attendance from home</p>
          </div>
        </div>
        <GeoCheckinFlow
          employeeId={employeeId}
          onSuccess={onRefresh}
          onBack={() => {}}
        />
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EmployeeAttendancePage() {
  const { user } = useAuthStore()
  const employeeCode = toEmployeeCode(user?.user_id)

  const [tab,          setTab]          = useState<Tab>('regular')
  const [month,        setMonth]        = useState(currentMonth)
  const [statusFilter, setStatusFilter] = useState<AttendanceStatus | 'ALL'>('ALL')
  const [historyMonth, setHistoryMonth] = useState(currentMonth)

  // ── Work mode state ─────────────────────────────────────────────────────────
  const [workMode,        setWorkMode]        = useState<DailyWorkMode | null>(null)
  const [workModeLoading, setWorkModeLoading] = useState(true)

  const fetchWorkMode = useCallback(async () => {
    if (!employeeCode) { setWorkModeLoading(false); return }
    try {
      const { data } = await axios.get('/api/attendance/work-mode/today', {
        params: { employee_id: employeeCode }
      })
      setWorkMode(data.data ?? null)
    } catch {
      setWorkMode(null)
    } finally {
      setWorkModeLoading(false)
    }
  }, [employeeCode])

  // ── WFH state ───────────────────────────────────────────────────────────────
  const [wfhStatus,        setWfhStatus]        = useState<WfhStatus | null>(null)
  const [wfhStatusLoading, setWfhStatusLoading] = useState(true)
  const [wfhHistory,        setWfhHistory]        = useState<WfhRecord[]>([])
  const [wfhHistoryLoading, setWfhHistoryLoading] = useState(false)

  const [lateSummary, setLateSummary] = useState<{
    grace_late_count: number
    late_deductions_applied: number
    late_arrival_deduction: number
  } | null>(null)

  const fetchWfhStatus = useCallback(async () => {
    if (!employeeCode) { setWfhStatusLoading(false); return }
    try {
      const { data } = await wfhApi.getStatus(employeeCode)
      setWfhStatus(data)
    } catch {
      setWfhStatus(null)
    } finally {
      setWfhStatusLoading(false)
    }
  }, [employeeCode])

  const fetchLateSummary = useCallback(async () => {
    if (!employeeCode) return
    try {
      const res = await fetch(`/api/attendance/late-summary/${employeeCode}?month=${month.slice(5)}&year=${month.slice(0, 4)}`)
      const data = await res.json()
      setLateSummary({
        grace_late_count:        data.grace_late_count        ?? 0,
        late_deductions_applied: data.deductions_applied      ?? 0,
        late_arrival_deduction:  data.late_arrival_deduction  ?? 0,
      })
    } catch {
      setLateSummary(null)
    }
  }, [employeeCode, month])

  const fetchWfhHistory = useCallback(async () => {
    if (!employeeCode) return
    setWfhHistoryLoading(true)
    try {
      const { data } = await wfhApi.getHistory(employeeCode, historyMonth)
      setWfhHistory(data.records ?? [])
    } catch {
      setWfhHistory([])
    } finally {
      setWfhHistoryLoading(false)
    }
  }, [employeeCode, historyMonth])

  const { records, stats, isLoading, refetch } =
    useAttendanceRecords(employeeCode || null, month)

  const handleRefresh = useCallback(() => {
    fetchWfhStatus()
    refetch()
  }, [fetchWfhStatus, refetch])

  useEffect(() => { fetchWorkMode() },   [fetchWorkMode])
  useEffect(() => { fetchWfhStatus() },  [fetchWfhStatus])
  useEffect(() => { fetchLateSummary() }, [fetchLateSummary])
  useEffect(() => {
    if (tab === 'history') fetchWfhHistory()
  }, [tab, fetchWfhHistory])

  const lateCount = records.filter(
    r => isLate(r) && (r.status === 'PRESENT' || r.status === 'HALF_DAY')
  ).length

  const filtered = statusFilter === 'ALL'
    ? records
    : records.filter(r => r.status === statusFilter)

  if (!user) return null

  const dash = isLoading ? '—' : null

  const WFH_TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'selfie',  label: 'Selfie',   icon: 'fa-solid fa-camera'            },
    { id: 'geo',     label: 'Geo',      icon: 'fa-solid fa-location-dot'      },
    { id: 'history', label: 'History',  icon: 'fa-solid fa-clock-rotate-left' },
    { id: 'regular', label: 'Records',  icon: 'fa-solid fa-calendar-check'    },
  ]

  const isWFO = workMode?.mode === 'WFO'
  const isWFH = workMode?.mode === 'WFH'

  return (
    <div className="space-y-5">

      {/* ── Page header ── */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#0f172a] flex items-center justify-center shrink-0">
          <i className="fa-solid fa-clock-rotate-left text-white text-[13px]" />
        </div>
        <div>
          <h1 className="text-[16px] font-bold text-gray-900 leading-tight">My Attendance</h1>
          <p className="text-[11px] text-gray-400">
            {user.full_name} &nbsp;·&nbsp; {employeeCode || 'Employee'}
          </p>
        </div>
      </div>

      {/* ── Work Mode Selector card ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <WorkModeSelector
          employeeId={employeeCode}
          current={workMode}
          loading={workModeLoading}
          onSelected={mode => {
            setWorkMode(mode)
            if (mode.mode === 'WFH') setTab('selfie')
          }}
        />
      </div>

      {/* ── WFO module — only shown after WFO is selected ── */}
      {isWFO && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-5 space-y-5">

            {employeeCode && (
              <WFOCheckinCard
                employeeId={employeeCode}
                workMode={workMode!}
                onSuccess={updated => setWorkMode(updated)}
              />
            )}

            {/* Monthly records */}
            <div className="border-t border-gray-100 pt-5">
              <div className="flex flex-wrap gap-3 mb-4">
                <StatTile icon="fa-solid fa-circle-check"       iconBg="bg-emerald-50" iconColor="text-emerald-500" value={dash ?? stats.present}  label="Present"       valueColor="text-emerald-600" />
                <StatTile icon="fa-solid fa-circle-xmark"       iconBg="bg-red-50"     iconColor="text-red-500"     value={dash ?? stats.absent}   label="Absent"        valueColor="text-red-500" />
                <StatTile icon="fa-solid fa-clock"              iconBg="bg-violet-50"  iconColor="text-violet-500"  value={dash ?? lateCount}      label="Late Arrivals" valueColor="text-violet-600" />
                <StatTile icon="fa-solid fa-triangle-exclamation" iconBg="bg-red-50"   iconColor="text-red-500"
                  value={dash ?? (lateSummary?.grace_late_count ?? '—')}
                  label="Beyond Grace" valueColor="text-red-600"
                />
              </div>

              {lateSummary && lateSummary.late_arrival_deduction > 0 && (
                <div className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50/60 px-4 py-3 text-[12px] text-red-700 mb-4">
                  <i className="fa-solid fa-triangle-exclamation mt-0.5 shrink-0" />
                  <span>
                    <strong>{lateSummary.grace_late_count} beyond-grace arrival{lateSummary.grace_late_count !== 1 ? 's' : ''}</strong> this month
                    — {lateSummary.late_deductions_applied} × ½ day deduction (
                    <strong>₹{lateSummary.late_arrival_deduction.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>).
                  </span>
                </div>
              )}

              <ContentHeader
                title="Monthly Records"
                subtitle={isLoading ? 'Loading…' : `${filtered.length} entries`}
                right={
                  <FilterBar monthValue={month} onMonthChange={setMonth} onRefresh={refetch} refreshing={isLoading}>
                    <select
                      value={statusFilter}
                      onChange={e => setStatusFilter(e.target.value as AttendanceStatus | 'ALL')}
                      className="h-8 px-3 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-indigo-300 transition-colors"
                    >
                      <option value="ALL">All Status</option>
                      <option value="PRESENT">Present</option>
                      <option value="ABSENT">Absent</option>
                      <option value="HALF_DAY">Half Day</option>
                      <option value="ON_LEAVE">On Leave</option>
                    </select>
                  </FilterBar>
                }
              />
              <AttendanceTable records={filtered} isLoading={isLoading} />
            </div>
          </div>
        </div>
      )}

      {/* ── WFH module — only shown after WFH is selected ── */}
      {isWFH && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

          {/* Tab nav */}
          <div className="flex border-b border-gray-100 overflow-x-auto bg-white px-2">
            {WFH_TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-3.5 text-[12px] font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
                  tab === t.id
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200'
                }`}
              >
                <i className={`${t.icon} text-[11px]`} />
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="p-5">

            {/* ── Selfie Attendance ── */}
            {tab === 'selfie' && (
              <div className="space-y-4">
                <ContentHeader title="Selfie Attendance" subtitle="Capture a webcam selfie to mark WFH attendance" />
                <InfoNotice>
                  Capture a selfie as attendance evidence for your WFH day. Your photo will be reviewed by HR if flagged.
                </InfoNotice>
                {!wfhStatusLoading && employeeCode && (
                  <WfhCheckinCard employeeId={employeeCode} status={wfhStatus} onRefresh={handleRefresh} defaultMethod="SELFIE" />
                )}
              </div>
            )}

            {/* ── Geo Attendance ── */}
            {tab === 'geo' && (
              <div className="space-y-4">
                <ContentHeader title="Geo Attendance" subtitle="GPS-based attendance from your registered home location" />
                <InfoNotice>
                  Share your GPS location to mark attendance. Auto-approved when within the allowed radius of your registered home address.
                </InfoNotice>
                {!wfhStatusLoading && employeeCode && (
                  <GeoAttendanceTab employeeId={employeeCode} wfhStatus={wfhStatus} onRefresh={handleRefresh} />
                )}
              </div>
            )}

            {/* ── WFH History ── */}
            {tab === 'history' && (
              <div className="space-y-4">
                <ContentHeader
                  title="WFH Attendance History"
                  subtitle="Selfie & Geo records"
                  right={
                    <FilterBar monthValue={historyMonth} onMonthChange={setHistoryMonth} onRefresh={fetchWfhHistory} refreshing={wfhHistoryLoading} />
                  }
                />
                <div className="border-t border-gray-100 pt-3">
                  <WfhHistoryTable records={wfhHistory} isLoading={wfhHistoryLoading} />
                </div>
              </div>
            )}

            {/* ── Monthly Records ── */}
            {tab === 'regular' && (
              <div className="space-y-5">
                <div className="flex flex-wrap gap-3">
                  <StatTile icon="fa-solid fa-circle-check"       iconBg="bg-emerald-50" iconColor="text-emerald-500" value={dash ?? stats.present}  label="Present"       valueColor="text-emerald-600" />
                  <StatTile icon="fa-solid fa-circle-xmark"       iconBg="bg-red-50"     iconColor="text-red-500"     value={dash ?? stats.absent}   label="Absent"        valueColor="text-red-500" />
                  <StatTile icon="fa-solid fa-circle-half-stroke" iconBg="bg-amber-50"   iconColor="text-amber-500"   value={dash ?? stats.half_day} label="Half Day"      valueColor="text-amber-600" />
                  <StatTile icon="fa-solid fa-clock"              iconBg="bg-violet-50"  iconColor="text-violet-500"  value={dash ?? lateCount}      label="Late Arrivals" valueColor="text-violet-600" />
                </div>
                <div className="border-t border-gray-100 pt-5">
                  <ContentHeader
                    title="Attendance Records"
                    subtitle={isLoading ? 'Loading…' : `${filtered.length} entries`}
                    right={
                      <FilterBar monthValue={month} onMonthChange={setMonth} onRefresh={refetch} refreshing={isLoading}>
                        <select
                          value={statusFilter}
                          onChange={e => setStatusFilter(e.target.value as AttendanceStatus | 'ALL')}
                          className="h-8 px-3 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-indigo-300 transition-colors"
                        >
                          <option value="ALL">All Status</option>
                          <option value="PRESENT">Present</option>
                          <option value="ABSENT">Absent</option>
                          <option value="HALF_DAY">Half Day</option>
                          <option value="ON_LEAVE">On Leave</option>
                        </select>
                      </FilterBar>
                    }
                  />
                  <AttendanceTable records={filtered} isLoading={isLoading} />
                </div>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  )
}
