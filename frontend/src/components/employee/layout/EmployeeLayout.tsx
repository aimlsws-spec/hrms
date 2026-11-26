import { Outlet } from 'react-router-dom'
import EmployeeSidebar from './EmployeeSidebar'
import EmployeeHeader from './EmployeeHeader'
import { useAuthStore } from '../../../store/authStore'
import FirstLoginDetailsModal from '../FirstLoginDetailsModal'

export default function EmployeeLayout() {
  const { user } = useAuthStore()
  const showFirstLoginModal =
    user?.role === 'employee' && !user?.profile_completed

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <EmployeeSidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <EmployeeHeader />
        <main className="flex-1 overflow-y-auto px-4 py-4 lg:px-6 lg:py-5">
          <Outlet />
        </main>
      </div>

      <FirstLoginDetailsModal
        isOpen={Boolean(showFirstLoginModal)}
        onCompleted={() => {}}
      />
    </div>
  )
}
