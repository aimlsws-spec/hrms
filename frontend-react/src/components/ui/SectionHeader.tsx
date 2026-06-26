import { ReactNode } from 'react'

interface SectionHeaderProps {
  title: string
  action?: ReactNode
}

export default function SectionHeader({ title, action }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      {action && <div>{action}</div>}
    </div>
  )
}
