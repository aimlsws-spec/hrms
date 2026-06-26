import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import Sidebar from '../../components/layout/Sidebar'
import Header from '../../components/layout/Header'

const NAV = [
  { to: '/accountant/dashboard',        label: 'Dashboard',         icon: 'fa-solid fa-chart-pie' },
  { to: '/accountant/payslips',         label: 'Payslips',          icon: 'fa-solid fa-file-invoice-dollar' },
  { to: '/accountant/salary-requests',  label: 'Salary Requests',   icon: 'fa-solid fa-file-signature' },
  { to: '/accountant/payroll',          label: 'Payroll',           icon: 'fa-solid fa-money-bill-wave' },
  { to: '/accountant/employees',        label: 'Employees',         icon: 'fa-solid fa-users' },
  { to: '/accountant/expenses',         label: 'Expenses',          icon: 'fa-solid fa-receipt' },
  { to: '/accountant/reports',          label: 'Reports',           icon: 'fa-solid fa-chart-bar' },
  { to: '/accountant/settings',         label: 'Settings',          icon: 'fa-solid fa-gear' },
]

export default function AccountantLayout() {
  const { user, clearUser } = useAuthStore()
  const navigate = useNavigate()

  const initials = (user?.full_name ?? 'A')
    .split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar
        navItems={NAV}
        brandingTitle="Seawind HRMS"
        brandingSubtitle="Accountant Panel"
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
