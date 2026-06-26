import { useAuthStore }         from '../../store/authStore'
import { useLeaveBalance }       from '../../hooks/useLeaveBalance'
import { useAnnouncements }      from '../../hooks/useAnnouncements'
import { useAttendanceSummary }  from '../../hooks/employee/dashboard/useAttendanceSummary'

import EmployeeWelcomeCard    from '../../components/employee/dashboard/EmployeeWelcomeCard'
import AttendanceSummaryCard  from '../../components/employee/dashboard/AttendanceSummaryCard'
import LeaveBalanceCard       from '../../components/employee/dashboard/LeaveBalanceCard'
import AnnouncementsCard      from '../../components/employee/dashboard/AnnouncementsCard'
import QuickActionsCard       from '../../components/employee/dashboard/QuickActionsCard'
import SalaryInfoCard         from '../../components/employee/profile/SalaryInfoCard'

/**
 * Derive the employee_code used in attendance + leave_balance tables.
 * - Signup employees:     user_id = 4 (INT)  → "EMP0004"
 * - HR-created employees: user_id may already be "EMP0001"
 */
function toEmployeeCode(userId: number | string | undefined): string {
  if (userId == null) return ''
  const s = String(userId)
  if (/^EMP\d+$/i.test(s)) return s.toUpperCase()
  const n = parseInt(s, 10)
  return n > 0 ? `EMP${String(n).padStart(4, '0')}` : s
}

export default function EmployeeDashboardPage() {
  const { user } = useAuthStore()

  const employeeCode = toEmployeeCode(user?.user_id)

  const { summary,       isLoading: attLoading,  error: attError }  = useAttendanceSummary(employeeCode)
  const { balance,       total,     isLoading: leaveLoading }        = useLeaveBalance(employeeCode)
  const { announcements, isLoading: annLoading,  error: annError }   = useAnnouncements()

  if (!user) return null

  return (
    <div className="space-y-4">

      {/* Welcome banner */}
      <EmployeeWelcomeCard user={user} />

      {/* Main grid layout: 2 columns on large screens, 1 on small */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Left column (2/3 width) */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* Row 1: Attendance and Leave Balance (equal widths) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AttendanceSummaryCard
              summary={summary}
              isLoading={attLoading}
              error={attError}
            />
            <LeaveBalanceCard
              balance={balance}
              total={total}
              isLoading={leaveLoading}
            />
          </div>

          {/* Row 2: Announcements (full width) */}
          <AnnouncementsCard
            announcements={announcements}
            isLoading={annLoading}
            error={annError}
          />

        </div>

        {/* Right column (1/3 width) - Consistent sidebar */}
        <div className="space-y-4">
          <QuickActionsCard />
          <SalaryInfoCard employeeId={employeeCode} />
        </div>

      </div>

    </div>
  )
}
