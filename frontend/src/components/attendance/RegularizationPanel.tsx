import { useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import { useRegularization } from '../../hooks/attendance/useRegularization'
import EmployeeSearchSelect from './EmployeeSearchSelect'
import type { EmployeeOption } from '../../hooks/attendance/useEmployeeOptions'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import ErrorAlert from '../ui/ErrorAlert'
import type { RegularizationStatus } from '../../types/attendance'

function statusVariant(s: RegularizationStatus): 'green' | 'red' | 'yellow' {
  if (s === 'Approved') return 'green'
  if (s === 'Rejected') return 'red'
  return 'yellow'
}

function fmtDate(d?: string) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  } catch { return d }
}

const WINDOW_DAYS = 31
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const yesterday = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return isoDay(d) })()
const earliest  = (() => { const d = new Date(); d.setDate(d.getDate() - WINDOW_DAYS); return isoDay(d) })()

const inputCls = 'w-full h-11 px-3 border-2 border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-primary-700'

interface Props {
  isHRAdmin: boolean
}

export default function RegularizationPanel({ isHRAdmin }: Props) {
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'pending' | 'submit'>(isHRAdmin ? 'pending' : 'submit')

  const pendingHook = useRegularization('pending')
  const myHook      = useRegularization('employee', String(user?.user_id ?? ''))

  // Submit form state
  const [empId,    setEmpId]    = useState(isHRAdmin ? '' : String(user?.user_id ?? ''))
  const [attDate,  setAttDate]  = useState('')
  const [checkIn,  setCheckIn]  = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [reason,   setReason]   = useState('')
  const [submitted, setSubmitted] = useState(false)

  function handleEmployeeChange(id: string, _emp?: EmployeeOption) {
    setEmpId(id)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const ok = await myHook.submit({
      employee_id:         empId,
      attendance_date:     attDate,
      requested_check_in:  checkIn,
      requested_check_out: checkOut,
      reason,
    })
    if (ok) {
      setSubmitted(true)
      setTimeout(() => {
        setSubmitted(false)
        setAttDate('')
        setCheckIn('')
        setCheckOut('')
        setReason('')
        if (isHRAdmin) setEmpId('')
      }, 2000)
    }
  }

  async function handleReject(requestId: number) {
    const reason = window.prompt('Why are you rejecting this request? (the employee will see this)')
    if (reason === null) return
    if (reason.trim().length < 3) { window.alert('Please write a short reason.'); return }
    await pendingHook.reject(requestId, String(user?.user_id ?? ''), reason.trim())
  }

  async function handleApprove(requestId: number) {
    const comments = window.prompt('Approval comments (optional):')
    if (comments === null) return
    // approved_by must be the HR/admin user_id so the server can verify the role and audit-log it
    await pendingHook.approve(requestId, String(user?.user_id ?? ''), comments || undefined)
  }

  const hook = activeTab === 'pending' ? pendingHook : myHook

  return (
    <div>
      {/* Sub-tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {isHRAdmin && (
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeTab === 'pending'
                ? 'bg-primary-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Pending Requests
            {pendingHook.requests.length > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">
                {pendingHook.requests.length}
              </span>
            )}
          </button>
        )}
        <button
          onClick={() => setActiveTab('submit')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
            activeTab === 'submit'
              ? 'bg-primary-900 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {isHRAdmin ? 'Submit Request' : 'Request Correction'}
        </button>
      </div>

      {/* ── Pending requests — HR/Admin ── */}
      {activeTab === 'pending' && isHRAdmin && (
        <>
          {hook.error ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <span className="text-red-400 text-lg shrink-0">⚠</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-red-800">{hook.error}</p>
                <button
                  onClick={pendingHook.refetch}
                  className="mt-2 text-xs text-red-700 underline hover:no-underline"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : hook.isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map(i => (
                <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : pendingHook.requests.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-sm text-gray-400">No pending regularization requests.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-100">
                    <th className="text-left pb-3 pr-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Employee</th>
                    <th className="text-left pb-3 pr-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Date</th>
                    <th className="text-left pb-3 pr-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Recorded</th>
                    <th className="text-left pb-3 pr-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Requested</th>
                    <th className="text-left pb-3 pr-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Reason</th>
                    <th className="text-left pb-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingHook.requests.map((r, i) => (
                    <tr key={r.id ?? i} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-3 pr-4 font-medium text-gray-800 whitespace-nowrap">
                        {r.employee_name || r.employee_id}
                      </td>
                      <td className="py-3 pr-4 text-gray-600 whitespace-nowrap">{fmtDate(r.attendance_date)}</td>
                      <td className="py-3 pr-4 text-gray-500 whitespace-nowrap">
                        {r.original_check_in || r.original_check_out
                          ? `${r.original_check_in ?? '—'} – ${r.original_check_out ?? '—'}`
                          : 'No punch'}
                      </td>
                      <td className="py-3 pr-4 text-gray-800 font-medium whitespace-nowrap">
                        {r.requested_check_in ?? '—'} – {r.requested_check_out ?? '—'}
                      </td>
                      <td
                        className="py-3 pr-4 text-gray-500 max-w-[220px]"
                        title={r.reason}
                      >
                        <span className="line-clamp-2">{r.reason}</span>
                      </td>
                      <td className="py-3 whitespace-nowrap">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApprove(r.id!)}
                            className="px-3 py-1 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-medium hover:bg-green-100 transition-colors"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(r.id!)}
                            className="px-3 py-1 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors"
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── Submit correction form ── */}
      {activeTab === 'submit' && (
        <>
          {myHook.error && <ErrorAlert type="error" message={myHook.error} />}
          {!isHRAdmin && !submitted && (
            <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-[12px] text-blue-800 leading-relaxed">
              Use this when you forgot to punch or the times are wrong. HR reviews it and, once approved, your attendance for that day is
              corrected and your month's late count and salary deduction are recalculated. It cannot be used for days of approved leave
              or for a month whose payroll is already processed.
            </div>
          )}

          {submitted ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
              <div className="text-3xl mb-2">✓</div>
              <p className="text-green-800 font-semibold">Request Submitted</p>
              <p className="text-green-600 text-sm mt-1">HR will review your correction.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* HR admin can pick any employee; regular employee is pre-filled */}
                {isHRAdmin && (
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Employee <span className="text-red-500">*</span>
                    </label>
                    <EmployeeSearchSelect
                      value={empId}
                      onChange={handleEmployeeChange}
                      placeholder="Select employee..."
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={attDate}
                    min={earliest}
                    max={yesterday}
                    onChange={e => setAttDate(e.target.value)}
                    required
                    className={inputCls}
                  />
                  <p className="text-[11px] text-gray-400 mt-1">A day that has ended, within the last {WINDOW_DAYS} days.</p>
                </div>

                <div>
                  {/* spacer on sm when employee row not shown */}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Check In <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={checkIn}
                    onChange={e => setCheckIn(e.target.value)}
                    required
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Check Out <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={checkOut}
                    onChange={e => setCheckOut(e.target.value)}
                    required
                    className={inputCls}
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
                  placeholder="Explain the correction needed..."
                  className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-primary-700 resize-none"
                />
              </div>

              <Button
                type="submit"
                loading={myHook.isLoading}
                loadingText="Submitting..."
                className="w-full sm:w-auto px-8"
              >
                Submit Request
              </Button>
            </form>
          )}

          {/* My past requests (employee view) */}
          {!isHRAdmin && myHook.requests.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-100">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">My Requests</h4>
              <div className="space-y-2">
                {myHook.requests.map((r, i) => (
                  <div
                    key={r.id ?? i}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-xl text-sm gap-3"
                  >
                    <div className="min-w-0">
                      <p>
                        <span className="font-medium text-gray-800">{fmtDate(r.attendance_date)}</span>
                        <span className="text-gray-600 ml-3">{r.requested_check_in ?? '—'} – {r.requested_check_out ?? '—'}</span>
                      </p>
                      <p className="text-gray-500 text-xs mt-0.5 truncate" title={r.reason}>{r.reason}</p>
                      {r.status !== 'Pending' && r.approval_comments && (
                        <p className={`text-xs mt-0.5 ${r.status === 'Rejected' ? 'text-red-600' : 'text-green-700'}`}>
                          HR: {r.approval_comments}
                        </p>
                      )}
                    </div>
                    <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
