import client from './client'
import type {
  BiometricMapping,
  UnmappedEnroll,
  SyncHealth,
  SyncLogEntry,
  BiometricStats,
  LiveAttendanceResponse,
} from '../types/biometric'

interface MappingsResponse  { success: boolean; mappings: BiometricMapping[]; count: number }
interface UnmappedResponse  { success: boolean; unmapped: UnmappedEnroll[];   count: number }
interface SyncStatusResponse { success: boolean; health: SyncHealth[]; log: SyncLogEntry[] }
interface StatsResponse extends BiometricStats { success: boolean }
interface ActionResponse    { success: boolean; message?: string; mapping_id?: number }

function roleHeaders() {
  try {
    const raw = localStorage.getItem('hrms_user')
    if (raw) {
      const parsed = JSON.parse(raw)
      // Zustand persist wraps data under { state: { user: {...} } }
      const u = parsed?.state?.user ?? parsed
      return { 'X-User-Role': u?.role ?? '', 'X-User-Id': String(u?.user_id ?? '') }
    }
  } catch { /* ignore */ }
  return {}
}

export const biometricApi = {
  // Sync
  triggerSync: (device_id?: string, lookback_hours?: number) =>
    client.post<ActionResponse>('/biometric/sync/trigger', { device_id, lookback_hours }, { headers: roleHeaders() }),

  getSyncStatus: () =>
    client.get<SyncStatusResponse>('/biometric/sync/status'),

  // Mappings
  getMappings: (include_inactive = false) =>
    client.get<MappingsResponse>('/biometric/mappings', {
      params: { include_inactive },
      headers: roleHeaders(),
    }),

  getUnmapped: () =>
    client.get<UnmappedResponse>('/biometric/unmapped', { headers: roleHeaders() }),

  createMapping: (enroll_id: string, device_id: string, employee_id: string, notes?: string) =>
    client.post<ActionResponse>('/biometric/mappings', { enroll_id, device_id, employee_id, notes }, { headers: roleHeaders() }),

  updateMapping: (id: number, data: { employee_id?: string; is_active?: number; notes?: string }) =>
    client.put<ActionResponse>(`/biometric/mappings/${id}`, data, { headers: roleHeaders() }),

  deactivateMapping: (id: number) =>
    client.put<ActionResponse>(`/biometric/mappings/${id}`, { is_active: 0 }, { headers: roleHeaders() }),

  // Stats
  getStats: () =>
    client.get<StatsResponse>('/biometric/stats'),

  // Live attendance feed — polls GET /api/attendance/live
  getLiveAttendance: (limit = 50, since?: string) =>
    client.get<LiveAttendanceResponse>('/attendance/live', {
      params: {
        limit,
        // Only include `since` when provided — omitting it fetches the initial batch
        ...(since ? { since } : {}),
      },
    }),

  // Phase 4: manually trigger punch → attendance conversion
  triggerProcessing: () =>
    client.post<{
      success:             boolean
      auto_provisioned:    number
      processed_punches:   number
      attendance_created:  number
      attendance_updated:  number
      skipped_protected:   number
      errors:              number
      triggered_at:        string
    }>('/biometric/process/trigger', {}, { headers: roleHeaders() }),
}
