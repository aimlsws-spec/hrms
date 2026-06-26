/**
 * WfhGeoLogsPage — HR portal for geo WFH attendance.
 *
 * Route: /wfh-geo-logs  (HR/admin only)
 *
 * Four tabs:
 *   1. Geo Attendance Logs   — all successful geo check-ins with distance info
 *   2. Failed Attempts       — geo attempts that were outside the allowed radius
 *   3. Employee Home Locations — home coordinates + ability to update
 *   4. Configuration         — geo radius setting
 */
import { useState, useEffect, useCallback } from 'react'
import { useAuthStore }  from '../store/authStore'
import { wfhGeoApi }    from '../api/wfhApi'
import type {
  HrGeoRecord,
  HrHomeLocationRecord,
  GeoAttemptRecord,
} from '../api/wfhApi'

type Tab = 'logs' | 'failed' | 'homes' | 'config'

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
    + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

function fmtDuration(mins: number | null | undefined): string {
  if (mins == null) return '—'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

// ── Status badge ────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    AUTO_APPROVED: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    APPROVED:      'bg-emerald-50 text-emerald-700 border-emerald-100',
    REJECTED:      'bg-red-50 text-red-600 border-red-100',
    FLAGGED:       'bg-amber-50 text-amber-600 border-amber-100',
  }
  const cls = map[status] ?? 'bg-gray-50 text-gray-500 border-gray-100'
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cls}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

// ── Tab: Geo Logs ────────────────────────────────────────────────────────────────

function GeoLogsTab({ reviewerUserId }: { reviewerUserId: string }) {
  const [records,     setRecords]     = useState<HrGeoRecord[]>([])
  const [total,       setTotal]       = useState(0)
  const [page,        setPage]        = useState(1)
  const [isLoading,   setIsLoading]   = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [monthFilter, setMonthFilter] = useState(() => new Date().toISOString().slice(0, 7))
  const [empFilter,   setEmpFilter]   = useState('')

  const PER_PAGE = 20

  const load = useCallback(async (p = 1) => {
    setIsLoading(true)
    setError(null)
    try {
      const { data } = await wfhGeoApi.getGeoAttendance(reviewerUserId, {
        page:        p,
        per_page:    PER_PAGE,
        month:       monthFilter || undefined,
        employee_id: empFilter.trim() || undefined,
      })
      setRecords(data.records)
      setTotal(data.total)
      setPage(p)
    } catch {
      setError('Failed to load geo attendance records.')
    } finally {
      setIsLoading(false)
    }
  }, [reviewerUserId, monthFilter, empFilter])

  useEffect(() => { load(1) }, [monthFilter, empFilter])  // eslint-disable-line react-hooks/exhaustive-deps

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="month"
          value={monthFilter}
          onChange={e => setMonthFilter(e.target.value)}
          className="h-9 px-3 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
        <input
          type="text"
          placeholder="Filter by Employee ID"
          value={empFilter}
          onChange={e => setEmpFilter(e.target.value)}
          className="h-9 px-3 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-48"
        />
        <button
          onClick={() => load(1)}
          className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-[12px] font-medium rounded-lg transition-colors"
        >
          <i className="fa-solid fa-magnifying-glass mr-1.5" />Search
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-[13px] text-red-600">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-gray-100">
              {['Employee', 'Date & Time', 'Duration', 'Distance', 'Coordinates', 'Status'].map(h => (
                <th key={h} className="text-left py-2 px-3 font-semibold text-gray-500 text-[11px] uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-400">
                  <i className="fa-solid fa-circle-notch animate-spin mr-2" />Loading…
                </td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-400">No geo attendance records found</td>
              </tr>
            ) : records.map(r => (
              <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="py-2.5 px-3">
                  <p className="font-semibold text-gray-800">{r.employee_name}</p>
                  <p className="text-gray-400 text-[10px]">{r.employee_id}</p>
                  {r.department && <p className="text-gray-400 text-[10px]">{r.department}</p>}
                </td>
                <td className="py-2.5 px-3">
                  <p className="text-gray-800">{fmtDateTime(r.punch_in_at)}</p>
                  {r.punch_out_at && (
                    <p className="text-gray-400 text-[11px]">out {fmtDateTime(r.punch_out_at)}</p>
                  )}
                </td>
                <td className="py-2.5 px-3 text-gray-700">{fmtDuration(r.duration_minutes)}</td>
                <td className="py-2.5 px-3">
                  {r.geo_distance_meters != null ? (
                    <span className="font-semibold text-emerald-600">{Math.round(r.geo_distance_meters)} m</span>
                  ) : '—'}
                </td>
                <td className="py-2.5 px-3 font-mono text-gray-500 text-[10px]">
                  {r.geo_latitude != null && r.geo_longitude != null
                    ? `${r.geo_latitude.toFixed(5)}, ${r.geo_longitude.toFixed(5)}`
                    : '—'
                  }
                </td>
                <td className="py-2.5 px-3">
                  <StatusBadge status={r.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-gray-400">{total} record{total !== 1 ? 's' : ''}</span>
          <div className="flex gap-1">
            <button
              onClick={() => load(page - 1)}
              disabled={page <= 1 || isLoading}
              className="h-8 px-3 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              <i className="fa-solid fa-chevron-left text-[10px]" />
            </button>
            <span className="h-8 px-3 flex items-center text-gray-600">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => load(page + 1)}
              disabled={page >= totalPages || isLoading}
              className="h-8 px-3 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              <i className="fa-solid fa-chevron-right text-[10px]" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab: Home Locations ─────────────────────────────────────────────────────────

function HomeLocationsTab({ reviewerUserId }: { reviewerUserId: string }) {
  const [records,   setRecords]   = useState<HrHomeLocationRecord[]>([])
  const [total,     setTotal]     = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  // Edit state
  const [editing,   setEditing]   = useState<string | null>(null)   // employee_id
  const [editLat,   setEditLat]   = useState('')
  const [editLon,   setEditLon]   = useState('')
  const [editLabel, setEditLabel] = useState('')
  const [saving,    setSaving]    = useState(false)
  const [saveMsg,   setSaveMsg]   = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const { data } = await wfhGeoApi.getHomeLocations(reviewerUserId, { per_page: 100 })
      setRecords(data.records)
      setTotal(data.total)
    } catch {
      setError('Failed to load home locations.')
    } finally {
      setIsLoading(false)
    }
  }, [reviewerUserId])

  useEffect(() => { load() }, [load])

  const handleStartEdit = (r: HrHomeLocationRecord) => {
    setEditing(r.employee_id)
    setEditLat(String(r.latitude))
    setEditLon(String(r.longitude))
    setEditLabel(r.address_label ?? '')
    setSaveMsg(null)
  }

  const handleSave = async (employeeId: string) => {
    const lat = parseFloat(editLat)
    const lon = parseFloat(editLon)
    if (isNaN(lat) || isNaN(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      setSaveMsg('Invalid coordinates. Latitude must be −90 to 90, Longitude −180 to 180.')
      return
    }
    setSaving(true)
    setSaveMsg(null)
    try {
      await wfhGeoApi.setHomeLocation(employeeId, lat, lon, {
        addressLabel:    editLabel.trim() || undefined,
        registeredVia:   'hr_manual',
        reviewerUserId,
      })
      setSaveMsg('Saved')
      setEditing(null)
      load()
    } catch {
      setSaveMsg('Save failed. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-gray-500">{total} employee{total !== 1 ? 's' : ''} with home location registered</p>
        <button onClick={load} className="h-8 w-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-400">
          <i className="fa-solid fa-rotate-right text-[11px]" />
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-[13px] text-red-600">{error}</div>
      )}

      {saveMsg && (
        <div className={`rounded-xl px-4 py-3 text-[12px] ${saveMsg === 'Saved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
          {saveMsg}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-gray-100">
              {['Employee', 'Coordinates', 'Address', 'Registered Via', 'Last Updated', 'Actions'].map(h => (
                <th key={h} className="text-left py-2 px-3 font-semibold text-gray-500 text-[11px] uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="py-8 text-center text-gray-400">
                <i className="fa-solid fa-circle-notch animate-spin mr-2" />Loading…
              </td></tr>
            ) : records.length === 0 ? (
              <tr><td colSpan={6} className="py-8 text-center text-gray-400">
                No home locations registered yet
              </td></tr>
            ) : records.map(r => (
              <tr key={r.employee_id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="py-2.5 px-3">
                  <p className="font-semibold text-gray-800">{r.employee_name}</p>
                  <p className="text-gray-400 text-[10px]">{r.employee_id}</p>
                </td>
                <td className="py-2.5 px-3 font-mono text-gray-600 text-[11px]">
                  {editing === r.employee_id ? (
                    <div className="flex flex-col gap-1">
                      <input
                        value={editLat}
                        onChange={e => setEditLat(e.target.value)}
                        placeholder="Latitude"
                        className="h-7 px-2 border border-gray-200 rounded text-[11px] w-28"
                      />
                      <input
                        value={editLon}
                        onChange={e => setEditLon(e.target.value)}
                        placeholder="Longitude"
                        className="h-7 px-2 border border-gray-200 rounded text-[11px] w-28"
                      />
                    </div>
                  ) : (
                    `${r.latitude.toFixed(5)}, ${r.longitude.toFixed(5)}`
                  )}
                </td>
                <td className="py-2.5 px-3 text-gray-600 max-w-[200px]">
                  {editing === r.employee_id ? (
                    <input
                      value={editLabel}
                      onChange={e => setEditLabel(e.target.value)}
                      placeholder="Address label (optional)"
                      className="h-7 px-2 border border-gray-200 rounded text-[11px] w-full"
                    />
                  ) : (
                    <span className="line-clamp-2">{r.address_label ?? '—'}</span>
                  )}
                </td>
                <td className="py-2.5 px-3">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                    r.registered_via === 'employee_gps'
                      ? 'bg-blue-50 text-blue-600 border-blue-100'
                      : r.registered_via === 'hr_manual'
                      ? 'bg-violet-50 text-violet-600 border-violet-100'
                      : 'bg-gray-50 text-gray-500 border-gray-100'
                  }`}>
                    {r.registered_via.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-gray-500">
                  {r.updated_at ? new Date(r.updated_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                </td>
                <td className="py-2.5 px-3">
                  {editing === r.employee_id ? (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleSave(r.employee_id)}
                        disabled={saving}
                        className="h-7 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-medium rounded-lg disabled:opacity-60"
                      >
                        {saving ? <i className="fa-solid fa-circle-notch animate-spin" /> : 'Save'}
                      </button>
                      <button
                        onClick={() => setEditing(null)}
                        className="h-7 px-3 border border-gray-200 hover:bg-gray-50 text-gray-600 text-[11px] rounded-lg"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleStartEdit(r)}
                      className="h-7 px-3 border border-gray-200 hover:bg-gray-50 text-gray-600 text-[11px] rounded-lg transition-colors"
                    >
                      <i className="fa-solid fa-pen mr-1" />Edit
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Tab: Failed Attempts ────────────────────────────────────────────────────────

function FailedAttemptsTab({ reviewerUserId }: { reviewerUserId: string }) {
  const [records,     setRecords]     = useState<GeoAttemptRecord[]>([])
  const [total,       setTotal]       = useState(0)
  const [page,        setPage]        = useState(1)
  const [isLoading,   setIsLoading]   = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [monthFilter, setMonthFilter] = useState(() => new Date().toISOString().slice(0, 7))
  const [empFilter,   setEmpFilter]   = useState('')
  const [showAll,     setShowAll]     = useState(false)

  const PER_PAGE = 20

  const load = useCallback(async (p = 1) => {
    setIsLoading(true)
    setError(null)
    try {
      const { data } = await wfhGeoApi.getGeoAttempts(reviewerUserId, {
        page:        p,
        per_page:    PER_PAGE,
        month:       monthFilter || undefined,
        employee_id: empFilter.trim() || undefined,
        only_failed: !showAll,
      })
      setRecords(data.records)
      setTotal(data.total)
      setPage(p)
    } catch {
      setError('Failed to load geo attempt records.')
    } finally {
      setIsLoading(false)
    }
  }, [reviewerUserId, monthFilter, empFilter, showAll])

  useEffect(() => { load(1) }, [monthFilter, empFilter, showAll])  // eslint-disable-line react-hooks/exhaustive-deps

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 flex items-start gap-2">
        <i className="fa-solid fa-triangle-exclamation text-amber-500 text-[12px] mt-0.5 shrink-0" />
        <p className="text-[12px] text-amber-700">
          Failed attempts are logged when an employee's GPS location falls outside the configured radius.
          No attendance record is created for failed attempts.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="month"
          value={monthFilter}
          onChange={e => setMonthFilter(e.target.value)}
          className="h-9 px-3 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none"
        />
        <input
          type="text"
          placeholder="Filter by Employee ID"
          value={empFilter}
          onChange={e => setEmpFilter(e.target.value)}
          className="h-9 px-3 text-[12px] border border-gray-200 rounded-lg bg-white focus:outline-none w-44"
        />
        <label className="flex items-center gap-2 text-[12px] text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showAll}
            onChange={e => setShowAll(e.target.checked)}
            className="rounded"
          />
          Show all attempts (including successful)
        </label>
        <button
          onClick={() => load(1)}
          className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-[12px] font-medium rounded-lg transition-colors"
        >
          <i className="fa-solid fa-magnifying-glass mr-1.5" />Search
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-[13px] text-red-600">{error}</div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-gray-100">
              {['Employee', 'Attempted At', 'Distance', 'Radius', 'Result', 'Coordinates'].map(h => (
                <th key={h} className="text-left py-2 px-3 font-semibold text-gray-500 text-[11px] uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="py-8 text-center text-gray-400">
                <i className="fa-solid fa-circle-notch animate-spin mr-2" />Loading…
              </td></tr>
            ) : records.length === 0 ? (
              <tr><td colSpan={6} className="py-8 text-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                    <i className="fa-solid fa-circle-check text-emerald-400 text-[16px]" />
                  </div>
                  <p className="text-[13px] text-gray-400">
                    {showAll ? 'No geo attempts recorded' : 'No failed geo attempts — all employees are within radius'}
                  </p>
                </div>
              </td></tr>
            ) : records.map(r => (
              <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="py-2.5 px-3">
                  <p className="font-semibold text-gray-800">{r.employee_name}</p>
                  <p className="text-gray-400 text-[10px]">{r.employee_id}</p>
                </td>
                <td className="py-2.5 px-3 text-gray-700">
                  {r.attempted_at
                    ? new Date(r.attempted_at).toLocaleString('en-IN', {
                        day: '2-digit', month: 'short',
                        hour: '2-digit', minute: '2-digit',
                      })
                    : '—'}
                </td>
                <td className="py-2.5 px-3">
                  {r.distance_meters != null ? (
                    <span className={`font-semibold ${r.within_radius ? 'text-emerald-600' : 'text-red-500'}`}>
                      {Math.round(r.distance_meters)} m
                    </span>
                  ) : '—'}
                </td>
                <td className="py-2.5 px-3 text-gray-500">{r.radius_meters} m</td>
                <td className="py-2.5 px-3">
                  {r.within_radius ? (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-600 border-emerald-100">
                      <i className="fa-solid fa-circle-check mr-1" />Within radius
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-red-50 text-red-600 border-red-100">
                      <i className="fa-solid fa-circle-xmark mr-1" />Outside radius
                    </span>
                  )}
                </td>
                <td className="py-2.5 px-3 font-mono text-gray-400 text-[10px]">
                  {r.latitude != null && r.longitude != null
                    ? `${r.latitude.toFixed(4)}, ${r.longitude.toFixed(4)}`
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-gray-400">{total} record{total !== 1 ? 's' : ''}</span>
          <div className="flex gap-1">
            <button onClick={() => load(page - 1)} disabled={page <= 1 || isLoading}
              className="h-8 px-3 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">
              <i className="fa-solid fa-chevron-left text-[10px]" />
            </button>
            <span className="h-8 px-3 flex items-center text-gray-600">{page} / {totalPages}</span>
            <button onClick={() => load(page + 1)} disabled={page >= totalPages || isLoading}
              className="h-8 px-3 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">
              <i className="fa-solid fa-chevron-right text-[10px]" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}


// ── Tab: Configuration ──────────────────────────────────────────────────────────

function ConfigTab({ reviewerUserId }: { reviewerUserId: string }) {
  const [radius,    setRadius]    = useState<number | null>(null)
  const [input,     setInput]     = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving,  setIsSaving]  = useState(false)
  const [message,   setMessage]   = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => {
    setIsLoading(true)
    wfhGeoApi.getGeoConfig(reviewerUserId)
      .then(({ data }) => {
        setRadius(data.radius_meters)
        setInput(String(data.radius_meters))
      })
      .catch(() => setMessage({ text: 'Failed to load config.', ok: false }))
      .finally(() => setIsLoading(false))
  }, [reviewerUserId])

  const handleSave = async () => {
    const val = parseInt(input, 10)
    if (isNaN(val) || val < 50 || val > 2000) {
      setMessage({ text: 'Radius must be between 50 and 2000 metres.', ok: false })
      return
    }
    setIsSaving(true)
    setMessage(null)
    try {
      await wfhGeoApi.updateGeoConfig(reviewerUserId, val)
      setRadius(val)
      setMessage({ text: `Geo radius updated to ${val} m.`, ok: true })
    } catch {
      setMessage({ text: 'Failed to save. Please try again.', ok: false })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="max-w-md space-y-5">
      <div>
        <h3 className="text-[14px] font-semibold text-gray-800 mb-1">Geo Attendance Radius</h3>
        <p className="text-[12px] text-gray-500">
          Maximum distance (in metres) an employee can be from their registered home location
          for geo attendance to be automatically approved. Recommended: 200–500 m.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-gray-400 text-[13px]">
          <i className="fa-solid fa-circle-notch animate-spin" /> Loading…
        </div>
      ) : (
        <>
          {radius != null && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 text-[13px] text-indigo-700">
              Current radius: <span className="font-bold">{radius} m</span>
            </div>
          )}

          <div className="flex items-center gap-3">
            <input
              type="number"
              min={50}
              max={2000}
              value={input}
              onChange={e => setInput(e.target.value)}
              className="h-10 px-3 border-2 border-gray-200 rounded-xl text-[13px] w-32 focus:outline-none focus:border-indigo-400"
            />
            <span className="text-[13px] text-gray-500">metres</span>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="h-10 px-5 bg-indigo-600 hover:bg-indigo-700 text-white text-[13px] font-semibold rounded-xl disabled:opacity-60 transition-colors"
            >
              {isSaving ? <i className="fa-solid fa-circle-notch animate-spin" /> : 'Save'}
            </button>
          </div>

          <div className="text-[11px] text-gray-400 space-y-1">
            <p>• 200 m — tight (GPS precision ~10 m, good for dense areas)</p>
            <p>• 300 m — <span className="font-semibold">recommended default</span></p>
            <p>• 500 m — lenient (good for rural areas with poorer GPS)</p>
          </div>
        </>
      )}

      {message && (
        <div className={`rounded-xl px-4 py-3 text-[12px] ${message.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
          {message.text}
        </div>
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────────

export default function WfhGeoLogsPage() {
  const { user }       = useAuthStore()
  const reviewerUserId = String(user?.user_id ?? '')
  const [tab, setTab]  = useState<Tab>('logs')

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'logs',   label: 'Geo Attendance Logs',    icon: 'fa-solid fa-list-check'         },
    { id: 'failed', label: 'Failed Attempts',         icon: 'fa-solid fa-triangle-exclamation' },
    { id: 'homes',  label: 'Employee Home Locations', icon: 'fa-solid fa-house'              },
    { id: 'config', label: 'Configuration',           icon: 'fa-solid fa-sliders'            },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#0f172a] flex items-center justify-center shrink-0">
          <i className="fa-solid fa-location-dot text-white text-[13px]" />
        </div>
        <div>
          <h1 className="text-[18px] font-bold text-gray-900 leading-tight">WFH Geo Attendance</h1>
          <p className="text-[12px] text-gray-400">
            View geo attendance logs, manage employee home locations, and configure the geo radius.
          </p>
        </div>
      </div>

      {/* Stats banner */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-5 py-4">
        <div className="flex items-center gap-3">
          <i className="fa-solid fa-circle-info text-indigo-500" />
          <p className="text-[12px] text-indigo-700">
            Geo attendance is <strong>automatically approved</strong> — no HR review required.
            Employees must be within the configured radius of their registered home location.
          </p>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium border-b-2 transition-colors -mb-px ${
              tab === t.id
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <i className={`${t.icon} text-[11px]`} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        {tab === 'logs'    && <GeoLogsTab          reviewerUserId={reviewerUserId} />}
        {tab === 'failed'  && <FailedAttemptsTab   reviewerUserId={reviewerUserId} />}
        {tab === 'homes'   && <HomeLocationsTab    reviewerUserId={reviewerUserId} />}
        {tab === 'config'  && <ConfigTab           reviewerUserId={reviewerUserId} />}
      </div>
    </div>
  )
}
