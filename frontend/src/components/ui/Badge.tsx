import { ReactNode } from 'react'

export type BadgeVariant = 'green' | 'blue' | 'yellow' | 'red' | 'gray' | 'purple'

interface BadgeProps {
  children: ReactNode
  variant?: BadgeVariant
}

const STYLES: Record<BadgeVariant, string> = {
  green:  'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300',
  blue:   'bg-blue-100   text-blue-700',
  yellow: 'bg-amber-100  text-amber-800 ring-1 ring-amber-300',
  red:    'bg-red-100    text-red-800 ring-1 ring-red-300',
  gray:   'bg-gray-100   text-gray-600',
  purple: 'bg-purple-100 text-purple-700',
}

export default function Badge({ children, variant = 'gray' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${STYLES[variant]}`}>
      {children}
    </span>
  )
}
