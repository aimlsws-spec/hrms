import { useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { useLeaveBalance } from '../hooks/useLeaveBalance'
import { useLeaveCalendar } from '../hooks/leave/useLeaveCalendar'
import { useLeaveRequests } from '../hooks/leave/useLeaveRequests'
import { leavesApi } from '../api/leaves'
import LeaveCalendar from '../components/leave/LeaveCalendar'
import LeaveBalanceCard from '../components/leave/LeaveBalanceCard'
import LeaveTable from '../components/leave/LeaveTable'
import LeaveFilters, { type LeaveFilterStatus } from '../components/leave/LeaveFilters'
import ApproveModal from '../components/leave/ApproveModal'
import HRAddLeaveModal from '../components/leave/HRAddLeaveModal'
import HREditLeaveModal from '../components/leave/HREditLeaveModal'
import HRYearlyBalancesTab from '../components/leave/HRYearlyBalancesTab'
import Card from '../components/ui/Card'
import type { LeaveRequest } from '../types/leave'

type ActiveTab = 'requests' | 'balances' | 'calendar'

export default function LeavePage() {
  const { user } = useAuthStore()
  const isHRAdmin = user?.role === 'admin' || user?.role === 'hr' || user?.role === 'sub_hr'

  const [activeTab, setActiveTab] = useState<ActiveTab>('requests')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editRequest, setEditRequest] = useState<LeaveRequest | null>(null)
  const [approveRequest, setApproveRequest] = useState<LeaveRequest | null>(null)
  const [filter, setFilter] = useState<LeaveFilterStatus>('all')
  const [scope, setScope] = useState<'all' | 'mine' | 'employees'>('all')

  const { balance, isLoading: balanceLoading, refetch: refetchBalance } = useLeaveBalance(user?.user_id ?? null)

  const { year, month, data: calendarData, isLoading: calLoading, prevMonth, nextMonth } =
    useLeaveCalendar(user?.user_id ?? null)

  const { requests, isLoading: reqLoading, refetch: refetchRequests, rejectRequest } =
    useLeaveRequests(isHRAdmin, user?.user_id)

  const userEmpId = String(user?.user_id || '').toUpperCase()
  const scopeFiltered = requests.filter((r) => {
    if (scope === 'mine') {
      return String(r.employee_id || '').toUpperCase() === userEmpId
    }
    if (scope === 'employees') {
      return String(r.employee_id || '').toUpperCase() !== userEmpId
    }
    return true
  })

  const filtered = filter === 'all' ? scopeFiltered : scopeFiltered.filter((r) => r.status === filter)

  function handleApprove(id: number) {
    const req = requests.find(r => r.id === id) ?? null
    setApproveRequest(req)
  }

  function handleReject(id: number) {
    const reason = window.prompt('Enter reason for rejection (optional):')
    if (reason === null) return
    const roleTag = user?.role === 'sub_hr' ? 'Sub-HR' : user?.role === 'hr' ? 'HR Head' : 'HR'
    const rejectorName = `${user?.full_name ?? 'HR'} (${roleTag})`
    rejectRequest(id, rejectorName, reason)
  }

  async function handleDelete(id: number) {
    if (!window.confirm('Are you sure you want to delete this leave record? Any deducted days will be restored to the employee balance.')) {
      return
    }
    try {
      const res = await leavesApi.deleteLeave(id)
      if (res.data?.success) {
        refetchRequests()
        refetchBalance()
      } else {
        alert(res.data?.message || 'Failed to delete leave record')
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error deleting leave record')
    }
  }

  function handleReloadAll() {
    refetchRequests()
    refetchBalance()
  }

  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leave Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isHRAdmin
              ? 'Create, maintain, and audit leave records for employees and HR'
              : 'Requests, approvals, and balances'}
          </p>
        </div>
        {isHRAdmin && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
            >
              <i className="fa-solid fa-user-pen text-xs" />
              Apply Leave on Behalf / Self
            </button>
          </div>
        )}
      </div>

      {/* ── Tabs for HR/Admin ── */}
      {isHRAdmin && (
        <div className="flex items-center gap-2 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('requests')}
            className={`pb-3 px-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'requests'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <i className="fa-solid fa-list-check" />
            Leave Requests &amp; Records
          </button>
          <button
            onClick={() => setActiveTab('balances')}
            className={`pb-3 px-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'balances'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <i className="fa-solid fa-wallet" />
            Yearly Balances &amp; Carry-Forward
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`pb-3 px-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'calendar'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <i className="fa-solid fa-calendar-days" />
            Leave Calendar
          </button>
        </div>
      )}

      {/* ── TAB 1: Requests & Records ── */}
      {(activeTab === 'requests' || !isHRAdmin) && (
        <div className="space-y-6">
          {/* Balance card row: HR also sees their own balance card! */}
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
            <LeaveBalanceCard balance={balance} isLoading={balanceLoading} />

            <Card>
              <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">
                    {isHRAdmin
                      ? (scope === 'mine'
                          ? 'My Own Leaves (HR)'
                          : scope === 'employees'
                          ? 'Employee Leaves'
                          : 'All Leave Records')
                      : 'My Leave History'}
                  </h3>
                  <p className="text-xs text-gray-400">
                    {isHRAdmin
                      ? (scope === 'mine'
                          ? 'Leave dates recorded by and for your HR account'
                          : 'Maintain, approve, edit or delete leave records')
                      : 'Your applied leave requests'}
                  </p>
                </div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  {isHRAdmin && (
                    <div className="inline-flex items-center border border-gray-200 rounded-xl overflow-hidden bg-gray-50 text-xs font-semibold p-0.5">
                      <button
                        type="button"
                        onClick={() => setScope('all')}
                        className={`px-3 py-1.5 rounded-lg transition-all ${
                          scope === 'all' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-gray-500 hover:text-gray-800'
                        }`}
                      >
                        All Records
                      </button>
                      <button
                        type="button"
                        onClick={() => setScope('mine')}
                        className={`px-3 py-1.5 rounded-lg transition-all ${
                          scope === 'mine' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-gray-500 hover:text-gray-800'
                        }`}
                      >
                        <i className="fa-solid fa-user-tie mr-1" />
                        My Own Leaves (HR)
                      </button>
                      <button
                        type="button"
                        onClick={() => setScope('employees')}
                        className={`px-3 py-1.5 rounded-lg transition-all ${
                          scope === 'employees' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-gray-500 hover:text-gray-800'
                        }`}
                      >
                        Employee Leaves
                      </button>
                    </div>
                  )}
                  <LeaveFilters value={filter} onChange={setFilter} />
                </div>
              </div>
              <LeaveTable
                requests={filtered}
                isLoading={reqLoading}
                isHRAdmin={isHRAdmin}
                onApprove={handleApprove}
                onReject={handleReject}
                onEdit={req => setEditRequest(req)}
                onDelete={handleDelete}
              />
            </Card>
          </div>
        </div>
      )}

      {/* ── TAB 2: Yearly Balances (HR only) ── */}
      {isHRAdmin && activeTab === 'balances' && (
        <HRYearlyBalancesTab />
      )}

      {/* ── TAB 3: Calendar View ── */}
      {activeTab === 'calendar' && (
        <Card>
          <LeaveCalendar
            year={year}
            month={month}
            data={calendarData}
            isLoading={calLoading}
            onPrevMonth={prevMonth}
            onNextMonth={nextMonth}
          />
        </Card>
      )}

      {/* ── Add / Record Leave Modal ── */}
      {showAddModal && (
        <HRAddLeaveModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false)
            handleReloadAll()
          }}
        />
      )}

      {/* ── Edit Leave Modal ── */}
      {editRequest && (
        <HREditLeaveModal
          leave={editRequest}
          onClose={() => setEditRequest(null)}
          onSuccess={() => {
            setEditRequest(null)
            handleReloadAll()
          }}
        />
      )}

      {/* ── Approve modal ── */}
      {approveRequest !== null && (
        <ApproveModal
          leaveRequest={approveRequest}
          onClose={() => setApproveRequest(null)}
          onSuccess={() => {
            refetchRequests()
            refetchBalance()
            setApproveRequest(null)
          }}
        />
      )}
    </div>
  )
}
