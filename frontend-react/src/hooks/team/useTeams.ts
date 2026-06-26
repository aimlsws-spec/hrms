import { useState, useEffect, useCallback } from 'react'
import { teamsApi } from '../../api/teams'
import type { Team, CreateTeamPayload } from '../../types/team'

export function useTeams() {
  const [teams, setTeams]       = useState<Team[]>([])
  const [isLoading, setLoading] = useState(true)
  const [error, setError]       = useState('')

  const fetchTeams = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await teamsApi.getAll()
      setTeams(data.teams ?? [])
    } catch {
      setError('Failed to load teams.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTeams() }, [fetchTeams])

  async function createTeam(payload: CreateTeamPayload): Promise<{ success: boolean; message: string }> {
    try {
      const { data } = await teamsApi.create(payload)
      if (data.success) { await fetchTeams() }
      return { success: !!data.success, message: data.message ?? '' }
    } catch {
      return { success: false, message: 'Connection failed.' }
    }
  }

  async function deleteTeam(teamId: number): Promise<{ success: boolean; message: string }> {
    try {
      const { data } = await teamsApi.deleteTeam(teamId)
      if (data.success) { await fetchTeams() }
      return { success: !!data.success, message: data.message ?? '' }
    } catch {
      return { success: false, message: 'Connection failed.' }
    }
  }

  async function updateManager(teamId: number, managerId: string): Promise<{ success: boolean; message: string }> {
    try {
      const { data } = await teamsApi.updateManager(teamId, managerId)
      if (data.success) { await fetchTeams() }
      return { success: !!data.success, message: data.message ?? '' }
    } catch {
      return { success: false, message: 'Connection failed.' }
    }
  }

  return { teams, isLoading, error, refetch: fetchTeams, createTeam, deleteTeam, updateManager }
}
