import { useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { useLeaveBalance } from '../hooks/useLeaveBalance'
import { useLeaveCalendar } from '../hooks/leave/useLeaveCalendar'
import { useLeaveRequests } from '../hooks/leave/useLeaveRequests'
import LeaveCalendar from '../components/leave/LeaveCalendar'
import LeaveBalanceCard from '../components/leave/LeaveBalanceCard'
import LeaveTable from '../components/leave/LeaveTable'
import LeaveFilters, { type LeaveFilterStatus } from '../components/leave/LeaveFilters'
import ApproveModal from '../components/leave/ApproveModal'
import Card from '../components/ui/Card'
import type { LeaveRequest } from '../types/leave'

export default function LeavePage() {
  const { user } = useAuthStore()
  const isHRAdmin = user?.role === 'admin' || user?.role === 'hr'

  const { balance, isLoading: balanceLoading } = useLeaveBalance(user?.user_id ?? null)

  const { year, month, data: calendarData, isLoading: calLoading, prevMonth, nextMonth } =
    useLeaveCalendar(user?.user_id ?? null)

  const { requests, isLoading: reqLoading, refetch, rejectRequest } =
    useLeaveRequests(isHRAdmin, user?.user_id)

  const [filter,          setFilter]          = useState<LeaveFilterStatus>('all')
  const [approveRequest,  setApproveRequest]  = useState<LeaveRequest | null>(null)

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter)

  function handleApprove(id: number) {
    const req = requests.find(r => r.id === id) ?? null
    setApproveRequest(req)
  }

  function handleReject(id: number) {
    const reason = window.prompt('Enter reason for rejection (optional):')
    if (reason === null) return
    rejectRequest(id, user?.full_name ?? 'HR', reason)
  }

  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leave Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Requests, approvals, and balances</p>
        </div>
      </div>

      {/* ── Balance + Calendar row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* Balance card — employees only (HR/Admin sees it for their own info) */}
        {!isHRAdmin && (
          <LeaveBalanceCard balance={balance} isLoading={balanceLoading} />
        )}

        <div className={isHRAdmin ? 'col-span-full' : ''}>
          <LeaveCalendar
            year={year}
            month={month}
            data={calendarData}
            isLoading={calLoading}
            onPrevMonth={prevMonth}
            onNextMonth={nextMonth}
          />
        </div>
      </div>

      {/* ── Requests table ── */}
      <Card>
        <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
          <h3 className="text-base font-semibold text-gray-900">
            {isHRAdmin ? 'All Leave Requests' : 'My Leave History'}
          </h3>
          <LeaveFilters value={filter} onChange={setFilter} />
        </div>
        <LeaveTable
          requests={filtered}
          isLoading={reqLoading}
          isHRAdmin={isHRAdmin}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      </Card>

      {/* ── Approve modal ── */}
      {approveRequest !== null && (
        <ApproveModal
          leaveRequest={approveRequest}
          onClose={() => setApproveRequest(null)}
          onSuccess={() => { refetch(); setApproveRequest(null) }}
        />
      )}
    </div>
  )
}
