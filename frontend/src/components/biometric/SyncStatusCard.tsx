import { useSyncStatus } from '../../hooks/biometric/useSyncStatus'

const healthDot: Record<string, string> = {
  GREEN: 'bg-green-400',
  AMBER: 'bg-yellow-400',
  RED:   'bg-red-500',
}

const healthLabel: Record<string, string> = {
  GREEN: 'Live',
  AMBER: 'Delayed',
  RED:   'Error',
}

export default function SyncStatusCard() {
  const { health, stats, triggering, triggerSync } = useSyncStatus()

  const primary = health[0]

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <i className="fas fa-fingerprint text-primary-600 text-lg" />
          <span className="font-semibold text-gray-800 text-sm">Biometric Sync</span>
        </div>
        <button
          onClick={triggerSync}
          disabled={triggering}
          className="text-xs px-3 py-1.5 rounded-lg bg-primary-50 text-primary-700 hover:bg-primary-100
                     font-medium transition-colors disabled:opacity-50"
        >
          {triggering ? 'Syncing…' : 'Sync Now'}
        </button>
      </div>

      {/* Health badge */}
      {primary && (
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${healthDot[primary.health] ?? 'bg-gray-400'} animate-pulse`} />
          <span className="text-sm font-medium text-gray-700">
            {healthLabel[primary.health] ?? primary.health}
          </span>
          {primary.minutes_ago != null && (
            <span className="text-xs text-gray-400 ml-1">
              · last sync {primary.minutes_ago}m ago
            </span>
          )}
          {primary.last_status === 'FAILED' && (
            <span className="ml-auto text-xs text-red-600 font-medium">Check logs</span>
          )}
        </div>
      )}

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-4 gap-2 pt-1 border-t border-gray-100">
          {[
            { label: 'Today',    value: stats.today_punches },
            { label: 'Total',    value: stats.total_punches },
            { label: 'Mapped',   value: stats.mapped },
            { label: 'Unmapped', value: stats.unmapped, warn: stats.unmapped > 0 },
          ].map(({ label, value, warn }) => (
            <div key={label} className="text-center">
              <p className={`text-lg font-bold ${warn ? 'text-amber-600' : 'text-gray-800'}`}>
                {value}
              </p>
              <p className="text-[11px] text-gray-400">{label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
