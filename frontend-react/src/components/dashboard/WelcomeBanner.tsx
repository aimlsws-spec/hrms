import { useMemo, useState, useEffect } from 'react'
import type { User } from '../../types/user'

function greeting() {
  const h = new Date().getHours()
  if (h >= 5  && h < 12) return 'Good Morning'
  if (h >= 12 && h < 17) return 'Good Afternoon'
  return 'Good Evening'
}

interface WelcomeBannerProps {
  user: User | null
}

export default function WelcomeBanner({ user }: WelcomeBannerProps) {
  const greet = useMemo(greeting, [])
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="bg-primary-900 rounded-xl px-6 py-4 text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight mb-2">
          {greet}, {user?.full_name ?? 'User'}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <span className="bg-primary-800 text-primary-100 rounded-full px-2.5 py-0.5 text-xs font-medium border border-primary-700/50">
            {user?.role === 'admin' ? 'HR Admin' : user?.role === 'hr' ? 'HR Manager' : 'Employee'}
          </span>
          <span className="bg-primary-800 text-primary-100 rounded-full px-2.5 py-0.5 text-xs font-medium border border-primary-700/50">
            <i className="fas fa-circle text-[8px] text-green-400 mr-1.5 relative -top-[1px]"></i>
            Active
          </span>
          <span className="bg-primary-800 text-primary-100 rounded-full px-2.5 py-0.5 text-xs font-medium border border-primary-700/50 sm:hidden">
            {dateStr}
          </span>
        </div>
      </div>
      <div className="text-right hidden sm:block shrink-0">
        <p className="text-white text-lg font-semibold tabular-nums">{timeStr}</p>
        <p className="text-primary-200 text-xs mt-0.5">{dateStr}</p>
      </div>
    </div>
  )
}
