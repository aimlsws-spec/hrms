/**
 * HR: employee-wise working hours and break time report, plus the attendance audit log.
 * Net working time = (check-out − check-in) − breaks.
 */
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import client from '../api/client'
import { useAuthStore } from '../store/authStore'

interface DayRow {
  employee_id: string; full_name: string; department: string; date: string; status: string
  check_in: string | null; check_out: string | null
  break_minutes: number; net_minutes: number | null; breaks_count: number
  break_seconds: number; net_seconds: number | null; in_progress?: boolean
  beyond_grace: number; late_minutes: number
}
interface SummaryRow {
  employee_id: string; full_name: string; department: string
  days_present: number; late_days: number
  total_net_minutes: number; total_break_minutes: number; avg_net_minutes: number
  total_net_seconds: number; total_break_seconds: number; avg_net_seconds: number
}
interface AuditRow {
  id: number; employee_id: string; attendance_date: string | null; action: string
  old_values: Record<string, unknown> | null; new_values: Record<string, unknown> | null
  reason: string | null; performed_by: string; performed_name: string | null; performed_role: string | null
  created_at: string
}
interface BreakRow { id: number; start: string; end: string | null; seconds: number | null }

/** Hours and minutes; under an hour it shows seconds too, so a short break is not rounded to zero. */
const dur = (sec: number | null | undefined) => {
  if (sec == null) return '—'
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m ${String(s).padStart(2, '0')}s`
}
const hhmm = (t: string | null) => (t ? t.slice(0, 5) : '—')
const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export default function HRWorkHoursReportPage() {
  const user = useAuthStore((s) => s.user)
  const reviewer = String(user?.user_id ?? '')
  const today = new Date()
  const [from, setFrom] = useState(iso(new Date(today.getFullYear(), today.getMonth(), 1)))
  const [to,   setTo]   = useState(iso(today))
  const [empId, setEmpId] = useState('')
  const [tab, setTab] = useState<'hours' | 'audit'>('hours')
  const [rows, setRows] = useState<DayRow[]>([])
  const [summary, setSummary] = useState<SummaryRow[]>([])
  const [audit, setAudit] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [breaks, setBreaks] = useState<Record<string, BreakRow[]>>({})

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      if (tab === 'hours') {
        const { data } = await client.get('/hr/work-hours-report', {
          params: { reviewer_user_id: reviewer, from_date: from, to_date: to, employee_id: empId.trim() || undefined },
        })
        setRows(data.records ?? []); setSummary(data.summary ?? [])
      } else {
        const { data } = await client.get('/hr/attendance-audit-log', {
          params: { reviewer_user_id: reviewer, employee_id: empId.trim() || undefined },
        })
        setAudit(data.records ?? [])
      }
    } catch (err: unknown) {
      setError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Could not load the report.')
    } finally {
      setLoading(false)
    }
  }, [tab, reviewer, from, to, empId])

  useEffect(() => { load() }, [load])

  const toggleBreaks = async (r: DayRow) => {
    const key = `${r.employee_id}|${r.date}`
    if (open === key) { setOpen(null); return }
    setOpen(key)
    if (!breaks[key]) {
      try {
        const { data } = await client.get('/hr/attendance-breaks', { params: { reviewer_user_id: reviewer, employee_id: r.employee_id, work_date: r.date } })
        setBreaks((b) => ({ ...b, [key]: data.breaks ?? [] }))
      } catch { setBreaks((b) => ({ ...b, [key]: [] })) }
    }
  }

  const totals = useMemo(() => ({
    net:   summary.reduce((a, s) => a + s.total_net_seconds, 0),
    brk:   summary.reduce((a, s) => a + s.total_break_seconds, 0),
    days:  summary.reduce((a, s) => a + s.days_present, 0),
  }), [summary])

  const exportCsv = () => {
    const head = ['Employee ID', 'Name', 'Department', 'Date', 'Status', 'Check in', 'Check out', 'Break minutes', 'Breaks', 'Net working minutes', 'Late']
    const lines = [head.join(',')].concat(rows.map((r) => [
      r.employee_id, r.full_name, r.department, r.date, r.status, hhmm(r.check_in), hhmm(r.check_out),
      r.break_minutes, r.breaks_count, r.net_minutes ?? '', r.beyond_grace ? 'Yes' : 'No',
    ].map(csvCell).join(',')))
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }))
    const a = document.createElement('a'); a.href = url; a.download = `work-hours_${from}_${to}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const inputCls = 'h-9 px-3 border-2 border-gray-200 rounded-lg text-[13px] focus:outline-none focus:border-indigo-400 bg-white'
  const th = 'text-left pb-2.5 pr-4 font-semibold text-gray-500 text-[11px] uppercase tracking-wide whitespace-nowrap'

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[18px] font-bold text-gray-800">Working Hours &amp; Breaks</h1>
        <p className="text-[12px] text-gray-500 mt-0.5">Employee-wise check-in / check-out, break time and net working hours. Changes to attendance are listed under Audit log.</p>
      </div>

      <div className="flex flex-wrap items-end gap-3 bg-white border border-gray-100 rounded-xl p-4">
        <div className="flex rounded-lg overflow-hidden border border-gray-200">
          {(['hours', 'audit'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 h-9 text-[12px] font-semibold ${tab === t ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              {t === 'hours' ? 'Working hours' : 'Audit log'}
            </button>
          ))}
        </div>
        {tab === 'hours' && (
          <>
            <label className="text-[11px] text-gray-500 space-y-1 block">From<input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={`${inputCls} block`} /></label>
            <label className="text-[11px] text-gray-500 space-y-1 block">To<input type="date" value={to} min={from} max={iso(today)} onChange={(e) => setTo(e.target.value)} className={`${inputCls} block`} /></label>
          </>
        )}
        <label className="text-[11px] text-gray-500 space-y-1 block">Employee ID (optional)
          <input value={empId} onChange={(e) => setEmpId(e.target.value)} placeholder="e.g. SWS26-AB12" className={`${inputCls} block w-44`} />
        </label>
        {tab === 'hours' && (
          <button onClick={exportCsv} disabled={!rows.length}
            className="h-9 px-4 border-2 border-gray-200 hover:border-indigo-300 disabled:opacity-40 text-gray-700 text-[12px] font-semibold rounded-lg">
            <i className="fa-solid fa-file-csv mr-1.5" />Export CSV
          </button>
        )}
      </div>

      {error && <div className="px-4 py-3 rounded-xl text-[12px] bg-red-50 text-red-600 border border-red-100">{error}</div>}
      {loading && <div className="h-24 bg-gray-100 rounded-xl animate-pulse" />}

      {!loading && tab === 'hours' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[['Employee-days present', String(totals.days)], ['Total net working time', dur(totals.net)], ['Total break time', dur(totals.brk)]].map(([k, v]) => (
              <div key={k} className="bg-white border border-gray-100 rounded-xl px-4 py-3">
                <p className="text-[10px] uppercase tracking-wide text-gray-400">{k}</p>
                <p className="text-[20px] font-bold text-gray-800 mt-0.5">{v}</p>
              </div>
            ))}
          </div>

          <section className="bg-white border border-gray-100 rounded-xl p-4 overflow-x-auto">
            <h2 className="text-[13px] font-bold text-gray-800 mb-3">Employee-wise summary</h2>
            {summary.length === 0 ? <p className="text-[12px] text-gray-400 py-6 text-center">No attendance in this range.</p> : (
              <table className="w-full text-[13px] border-collapse">
                <thead><tr className="border-b-2 border-gray-100">
                  <th className={th}>Employee</th><th className={th}>Department</th><th className={th}>Days present</th><th className={th}>Late days</th>
                  <th className={th}>Net working</th><th className={th}>Avg / day</th><th className={th}>Breaks</th>
                </tr></thead>
                <tbody>{summary.map((s) => (
                  <tr key={s.employee_id} className="border-b border-gray-50">
                    <td className="py-2.5 pr-4"><p className="font-medium text-gray-800">{s.full_name}</p><p className="text-[11px] text-gray-400">{s.employee_id}</p></td>
                    <td className="py-2.5 pr-4 text-gray-600">{s.department || '—'}</td>
                    <td className="py-2.5 pr-4">{s.days_present}</td>
                    <td className="py-2.5 pr-4">{s.late_days}</td>
                    <td className="py-2.5 pr-4 font-medium">{dur(s.total_net_seconds)}</td>
                    <td className="py-2.5 pr-4">{dur(s.avg_net_seconds)}</td>
                    <td className="py-2.5 pr-4 text-sky-700">{dur(s.total_break_seconds)}</td>
                  </tr>))}</tbody>
              </table>
            )}
          </section>

          <section className="bg-white border border-gray-100 rounded-xl p-4 overflow-x-auto">
            <h2 className="text-[13px] font-bold text-gray-800 mb-3">Daily detail <span className="font-normal text-gray-400">— click a row to see each break</span></h2>
            {rows.length === 0 ? <p className="text-[12px] text-gray-400 py-6 text-center">No records.</p> : (
              <table className="w-full text-[13px] border-collapse">
                <thead><tr className="border-b-2 border-gray-100">
                  <th className={th}>Date</th><th className={th}>Employee</th><th className={th}>Status</th><th className={th}>Check in</th><th className={th}>Check out</th>
                  <th className={th}>Breaks</th><th className={th}>Net hours</th>
                </tr></thead>
                <tbody>{rows.map((r) => {
                  const key = `${r.employee_id}|${r.date}`
                  return (
                    <Fragment key={key}>
                      <tr onClick={() => toggleBreaks(r)} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer">
                        <td className="py-2.5 pr-4 whitespace-nowrap">{new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
                        <td className="py-2.5 pr-4"><span className="font-medium text-gray-800">{r.full_name}</span></td>
                        <td className="py-2.5 pr-4">{r.status}{r.beyond_grace ? <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-100">Late</span> : null}</td>
                        <td className="py-2.5 pr-4">{hhmm(r.check_in)}</td>
                        <td className="py-2.5 pr-4">{hhmm(r.check_out)}</td>
                        <td className="py-2.5 pr-4 text-sky-700 whitespace-nowrap">{r.break_seconds ? `${dur(r.break_seconds)} (${r.breaks_count})` : '—'}</td>
                        <td className="py-2.5 pr-4 font-medium">{dur(r.net_seconds)}{r.in_progress && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">in progress</span>}</td>
                      </tr>
                      {open === key && (
                        <tr className="bg-slate-50/70">
                          <td colSpan={7} className="px-4 py-2 text-[12px] text-gray-600">
                            {(breaks[key] ?? []).length === 0 ? 'No breaks recorded.' :
                              (breaks[key] ?? []).map((b, i) => (
                                <span key={b.id} className="inline-block mr-5">Break {i + 1}: {clock(b.start)} – {b.end ? clock(b.end) : 'running'}{b.seconds != null ? ` (${Math.round(b.seconds / 60)} min)` : ''}</span>
                              ))}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}</tbody>
              </table>
            )}
          </section>
        </>
      )}

      {!loading && tab === 'audit' && (
        <section className="bg-white border border-gray-100 rounded-xl p-4 overflow-x-auto">
          <h2 className="text-[13px] font-bold text-gray-800 mb-3">Manual attendance changes</h2>
          {audit.length === 0 ? <p className="text-[12px] text-gray-400 py-6 text-center">No manual changes have been made.</p> : (
            <table className="w-full text-[13px] border-collapse">
              <thead><tr className="border-b-2 border-gray-100">
                <th className={th}>When</th><th className={th}>Changed by</th><th className={th}>Employee</th><th className={th}>Date</th><th className={th}>Action</th><th className={th}>Before → After</th><th className={th}>Reason</th>
              </tr></thead>
              <tbody>{audit.map((a) => (
                <tr key={a.id} className="border-b border-gray-50 align-top">
                  <td className="py-2.5 pr-4 whitespace-nowrap text-gray-600">{new Date(a.created_at).toLocaleString('en-IN')}</td>
                  <td className="py-2.5 pr-4"><p className="font-medium text-gray-800">{a.performed_name || a.performed_by}</p><p className="text-[11px] text-gray-400 capitalize">{a.performed_role}</p></td>
                  <td className="py-2.5 pr-4">{a.employee_id}</td>
                  <td className="py-2.5 pr-4 whitespace-nowrap">{a.attendance_date ?? '—'}</td>
                  <td className="py-2.5 pr-4 text-[11px] font-semibold text-indigo-700">{a.action.replace(/_/g, ' ')}</td>
                  <td className="py-2.5 pr-4 text-[12px] text-gray-600">
                    {a.old_values ? JSON.stringify(a.old_values) : 'none'} → {a.new_values ? JSON.stringify(a.new_values) : '—'}
                  </td>
                  <td className="py-2.5 text-gray-600">{a.reason || '—'}</td>
                </tr>))}</tbody>
            </table>
          )}
        </section>
      )}
    </div>
  )
}
