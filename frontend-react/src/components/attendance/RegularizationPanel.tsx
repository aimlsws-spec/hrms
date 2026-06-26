import { useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import { useRegularization } from '../../hooks/attendance/useRegularization'
import EmployeeSearchSelect from './EmployeeSearchSelect'
import type { EmployeeOption } from '../../hooks/attendance/useEmployeeOptions'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import ErrorAlert from '../ui/ErrorAlert'
import type { RegularizationStatus } from '../../types/attendance'

// API MISMATCH (documented):
// POST /api/attendance/regularization/approve/{id} expects approved_by = employee_id (e.g. "EMP001")
// but auth store only has user_id (integer). The backend's role-check query does:
//   SELECT role FROM users JOIN employees ON user_id WHERE e.employee_id = approved_by
// Passing user_id causes the lookup to fail → "Only HR or Admin can approve".
// Workaround: we pass user?.full_name for audit trail; approval will fail until
// auth store exposes employee_id or backend is relaxed to accept user_id.

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

  async function handleApprove(requestId: number) {
    const comments = window.prompt('Approval comments (optional):')
    if (comments === null) return
    // NOTE: passing full_name as approved_by — see mismatch comment at top of file
    await pendingHook.approve(requestId, user?.full_name ?? 'HR', comments || undefined)
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
                <p className="text-sm font-semibold text-red-800">Unable to load regularization requests</p>
                <p className="text-xs text-red-600 mt-0.5">
                  This feature may require additional database setup on the server.
                </p>
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
                    <th className="text-left pb-3 pr-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Req. In</th>
                    <th className="text-left pb-3 pr-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Req. Out</th>
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
                      <td className="py-3 pr-4 text-gray-600">{r.requested_check_in ?? '—'}</td>
                      <td className="py-3 pr-4 text-gray-600">{r.requested_check_out ?? '—'}</td>
                      <td
                        className="py-3 pr-4 text-gray-500 max-w-[180px] truncate"
                        title={r.reason}
                      >
                        {r.reason}
                      </td>
                      <td className="py-3">
                        <button
                          onClick={() => handleApprove(r.id!)}
                          className="px-3 py-1 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-medium hover:bg-green-100 transition-colors"
                        >
                          Approve
                        </button>
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
                    onChange={e => setAttDate(e.target.value)}
                    required
                    className={inputCls}
                  />
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
                      <span className="font-medium text-gray-800">{fmtDate(r.attendance_date)}</span>
                      <span className="text-gray-500 ml-3 truncate">{r.reason}</span>
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
