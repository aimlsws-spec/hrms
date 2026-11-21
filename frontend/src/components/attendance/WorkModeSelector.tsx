import { useState } from 'react'
import axios from 'axios'

export interface DailyWorkMode {
  id: number
  employee_id: string
  work_date: string
  mode: 'WFO' | 'WFH'
  biometric_user_id: string | null
  checked_in_at: string | null
  check_in_method: 'BIOMETRIC' | 'MANUAL' | null
  status: 'PENDING' | 'PRESENT' | 'ABSENT'
}

interface Props {
  employeeId: string
  current: DailyWorkMode | null
  loading: boolean
  onSelected: (mode: DailyWorkMode) => void
}

export default function WorkModeSelector({ employeeId, current, loading, onSelected }: Props) {
  const [busy, setBusy] = useState(false)

  const pick = async (mode: 'WFO' | 'WFH') => {
    if (busy) return
    setBusy(true)
    try {
      const { data } = await axios.post('/api/attendance/work-mode', { employee_id: employeeId, mode })
      if (data.success) onSelected(data.data)
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3 text-[13px] text-gray-400">
        <i className="fa-solid fa-circle-notch animate-spin" /> Loading work mode…
      </div>
    )
  }

  // Work mode NOT configured during onboarding
  if (!current) {
    return (
      <div className="flex items-center gap-3 rounded-xl px-4 py-4 border border-amber-200 bg-amber-50">
        <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center shrink-0">
          <i className="fa-solid fa-triangle-exclamation text-white text-[13px]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-gray-800 leading-tight">
            Work Mode Not Configured
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Your work mode was not set during onboarding. Please contact HR to configure your work mode (WFO or WFH).
          </p>
        </div>
      </div>
    )
  }

  // Work mode is fixed (committed at signup) — show read-only status
  const isWFO = current.mode === 'WFO'
  const isPresent = current.status === 'PRESENT'
  return (
    <div className={`flex items-center gap-3 rounded-xl px-4 py-3 border ${
      isWFO
        ? 'bg-blue-50 border-blue-100'
        : 'bg-violet-50 border-violet-100'
    }`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
        isWFO ? 'bg-blue-600' : 'bg-violet-600'
      }`}>
        <i className={`text-white text-[13px] ${isWFO ? 'fa-solid fa-building' : 'fa-solid fa-house'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-gray-800 leading-tight">
          Committed Work Mode:&nbsp;
          <span className={isWFO ? 'text-blue-700' : 'text-violet-700'}>
            {isWFO ? 'Work from Office (WFO)' : 'Work from Home (WFH)'}
          </span>
          {current.biometric_user_id && isWFO && (
            <span className="text-[11px] text-gray-500 ml-2">
              | Biometric ID: {current.biometric_user_id}
            </span>
          )}
        </p>
        <p className="text-[11px] text-gray-500 mt-0.5">
          {isPresent
            ? `Checked in${current.checked_in_at
                ? ' at ' + new Date(current.checked_in_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                : ''}`
            : 'Committed at signup — check-in pending'}
        </p>
      </div>
    </div>
  )
}

