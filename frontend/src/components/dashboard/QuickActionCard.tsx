import { ReactNode } from 'react'

interface QuickActionCardProps {
  icon: ReactNode
  title: string
  description: string
  onClick: () => void
}

export default function QuickActionCard({ icon, title, description, onClick }: QuickActionCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-200 cursor-pointer transition-all duration-150 hover:bg-primary-50 hover:border-primary-200 hover:shadow-sm active:scale-[0.98] select-none group"
    >
      <div className="w-9 h-9 bg-primary-900 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-primary-800 transition-colors duration-150">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-sm text-gray-900 truncate leading-tight">{title}</div>
        <div className="text-xs text-gray-500 truncate mt-0.5">{description}</div>
      </div>
      <i className="fas fa-chevron-right text-[10px] text-gray-300 group-hover:text-primary-500 transition-colors duration-150 mr-1" />
    </div>
  )
}
