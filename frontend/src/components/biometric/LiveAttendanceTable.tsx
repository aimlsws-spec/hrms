import type { DisplayRecord } from '../../hooks/biometric/useLiveAttendance'
import ConnectionIndicator from './ConnectionIndicator'

// ── Formatting helpers ────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour:   '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

function formatDate(iso: string): string {
  const d     = new Date(iso)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return 'Today'
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

/** Shortens a long device ID for compact display — e.g. "C2622C67…1B36" */
function shortDevice(id: string): string {
  return id.length > 10 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  records:     DisplayRecord[]
  isConnected: boolean | null
  error:       string | null
  /** Total height of the scrollable record area (Tailwind arbitrary value). Default: 420px */
  tableHeight?: string
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LiveAttendanceTable({
  records,
  isConnected,
  error,
  tableHeight = '420px',
}: Props) {

  const lastUpdate = records.length > 0
    ? `Last punch: ${formatTime(records[0].io_time)}`
    : 'Waiting for punches…'

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">

      {/* ── Card header ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2.5">
          <i className="fas fa-satellite-dish text-primary-600 text-sm" />
          <span className="text-sm font-semibold text-gray-800">Live Attendance Feed</span>
          <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-primary-100 text-primary-700">
            {records.length}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <span className="hidden sm:block text-xs text-gray-400 italic">{lastUpdate}</span>
          <ConnectionIndicator status={isConnected} lastError={error} />
        </div>
      </div>

      {/* ── Error banner (only when disconnected) ──────────────────────── */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border-b border-red-100 text-xs text-red-700">
          <i className="fas fa-circle-exclamation shrink-0" />
          <span className="truncate">{error}</span>
        </div>
      )}

      {/* ── Scrollable log area ─────────────────────────────────────────── */}
      <div style={{ height: tableHeight }} className="overflow-y-auto overscroll-contain">
        {records.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
            {isConnected === null ? (
              <>
                <i className="fas fa-spinner fa-spin text-2xl text-primary-400" />
                <p className="text-sm">Fetching live punches…</p>
              </>
            ) : (
              <>
                <i className="fas fa-clock text-2xl" />
                <p className="text-sm">No punch records yet today</p>
                <p className="text-xs text-gray-300">New punches appear here automatically</p>
              </>
            )}
          </div>
        ) : (
          <table className="w-full text-xs">
            {/* Sticky header — stays visible while scrolling */}
            <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left font-semibold text-gray-500 px-4 py-2 w-28">Time</th>
                <th className="text-left font-semibold text-gray-500 px-3 py-2">Name</th>
                <th className="text-left font-semibold text-gray-500 px-3 py-2 w-16">ID</th>
                <th className="text-left font-semibold text-gray-500 px-3 py-2 w-28 hidden sm:table-cell">Device</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {records.map(rec => (
                <tr
                  key={rec._key}
                  /**
                   * `row-new` is defined in globals.css as a @keyframes animation.
                   * It plays once — slides the row in from slightly above and
                   * fades from green-100 to transparent over 1.4 s.
                   * The class is removed after ANIMATION_DURATION_MS in the hook.
                   */
                  className={`transition-colors hover:bg-gray-50 ${rec._isNew ? 'row-new' : ''}`}
                >
                  {/* Time column — shows date only if it's not today */}
                  <td className="px-4 py-2.5 font-mono text-gray-700 whitespace-nowrap">
                    <span className="font-semibold">{formatTime(rec.io_time)}</span>
                    {formatDate(rec.io_time) !== 'Today' && (
                      <span className="block text-gray-400 text-[10px]">{formatDate(rec.io_time)}</span>
                    )}
                  </td>

                  {/* Name column */}
                  <td className="px-3 py-2.5 text-gray-800">
                    {rec.first_name || rec.last_name ? (
                      <span className="font-medium">{rec.full_name}</span>
                    ) : (
                      <span className="text-gray-400 italic">{rec.full_name}</span>
                    )}
                  </td>

                  {/* User ID */}
                  <td className="px-3 py-2.5 font-mono text-gray-500">{rec.user_id}</td>

                  {/* Device ID (hidden on small screens) */}
                  <td className="px-3 py-2.5 text-gray-400 hidden sm:table-cell">
                    <span title={rec.device_id}>{shortDevice(rec.device_id)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 flex items-center justify-between text-[11px] text-gray-400">
        <span>Showing {records.length} of last 50 records · polling every 5 s</span>
        {records.length === 50 && (
          <span className="text-amber-500 font-medium">
            <i className="fas fa-triangle-exclamation mr-1" />
            50-record limit reached
          </span>
        )}
      </div>

    </div>
  )
}
