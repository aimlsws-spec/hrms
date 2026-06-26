import { ReactNode } from 'react'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: ReactNode
  isLoading?: boolean
}

export default function StatCard({ title, value, subtitle, icon, isLoading }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200 group cursor-default">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center text-primary-700 text-sm group-hover:bg-primary-100 transition-colors duration-200">
          {icon}
        </div>
      </div>
      <div className="text-2xl font-bold text-primary-900 mb-1 leading-none">
        {isLoading
          ? <span className="text-xl text-gray-200 animate-pulse">—</span>
          : value}
      </div>
      <p className="text-[13px] font-semibold text-gray-700 mt-1.5">{title}</p>
      {subtitle && <p className="text-[11px] text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  )
}
