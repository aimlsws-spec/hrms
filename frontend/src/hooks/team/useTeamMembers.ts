import { useState, useEffect, useCallback } from 'react'
import { teamsApi } from '../../api/teams'
import type { TeamMember, TeamEmployee } from '../../types/team'

export function useTeamMembers(teamId: number | null) {
  const [members, setMembers]     = useState<TeamMember[]>([])
  const [employees, setEmployees] = useState<TeamEmployee[]>([])
  const [teamName, setTeamName]   = useState('')
  const [isLoading, setLoading]   = useState(false)
  const [error, setError]         = useState('')

  const fetchMembers = useCallback(async () => {
    if (!teamId) return
    setLoading(true)
    setError('')
    try {
      const { data } = await teamsApi.getMembers(teamId)
      setMembers(data.members ?? [])
      setTeamName(data.team_name ?? '')
    } catch {
      setError('Failed to load members.')
    } finally {
      setLoading(false)
    }
  }, [teamId])

  // Load employee list once for add-member dropdown
  useEffect(() => {
    teamsApi.getEmployees()
      .then(({ data }) => setEmployees(data.employees ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (teamId) {
      fetchMembers()
    } else {
      setMembers([])
      setTeamName('')
    }
  }, [teamId, fetchMembers])

  async function addMember(employeeId: string): Promise<{ success: boolean; message: string }> {
    if (!teamId) return { success: false, message: 'No team selected' }
    try {
      const { data } = await teamsApi.addMember(teamId, employeeId)
      if (data.success) await fetchMembers()
      return { success: !!data.success, message: data.message ?? '' }
    } catch {
      return { success: false, message: 'Connection failed.' }
    }
  }

  async function removeMember(employeeId: string): Promise<{ success: boolean; message: string }> {
    if (!teamId) return { success: false, message: 'No team selected' }
    try {
      const { data } = await teamsApi.removeMember(teamId, employeeId)
      if (data.success) await fetchMembers()
      return { success: !!data.success, message: data.message ?? '' }
    } catch {
      return { success: false, message: 'Connection failed.' }
    }
  }

  return { members, employees, teamName, isLoading, error, refetch: fetchMembers, addMember, removeMember }
}
