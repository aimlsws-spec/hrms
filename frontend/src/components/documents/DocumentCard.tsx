import type { ReactNode } from 'react'

type CardColor = 'green' | 'blue' | 'orange' | 'purple'

const colorMap: Record<CardColor, { icon: string; title: string; border: string }> = {
  green:  { icon: 'bg-green-100 text-green-700',  title: 'text-green-700',  border: 'hover:border-green-300' },
  blue:   { icon: 'bg-blue-100 text-blue-700',    title: 'text-blue-700',   border: 'hover:border-blue-300'  },
  orange: { icon: 'bg-orange-100 text-orange-700', title: 'text-orange-700', border: 'hover:border-orange-300' },
  purple: { icon: 'bg-purple-100 text-purple-700', title: 'text-purple-700', border: 'hover:border-purple-300' },
}

interface Props {
  title: string
  description: string
  icon: ReactNode
  color: CardColor
  isActive: boolean
  onClick: () => void
}

export default function DocumentCard({ title, description, icon, color, isActive, onClick }: Props) {
  const c = colorMap[color]
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-5 rounded-2xl border-2 transition-all ${
        isActive
          ? 'border-primary-700 bg-primary-50 shadow-md'
          : `border-gray-100 bg-white hover:shadow-md ${c.border}`
      }`}
    >
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${c.icon}`}>
        {icon}
      </div>
      <p className={`font-semibold text-sm mb-0.5 ${isActive ? 'text-primary-900' : c.title}`}>
        {title}
      </p>
      <p className="text-xs text-gray-500">{description}</p>
    </button>
  )
}
