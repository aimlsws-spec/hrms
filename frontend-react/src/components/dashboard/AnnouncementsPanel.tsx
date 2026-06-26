import Card from '../ui/Card'
import SectionHeader from '../ui/SectionHeader'
import Avatar from '../ui/Avatar'
import EmptyState from '../ui/EmptyState'
import type { Announcement } from '../../types/dashboard'

function AnnouncementItem({ ann }: { ann: Announcement }) {
  const isAdmin = (ann.creator_role ?? '').toLowerCase() === 'admin'
  const date = ann.created_at
    ? new Date(ann.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : ''
  const creatorName = ann.creator_name ?? 'Admin'

  return (
    <div className="flex gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <Avatar name={creatorName} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-0.5">
          <h4 className="text-[13px] font-bold text-gray-900 leading-tight">{ann.title}</h4>
          {date && <span className="text-[11px] text-gray-400 shrink-0 mt-0.5">{date}</span>}
        </div>
        <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">
          {ann.message ?? ann.content ?? ''}
        </p>
        <div className="flex items-center gap-1.5 mt-1.5">
          <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${isAdmin ? 'bg-red-400' : 'bg-blue-400'}`} />
          <span className="text-xs text-gray-400">
            {creatorName} · {(ann.creator_role ?? 'Staff').toUpperCase()}
          </span>
        </div>
      </div>
    </div>
  )
}

interface AnnouncementsPanelProps {
  announcements: Announcement[]
  isLoading: boolean
  error: string | null
}

export default function AnnouncementsPanel({ announcements, isLoading, error }: AnnouncementsPanelProps) {
  return (
    <Card>
      <SectionHeader title="Announcements" />
      {isLoading ? (
        <div className="space-y-4">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex gap-3">
              <div className="w-8 h-8 bg-gray-100 rounded-full animate-pulse shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-gray-100 rounded animate-pulse w-3/4" />
                <div className="h-3 bg-gray-100 rounded animate-pulse w-full" />
                <div className="h-3 bg-gray-100 rounded animate-pulse w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <EmptyState message="Could not load announcements" />
      ) : announcements.length === 0 ? (
        <EmptyState message="No announcements yet" />
      ) : (
        <div className="max-h-64 overflow-y-auto -mr-2 pr-2">
          {announcements.map((ann, i) => (
            <AnnouncementItem key={ann.id ?? i} ann={ann} />
          ))}
        </div>
      )}
    </Card>
  )
}
