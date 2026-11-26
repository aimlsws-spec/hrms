import React, { useState, useEffect, FormEvent } from 'react'
import { useAuthStore } from '../../store/authStore'
import { useLeaveBalance } from '../../hooks/useLeaveBalance'
import { useUnpaidLeaveCheck } from '../../hooks/leave/useUnpaidLeaveCheck'
import { useUnpaidLeaveTaken } from '../../hooks/leave/useUnpaidLeaveTaken'
import { useLeaveCalendar } from '../../hooks/leave/useLeaveCalendar'
import { leavesApi } from '../../api/leaves'
import LeaveBalanceCard from '../../components/employee/dashboard/LeaveBalanceCard'
import ModernLeaveCalendar from '../../components/common/ModernLeaveCalendar'
import type { LeaveDuration, LeaveRequest } from '../../types/leave'

function toEmployeeCode(userId: number | string | undefined): string {
  if (userId == null) return ''
  const s = String(userId)
  if (/^EMP\d+$/i.test(s)) return s.toUpperCase()
  const n = parseInt(s, 10)
  return n > 0 ? `EMP${String(n).padStart(4, '0')}` : s
}

export default function MyLeavePage() {
  const { user } = useAuthStore()
  const employeeCode = toEmployeeCode(user?.user_id)
  
  const { balance, total, isLoading: balanceLoading } = useLeaveBalance(employeeCode)
  const { unpaidDaysTaken, isLoading: unpaidLoading } = useUnpaidLeaveTaken(user?.user_id ?? null)
  
  const [rightTab, setRightTab] = useState<'calendar' | 'history'>('calendar')
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [loadingRequests, setLoadingRequests] = useState(true)

  // Calendar hook for this employee
  const {
    year: calYear,
    month: calMonth,
    data: calData,
    isLoading: calLoading,
    prevMonth: calPrevMonth,
    nextMonth: calNextMonth,
  } = useLeaveCalendar(employeeCode || user?.user_id || 'all')
  
  // Form State
  const [leaveType, setLeaveType] = useState('Casual Leave')
  const [leaveDuration, setLeaveDuration] = useState<LeaveDuration>('full_day')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitMessage, setSubmitMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [unpaidAcknowledged, setUnpaidAcknowledged] = useState(false)

  // For half-day, end date must equal start date
  const effectiveEndDate = (leaveDuration === 'first_half' || leaveDuration === 'second_half') ? startDate : endDate

  const { warning: unpaidWarning, isLoading: checkingUnpaid } = useUnpaidLeaveCheck({
    userId: employeeCode,
    leaveType,
    startDate,
    endDate: effectiveEndDate,
    leaveDuration,
  })

  const fetchRequests = async () => {
    if (!user?.user_id) return
    try {
      setLoadingRequests(true)
      const res = await leavesApi.getEmployeeRequests(user.user_id)
      if (res.data.success) {
        setRequests(res.data.requests || res.data.leave_requests || [])
      }
    } catch (error) {
      console.error('Failed to fetch requests', error)
    } finally {
      setLoadingRequests(false)
    }
  }

  useEffect(() => {
    fetchRequests()
  }, [user?.user_id])

  useEffect(() => {
    setUnpaidAcknowledged(false)
  }, [leaveType, startDate, endDate, leaveDuration])

  const handleApplyLeave = async (e: FormEvent) => {
    e.preventDefault()
    if (!user?.user_id) return

    setSubmitting(true)
    setSubmitMessage(null)
    try {
      if (unpaidWarning?.exceeds_balance && !unpaidAcknowledged) {
        setSubmitMessage({ type: 'error', text: 'Please acknowledge the unpaid leave warning before submitting.' })
        return
      }
      const res = await leavesApi.applyLeave({
        employee_id: employeeCode,
        leave_type: leaveType,
        leave_duration: leaveDuration,
        start_date: startDate,
        end_date: effectiveEndDate,
        reason: reason,
        is_unpaid: unpaidWarning?.exceeds_balance || false,
        unpaid_days: unpaidWarning?.unpaid_days ?? 0,
      })
      if (res.data.success) {
        setSubmitMessage({ type: 'success', text: 'Leave applied successfully' })
        setStartDate('')
        setEndDate('')
        setReason('')
        setLeaveDuration('full_day')
        fetchRequests() // Refresh the list
      } else {
        setSubmitMessage({ type: 'error', text: res.data.message || 'Failed to apply leave' })
      }
    } catch (error: any) {
      setSubmitMessage({ type: 'error', text: error.response?.data?.message || 'Error connecting to server' })
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusColor = (status: string) => {
    const normalized = String(status || '').trim().toLowerCase()
    switch (normalized) {
      case 'approved': return 'bg-emerald-100 text-emerald-700'
      case 'rejected': return 'bg-red-100 text-red-700'
      default: return 'bg-amber-100 text-amber-700'
    }
  }

  return (
    <div className="space-y-6 w-[95%] max-w-[1600px] mx-auto px-6 py-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800">My Leaves</h1>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[35%_65%] gap-8 items-start">
        {/* Left Column: Balance & Apply Form */}
        <div className="space-y-6 w-full xl:max-w-[480px]">
          <LeaveBalanceCard balance={balance} total={total} isLoading={balanceLoading} />

          {/* Unpaid Leave Taken Section */}
          {unpaidDaysTaken > 0 && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
              <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <i className="fa-solid fa-clock text-amber-500 text-sm" />
                Unpaid Leave Taken
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-sm text-slate-600">Total Unpaid Days</span>
                  <span className="text-lg font-semibold text-amber-600">{unpaidDaysTaken}</span>
                </div>
                <p className="text-xs text-slate-500 pt-2">
                  Unpaid leave days will be deducted from your salary during payroll processing.
                </p>
              </div>
            </div>
          )}

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <i className="fa-solid fa-paper-plane text-blue-500 text-sm" />
              Apply Leave
            </h2>

            {submitMessage && (
              <div className={`p-3 mb-4 rounded-lg text-sm ${
                submitMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
              }`}>
                {submitMessage.text}
              </div>
            )}

            <form onSubmit={handleApplyLeave} className="space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-slate-700 mb-1">Leave Type</label>
                <select
                  required
                  className="w-full text-sm border-slate-200 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
                >
                  <option value="Casual Leave">Casual Leave</option>
                  <option value="Sick Leave">Sick Leave</option>
                  <option value="Earned Leave">Earned Leave</option>
                </select>
              </div>

              <div>
                <label className="block text-[13px] font-medium text-slate-700 mb-1">Leave Duration</label>
                <div className="flex gap-2">
                  {(['full_day', 'first_half', 'second_half'] as LeaveDuration[]).map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setLeaveDuration(d)}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                        leaveDuration === d
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400'
                      }`}
                    >
                      {d === 'full_day' ? 'Full Day' : d === 'first_half' ? 'First Half' : 'Second Half'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[13px] font-medium text-slate-700 mb-1">From</label>
                  <input
                    type="date"
                    required
                    className="w-full text-sm border-slate-200 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-slate-700 mb-1">
                    To
                    {(leaveDuration === 'first_half' || leaveDuration === 'second_half') && (
                      <span className="ml-1 text-[11px] text-blue-500 font-normal">(same day)</span>
                    )}
                  </label>
                  <input
                    type="date"
                    required
                    className="w-full text-sm border-slate-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
                    value={effectiveEndDate}
                    disabled={leaveDuration === 'first_half' || leaveDuration === 'second_half'}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-medium text-slate-700 mb-1">Reason</label>
                <textarea 
                  required
                  rows={3}
                  className="w-full text-sm border-slate-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 resize-none"
                  placeholder="Reason for leave..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>

              {unpaidWarning?.exceeds_balance && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                  <div className="font-semibold mb-2">Leave balance exceeded</div>
                  <div className="mb-2">
                    Requested: <strong>{unpaidWarning.requested_days}</strong> day(s), Paid available: <strong>{unpaidWarning.available_paid_days}</strong> day(s)
                  </div>
                  <div className="mb-3">
                    Unpaid leave will be: <strong>{unpaidWarning.unpaid_days}</strong> day(s).
                  </div>
                  <button
                    type="button"
                    onClick={() => setUnpaidAcknowledged(true)}
                    className="inline-flex items-center justify-center rounded-lg bg-red-600 px-3 py-2 text-white text-sm font-semibold hover:bg-red-700"
                  >
                    {unpaidAcknowledged ? 'Acknowledged' : 'Acknowledge Unpaid Leave'}
                  </button>
                </div>
              )}

              <button 
                type="submit" 
                disabled={submitting}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Calendar & Leave History */}
        <div className="flex flex-col h-full space-y-4">
          {/* Tab Navigation */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <button
              type="button"
              onClick={() => setRightTab('calendar')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                rightTab === 'calendar'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <i className="fa-solid fa-calendar-days" />
              Calendar & Holidays
            </button>
            <button
              type="button"
              onClick={() => setRightTab('history')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                rightTab === 'history'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <i className="fa-solid fa-clock-rotate-left" />
              Leave History ({requests.length})
            </button>
          </div>

          {rightTab === 'calendar' ? (
            <ModernLeaveCalendar
              year={calYear}
              month={calMonth}
              data={calData}
              isLoading={calLoading}
              onPrevMonth={calPrevMonth}
              onNextMonth={calNextMonth}
              title="My Calendar & Official Holidays"
              subtitle="All Sundays and 2nd & 4th Saturdays are observed company holidays. Click any day to view details."
            />
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col h-full">
              <div className="p-5 border-b border-slate-100">
                <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <i className="fa-solid fa-clock-rotate-left text-blue-500 text-sm" />
                  Leave Request History
                </h2>
              </div>
              
              <div className="flex-1 overflow-auto p-5">
                {loadingRequests ? (
                  <div className="p-8 text-center text-slate-400">Loading history...</div>
                ) : requests.length === 0 ? (
                  <div className="p-12 text-center text-slate-500">
                    <i className="fa-solid fa-folder-open text-3xl text-slate-300 mb-3" />
                    <p>No leave requests found</p>
                  </div>
                ) : (
                  <div>
                    <table className="w-full table-auto text-left text-sm text-slate-600">
                      <thead className="bg-slate-50 text-slate-500 font-semibold text-xs uppercase tracking-wide">
                        <tr>
                          <th className="px-5 py-4 border-b border-slate-100">Date Range</th>
                          <th className="px-5 py-4 border-b border-slate-100">Leave Type</th>
                          <th className="px-5 py-4 border-b border-slate-100">Duration</th>
                          <th className="px-5 py-4 border-b border-slate-100">Reason</th>
                          <th className="px-5 py-4 border-b border-slate-100 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {requests.map(req => (
                          <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-5 py-4 whitespace-nowrap">
                              {req.start_date} <span className="text-slate-300 mx-1">→</span> {req.end_date}
                            </td>
                            <td className="px-5 py-4 font-medium text-slate-700 whitespace-nowrap">
                              {req.leave_type}
                            </td>
                            <td className="px-5 py-4 whitespace-nowrap">
                              {req.leave_duration === 'first_half'
                                ? <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-100">First Half</span>
                                : req.leave_duration === 'second_half'
                                ? <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-violet-50 text-violet-700 border border-violet-100">Second Half</span>
                                : <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-50 text-slate-500 border border-slate-100">Full Day</span>
                              }
                            </td>
                            <td className="px-5 py-4 text-gray-600 whitespace-normal break-words" title={req.reason}>
                              {req.reason || '-'}
                            </td>
                            <td className="px-5 py-4 text-right">
                              <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold ${getStatusColor(req.status)}`}>
                                {req.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
