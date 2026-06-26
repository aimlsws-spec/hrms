import { useState, useEffect, useCallback, useRef } from 'react'
import { biometricApi } from '../../api/biometricApi'
import type { LiveAttendanceRecord } from '../../types/biometric'

/** Internal record type — adds stable key + animation flag to the API shape. */
export interface DisplayRecord extends LiveAttendanceRecord {
  /** Stable React key: user_id + device_id + io_time */
  _key:   string
  /** True for ~1.4 s after the row is first prepended, then cleared. */
  _isNew: boolean
}

const MAX_RECORDS = 50
const ANIMATION_DURATION_MS = 1_500

/**
 * Polls GET /api/attendance/live on the given interval (default 5 s).
 *
 * Optimisation: after the first fetch, every subsequent call sends
 * `since=<last_io_time>` so the API returns only NEW punches — no
 * wasted bandwidth re-downloading records the UI already has.
 *
 * `lastSeenRef` is a plain ref (not state) so changing it inside `poll`
 * never triggers a re-render or resets the interval timer.
 *
 * Usage:
 *   const { records, isConnected, error } = useLiveAttendance()
 */
export function useLiveAttendance(pollIntervalMs = 5_000) {
  const [records,     setRecords]     = useState<DisplayRecord[]>([])
  const [isConnected, setIsConnected] = useState<boolean | null>(null) // null = initialising
  const [error,       setError]       = useState<string | null>(null)

  // Refs live outside React's render cycle — safe to read/write inside callbacks
  const lastSeenRef = useRef<string | null>(null)
  const isFirstPoll = useRef(true)

  const poll = useCallback(async () => {
    try {
      const res      = await biometricApi.getLiveAttendance(MAX_RECORDS, lastSeenRef.current ?? undefined)
      const incoming = res.data.records

      if (incoming.length > 0) {
        // Newest record is index 0 (ORDER BY io_time DESC from the API)
        lastSeenRef.current = incoming[0].io_time

        const firstBatch = isFirstPoll.current
        isFirstPoll.current = false

        const newRows: DisplayRecord[] = incoming.map(r => ({
          ...r,
          _key:   `${r.user_id}-${r.device_id}-${r.io_time}`,
          // Don't animate the initial bulk load — only subsequent incremental arrivals
          _isNew: !firstBatch,
        }))

        setRecords(prev => {
          // Guard against duplicates that can appear when two polls overlap
          const existing = new Set(prev.map(r => r._key))
          const unique   = newRows.filter(r => !existing.has(r._key))
          if (unique.length === 0) return prev
          // Prepend newest records; cap total to MAX_RECORDS to prevent DOM bloat
          return [...unique, ...prev].slice(0, MAX_RECORDS)
        })

        // Remove the highlight class after the CSS animation finishes
        if (!firstBatch) {
          setTimeout(
            () => setRecords(prev => prev.map(r => ({ ...r, _isNew: false }))),
            ANIMATION_DURATION_MS,
          )
        }
      } else {
        // Even an empty response means the server is reachable
        isFirstPoll.current = false
      }

      setIsConnected(true)
      setError(null)
    } catch (err) {
      setIsConnected(false)
      setError(err instanceof Error ? err.message : 'Polling failed')
    }
  }, []) // no deps — lastSeenRef and isFirstPoll are refs, not state

  useEffect(() => {
    poll() // immediate fetch on mount
    const id = setInterval(poll, pollIntervalMs)
    return () => clearInterval(id)
  }, [poll, pollIntervalMs])

  return { records, isConnected, error }
}
