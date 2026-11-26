import React, { useState, useEffect } from 'react'
import { leavesApi } from '../../api/leaves'
import { useAuthStore } from '../../store/authStore'
import type { LeaveDuration, LeaveBalance } from '../../types/leave'
import axios from 'axios'

interface Props {
  onClose: () => void
  onSuccess: () => void
}

interface UserOption {
  employee_id: string
  name: string
  department?: string
  role?: string
}

export default function HRAddLeaveModal({ onClose, onSuccess }: Props) {
  const { user } = useAuthStore()
  const hrCode = user?.user_id || 'hr001'

  const [targetType, setTargetType] = useState<'self' | 'employee'>('employee')
  const [employees, setEmployees] = useState<UserOption[]>([])
  const [selectedEmp, setSelectedEmp] = useState<string>('')
  const [selectedEmpName, setSelectedEmpName] = useState<string>('')

  const [leaveType, setLeaveType] = useState('Casual Leave')
  const [leaveDuration, setLeaveDuration] = useState<LeaveDuration>('full_day')
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10))
  const [reason, setReason] = useState('')
  const [status, setStatus] = useState<'Approved' | 'Pending'>('Approved')

  const [empBalance, setEmpBalance] = useState<LeaveBalance | null>(null)
  const [loadingBalance, setLoadingBalance] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load employee list
  useEffect(() => {
    async function loadEmployees() {
      try {
        const res = await axios.get('/api/users')
        const list: UserOption[] = (res.data?.users || []).map((u: any) => ({
          employee_id: u.employee_id || u.user_id,
          name: u.name || u.full_name || u.user_id,
          department: u.department || '',
          role: u.role || 'employee',
        }))
        setEmployees(list)
        if (list.length > 0) {
          setSelectedEmp(list[0].employee_id)
          setSelectedEmpName(list[0].name)
        }
      } catch (err) {
        console.error('Failed to load employee list', err)
      }
    }
    loadEmployees()
  }, [])

  // The active employee id for leave creation
  const activeEmpId = targetType === 'self' ? hrCode : selectedEmp

  // Fetch leave balance for activeEmpId
  useEffect(() => {
    if (!activeEmpId) return
    setLoadingBalance(true)
    leavesApi.getBalance(activeEmpId)
      .then(res => {
        const b = res.data?.summary || res.data?.balance || res.data?.data || null
        setEmpBalance(b)
      })
      .catch(() => setEmpBalance(null))
      .finally(() => setLoadingBalance(false))
  }, [activeEmpId])

  // Sync end date if half day
  const effectiveEndDate = (leaveDuration === 'first_half' || leaveDuration === 'second_half') ? startDate : endDate

  // Calculate day count
  const calculateDays = () => {
    if (!startDate || !effectiveEndDate) return 0
    if (leaveDuration === 'first_half' || leaveDuration === 'second_half') return 0.5
    const start = new Date(startDate)
    const end = new Date(effectiveEndDate)
    const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1
    return diff > 0 ? diff : 0
  }

  const requestedDays = calculateDays()

  // Balance check
  const getAvailableForType = () => {
    if (!empBalance) return 0
    const lt = leaveType.toLowerCase()
    if (lt.includes('sick')) return Number(empBalance.sick_balance ?? 12)
    if (lt.includes('paid') || lt.includes('earn')) return Number(empBalance.paid_balance ?? empBalance.earned_balance ?? 12)
    return Number(empBalance.casual_balance ?? 12)
  }

  const availableDays = getAvailableForType()
  const unpaidDays = Math.max(0, requestedDays - availableDays)
  const isUnpaid = unpaidDays > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeEmpId) {
      setError('Please select an employee.')
      return
    }
    if (!startDate || !effectiveEndDate) {
      setError('Please enter both start and end date.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const payload = {
        employee_id: activeEmpId,
        leave_type: leaveType,
        leave_duration: leaveDuration,
        start_date: startDate,
        end_date: effectiveEndDate,
        reason: reason || (targetType === 'self' ? 'HR Leave' : 'Leave record added by HR'),
        status: status,
        created_by: user?.full_name || 'HR Manager',
        is_unpaid: isUnpaid,
        unpaid_days: unpaidDays,
      }

      const res = await leavesApi.adminCreateLeave(payload)
      if (res.data?.success) {
        onSuccess()
      } else {
        setError(res.data?.message || 'Failed to create leave record.')
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error communicating with server.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/50 to-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-sm shadow-indigo-200">
              <i className="fa-solid fa-calendar-plus" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Record Employee / HR Leave</h2>
              <p className="text-xs text-gray-500">Maintain leave records without manual month-end counting</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 flex items-center justify-center transition-colors"
          >
            <i className="fa-solid fa-xmark text-sm" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 text-xs bg-red-50 text-red-600 rounded-xl border border-red-100 flex items-center gap-2">
              <i className="fa-solid fa-circle-exclamation shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Target: For Myself (HR) vs For Employee */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
              Leave For
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTargetType('self')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                  targetType === 'self'
                    ? 'border-indigo-600 bg-indigo-50/60 text-indigo-700 shadow-sm'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <i className="fa-solid fa-user-tie" />
                For Myself (HR)
              </button>
              <button
                type="button"
                onClick={() => setTargetType('employee')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                  targetType === 'employee'
                    ? 'border-indigo-600 bg-indigo-50/60 text-indigo-700 shadow-sm'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <i className="fa-solid fa-users" />
                For an Employee
              </button>
            </div>
          </div>

          {/* Employee selector or Self indicator */}
          {targetType === 'employee' ? (
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Select Employee *
              </label>
              <select
                value={selectedEmp}
                onChange={e => {
                  setSelectedEmp(e.target.value)
                  const found = employees.find(emp => emp.employee_id === e.target.value)
                  setSelectedEmpName(found?.name || e.target.value)
                }}
                className="w-full h-10 px-3 border border-gray-200 rounded-xl text-xs bg-slate-50 text-gray-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
                required
              >
                {employees.map(emp => (
                  <option key={emp.employee_id} value={emp.employee_id}>
                    {emp.name} ({emp.employee_id}) {emp.department ? `· ${emp.department}` : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-indigo-50/50 border border-indigo-100 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-circle-user text-indigo-600 text-sm" />
                <div>
                  <p className="font-semibold text-indigo-900">{user?.full_name || 'HR Manager'}</p>
                  <p className="text-[10px] text-indigo-500 font-mono">ID: {hrCode} (HR Role)</p>
                </div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-200/60 text-indigo-800 font-semibold">
                HR Self-Leave
              </span>
            </div>
          )}

          {/* Current Balance Snapshot Card */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                <i className="fa-solid fa-wallet text-slate-500" />
                Remaining Yearly Leave Balances
              </span>
              {loadingBalance ? (
                <span className="text-[10px] text-slate-400">Loading…</span>
              ) : (
                <span className="text-[10px] text-slate-400 font-mono">Year {empBalance?.year ?? new Date().getFullYear()}</span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white p-2 rounded-lg border border-slate-100">
                <p className="text-[10px] text-slate-500">Casual Leave</p>
                <p className="text-sm font-bold text-amber-600">{Number(empBalance?.casual_balance ?? 12).toFixed(1)}</p>
                <p className="text-[9px] text-slate-400">of {Number(empBalance?.casual_total ?? 12).toFixed(0)}</p>
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-100">
                <p className="text-[10px] text-slate-500">Sick Leave</p>
                <p className="text-sm font-bold text-red-600">{Number(empBalance?.sick_balance ?? 12).toFixed(1)}</p>
                <p className="text-[9px] text-slate-400">of {Number(empBalance?.sick_total ?? 12).toFixed(0)}</p>
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-100">
                <p className="text-[10px] text-slate-500">Paid Leave</p>
                <p className="text-sm font-bold text-emerald-600">
                  {Number(empBalance?.paid_balance ?? empBalance?.earned_balance ?? 12).toFixed(1)}
                </p>
                <p className="text-[9px] text-slate-400">of {Number(empBalance?.earned_total ?? 12).toFixed(0)}</p>
              </div>
            </div>
          </div>

          {/* Leave Type & Duration */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Leave Type *
              </label>
              <select
                value={leaveType}
                onChange={e => setLeaveType(e.target.value)}
                className="w-full h-10 px-3 border border-gray-200 rounded-xl text-xs bg-slate-50 text-gray-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
              >
                <option value="Casual Leave">Casual Leave (CL)</option>
                <option value="Sick Leave">Sick Leave (SL)</option>
                <option value="Paid Leave">Paid / Earned Leave (PL)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Duration *
              </label>
              <select
                value={leaveDuration}
                onChange={e => setLeaveDuration(e.target.value as LeaveDuration)}
                className="w-full h-10 px-3 border border-gray-200 rounded-xl text-xs bg-slate-50 text-gray-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
              >
                <option value="full_day">Full Day (1.0)</option>
                <option value="first_half">First Half (0.5)</option>
                <option value="second_half">Second Half (0.5)</option>
              </select>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Start Date *
              </label>
              <input
                type="date"
                value={startDate}
                onChange={e => {
                  setStartDate(e.target.value)
                  if (leaveDuration === 'first_half' || leaveDuration === 'second_half') {
                    setEndDate(e.target.value)
                  }
                }}
                className="w-full h-10 px-3 border border-gray-200 rounded-xl text-xs bg-slate-50 text-gray-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                End Date *
              </label>
              <input
                type="date"
                value={effectiveEndDate}
                disabled={leaveDuration === 'first_half' || leaveDuration === 'second_half'}
                onChange={e => setEndDate(e.target.value)}
                className="w-full h-10 px-3 border border-gray-200 rounded-xl text-xs bg-slate-50 text-gray-900 focus:outline-none focus:border-indigo-500 focus:bg-white disabled:opacity-50"
                required
              />
            </div>
          </div>

          {/* Days summary & Unpaid warning banner */}
          <div className="flex items-center justify-between text-xs py-1 px-3 bg-gray-50 rounded-lg">
            <span className="text-gray-500">Requested Days:</span>
            <span className="font-bold text-gray-800">{requestedDays} day(s)</span>
          </div>

          {isUnpaid && (
            <div className="p-3 bg-amber-50 text-amber-800 rounded-xl border border-amber-200 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-semibold">
                <i className="fa-solid fa-triangle-exclamation text-amber-600" />
                <span>Notice: Exceeds Available Paid Balance</span>
              </div>
              <p className="text-[11px] text-amber-700">
                Available: {availableDays.toFixed(1)} day(s) · {unpaidDays.toFixed(1)} day(s) will be recorded as unpaid leave.
              </p>
            </div>
          )}

          {/* Status option */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Record Status
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value="Approved"
                  checked={status === 'Approved'}
                  onChange={() => setStatus('Approved')}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-medium text-emerald-700">Pre-Approved (Auto-Deduct Balance)</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value="Pending"
                  checked={status === 'Pending'}
                  onChange={() => setStatus('Pending')}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-medium text-amber-700">Pending Review</span>
              </label>
            </div>
          </div>

          {/* Reason & Quick presets */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Reason / Remarks
              </label>
              {targetType === 'employee' && (
                <span className="text-[10px] text-indigo-600 font-medium">Quick presets:</span>
              )}
            </div>

            {targetType === 'employee' && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                <button
                  type="button"
                  onClick={() => {
                    setLeaveType('Sick Leave')
                    setReason('Employee unwell with high fever / sickness, unable to submit request directly')
                  }}
                  className="px-2 py-0.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[10px] font-semibold transition"
                >
                  + Sick / Fever
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLeaveType('Sick Leave')
                    setReason('Medical emergency / hospitalized — leave submitted by HR on behalf')
                  }}
                  className="px-2 py-0.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[10px] font-semibold transition"
                >
                  + Medical Emergency
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReason('Employee unable to access portal / network connectivity issue, submitted via HR')
                  }}
                  className="px-2 py-0.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-semibold transition"
                >
                  + Unable to access portal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLeaveType('Casual Leave')
                    setReason('Pre-informed personal urgent work, recorded by HR on behalf')
                  }}
                  className="px-2 py-0.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[10px] font-semibold transition"
                >
                  + Personal Urgent
                </button>
              </div>
            )}

            <textarea
              rows={2}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Employee is sick, unable to submit request, medical emergency..."
              className="w-full p-3 border border-gray-200 rounded-xl text-xs bg-slate-50 text-gray-900 focus:outline-none focus:border-indigo-500 focus:bg-white resize-none"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || requestedDays <= 0}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin text-xs" />
                  Saving…
                </>
              ) : (
                <>
                  <i className="fa-solid fa-check text-xs" />
                  Save Leave Record
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
