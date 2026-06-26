import { useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { useTeams } from '../hooks/team/useTeams'
import { useTeamMembers } from '../hooks/team/useTeamMembers'
import TeamTable from '../components/team/TeamTable'
import TeamMemberList from '../components/team/TeamMemberList'
import TeamModal from '../components/team/TeamModal'
import Card from '../components/ui/Card'
import ErrorAlert from '../components/ui/ErrorAlert'

export default function TeamPage() {
  const { user } = useAuthStore()
  const isHRAdmin = user?.role === 'admin' || user?.role === 'hr'
  const isManager = user?.role === 'manager'

  const { teams, isLoading, error, createTeam, deleteTeam, refetch } = useTeams()
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const { members, employees, teamName, isLoading: membersLoading, addMember, removeMember } =
    useTeamMembers(selectedTeamId)

  // Managers see only their own team(s)
  const visibleTeams = isManager
    ? teams.filter(t => String(t.manager_id) === String(user?.user_id))
    : teams

  function handleSelectTeam(id: number) {
    setSelectedTeamId(prev => prev === id ? null : id)
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Delete team "${name}"? All members will be removed.`)) return
    const result = await deleteTeam(id)
    if (result.success && selectedTeamId === id) setSelectedTeamId(null)
  }

  const selectedTeam = teams.find(t => t.id === selectedTeamId)

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isHRAdmin ? `${teams.length} team${teams.length !== 1 ? 's' : ''} total` : 'Your team'}
          </p>
        </div>
        {isHRAdmin && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="shrink-0 px-4 py-2 bg-primary-900 text-white rounded-xl text-sm font-semibold hover:bg-primary-800 transition-colors"
          >
            + New Team
          </button>
        )}
      </div>

      {error && <ErrorAlert type="error" message={error} />}

      {/* Team grid */}
      <TeamTable
        teams={visibleTeams}
        isLoading={isLoading}
        selectedId={selectedTeamId}
        isHRAdmin={isHRAdmin}
        onSelect={handleSelectTeam}
        onDelete={handleDelete}
      />

      {/* Member panel — shown when a team is selected */}
      {selectedTeam && (
        <Card>
          <TeamMemberList
            teamId={selectedTeam.id}
            teamName={teamName || selectedTeam.team_name}
            members={members}
            employees={employees}
            isLoading={membersLoading}
            isHRAdmin={isHRAdmin}
            onAddMember={async (empId) => {
              const result = await addMember(empId)
              if (result.success) refetch()
              return result
            }}
            onRemoveMember={async (empId) => {
              const result = await removeMember(empId)
              if (result.success) refetch()
              return result
            }}
          />
        </Card>
      )}

      {/* Create team modal */}
      {showCreateModal && (
        <TeamModal
          employees={employees}
          createdBy={user?.full_name ?? 'HR'}
          onClose={() => setShowCreateModal(false)}
          onSubmit={createTeam}
        />
      )}
    </div>
  )
}
