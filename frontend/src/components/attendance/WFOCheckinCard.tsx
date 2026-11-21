import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import type { DailyWorkMode } from './WorkModeSelector'

interface Props {
  employeeId: string
  workMode: DailyWorkMode
  onSuccess: (updated: DailyWorkMode) => void
}

interface PunchPreview {
  found:       boolean
  first_punch: string | null
  is_late:     boolean
  source:      'HRMS_SYNC' | 'IDMS_DIRECT' | null
  reason?:     string
}

/**
 * WFOCheckinCard - For Work From Office employees
 * 
 * This component displays the employee's biometric enrollment information
 * and auto-processes attendance when a biometric punch is detected.
 * 
 * The biometric enrollment ID is loaded from the employee profile (set during
 * onboarding/signup) and is NEVER editable by the employee.
 * 
 * If no biometric enrollment ID is assigned, the employee sees a message
 * instructing them to contact HR.
 */
export default function WFOCheckinCard({ employeeId, workMode, onSuccess }: Props) {
  const [preview,         setPreview]          = useState<PunchPreview | null>(null)
  const [previewLoading,  setPreviewLoading]   = useState(false)
  const [autoProcessing,  setAutoProcessing]   = useState(false)
  const [error,           setError]            = useState<string | null>(null)

  const autoSubmittedRef = useRef(false)
  const previewTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null)

  // Get biometric enrollment ID from employee profile (loaded during onboarding)
  // This is read-only - employees cannot modify it
  const biometricEnrollmentId = workMode.biometric_user_id

  const fmt = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'

  const fetchPreview = () => {
    setPreviewLoading(true)
    axios.get(`/api/attendance/wfo-punch-preview/${employeeId}`)
      .then(({ data }) => setPreview(data))
      .catch(() => setPreview(null))
      .finally(() => setPreviewLoading(false))
  }

  useEffect(() => {
    fetchPreview()
    previewTimerRef.current = setInterval(fetchPreview, 30_000)
    return () => { if (previewTimerRef.current) clearInterval(previewTimerRef.current) }
  }, [employeeId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-submit when punch is detected and biometric ID is registered
  useEffect(() => {
    if (
      !autoSubmittedRef.current &&
      preview?.found &&
      workMode.status !== 'PRESENT' &&
      !autoProcessing &&
      biometricEnrollmentId
    ) {
      autoSubmittedRef.current = true
      handleAutoCheckin(biometricEnrollmentId)
    }
  }, [preview?.found, workMode.status, autoProcessing, biometricEnrollmentId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAutoCheckin = async (id: string) => {
    setAutoProcessing(true)
    setError(null)
    try {
      const { data } = await axios.post('/api/attendance/wfo-checkin', {
        employee_id:       employeeId,
        biometric_user_id: id,
      })
      if (data.success) {
        onSuccess(data.data)
      } else {
        setError(data.message || 'Could not record attendance — will retry automatically.')
        autoSubmittedRef.current = false
      }
    } catch (e: unknown) {
      setError((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Server error — will retry on refresh.')
      autoSubmittedRef.current = false
    } finally {
      setAutoProcessing(false)
    }
  }

  // ✅ Already checked in — show attendance recorded card
  if (workMode.status === 'PRESENT') {
    return (
      <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-5 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center shrink-0">
            <i className="fa-solid fa-circle-check text-white text-[15px]" />
          </div>
          <div>
            <p className="text-[14px] font-bold text-gray-800">WFO Attendance Recorded</p>
            <p className="text-[11px] text-gray-500">Linked to your biometric punch — no action needed</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white rounded-xl px-3 py-2.5 border border-gray-100 text-center">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Check In</p>
            <p className="text-[15px] font-bold text-gray-800 mt-0.5">{fmt(workMode.checked_in_at)}</p>
          </div>
          <div className="bg-white rounded-xl px-3 py-2.5 border border-gray-100 text-center">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Method</p>
            <p className="text-[13px] font-bold text-gray-800 mt-0.5">Biometric</p>
          </div>
          <div className="bg-white rounded-xl px-3 py-2.5 border border-gray-100 text-center">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Enroll ID</p>
            <p className="text-[13px] font-bold text-gray-800 mt-0.5">{biometricEnrollmentId || '—'}</p>
          </div>
        </div>
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-emerald-100/60 text-emerald-700 text-[12px]">
          <i className="fa-solid fa-fingerprint mt-0.5 shrink-0" />
          Your biometric punch was automatically linked to today's attendance record.
        </div>
      </div>
    )
  }

  // 🚫 No biometric enrollment ID assigned — show HR contact message
  if (!biometricEnrollmentId) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 p-5 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-red-500 flex items-center justify-center shrink-0">
            <i className="fa-solid fa-triangle-exclamation text-white text-[15px]" />
          </div>
          <div>
            <p className="text-[14px] font-bold text-gray-800">Biometric Enrollment ID Not Assigned</p>
            <p className="text-[11px] text-gray-500">Contact HR Administrator for assistance</p>
          </div>
        </div>
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-white px-4 py-3 text-[12px] text-red-700">
          <i className="fa-solid fa-circle-exclamation mt-0.5 shrink-0" />
          <span>
            <strong>Biometric Enrollment ID has not been assigned.</strong>
            <br />
            Your biometric enrollment ID should have been collected during onboarding.
            Please contact the HR Administrator to assign your biometric enrollment ID.
            Only HR/Admin can assign or update biometric enrollment IDs.
          </span>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 space-y-2">
          <p className="text-[12px] font-semibold text-gray-600">Office Attendance Information</p>
          <div className="grid grid-cols-2 gap-2 text-[12px]">
            <div className="flex justify-between">
              <span className="text-gray-500">Committed Work Mode</span>
              <span className="font-medium text-gray-800">Work From Office</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Biometric Enrollment ID</span>
              <span className="font-medium text-red-600">Not Assigned</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Attendance Source</span>
              <span className="font-medium text-gray-800">Biometric Machine</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Status</span>
              <span className="font-medium text-amber-600">Waiting for HR assignment</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ✅ Has biometric enrollment ID — show read-only info + waiting for punch
  return (
    <div className="rounded-xl border border-gray-100 bg-slate-50/60 p-5 space-y-4">

      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
          <i className="fa-solid fa-fingerprint text-white text-[15px]" />
        </div>
        <div>
          <p className="text-[14px] font-bold text-gray-800">Office Attendance</p>
          <p className="text-[11px] text-gray-400">Biometric-based attendance tracking</p>
        </div>
      </div>

      {/* Read-Only Information Card */}
      <div className="rounded-xl border border-gray-100 bg-white px-4 py-3.5 space-y-2">
        <p className="text-[12px] font-semibold text-gray-600 uppercase tracking-wide">Committed Work Mode</p>
        <div className="grid grid-cols-2 gap-2 text-[12px]">
          <div className="flex justify-between">
            <span className="text-gray-500">Work Mode</span>
            <span className="font-medium text-blue-700">Work From Office</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Biometric Enrollment ID</span>
            <span className="font-medium text-gray-800 font-mono">{biometricEnrollmentId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Attendance Source</span>
            <span className="font-medium text-gray-800">Biometric Machine</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Status</span>
            <span className="font-medium text-amber-600">Waiting for biometric synchronization</span>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50/60 px-3 py-2.5 text-[12px] text-blue-700">
        <i className="fa-solid fa-circle-info mt-0.5 shrink-0" />
        <span>
          Just punch your finger on the office biometric machine.
          Your attendance will be <strong>recorded automatically</strong> — no confirmation needed.
          Late threshold is <strong>09:50 AM</strong>.
        </span>
      </div>

      {/* Live Punch Preview */}
      <div className={`rounded-xl border px-4 py-3 space-y-1 ${
        previewLoading ? 'border-gray-100 bg-gray-50'
        : preview?.found
          ? preview.is_late ? 'border-orange-100 bg-orange-50' : 'border-emerald-100 bg-emerald-50'
          : 'border-gray-100 bg-gray-50'
      }`}>
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Today's Biometric Punch</p>
          <button onClick={fetchPreview} disabled={previewLoading} className="text-gray-300 hover:text-gray-500 transition" title="Refresh">
            <i className={`fa-solid fa-rotate-right text-[10px] ${previewLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {previewLoading ? (
          <div className="flex items-center gap-2 text-[12px] text-gray-400">
            <i className="fa-solid fa-circle-notch animate-spin text-[11px]" />Checking biometric logs…
          </div>
        ) : preview?.found ? (
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`text-[22px] font-bold tabular-nums ${preview.is_late ? 'text-orange-600' : 'text-emerald-700'}`}>
              {fmt(preview.first_punch)}
            </span>
            {preview.is_late
              ? <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200"><i className="fa-solid fa-clock text-[9px]" />Late arrival</span>
              : <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200"><i className="fa-solid fa-circle-check text-[9px]" />On time</span>
            }
            {preview.source === 'IDMS_DIRECT' && (
              <span className="text-[10px] text-blue-500 font-medium"><i className="fa-solid fa-bolt mr-0.5" />Live from device</span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[12px] text-gray-400">
            <i className="fa-solid fa-fingerprint text-gray-300" />
            No punch found yet — scan your finger on the office biometric machine.
          </div>
        )}
      </div>

      {/* Auto-processing indicator */}
      {autoProcessing && (
        <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5 text-[12px] text-blue-700">
          <i className="fa-solid fa-circle-notch animate-spin text-[11px] shrink-0" />
          Recording your attendance automatically…
        </div>
      )}

      {/* Punch detected + waiting for auto-process */}
      {preview?.found && !autoProcessing && !error && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-[12px] text-emerald-700">
          <i className="fa-solid fa-circle-check mt-0.5 shrink-0" />
          Punch detected — your attendance is being recorded automatically.
        </div>
      )}

      {/* Waiting for punch */}
      {!preview?.found && !previewLoading && !autoProcessing && (
        <div className="flex items-start gap-2 rounded-xl border border-gray-100 bg-white px-3 py-2.5 text-[12px] text-gray-500">
          <i className="fa-solid fa-hourglass-half mt-0.5 shrink-0 text-gray-400" />
          Waiting for punch… Once you scan on the office machine, attendance will record automatically.
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="space-y-2">
          <div className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-[12px] text-red-600">
            <i className="fa-solid fa-circle-exclamation mt-0.5 shrink-0" />{error}
          </div>
          {preview?.found && biometricEnrollmentId && (
            <button
              onClick={() => { autoSubmittedRef.current = false; setError(null); handleAutoCheckin(biometricEnrollmentId) }}
              className="w-full h-9 text-[12px] font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition"
            >
              <i className="fa-solid fa-rotate-right mr-1" /> Retry
            </button>
          )}
        </div>
      )}
    </div>
  )
}
