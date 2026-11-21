import { useState, useEffect } from 'react'
import { teamsApi } from '../../api/teams'
import type { Team } from '../../types/team'

export interface TeamSizePoint {
  name: string
  members: number
}

export function useTeamAnalytics() {
  const [teams, setTeams]         = useState<Team[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError]         = useState('')

  useEffect(() => {
    async function load() {
      setIsLoading(true)
      setError('')
      try {
        const { data } = await teamsApi.getAll()
        setTeams(data.teams ?? [])
      } catch {
        setError('Failed to load team data.')
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  const teamSizeData: TeamSizePoint[] = teams
    .filter(t => t.member_count > 0)
    .sort((a, b) => b.member_count - a.member_count)
    .map(t => ({ name: t.team_name, members: t.member_count }))

  return { teams, teamSizeData, isLoading, error }
}
