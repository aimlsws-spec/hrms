import { useEffect, useState } from 'react'
import Button from '../ui/Button'
import ErrorAlert from '../ui/ErrorAlert'
import { useApplyLeave } from '../../hooks/leave/useApplyLeave'
import { useUnpaidLeaveCheck } from '../../hooks/leave/useUnpaidLeaveCheck'
import type { ApplyLeavePayload } from '../../types/leave'

const LEAVE_TYPES = ['Casual Leave', 'Sick Leave', 'Earned Leave']

interface Props {
  userId: number | string
  onSuccess: () => void
  onCancel: () => void
}

export default function LeaveRequestForm({ userId, onSuccess, onCancel }: Props) {
  const { submit, isLoading, error, sandwichWarning, clearSandwichWarning } = useApplyLeave()

  const [leaveType, setLeaveType] = useState(LEAVE_TYPES[0])
  const [duration, setDuration] = useState<'full' | 'half'>('full')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [pendingPayload, setPendingPayload] = useState<ApplyLeavePayload | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [unpaidAcknowledged, setUnpaidAcknowledged] = useState(false)

  // Check for unpaid leave threshold
  const { warning: unpaidWarning, isLoading: checkingBalance } = useUnpaidLeaveCheck({
    userId,
    leaveType,
    startDate,
    endDate,
    halfDay: duration === 'half'
  })

  function buildPayload(): ApplyLeavePayload {
    return {
      employee_id: userId,
      leave_type:  leaveType,
      start_date:  startDate,
      end_date:    endDate,
      reason,
      half_day: duration === 'half' ? 'Half Day' : 'Full Day',
      is_unpaid: unpaidWarning?.exceeds_balance || false,
      unpaid_days: unpaidWarning?.unpaid_days ?? 0,
    }
  }

  async function handleSubmit(e?: React.FormEvent) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault()
    
    // If unpaid warning exists and not acknowledged, prevent submission
    if (unpaidWarning?.exceeds_balance && !unpaidAcknowledged) {
      return // User must acknowledge unpaid leave warning first
    }
    
    const payload = buildPayload()
    setPendingPayload(payload)
    const result = await submit(payload, false)
    if (result.success) { setSubmitted(true); setTimeout(onSuccess, 1200) }
  }

  async function handleSandwichConfirm() {
    if (!pendingPayload) return
    clearSandwichWarning()
    const result = await submit(pendingPayload, true)
    if (result.success) { setSubmitted(true); setTimeout(onSuccess, 1200) }
  }

  function handleUnpaidAcknowledge() {
    setUnpaidAcknowledged(true)
  }

  useEffect(() => {
    setUnpaidAcknowledged(false)
  }, [leaveType, startDate, endDate, duration])

  if (submitted) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
        <div className="text-4xl mb-3">✓</div>
        <h4 className="text-green-800 font-semibold text-lg">Leave Application Submitted</h4>
        <p className="text-green-700 text-sm mt-1">Status: Pending HR Approval</p>
      </div>
    )
  }

  return (
    <div>
      {error && <ErrorAlert type="error" message={error} />}

      {/* Unpaid Leave Warning */}
      {unpaidWarning?.exceeds_balance && (
        <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-xl text-sm">
          <div className="flex items-start gap-2 mb-3">
            <i className="fa-solid fa-exclamation-triangle text-red-500 text-[14px] mt-0.5" />
            <div>
              <p className="font-semibold text-red-800 mb-1">Leave Balance Exceeded</p>
              <p className="text-red-700 mb-2">
                Requested Leave: <strong>{unpaidWarning.requested_days}</strong> day(s)
                <span className="mx-1">·</span>
                Paid Leave Available: <strong>{unpaidWarning.available_paid_days}</strong>
              </p>
              <p className="text-red-700 mb-3">
                Paid days: <strong>{Math.max(0, unpaidWarning.requested_days - unpaidWarning.unpaid_days)}</strong> · Unpaid days: <strong>{unpaidWarning.unpaid_days}</strong>
              </p>
              {!unpaidAcknowledged ? (
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handleUnpaidAcknowledge}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors"
                  >
                    Confirm Unpaid Leave Acknowledgement
                  </button>
                  <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2 border border-red-200 text-red-700 rounded-lg text-sm font-semibold hover:bg-red-50 transition-colors"
                  >
                    Cancel Request
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-red-700">
                    <i className="fa-solid fa-check-circle text-red-600" />
                    <span className="font-medium">Acknowledged. You may now submit the leave request.</span>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={isLoading}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-60"
                    >
                      Apply Anyway
                    </button>
                    <button
                      type="button"
                      onClick={onCancel}
                      className="px-4 py-2 border border-red-200 text-red-700 rounded-lg text-sm font-semibold hover:bg-red-50 transition-colors"
                    >
                      Cancel Request
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sandwich policy alert */}
      {sandwichWarning?.has_sandwich && (
        <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm">
          <p className="font-semibold text-amber-800 mb-1">⚠️ Sandwich Leave Policy Alert</p>
          <p className="text-amber-700 mb-2">{sandwichWarning.warning}</p>
          {sandwichWarning.count != null && (
            <p className="text-amber-700 mb-4">
              {sandwichWarning.count} additional day(s) will be counted as leave.
            </p>
          )}
          <div className="flex gap-3">
            <button
              onClick={handleSandwichConfirm}
              disabled={isLoading}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 transition-colors disabled:opacity-60"
            >
              Proceed Anyway
            </button>
            <button
              onClick={clearSandwichWarning}
              className="px-4 py-2 border border-amber-300 text-amber-700 rounded-lg text-sm font-semibold hover:bg-amber-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Leave Type</label>
            <select
              value={leaveType}
              onChange={e => setLeaveType(e.target.value)}
              className="w-full h-11 px-3 border-2 border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-primary-700"
            >
              {LEAVE_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Duration</label>
            <select
              value={duration}
              onChange={e => setDuration(e.target.value as 'full' | 'half')}
              className="w-full h-11 px-3 border-2 border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-primary-700"
            >
              <option value="full">Full Day</option>
              <option value="half">Half Day</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              required
              className="w-full h-11 px-3 border-2 border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-primary-700"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">End Date</label>
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={e => setEndDate(e.target.value)}
              required
              className="w-full h-11 px-3 border-2 border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-primary-700"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Reason <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            required
            rows={3}
            placeholder="Enter reason for leave"
            className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-primary-700 resize-none"
          />
        </div>

        <div className="flex gap-3 pt-1">
          <Button
            type="submit"
            loading={isLoading || checkingBalance}
            className="flex-1"
            disabled={checkingBalance || isLoading || (unpaidWarning?.exceeds_balance && !unpaidAcknowledged)}
          >
            Submit Application
          </Button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 h-[52px] mt-3 border-2 border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
