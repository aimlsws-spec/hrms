import client from './client'

// ── Types ──────────────────────────────────────────────────────────────────────

export type AttendanceMethod = 'SELFIE' | 'GEO'

export interface WfhStatus {
  has_session:          boolean
  wfh_id?:              number
  status?:              WfhSessionStatus
  attendance_method?:   AttendanceMethod
  punch_in_at?:         string
  punch_out_at?:        string
  selfie_captured?:     boolean
  geo_distance_meters?: number | null
}

// ── Geo types ──────────────────────────────────────────────────────────────────

export interface HomeLocation {
  found:          boolean
  id?:            number
  employee_id?:   string
  latitude?:      number
  longitude?:     number
  address_label?: string | null
  registered_via?: 'employee_gps' | 'hr_manual' | 'geocoded'
  updated_by?:    string | null
  updated_at?:    string | null
}

export interface GeoCheckinPayload {
  employee_id:      string
  latitude:         number
  longitude:        number
  idempotency_key:  string
  client_timestamp?: string
}

export interface GeoCheckinResult {
  success:          boolean
  within_radius?:   boolean
  distance_meters?: number
  radius_meters?:   number
  wfh_id?:          number
  status?:          string
  attendance_method?: AttendanceMethod
  punch_in_at?:     string
  message?:         string
  duplicate?:       boolean
}

export interface GeoCheckoutPayload {
  employee_id:       string
  latitude:          number
  longitude:         number
  client_timestamp?: string
}

export interface GeoCheckoutResult {
  success:           boolean
  within_radius?:    boolean
  distance_meters?:  number
  radius_meters?:    number
  punch_out_at?:     string
  duration_minutes?: number
  message?:          string
}

export interface GeoRecord {
  id:                  number
  punch_in_at:         string
  punch_out_at:        string | null
  duration_minutes:    number | null
  status:              WfhSessionStatus
  geo_latitude:        number | null
  geo_longitude:       number | null
  geo_distance_meters: number | null
}

export interface HrGeoRecord {
  id:                  number
  employee_id:         string
  employee_name:       string
  department:          string
  job_title:           string
  punch_in_at:         string
  punch_out_at:        string | null
  duration_minutes:    number | null
  status:              WfhSessionStatus
  geo_latitude:        number | null
  geo_longitude:       number | null
  geo_distance_meters: number | null
}

export interface HrGeoListResponse {
  success:     boolean
  records:     HrGeoRecord[]
  total:       number
  page:        number
  per_page:    number
  total_pages: number
}

export interface HrHomeLocationRecord {
  id:             number
  employee_id:    string
  employee_name:  string
  department:     string
  latitude:       number
  longitude:      number
  address_label:  string | null
  registered_via: string
  updated_by:     string | null
  updated_at:     string | null
}

export interface HrHomeLocationsResponse {
  success:     boolean
  records:     HrHomeLocationRecord[]
  total:       number
  page:        number
  per_page:    number
  total_pages: number
}

// ── Home location change request types ────────────────────────────────────────

export interface HomeLocationChangeRequest {
  found:         boolean
  id?:           number
  employee_id?:  string
  latitude?:     number
  longitude?:    number
  address_label?: string | null
  reason?:       string | null
  status?:       'pending' | 'approved' | 'rejected'
  hr_comment?:   string | null
  reviewed_by?:  string | null
  reviewed_at?:  string | null
  created_at?:   string | null
}

export interface HrLocationRequest {
  id:                  number
  employee_id:         string
  employee_name:       string
  department:          string
  requested_latitude:  number
  requested_longitude: number
  requested_address:   string | null
  reason:              string | null
  status:              'pending' | 'approved' | 'rejected'
  hr_comment:          string | null
  reviewed_by:         string | null
  reviewed_at:         string | null
  created_at:          string | null
  current_address:     string | null
  current_latitude:    number | null
  current_longitude:   number | null
}

export interface HrLocationRequestsResponse {
  success:     boolean
  records:     HrLocationRequest[]
  total:       number
  page:        number
  per_page:    number
  total_pages: number
}

export interface GeoAttemptRecord {
  id:              number
  employee_id:     string
  employee_name:   string
  department:      string
  attempted_at:    string
  latitude:        number | null
  longitude:       number | null
  home_latitude:   number | null
  home_longitude:  number | null
  distance_meters: number | null
  radius_meters:   number
  within_radius:   boolean
  wfh_id:          number | null
}

export type WfhSessionStatus =
  | 'PENDING_SELFIE'
  | 'AUTO_APPROVED'
  | 'FLAGGED'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'

export interface WfhCheckinPayload {
  idempotency_key:  string
  client_timestamp: string
}

export interface WfhRecord {
  id:                  number
  punch_in_at:         string
  punch_out_at:        string | null
  duration_minutes:    number | null
  status:              WfhSessionStatus
  flag_reason:         string | null
  attendance_method:   AttendanceMethod
  geo_distance_meters: number | null
  selfie_captured:     boolean
  selfie_status:       string | null
}

export interface SelfieUploadResult {
  success:   boolean
  selfie_id?: number
  status?:   string
  notice?:   string
  message?:  string
}

export interface HrReviewRecord {
  wfh_id:          number
  employee_id:     string
  employee_name:   string
  department:      string
  job_title:       string
  punch_in_at:     string
  punch_out_at:    string | null
  wfh_status:      WfhSessionStatus
  flag_reason:     string | null
  selfie_id:       number
  capture_type:    string
  captured_at:     string
  file_size_bytes: number
}

export interface HrReviewListResponse {
  success:     boolean
  records:     HrReviewRecord[]
  total:       number
  page:        number
  per_page:    number
  total_pages: number
}

// ── API client ─────────────────────────────────────────────────────────────────

export const wfhApi = {

  /** Employee: get today's WFH session status */
  getStatus: (employeeId: string) =>
    client.get<WfhStatus>('/wfh/status', { params: { employee_id: employeeId } }),

  /** Employee: punch in */
  checkin: (employeeId: string, payload: WfhCheckinPayload) =>
    client.post<{ success: boolean; wfh_id?: number; status?: string; message?: string }>(
      '/wfh/checkin',
      { employee_id: employeeId, ...payload },
    ),

  /** Employee: punch out */
  checkout: (employeeId: string) =>
    client.post<{ success: boolean; punch_out_at?: string; duration_minutes?: number }>(
      '/wfh/checkout',
      { employee_id: employeeId },
    ),

  /** Employee: upload selfie */
  uploadSelfie: (
    wfhId:      number,
    employeeId: string,
    imageBlob:  Blob,
    opts?: { captureType?: string; captureAttempts?: number; cameraLabel?: string },
  ) => {
    const form = new FormData()
    form.append('wfh_id',           String(wfhId))
    form.append('employee_id',      employeeId)
    form.append('capture_type',     opts?.captureType     ?? 'checkin')
    form.append('capture_attempts', String(opts?.captureAttempts ?? 1))
    if (opts?.cameraLabel) form.append('camera_label', opts.cameraLabel)
    form.append('file', imageBlob, 'selfie.jpg')
    return client.post<SelfieUploadResult>('/wfh/selfie/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30_000,
    })
  },

  /** Employee / HR: WFH history for an employee */
  getHistory: (employeeId: string, month?: string) =>
    client.get<{ success: boolean; records: WfhRecord[] }>(
      `/wfh/history/${employeeId}`,
      { params: month ? { month } : undefined },
    ),

  /** HR only: review queue */
  getReviewList: (reviewerUserId: string, params?: { status?: string; page?: number; per_page?: number }) =>
    client.get<HrReviewListResponse>('/wfh/selfie/review', {
      params: { reviewer_user_id: reviewerUserId, ...params },
    }),

  /** HR only: view selfie image — returns image bytes fetched via authenticated fetch() */
  getSelfieImageUrl: (selfieId: number, reviewerUserId: string) =>
    `/api/wfh/selfie/${selfieId}?reviewer_user_id=${encodeURIComponent(reviewerUserId)}`,

  /** HR only: approve or reject */
  selfieAction: (selfieId: number, reviewerUserId: string, action: 'approve' | 'reject', comment: string) =>
    client.post<{ success: boolean; new_status?: string }>(
      `/wfh/selfie/${selfieId}/action`,
      { reviewer_user_id: reviewerUserId, action, comment },
    ),
}

// ── Geo attendance API ─────────────────────────────────────────────────────────

export const wfhGeoApi = {

  /** Employee / HR: get registered home location for an employee */
  getHomeLocation: (employeeId: string) =>
    client.get<HomeLocation>(`/wfh/home-location/${employeeId}`),

  /** Employee: register home location via GPS. HR: set manually (requires reviewerUserId). */
  setHomeLocation: (
    employeeId:    string,
    latitude:      number,
    longitude:     number,
    opts?: { addressLabel?: string; registeredVia?: 'employee_gps' | 'hr_manual'; reviewerUserId?: string },
  ) =>
    client.post<{ success: boolean; message?: string }>(
      '/wfh/home-location',
      {
        employee_id:      employeeId,
        latitude,
        longitude,
        address_label:    opts?.addressLabel    ?? null,
        registered_via:   opts?.registeredVia   ?? 'employee_gps',
        reviewer_user_id: opts?.reviewerUserId  ?? null,
      },
    ),

  /** Employee: geo-based WFH check-in */
  geoCheckin: (payload: GeoCheckinPayload) =>
    client.post<GeoCheckinResult>('/wfh/geo-checkin', payload),

  /** Employee: geo-based WFH punch-out (validates location, closes session) */
  geoCheckout: (payload: GeoCheckoutPayload) =>
    client.post<GeoCheckoutResult>('/wfh/geo-checkout', payload),

  /** Employee: geo WFH history (optional month filter YYYY-MM) */
  getGeoHistory: (employeeId: string, month?: string) =>
    client.get<{ success: boolean; records: GeoRecord[] }>(
      `/wfh/geo-history/${employeeId}`,
      { params: month ? { month } : undefined },
    ),

  // ── HR-only ──

  /** HR: get configured geo radius */
  getGeoConfig: (reviewerUserId: string) =>
    client.get<{ success: boolean; radius_meters: number }>(
      '/hr/geo-config',
      { params: { reviewer_user_id: reviewerUserId } },
    ),

  /** HR: update geo radius (50–2000 m) */
  updateGeoConfig: (reviewerUserId: string, radiusMeters: number) =>
    client.put<{ success: boolean; radius_meters: number }>(
      '/hr/geo-config',
      { reviewer_user_id: reviewerUserId, radius_meters: radiusMeters },
    ),

  /** HR: paginated geo attendance logs */
  getGeoAttendance: (
    reviewerUserId: string,
    params?: { page?: number; per_page?: number; month?: string; employee_id?: string },
  ) =>
    client.get<HrGeoListResponse>('/hr/geo-attendance', {
      params: { reviewer_user_id: reviewerUserId, ...params },
    }),

  /** HR: list all employee home locations */
  getHomeLocations: (reviewerUserId: string, params?: { page?: number; per_page?: number }) =>
    client.get<HrHomeLocationsResponse>('/hr/home-locations', {
      params: { reviewer_user_id: reviewerUserId, ...params },
    }),

  /** HR: geo attempt logs (failed by default; pass onlyFailed=false for all) */
  getGeoAttempts: (
    reviewerUserId: string,
    params?: { page?: number; per_page?: number; month?: string; employee_id?: string; only_failed?: boolean },
  ) =>
    client.get<{
      success: boolean; records: GeoAttemptRecord[]; total: number
      page: number; per_page: number; total_pages: number
    }>('/hr/geo-failed-attempts', {
      params: { reviewer_user_id: reviewerUserId, ...params },
    }),

  /** Geocode a text address and store as employee home location (HR use) */
  geocodeAndSetHomeLocation: (employeeId: string, address: string, reviewerUserId?: string) =>
    client.post<{ success: boolean; geocoded: boolean; message?: string }>(
      '/wfh/home-location/from-address',
      { employee_id: employeeId, address, reviewer_user_id: reviewerUserId ?? null },
    ),

  // ── Home location change request (employee-side) ──

  /** Employee: submit a request to change their registered home location */
  submitChangeRequest: (
    employeeId: string,
    latitude:   number,
    longitude:  number,
    opts?: { addressLabel?: string; reason?: string },
  ) =>
    client.post<{ success: boolean; request_id?: number; message?: string }>(
      '/wfh/home-location/change-request',
      {
        employee_id:   employeeId,
        latitude,
        longitude,
        address_label: opts?.addressLabel ?? null,
        reason:        opts?.reason       ?? null,
      },
    ),

  /** Employee: get the status of their latest home-location change request */
  getChangeRequestStatus: (employeeId: string) =>
    client.get<HomeLocationChangeRequest>(
      `/wfh/home-location/change-request/status/${employeeId}`,
    ),

  // ── Home location change request (HR-side) ──

  /** HR: paginated list of home-location change requests */
  getLocationChangeRequests: (
    reviewerUserId: string,
    params?: { status?: string; page?: number; per_page?: number },
  ) =>
    client.get<HrLocationRequestsResponse>('/hr/home-location-requests', {
      params: { reviewer_user_id: reviewerUserId, ...params },
    }),

  /** HR: approve or reject a home-location change request */
  actionLocationChangeRequest: (
    requestId:      number,
    reviewerUserId: string,
    action:         'approve' | 'reject',
    hrComment?:     string,
  ) =>
    client.post<{ success: boolean; status?: string; message?: string }>(
      `/hr/home-location-requests/${requestId}/action`,
      { reviewer_user_id: reviewerUserId, action, hr_comment: hrComment ?? null },
    ),
}
