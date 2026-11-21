import { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  padding?: 'sm' | 'md' | 'lg'
}

export default function Card({ children, className = '', padding = 'md' }: CardProps) {
  const pad = { sm: 'p-3', md: 'p-4', lg: 'p-5' }[padding]
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 ${pad} ${className}`}>
      {children}
    </div>
  )
}
