export interface BiometricMapping {
  id: number
  enroll_id: string
  device_id: string
  employee_id: string
  employee_name?: string
  department?: string
  is_active: number
  mapped_by?: string
  mapped_at?: string
  notes?: string
}

export interface UnmappedEnroll {
  enroll_id: string
  device_id: string
  punch_count: number
  last_punch?: string
  first_punch?: string
}

export interface SyncHealth {
  device_id: string
  last_sync?: string
  minutes_ago?: number
  last_status: string
  health: 'GREEN' | 'AMBER' | 'RED'
}

export interface SyncLogEntry {
  device_id: string
  sync_start?: string
  sync_end?: string
  records_fetched: number
  records_new: number
  status: string
  error_detail?: string
}

export interface BiometricStats {
  total_punches: number
  unique_enrolls: number
  mapped: number
  unmapped: number
  today_punches: number
}

// Live attendance feed — returned by GET /api/attendance/live
export interface LiveAttendanceRecord {
  user_id:    string
  first_name: string | null
  last_name:  string | null
  full_name:  string          // derived server-side: "First Last" or "Unknown (ID: x)"
  io_time:    string          // ISO-8601 datetime string
  device_id:  string
}

export interface LiveAttendanceResponse {
  success:     boolean
  count:       number
  records:     LiveAttendanceRecord[]
  fetched_at:  string
  query_since: string | null
  has_more:    boolean        // true when count === requested limit
}
