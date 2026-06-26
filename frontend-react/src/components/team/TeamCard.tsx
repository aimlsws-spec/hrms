import type { Team } from '../../types/team'

interface Props {
  team: Team
  isSelected: boolean
  isHRAdmin: boolean
  onSelect: (id: number) => void
  onDelete: (id: number, name: string) => void
}

export default function TeamCard({ team, isSelected, isHRAdmin, onSelect, onDelete }: Props) {
  return (
    <div
      onClick={() => onSelect(team.id)}
      className={`cursor-pointer rounded-2xl border-2 p-5 transition-all ${
        isSelected
          ? 'border-primary-700 bg-primary-50'
          : 'border-gray-100 bg-white hover:border-gray-300'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="font-semibold text-gray-900 text-base truncate">{team.team_name}</h4>
          {team.description && (
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{team.description}</p>
          )}
        </div>
        {isHRAdmin && (
          <button
            onClick={e => { e.stopPropagation(); onDelete(team.id, team.team_name) }}
            className="shrink-0 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete team"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>

      <div className="mt-4 space-y-1.5">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span className="truncate">{team.manager_name ?? 'No manager'}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>{team.member_count} member{team.member_count !== 1 ? 's' : ''}</span>
        </div>
      </div>

      <div className={`mt-3 pt-3 border-t border-gray-100 text-xs font-medium ${
        isSelected ? 'text-primary-700' : 'text-gray-400'
      }`}>
        {isSelected ? 'Viewing members ▼' : 'Click to manage'}
      </div>
    </div>
  )
}
