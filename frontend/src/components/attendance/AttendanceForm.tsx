import { useState } from 'react'
import Button from '../ui/Button'
import ErrorAlert from '../ui/ErrorAlert'
import EmployeeSearchSelect from './EmployeeSearchSelect'
import { useMarkAttendance } from '../../hooks/attendance/useMarkAttendance'
import type { AttendanceStatus } from '../../types/attendance'

const STATUS_OPTIONS: { label: string; value: AttendanceStatus }[] = [
  { label: 'Present',  value: 'PRESENT'  },
  { label: 'Absent',   value: 'ABSENT'   },
  { label: 'Half Day', value: 'HALF_DAY' },
  { label: 'On Leave', value: 'ON_LEAVE' },
]

const inputCls = 'w-full h-11 px-3 border-2 border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-primary-700'

interface Props {
  onSuccess: () => void
}

export default function AttendanceForm({ onSuccess }: Props) {
  const { mark, isLoading, error } = useMarkAttendance()

  const today = new Date().toISOString().split('T')[0]

  const [employeeId, setEmployeeId] = useState('')
  const [date, setDate]             = useState(today)
  const [status, setStatus]         = useState<AttendanceStatus>('PRESENT')
  const [checkIn, setCheckIn]       = useState('09:00')
  const [checkOut, setCheckOut]     = useState('18:00')
  const [remarks, setRemarks]       = useState('')
  const [toast, setToast]           = useState('')

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!employeeId) return
    const ok = await mark({
      employee_id:     employeeId,
      attendance_date: date,
      check_in:        checkIn,
      check_out:       checkOut || undefined,
      status,
      remarks:         remarks || undefined,
    })
    if (ok) {
      showToast('Attendance marked successfully!')
      onSuccess()
      // Reset employee + remarks for fast bulk entry; keep date/status/times
      setEmployeeId('')
      setRemarks('')
    }
  }

  return (
    <div>
      {/* Inline success toast */}
      {toast && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2.5 text-sm text-green-800">
          <span className="text-green-600 text-base font-bold shrink-0">✓</span>
          <span>{toast}</span>
        </div>
      )}

      {error && <ErrorAlert type="error" message={error} />}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Employee dropdown — full width */}
          <div className="sm:col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Employee <span className="text-red-500">*</span>
            </label>
            <EmployeeSearchSelect
              value={employeeId}
              onChange={id => setEmployeeId(id)}
              placeholder="Select employee..."
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              required
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Status <span className="text-red-500">*</span>
            </label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as AttendanceStatus)}
              className={inputCls}
            >
              {STATUS_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Check In</label>
            <input
              type="time"
              value={checkIn}
              onChange={e => setCheckIn(e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Check Out</label>
            <input
              type="time"
              value={checkOut}
              onChange={e => setCheckOut(e.target.value)}
              className={inputCls}
            />
          </div>

          {/* Remarks — full width */}
          <div className="sm:col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Remarks</label>
            <input
              type="text"
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder="Optional notes (e.g. WFH, medical)"
              className={inputCls}
            />
          </div>
        </div>

        <Button
          type="submit"
          loading={isLoading}
          loadingText="Marking..."
          disabled={!employeeId}
          className="w-full sm:w-auto px-8"
        >
          Mark Attendance
        </Button>
      </form>
    </div>
  )
}
