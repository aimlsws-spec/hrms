import { lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

import WelcomeBanner          from '../components/dashboard/WelcomeBanner'
import StatCard                from '../components/dashboard/StatCard'
import QuickActionCard         from '../components/dashboard/QuickActionCard'
import RecentEmployeesTable    from '../components/dashboard/RecentEmployeesTable'
import AnnouncementsPanel      from '../components/dashboard/AnnouncementsPanel'
import CreateAnnouncementForm  from '../components/dashboard/CreateAnnouncementForm'
import PendingLeavesPanel      from '../components/dashboard/PendingLeavesPanel'
import SalaryDeductionsReviewPanel from '../components/dashboard/SalaryDeductionsReviewPanel'
import LeaveBalanceWidget      from '../components/dashboard/LeaveBalanceWidget'
import LeaveCalendar           from '../components/dashboard/LeaveCalendar'

// Lazy-loaded — only fetched when an HR/Admin actually views the dashboard.
// Migrated to MVC: view + controller (usePendingSalaries) + model (salaryModel).
const PendingSalaryPanel = lazy(() => import('../views/PendingSalaryView'))

import { useDashboardStats }   from '../hooks/useDashboardStats'
import { useAnnouncements }    from '../hooks/useAnnouncements'
import { usePendingLeaves }    from '../hooks/usePendingLeaves'
import { useLeaveBalance }     from '../hooks/useLeaveBalance'

export default function DashboardPage() {
  const { user }    = useAuthStore()
  const navigate    = useNavigate()

  const isAdmin     = user?.role === 'admin'
  const isAdminOrHR = user?.role === 'admin' || user?.role === 'hr'
  const showLeave   = !isAdmin

  const { totalEmployees, isLoading: statsLoading }        = useDashboardStats()
  const { announcements, isLoading: annLoading, error: annError, refetch: refetchAnn } = useAnnouncements()
  const { pendingCount, pendingRequests, isLoading: pendingLoading } = usePendingLeaves()
  const { balance, total: leaveTotal, isLoading: balanceLoading }    = useLeaveBalance(
    showLeave ? (user?.user_id ?? null) : null
  )

  return (
    <div className="space-y-4">

      {/* ── Row 0: Welcome banner ── */}
      <WelcomeBanner user={user} />

      {/* ── Pending tasks for HR (new employees waiting for salary / details) ── */}
      {isAdminOrHR && (
        <Suspense fallback={null}>
          <PendingSalaryPanel />
        </Suspense>
      )}

      {/* ── Row 1: KPI stat cards & Attendance ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {isAdminOrHR && (
          <StatCard
            title="Total Employees"
            value={totalEmployees ?? '—'}
            subtitle="Active workforce"
            icon={<i className="fas fa-users" />}
            isLoading={statsLoading}
          />
        )}
        {showLeave && (
          <StatCard
            title="Leave Balance"
            value={`${leaveTotal.toFixed(1)}`}
            subtitle="Days available"
            icon={<i className="fas fa-calendar-check" />}
            isLoading={balanceLoading}
          />
        )}
        {isAdminOrHR && (
          <StatCard
            title="Pending Approvals"
            value={pendingCount}
            subtitle="Awaiting action"
            icon={<i className="fas fa-hourglass-half" />}
            isLoading={pendingLoading}
          />
        )}
        <StatCard
          title="Attendance Rate"
          value="94.2%"
          subtitle="This month"
          icon={<i className="fas fa-chart-line" />}
        />
      </div>

      {/* ── Row 2: Recent Employees + Quick Actions ── */}
      <div className={`grid grid-cols-1 gap-4 items-start ${isAdminOrHR ? 'xl:grid-cols-[1fr_300px]' : ''}`}>
        {isAdminOrHR && <RecentEmployeesTable />}

        {/* Quick Actions panel */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <h3 className="text-base font-semibold text-gray-900 mb-1">Quick Actions</h3>
          <p className="text-xs text-gray-400 mb-4">Common tasks at your fingertips</p>
          <div className="grid grid-cols-1 gap-2">
            <QuickActionCard
              icon={<i className="fas fa-calendar-plus text-white text-[16px]"></i>}
              title="Apply for Leave"
              description="Submit a new request"
              onClick={() => navigate('/leaves')}
            />
            <QuickActionCard
              icon={<i className="fas fa-users-cog text-white text-[16px]"></i>}
              title="Team Management"
              description="View & manage your team"
              onClick={() => navigate('/teams')}
            />
            {isAdminOrHR && (
              <QuickActionCard
                icon={<i className="fas fa-file-invoice text-white text-[16px]"></i>}
                title="Generate Document"
                description="Salary slips & letters"
                onClick={() => navigate('/documents')}
              />
            )}
            {isAdminOrHR && (
              <QuickActionCard
                icon={<i className="fas fa-user-plus text-white text-[16px]"></i>}
                title="Add Employee"
                description="Register new team member"
                onClick={() => navigate('/employees')}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Row 3 & 4: Main Content + Sidebar Widgets ── */}
      <div className={`grid grid-cols-1 gap-4 items-start ${isAdminOrHR ? 'xl:grid-cols-[1fr_300px]' : ''}`}>
        
        {/* Left Column (Main Content) */}
        <div className="space-y-4 flex flex-col">
          <AnnouncementsPanel
            announcements={announcements}
            isLoading={annLoading}
            error={annError}
          />
          {isAdminOrHR && (
            <>
              <PendingLeavesPanel
                requests={pendingRequests}
                isLoading={pendingLoading}
              />
              <SalaryDeductionsReviewPanel />
            </>
          )}
        </div>

        {/* Right Column (Sidebar Widgets) */}
        <div className="space-y-4 flex flex-col">
          {isAdminOrHR && (
            <CreateAnnouncementForm onCreated={refetchAnn} />
          )}
          {showLeave && (
            <LeaveBalanceWidget
              balance={balance}
              total={leaveTotal}
              isLoading={balanceLoading}
            />
          )}
          <LeaveCalendar />
        </div>
      </div>

    </div>
  )
}
