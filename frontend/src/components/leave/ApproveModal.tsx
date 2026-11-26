import { useState, useEffect } from 'react'
import { useAuthStore } from '../../store/authStore'
import { leavesApi } from '../../api/leaves'
import Button from '../ui/Button'
import ErrorAlert from '../ui/ErrorAlert'
import type { LeaveRequest, LeaveBalance } from '../../types/leave'

function fmt(d?: string) {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return d }
}

const leaveTypeBalanceKey: Record<string, keyof LeaveBalance> = {
  'casual leave': 'casual_balance',
  'sick leave':   'sick_balance',
  'earned leave': 'earned_balance',
  'annual leave': 'earned_balance',
}

interface Props {
  leaveRequest: LeaveRequest
  onClose: () => void
  onSuccess: () => void
}

export default function ApproveModal({ leaveRequest, onClose, onSuccess }: Props) {
  const { user } = useAuthStore()
  const [comments,  setComments]  = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error,     setError]     = useState('')
  const [balance,   setBalance]   = useState<LeaveBalance | null>(null)

  const employeeId = leaveRequest.employee_id

  useEffect(() => {
    if (!employeeId) return
    leavesApi.getBalance(employeeId)
      .then(res => {
        const b = res.data.balance ?? res.data.data ?? res.data.summary
        if (b) setBalance(b as LeaveBalance)
      })
      .catch(() => {})
  }, [employeeId])

  // Derive paid/unpaid split from current balance (what _set_leave_status will also compute)
  const requestedDays = Number(leaveRequest.days_count ?? leaveRequest.requested_days ?? 0)
  const leaveKey      = leaveTypeBalanceKey[(leaveRequest.leave_type ?? '').toLowerCase()] ?? 'casual_balance'
  const availableBalance = balance ? Number(balance[leaveKey] ?? 0) : null
  const paidPortion   = availableBalance != null ? Math.min(requestedDays, availableBalance) : null
  const unpaidPortion = availableBalance != null ? Math.max(0, requestedDays - availableBalance) : null
  const hasUnpaid     = unpaidPortion != null && unpaidPortion > 0

  async function handleApprove(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    const roleTag = user?.role === 'sub_hr' ? 'Sub-HR' : user?.role === 'hr' ? 'HR Head' : 'HR'
    const approverName = `${user?.full_name ?? 'HR'} (${roleTag})`
    try {
      const { data } = await leavesApi.approveLeave(
        leaveRequest.id,
        approverName,
        leaveRequest.leave_type ?? '',
        comments || `Approved by ${approverName}`,
      )
      if (data.success) {
        // e.g. the employee already punched in on days this leave covers
        if (data.warning) window.alert(data.warning)
        onSuccess(); onClose()
      }
      else setError(data.message || 'Failed to approve leave.')
    } catch {
      setError('Connection failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-gray-900">Review Leave Request</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        {error && <ErrorAlert type="error" message={error} />}

        {/* Leave summary */}
        <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-2 text-[13px]">
          <div className="flex justify-between">
            <span className="text-gray-500">Employee</span>
            <span className="font-medium text-gray-800">{leaveRequest.employee_name || String(leaveRequest.employee_id ?? '—')}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Leave Type</span>
            <span className="font-medium text-gray-800">{leaveRequest.leave_type ?? '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Duration</span>
            <span className="font-medium">
              {leaveRequest.leave_duration === 'first_half'
                ? <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-100">First Half</span>
                : leaveRequest.leave_duration === 'second_half'
                ? <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-violet-50 text-violet-700 border border-violet-100">Second Half</span>
                : <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-gray-100 text-gray-500 border border-gray-100">Full Day</span>
              }
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Period</span>
            <span className="font-medium text-gray-800">{fmt(leaveRequest.start_date)} → {fmt(leaveRequest.end_date)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Requested Days</span>
            <span className="font-semibold text-gray-800">{requestedDays}</span>
          </div>
          {availableBalance != null && (
            <div className="flex justify-between">
              <span className="text-gray-500">Available Balance</span>
              <span className="font-medium text-gray-800">{availableBalance.toFixed(1)} day(s)</span>
            </div>
          )}
        </div>

        {/* Paid / Unpaid breakdown */}
        {availableBalance != null && (
          <div className="grid grid-cols-2 gap-3 mb-4 text-[13px]">
            <div className="bg-emerald-50 rounded-xl p-3 text-center">
              <p className="text-[11px] text-emerald-600 font-semibold uppercase tracking-wide mb-1">Paid Leave</p>
              <p className="text-xl font-bold text-emerald-700">{(paidPortion ?? 0).toFixed(1)}</p>
              <p className="text-[11px] text-emerald-500 mt-0.5">day(s)</p>
            </div>
            <div className={`rounded-xl p-3 text-center ${hasUnpaid ? 'bg-red-50' : 'bg-gray-50'}`}>
              <p className={`text-[11px] font-semibold uppercase tracking-wide mb-1 ${hasUnpaid ? 'text-red-600' : 'text-gray-400'}`}>Unpaid Leave</p>
              <p className={`text-xl font-bold ${hasUnpaid ? 'text-red-700' : 'text-gray-400'}`}>{(unpaidPortion ?? 0).toFixed(1)}</p>
              <p className={`text-[11px] mt-0.5 ${hasUnpaid ? 'text-red-500' : 'text-gray-400'}`}>day(s)</p>
            </div>
          </div>
        )}

        {/* UNPAID LEAVE IMPACT badge */}
        {hasUnpaid && (
          <div className="mb-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-[12px]">
            <i className="fa-solid fa-triangle-exclamation text-amber-500 text-sm mt-0.5 shrink-0" />
            <div>
              <p className="font-bold text-amber-800 uppercase tracking-wide text-[11px] mb-1">Unpaid Leave Impact</p>
              <p className="text-amber-700">
                Approving will consume <strong>{(paidPortion ?? 0).toFixed(1)}</strong> paid day(s) and record{' '}
                <strong>{(unpaidPortion ?? 0).toFixed(1)}</strong> unpaid day(s).
                Salary will be deducted accordingly during payroll processing.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleApprove} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Comments <span className="text-gray-400 font-normal">(Optional)</span>
            </label>
            <textarea
              value={comments}
              onChange={e => setComments(e.target.value)}
              rows={2}
              placeholder="Add approval comments..."
              className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-primary-700 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <Button type="submit" loading={isLoading} className="flex-1">
              Approve Leave
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-[52px] mt-3 border-2 border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
