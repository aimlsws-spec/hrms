import { Outlet } from 'react-router-dom'
import EmployeeSidebar from './EmployeeSidebar'
import EmployeeHeader from './EmployeeHeader'

export default function EmployeeLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <EmployeeSidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <EmployeeHeader />
        <main className="flex-1 overflow-y-auto px-4 py-4 lg:px-6 lg:py-5">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
