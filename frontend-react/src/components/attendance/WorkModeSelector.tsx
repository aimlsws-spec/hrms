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
        <i className="fa-solid fa-circle-notch animate-spin" /> Loading today's mode…
      </div>
    )
  }

  // Mode is fixed (set at signup) — show read-only status bar
  if (current) {
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
            Today:&nbsp;
            <span className={isWFO ? 'text-blue-700' : 'text-violet-700'}>
              {isWFO ? 'Work from Office (WFO)' : 'Work from Home (WFH)'}
            </span>
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {isPresent
              ? `Checked in${current.checked_in_at
                  ? ' at ' + new Date(current.checked_in_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                  : ''}`
              : 'Set at signup — check-in pending'}
          </p>
        </div>
      </div>
    )
  }

  // Nothing selected yet — show the two big choice cards
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">
          <i className="fa-solid fa-calendar-day text-gray-500 text-[12px]" />
        </div>
        <p className="text-[13px] font-semibold text-gray-700">
          How are you working today?
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* WFO card */}
        <button
          onClick={() => pick('WFO')}
          disabled={busy}
          className="flex flex-col items-center gap-2.5 p-5 rounded-xl border-2 border-blue-100 bg-blue-50 hover:bg-blue-100 hover:border-blue-300 active:scale-[0.98] transition-all disabled:opacity-50"
        >
          <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center">
            <i className="fa-solid fa-building text-white text-[18px]" />
          </div>
          <div className="text-center">
            <p className="text-[13px] font-bold text-blue-800">Work from Office</p>
            <p className="text-[11px] text-blue-500 mt-0.5">Biometric attendance</p>
          </div>
        </button>

        {/* WFH card */}
        <button
          onClick={() => pick('WFH')}
          disabled={busy}
          className="flex flex-col items-center gap-2.5 p-5 rounded-xl border-2 border-violet-100 bg-violet-50 hover:bg-violet-100 hover:border-violet-300 active:scale-[0.98] transition-all disabled:opacity-50"
        >
          <div className="w-11 h-11 rounded-xl bg-violet-600 flex items-center justify-center">
            <i className="fa-solid fa-house text-white text-[18px]" />
          </div>
          <div className="text-center">
            <p className="text-[13px] font-bold text-violet-800">Work from Home</p>
            <p className="text-[11px] text-violet-500 mt-0.5">Selfie or Geo check-in</p>
          </div>
        </button>
      </div>
    </div>
  )
}
