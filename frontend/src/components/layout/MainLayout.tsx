import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import { useAuthStore } from '../../store/authStore'
import FirstLoginDetailsModal from '../employee/FirstLoginDetailsModal'

export default function MainLayout() {
  const { user } = useAuthStore()
  const showFirstLoginModal =
    user?.role === 'employee' && user?.profile_completed === false

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 lg:p-5">
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
