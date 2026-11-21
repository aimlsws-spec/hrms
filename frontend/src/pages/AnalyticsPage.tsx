import { useAnalyticsOverview } from '../hooks/analytics/useAnalyticsOverview'
import { useLeaveAnalytics } from '../hooks/analytics/useLeaveAnalytics'
import AnalyticsStats from '../components/analytics/AnalyticsStats'
import DepartmentChart from '../components/analytics/DepartmentChart'
import EmployeeStatusChart from '../components/analytics/EmployeeStatusChart'
import LeaveStatusChart from '../components/analytics/LeaveStatusChart'
import LeaveTypeChart from '../components/analytics/LeaveTypeChart'
import ActivityFeed from '../components/analytics/ActivityFeed'

export default function AnalyticsPage() {
  const {
    overview, deptData, statusData, pendingRegCount, totalDepts, isLoading: ovLoading,
  } = useAnalyticsOverview()

  const {
    statusData: leaveStatus, typeData: leaveType, recentRequests,
    pendingCount: pendingLeaves, total: totalLeaves, isLoading: leaveLoading,
  } = useLeaveAnalytics()

  const stats = [
    {
      label: 'Total Employees',
      value: ovLoading ? '—' : (overview?.total_employees ?? '—'),
      color: 'text-blue-900',
      sub: 'From employees table',
    },
    {
      label: 'Pending Leaves',
      value: leaveLoading ? '—' : pendingLeaves,
      color: 'text-amber-600',
      sub: `of ${totalLeaves} total requests`,
    },
    {
      label: 'Pending Regularizations',
      value: ovLoading ? '—' : pendingRegCount,
      color: 'text-purple-600',
      sub: 'Awaiting approval',
    },
    {
      label: 'Departments',
      value: ovLoading ? '—' : totalDepts,
      color: 'text-teal-700',
      sub: 'Active departments',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">HR Analytics</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Real-time insights from employee, leave, attendance, and team data
        </p>
      </div>

      <AnalyticsStats stats={stats} isLoading={false} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DepartmentChart data={deptData} isLoading={ovLoading} />
        <EmployeeStatusChart data={statusData} isLoading={ovLoading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LeaveStatusChart data={leaveStatus} isLoading={leaveLoading} />
        <LeaveTypeChart data={leaveType} isLoading={leaveLoading} />
      </div>

      <div className="grid grid-cols-1 gap-6">
        <ActivityFeed requests={recentRequests} isLoading={leaveLoading} totalCount={totalLeaves} />
      </div>
    </div>
  )
}
