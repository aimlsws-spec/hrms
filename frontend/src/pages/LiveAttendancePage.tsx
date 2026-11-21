/**
 * LiveAttendancePage
 *
 * Real-time punch-log dashboard that mirrors the UltraIDMS live view.
 * Polling starts automatically when the component mounts and stops when
 * it unmounts — no manual start/stop needed.
 *
 * Route: /biometric/live  (admin & hr only — see routes/index.tsx)
 */
import { useLiveAttendance } from '../hooks/biometric/useLiveAttendance'
import LiveAttendanceTable   from '../components/biometric/LiveAttendanceTable'
import SyncStatusCard        from '../components/biometric/SyncStatusCard'

export default function LiveAttendancePage() {
  const { records, isConnected, error } = useLiveAttendance(5_000)

  // Quick stats derived from the in-memory record list
  const todayCount  = records.filter(r => {
    const d = new Date(r.io_time)
    return d.toDateString() === new Date().toDateString()
  }).length

  const uniqueUsers = new Set(records.map(r => r.user_id)).size

  return (
    <div className="space-y-5 max-w-5xl mx-auto">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Live Attendance</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Real-time punch log from biometric devices · auto-refreshes every 5 s
          </p>
        </div>

        {/* Quick-stat pills */}
        <div className="hidden sm:flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full">
            <i className="fas fa-calendar-day" />
            <span>{todayCount} today</span>
          </div>
          <div className="flex items-center gap-1.5 bg-purple-50 text-purple-700 text-xs font-semibold px-3 py-1.5 rounded-full">
            <i className="fas fa-users" />
            <span>{uniqueUsers} unique</span>
          </div>
        </div>
      </div>

      {/* ── Sync health card (reuses existing component) ─────────────────── */}
      <SyncStatusCard />

      {/* ── Live feed table ───────────────────────────────────────────────── */}
      <LiveAttendanceTable
        records={records}
        isConnected={isConnected}
        error={error}
        tableHeight="460px"
      />

      {/* ── Usage hint ───────────────────────────────────────────────────── */}
      <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-sm text-blue-700 flex gap-3">
        <i className="fas fa-circle-info mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold mb-0.5">How this works</p>
          <p className="text-blue-600 text-xs leading-relaxed">
            This view polls the biometric device database directly every 5 seconds.
            New punches appear at the top with a green highlight.
            Records are limited to the 50 most recent punches to keep the view
            snappy — use the <strong>Attendance</strong> page for historical reports.
          </p>
        </div>
      </div>

    </div>
  )
}
