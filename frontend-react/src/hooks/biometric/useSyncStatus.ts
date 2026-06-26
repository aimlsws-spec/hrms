import { useState, useEffect, useCallback } from 'react'
import { biometricApi } from '../../api/biometricApi'
import type { SyncHealth, SyncLogEntry } from '../../types/biometric'

export function useSyncStatus(autoRefreshMs = 30_000) {
  const [health, setHealth]       = useState<SyncHealth[]>([])
  const [log, setLog]             = useState<SyncLogEntry[]>([])
  const [stats, setStats]         = useState<{
    total_punches: number; today_punches: number; unmapped: number; mapped: number
  } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [triggering, setTriggering] = useState(false)

  const fetchStatus = useCallback(async () => {
    setIsLoading(true)
    try {
      const [statusRes, statsRes] = await Promise.all([
        biometricApi.getSyncStatus(),
        biometricApi.getStats(),
      ])
      setHealth(statusRes.data.health ?? [])
      setLog(statusRes.data.log ?? [])
      const s = statsRes.data
      setStats({
        total_punches:  s.total_punches,
        today_punches:  s.today_punches,
        unmapped:       s.unmapped,
        mapped:         s.mapped,
      })
    } catch { /* silent — status card shows stale */ }
    finally { setIsLoading(false) }
  }, [])

  useEffect(() => {
    fetchStatus()
    const id = setInterval(fetchStatus, autoRefreshMs)
    return () => clearInterval(id)
  }, [fetchStatus, autoRefreshMs])

  const triggerSync = useCallback(async () => {
    setTriggering(true)
    try {
      await biometricApi.triggerSync()
      await fetchStatus()
    } finally {
      setTriggering(false)
    }
  }, [fetchStatus])

  return { health, log, stats, isLoading, triggering, triggerSync, refetch: fetchStatus }
}
