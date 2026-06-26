import EmptyState from '../../ui/EmptyState'
import type { Announcement } from '../../../types/dashboard'

function timeAgo(dateStr?: string) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7)  return `${days}d ago`
  return `${Math.floor(days / 7)}w ago`
}

const ACCENT_COLORS = [
  { dot: 'bg-blue-500',   bg: 'bg-blue-50',   text: 'text-blue-600'   },
  { dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-600' },
  { dot: 'bg-amber-500',  bg: 'bg-amber-50',  text: 'text-amber-600'  },
]

interface Props {
  announcements: Announcement[]
  isLoading: boolean
  error: string | null
}

export default function AnnouncementsCard({ announcements, isLoading, error }: Props) {
  const recent = announcements.slice(0, 3)
  const hasMore = announcements.length > 3

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
            <i className="fa-solid fa-bullhorn text-amber-500 text-[12px]" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-gray-800">Announcements</p>
            <p className="text-[11px] text-gray-400">{announcements.length} total</p>
          </div>
        </div>
        {recent.length > 0 && (
          <span className="flex items-center gap-1 text-[11px] text-blue-600 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse inline-block" />
            New
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0,1,2].map(i => <div key={i} className="h-16 bg-gray-50 rounded-xl animate-pulse" />)}
        </div>
      ) : error ? (
        <EmptyState message="Could not load announcements" icon="⚠️" />
      ) : recent.length === 0 ? (
        <EmptyState message="No announcements yet" icon="📢" />
      ) : (
        <>
          <ul className="space-y-2.5">
            {recent.map((a, i) => {
              const c = ACCENT_COLORS[i % ACCENT_COLORS.length]
              return (
                <li key={a.id ?? i} className="flex gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div className={`w-7 h-7 rounded-lg ${c.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                    <span className={`w-2 h-2 rounded-full ${c.dot} inline-block`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-gray-800 leading-snug">{a.title}</p>
                    {(a.message || a.content) && (
                      <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">
                        {a.message ?? a.content}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      {a.creator_name && (
                        <span className="text-[10px] text-gray-400">{a.creator_name}</span>
                      )}
                      <span className={`text-[10px] font-medium ${c.text}`}>{timeAgo(a.created_at)}</span>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
          
          {hasMore && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <button className="w-full flex items-center justify-center gap-2 text-[12px] font-medium text-primary-700 hover:text-primary-900 bg-primary-50 hover:bg-primary-100 py-2 rounded-lg transition-colors">
                <i className="fa-solid fa-chevron-down text-[10px]" />
                View All ({announcements.length})
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
