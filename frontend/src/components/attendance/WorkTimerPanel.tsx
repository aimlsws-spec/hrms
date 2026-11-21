/**
 * WorkTimerPanel — live attendance clock with Break Start / Break End.
 *
 * Every number comes from server timestamps (GET /wfh/timer). The browser only animates between
 * reads, so the clock stays correct after a refresh or a closed browser, and keeps ticking while the
 * connection is down (the last server snapshot is cached locally). Break / check-out actions need a
 * connection; the server validates them.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { wfhApi }               from '../../api/wfhApi'
import type { WorkTimer }       from '../../api/wfhApi'

interface Props {
  employeeId: string
  onChanged?: () => void
  /** change this (e.g. the punch-out time) to force an immediate re-sync */
  refreshKey?: string | null
}

const POLL_MS = 30_000

interface Snapshot { timer: WorkTimer; receivedAt: number }

const cacheKey = (id: string) => `hrms_timer_${id}`

function readCache(id: string): Snapshot | null {
  try {
    const raw = localStorage.getItem(cacheKey(id))
    if (!raw) return null
    const snap = JSON.parse(raw) as Snapshot
    // a cached snapshot is only meaningful on the day it was taken
    return new Date(snap.timer.server_now).toDateString() === new Date().toDateString() ? snap : null
  } catch { return null }
}

function writeCache(id: string, snap: Snapshot) {
  try { localStorage.setItem(cacheKey(id), JSON.stringify(snap)) } catch { /* private mode */ }
}

function hms(total: number): string {
  const s = Math.max(0, Math.floor(total))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

function clock(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'
}

const STATE_UI: Record<string, { label: string; cls: string; dot: string }> = {
  WORKING:     { label: 'Working',        cls: 'bg-emerald-50 text-emerald-700 border-emerald-100', dot: 'bg-emerald-500 animate-pulse' },
  ON_BREAK:    { label: 'On break',       cls: 'bg-amber-50 text-amber-700 border-amber-100',       dot: 'bg-amber-500 animate-pulse' },
  CHECKED_OUT: { label: 'Checked out',    cls: 'bg-gray-100 text-gray-600 border-gray-200',         dot: 'bg-gray-400' },
  NOT_STARTED: { label: 'Not checked in', cls: 'bg-gray-100 text-gray-600 border-gray-200',         dot: 'bg-gray-400' },
  PENDING_SELFIE: { label: 'Selfie pending', cls: 'bg-amber-50 text-amber-700 border-amber-100',    dot: 'bg-amber-500' },
}

export default function WorkTimerPanel({ employeeId, onChanged, refreshKey }: Props) {
  const [snap,    setSnap]    = useState<Snapshot | null>(() => readCache(employeeId))
  const [now,     setNow]     = useState(Date.now())
  const [busy,    setBusy]    = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [offline, setOffline] = useState(!navigator.onLine)
  const mounted = useRef(true)

  const accept = useCallback((timer: WorkTimer) => {
    const s = { timer, receivedAt: Date.now() }
    writeCache(employeeId, s)
    if (mounted.current) { setSnap(s); setOffline(false) }
  }, [employeeId])

  const load = useCallback(async () => {
    try {
      const { data } = await wfhApi.getTimer(employeeId)
      accept(data)
    } catch {
      if (mounted.current) setOffline(true)      // keep ticking from the cached snapshot
    }
  }, [employeeId, accept])

  useEffect(() => {
    mounted.current = true
    load()
    const poll = setInterval(load, POLL_MS)
    const tick = setInterval(() => setNow(Date.now()), 1000)
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    const goOnline  = () => { setOffline(false); load() }
    const goOffline = () => setOffline(true)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online',  goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      mounted.current = false
      clearInterval(poll); clearInterval(tick)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online',  goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [load])

  useEffect(() => { if (refreshKey !== undefined) load() }, [refreshKey, load])

  const act = async (kind: 'start' | 'end') => {
    setBusy(true); setError(null)
    try {
      const { data } = kind === 'start' ? await wfhApi.breakStart(employeeId) : await wfhApi.breakEnd(employeeId)
      accept(data)
      onChanged?.()
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(detail ?? 'Could not reach the server. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  if (!snap || snap.timer.state === 'NOT_STARTED' || snap.timer.state === 'PENDING_SELFIE') return null

  const t = snap.timer
  const sinceRead = Math.max(0, (now - snap.receivedAt) / 1000)
  const running = t.state === 'WORKING' || t.state === 'ON_BREAK'
  const work  = t.work_seconds  + (t.state === 'WORKING'  ? sinceRead : 0)
  const brk   = t.break_seconds + (t.state === 'ON_BREAK' ? sinceRead : 0)
  const gross = t.gross_seconds + (running ? sinceRead : 0)
  const ui = STATE_UI[t.state] ?? STATE_UI.NOT_STARTED
  const blocked = !!t.mobile_blocked

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-[13px] font-bold text-gray-800">Today's time</p>
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${ui.cls}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${ui.dot}`} />{ui.label}
        </span>
      </div>

      {offline && running && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg text-[11px] bg-amber-50 text-amber-700 border border-amber-100">
          <i className="fa-solid fa-wifi mt-0.5" />
          You're offline. The timer keeps running and will re-sync automatically. Break and check-out need a connection.
        </div>
      )}

      <div className="text-center">
        <p className="text-[10px] uppercase tracking-wide text-gray-400">Working time</p>
        <p className={`font-mono text-[34px] leading-none font-bold mt-1 ${t.state === 'WORKING' ? 'text-emerald-600' : 'text-gray-700'}`}>{hms(work)}</p>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-slate-50 px-2 py-2.5">
          <p className="text-[10px] uppercase tracking-wide text-gray-400">Break time</p>
          <p className={`font-mono text-[15px] font-bold mt-0.5 ${t.state === 'ON_BREAK' ? 'text-amber-600' : 'text-gray-700'}`}>{hms(brk)}</p>
        </div>
        <div className="rounded-lg bg-slate-50 px-2 py-2.5">
          <p className="text-[10px] uppercase tracking-wide text-gray-400">Since check-in</p>
          <p className="font-mono text-[15px] font-bold mt-0.5 text-gray-700">{hms(gross)}</p>
        </div>
        <div className="rounded-lg bg-slate-50 px-2 py-2.5">
          <p className="text-[10px] uppercase tracking-wide text-gray-400">Breaks taken</p>
          <p className="font-mono text-[15px] font-bold mt-0.5 text-gray-700">{t.breaks.length}</p>
        </div>
      </div>

      {t.state === 'WORKING' && (t.breaks_left ?? 10) <= 0 && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-[12px] bg-slate-50 text-slate-600 border border-slate-200">
          <i className="fa-solid fa-circle-check mt-0.5 text-emerald-600" />
          Daily break quota limit reached ({t.max_breaks ?? 10}).
        </div>
      )}

      {running && (
        t.state === 'WORKING' ? ((t.breaks_left ?? 10) > 0 && <button
            onClick={() => act('start')}
            disabled={busy || offline || blocked}
            className="flex items-center justify-center gap-2 h-10 w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-[13px] font-semibold rounded-xl transition-colors"
          >
            <i className="fa-solid fa-mug-hot text-[12px]" /> Start Break
          </button>) : (
          <button
            onClick={() => act('end')}
            disabled={busy || offline || blocked}
            className="flex items-center justify-center gap-2 h-10 w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[13px] font-semibold rounded-xl transition-colors"
          >
            <i className="fa-solid fa-play text-[12px]" /> End Break — resume work
          </button>
        )
      )}

      {error && (
        <div className="px-3 py-2 rounded-lg text-[12px] bg-red-50 text-red-600 border border-red-100">{error}</div>
      )}

      {t.breaks.length > 0 && (
        <ul className="divide-y divide-gray-50 text-[12px] text-gray-600">
          {t.breaks.map((b, i) => (
            <li key={b.id} className="flex items-center justify-between py-1.5">
              <span>Break {i + 1}: {clock(b.start)} – {b.end ? clock(b.end) : 'running'}</span>
              <span className="font-mono text-gray-500">
                {hms(b.end ? b.seconds : b.seconds + (t.state === 'ON_BREAK' ? sinceRead : 0))}
              </span>
            </li>
          ))}
        </ul>
      )}

      {t.state === 'CHECKED_OUT' && (
        <p className="text-[12px] text-gray-500">
          Net working time = time between check-in and check-out minus breaks.
        </p>
      )}
    </div>
  )
}
