import React, { useState } from 'react'
import { leavesApi } from '../../api/leaves'
import type { LeaveRequest, LeaveDuration, LeaveStatus } from '../../types/leave'

interface Props {
  leave: LeaveRequest
  onClose: () => void
  onSuccess: () => void
}

export default function HREditLeaveModal({ leave, onClose, onSuccess }: Props) {
  const [leaveType, setLeaveType] = useState(leave.leave_type || 'Casual Leave')
  const [leaveDuration, setLeaveDuration] = useState<LeaveDuration>(leave.leave_duration || 'full_day')
  const [startDate, setStartDate] = useState(leave.start_date || '')
  const [endDate, setEndDate] = useState(leave.end_date || '')
  const [status, setStatus] = useState<LeaveStatus>(leave.status || 'Pending')
  const [reason, setReason] = useState(leave.reason || '')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const effectiveEndDate = (leaveDuration === 'first_half' || leaveDuration === 'second_half') ? startDate : endDate

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const res = await leavesApi.updateLeave(leave.id, {
        leave_type: leaveType,
        leave_duration: leaveDuration,
        start_date: startDate,
        end_date: effectiveEndDate,
        status: status,
        reason: reason,
        actor: 'HR',
      })
      if (res.data?.success) {
        onSuccess()
      } else {
        setError(res.data?.message || 'Failed to update leave record.')
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error communicating with server.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-sm">
              <i className="fa-solid fa-pen-to-square" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Edit Leave Record</h2>
              <p className="text-xs text-gray-500">{leave.employee_name || leave.employee_id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 flex items-center justify-center"
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Leave Type
              </label>
              <select
                value={leaveType}
                onChange={e => setLeaveType(e.target.value)}
                className="w-full h-10 px-3 border border-gray-200 rounded-xl text-xs bg-slate-50 text-gray-900 focus:outline-none focus:border-indigo-500"
              >
                <option value="Casual Leave">Casual Leave</option>
                <option value="Sick Leave">Sick Leave</option>
                <option value="Paid Leave">Paid Leave</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Duration
              </label>
              <select
                value={leaveDuration}
                onChange={e => setLeaveDuration(e.target.value as LeaveDuration)}
                className="w-full h-10 px-3 border border-gray-200 rounded-xl text-xs bg-slate-50 text-gray-900 focus:outline-none focus:border-indigo-500"
              >
                <option value="full_day">Full Day</option>
                <option value="first_half">First Half</option>
                <option value="second_half">Second Half</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Start Date
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
                className="w-full h-10 px-3 border border-gray-200 rounded-xl text-xs bg-slate-50 text-gray-900 focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                End Date
              </label>
              <input
                type="date"
                value={effectiveEndDate}
                disabled={leaveDuration === 'first_half' || leaveDuration === 'second_half'}
                onChange={e => setEndDate(e.target.value)}
                className="w-full h-10 px-3 border border-gray-200 rounded-xl text-xs bg-slate-50 text-gray-900 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Status
            </label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as LeaveStatus)}
              className="w-full h-10 px-3 border border-gray-200 rounded-xl text-xs bg-slate-50 text-gray-900 focus:outline-none focus:border-indigo-500"
            >
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Reason / Remarks
            </label>
            <textarea
              rows={2}
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-xl text-xs bg-slate-50 text-gray-900 focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl text-xs font-semibold shadow-sm"
            >
              {submitting ? 'Updating…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
