import type { Team } from '../../types/team'
import TeamCard from './TeamCard'

interface Props {
  teams: Team[]
  isLoading: boolean
  selectedId: number | null
  isHRAdmin: boolean
  onSelect: (id: number) => void
  onDelete: (id: number, name: string) => void
}

export default function TeamTable({ teams, isLoading, selectedId, isHRAdmin, onSelect, onDelete }: Props) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="h-40 bg-gray-100 rounded-2xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (!teams.length) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
        <p className="text-gray-400 text-sm">No teams yet. Create your first team.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {teams.map(team => (
        <TeamCard
          key={team.id}
          team={team}
          isSelected={selectedId === team.id}
          isHRAdmin={isHRAdmin}
          onSelect={onSelect}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}
