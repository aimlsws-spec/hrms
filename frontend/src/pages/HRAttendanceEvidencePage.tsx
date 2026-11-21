/**
 * HR: Selfie & Location — who punched in, from where, with which selfie.
 * Covers office (WFO) and home (WFH) staff. Photos are fetched one at a time through the
 * authenticated API (never a plain <img src>) and every view is written to the selfie access log.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import client from '../api/client'
import { useAuthStore } from '../store/authStore'

interface Reference { label: string; latitude: number; longitude: number }
interface Row {
  wfh_id: number; employee_id: string; full_name: string; department: string; work_mode: 'WFO' | 'WFH'
  punch_in_at: string | null; punch_out_at: string | null; status: string; method: string | null
  latitude: number | null; longitude: number | null; distance_meters: number | null
  reference: Reference | null; client_ip: string | null
  checkin_selfie_id: number | null; checkout_selfie_id: number | null; selfie_deleted: boolean
}
interface Viewing { row: Row; kind: 'checkin' | 'checkout'; selfieId: number }

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const day  = (s: string | null) => (s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')
const time = (s: string | null) => (s ? new Date(s).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—')
const mapUrl = (lat: number, lon: number) => `https://www.google.com/maps?q=${lat},${lon}`
const km = (m: number | null) => (m == null ? '—' : m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`)

function SelfieDialog({ v, reviewer, onClose }: { v: Viewing; reviewer: string; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const made = useRef<string | null>(null)

  useEffect(() => {
    let off = false
    client.get(`/wfh/selfie/${v.selfieId}`, { params: { reviewer_user_id: reviewer }, responseType: 'blob' })
      .then(({ data }) => { if (off) return; made.current = URL.createObjectURL(data); setUrl(made.current) })
      .catch((e: { response?: { status?: number } }) =>
        setErr(e.response?.status === 410 ? 'This selfie was deleted under the retention policy.' : 'Could not load the selfie.'))
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', esc)
    return () => { off = true; window.removeEventListener('keydown', esc); if (made.current) URL.revokeObjectURL(made.current) }
  }, [v.selfieId, reviewer, onClose])

  const r = v.row
  const at = v.kind === 'checkin' ? r.punch_in_at : r.punch_out_at
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose} role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[92vh] overflow-auto grid md:grid-cols-[1fr_260px]" onClick={e => e.stopPropagation()}>
        <div className="bg-gray-900 flex items-center justify-center min-h-[260px]">
          {url ? <img src={url} alt={`${v.kind} selfie of ${r.full_name}`} className="max-h-[80vh] w-full object-contain" />
               : <p className="text-gray-300 text-sm px-6 text-center">{err ?? 'Loading selfie…'}</p>}
        </div>
        <div className="p-5 space-y-3 text-[13px]">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-bold text-gray-900 text-[15px]">{r.full_name}</p>
              <p className="text-gray-500 text-[12px]">{r.employee_id} · {r.department || '—'}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700" aria-label="Close"><i className="fas fa-xmark" /></button>
          </div>
          <dl className="space-y-2">
            <div><dt className="text-[11px] uppercase tracking-wide text-gray-400">{v.kind === 'checkin' ? 'Punch in' : 'Punch out'}</dt>
              <dd>{day(at)}, {time(at)}</dd></div>
            <div><dt className="text-[11px] uppercase tracking-wide text-gray-400">Work mode</dt>
              <dd>{r.work_mode === 'WFO' ? 'Work from Office' : 'Work from Home'}</dd></div>
            <div><dt className="text-[11px] uppercase tracking-wide text-gray-400">Location at punch-in</dt>
              <dd>{r.latitude != null && r.longitude != null ? (
                <>
                  {r.latitude.toFixed(5)}, {r.longitude.toFixed(5)}<br />
                  <a href={mapUrl(r.latitude, r.longitude)} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
                    <i className="fas fa-location-dot mr-1" />Open in Google Maps
                  </a>
                </>) : 'Not recorded'}</dd></div>
            <div><dt className="text-[11px] uppercase tracking-wide text-gray-400">Distance from {r.reference?.label.toLowerCase() ?? 'reference'}</dt>
              <dd>{km(r.distance_meters)}</dd></div>
            {r.client_ip && <div><dt className="text-[11px] uppercase tracking-wide text-gray-400">Network address</dt><dd>{r.client_ip}</dd></div>}
          </dl>
          <p className="text-[11px] text-gray-400 border-t border-gray-100 pt-2">
            <i className="fas fa-shield-halved mr-1" />Viewing this photo is recorded in the access log with your name.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function HRAttendanceEvidencePage() {
  const user = useAuthStore(s => s.user)
  const reviewer = String(user?.user_id ?? '')
  const today = new Date()
  const week = new Date(); week.setDate(today.getDate() - 6)
  const [from, setFrom] = useState(iso(week))
  const [to, setTo]     = useState(iso(today))
  const [q, setQ]       = useState('')
  const [mode, setMode] = useState<'' | 'WFO' | 'WFH'>('')
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewing, setViewing] = useState<Viewing | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const { data } = await client.get('/hr/attendance-evidence', {
        params: { reviewer_user_id: reviewer, from_date: from, to_date: to, q: q.trim() || undefined, mode: mode || undefined },
      })
      setRows(data.records ?? [])
    } catch (e: unknown) {
      setError((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Could not load the records.')
    } finally { setLoading(false) }
  }, [reviewer, from, to, q, mode])

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t) }, [load])

  const inputCls = 'h-9 px-3 border-2 border-gray-200 rounded-lg text-[13px] focus:outline-none focus:border-indigo-400 bg-white'
  const th = 'text-left pb-2.5 pr-4 font-semibold text-gray-500 text-[11px] uppercase tracking-wide whitespace-nowrap'
  const selfieBtn = 'inline-flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-1 rounded-lg border border-indigo-200 text-indigo-700 hover:bg-indigo-50'

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[18px] font-bold text-gray-800">Selfie &amp; Location</h1>
        <p className="text-[12px] text-gray-500 mt-0.5">See where each employee punched in from and open the selfie taken at that moment, for office and home staff. Photos are only shown when you click, and each view is logged.</p>
      </div>

      <div className="flex flex-wrap items-end gap-3 bg-white border border-gray-100 rounded-xl p-4">
        <label className="text-[11px] text-gray-500 space-y-1 block">Employee name or ID
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="e.g. Bhoomi or SWS26-AB12" className={`${inputCls} block w-52`} />
        </label>
        <label className="text-[11px] text-gray-500 space-y-1 block">Work mode
          <select value={mode} onChange={e => setMode(e.target.value as '' | 'WFO' | 'WFH')} className={`${inputCls} block`}>
            <option value="">Office and home</option><option value="WFO">Work from Office</option><option value="WFH">Work from Home</option>
          </select>
        </label>
        <label className="text-[11px] text-gray-500 space-y-1 block">From<input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} className={`${inputCls} block`} /></label>
        <label className="text-[11px] text-gray-500 space-y-1 block">To<input type="date" value={to} min={from} max={iso(today)} onChange={e => setTo(e.target.value)} className={`${inputCls} block`} /></label>
      </div>

      {error && <div className="px-4 py-3 rounded-xl text-[12px] bg-red-50 text-red-600 border border-red-100">{error}</div>}

      <section className="bg-white border border-gray-100 rounded-xl p-4 overflow-x-auto">
        {loading && rows.length === 0 ? <div className="h-24 bg-gray-100 rounded-xl animate-pulse" /> :
         rows.length === 0 ? <p className="text-[12px] text-gray-400 py-8 text-center">No punch-ins found for this filter.</p> : (
          <table className="w-full text-[13px] border-collapse">
            <thead><tr className="border-b-2 border-gray-100">
              <th className={th}>Employee</th><th className={th}>Date</th><th className={th}>In / Out</th>
              <th className={th}>Location</th><th className={th}>Selfie</th>
            </tr></thead>
            <tbody>{rows.map(r => (
              <tr key={r.wfh_id} className="border-b border-gray-50 align-top">
                <td className="py-3 pr-4">
                  <p className="font-medium text-gray-800">{r.full_name}</p>
                  <p className="text-[11px] text-gray-400">{r.employee_id}</p>
                  <span className={`inline-block mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${r.work_mode === 'WFO' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'}`}>
                    {r.work_mode === 'WFO' ? 'Office' : 'Home'}
                  </span>
                </td>
                <td className="py-3 pr-4 whitespace-nowrap">{day(r.punch_in_at)}</td>
                <td className="py-3 pr-4 whitespace-nowrap">{time(r.punch_in_at)} – {r.punch_out_at ? time(r.punch_out_at) : <span className="text-amber-600">open</span>}</td>
                <td className="py-3 pr-4">
                  {r.latitude != null && r.longitude != null ? (
                    <>
                      <a href={mapUrl(r.latitude, r.longitude)} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline whitespace-nowrap">
                        <i className="fas fa-location-dot mr-1" />View on map
                      </a>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {km(r.distance_meters)} from {r.reference ? r.reference.label.toLowerCase() : 'reference'}
                      </p>
                    </>
                  ) : <span className="text-gray-400">Not recorded</span>}
                </td>
                <td className="py-3">
                  <div className="flex flex-wrap gap-2">
                    {r.checkin_selfie_id ? (
                      <button className={selfieBtn} onClick={() => setViewing({ row: r, kind: 'checkin', selfieId: r.checkin_selfie_id! })}>
                        <i className="fas fa-camera" />Check-in
                      </button>
                    ) : <span className="text-[12px] text-gray-400">{r.selfie_deleted ? 'Deleted (retention)' : r.status === 'PENDING_SELFIE' ? 'Selfie not taken' : 'No selfie'}</span>}
                    {r.checkout_selfie_id && (
                      <button className={selfieBtn} onClick={() => setViewing({ row: r, kind: 'checkout', selfieId: r.checkout_selfie_id! })}>
                        <i className="fas fa-camera" />Check-out
                      </button>
                    )}
                  </div>
                </td>
              </tr>))}
            </tbody>
          </table>
        )}
      </section>

      {viewing && <SelfieDialog v={viewing} reviewer={reviewer} onClose={() => setViewing(null)} />}
    </div>
  )
}
