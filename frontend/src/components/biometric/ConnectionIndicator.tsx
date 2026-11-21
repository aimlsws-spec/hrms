/**
 * ConnectionIndicator — three-state dot that reflects live poll health.
 *
 *  null  → amber pulse  (initial fetch in progress)
 *  true  → green pulse  (last poll succeeded)
 *  false → red static   (last poll failed / timed out)
 */
interface Props {
  status: boolean | null
  lastError?: string | null
}

export default function ConnectionIndicator({ status, lastError }: Props) {
  if (status === null) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
        </span>
        Connecting…
      </span>
    )
  }

  if (status) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        Live
      </span>
    )
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600"
      title={lastError ?? 'Connection failed'}
    >
      {/* Static dot — no pulse to signal that polling has stopped */}
      <span className="inline-flex h-2 w-2 rounded-full bg-red-500" />
      Disconnected
    </span>
  )
}
