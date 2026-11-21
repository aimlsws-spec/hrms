/**
 * HRMS Design System Colors
 * 
 * Synchronized color palette between HR Panel and Employee Portal
 * Based on Tailwind's primary color configuration
 */

export const DESIGN_SYSTEM = {
  // Primary Brand Colors (Blue)
  primary: {
    50: '#eff6ff',
    100: '#dbeafe', 
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a', // Main brand color
  },

  // Status Badge Colors (matching HR Panel)
  status: {
    approved: 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300',
    pending: 'bg-amber-100 text-amber-800 ring-1 ring-amber-300', 
    rejected: 'bg-red-100 text-red-800 ring-1 ring-red-300',
    active: 'bg-emerald-100 text-emerald-800',
    inactive: 'bg-red-100 text-red-800',
    onLeave: 'bg-amber-100 text-amber-800',
  },

  // Background Colors
  backgrounds: {
    main: 'bg-gray-50', // Main content area
    sidebar: 'bg-primary-900', // Sidebar background
    card: 'bg-white', // Card background
    navActive: 'bg-white/15', // Active nav item
    navHover: 'bg-white/10', // Nav item hover
  },

  // Card Styling
  card: {
    border: 'border border-gray-100',
    borderRadius: 'rounded-2xl',
    shadow: 'shadow-sm',
    padding: 'p-5',
  },

  // Button Styles
  buttons: {
    primary: 'bg-primary-900 hover:bg-primary-800 text-white',
    secondary: 'border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-600',
    focus: 'focus:outline-none focus:ring-2 focus:ring-primary-900/30 focus:border-primary-700',
  },

  // Icon Colors (synchronized across portals)
  icons: {
    employeeId: 'text-blue-400',
    department: 'text-violet-400', 
    designation: 'text-indigo-400',
    role: 'text-gray-400',
    dateJoining: 'text-blue-400',
    status: 'text-emerald-400',
    phone: 'text-emerald-400',
    city: 'text-blue-400',
    location: 'text-violet-400',
  },
} as const

export type StatusType = keyof typeof DESIGN_SYSTEM.status