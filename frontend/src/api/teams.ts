import client from './client'
import type { CreateTeamPayload } from '../types/team'

// API MISMATCHES DOCUMENTED:
// 1. Original addMember used POST /teams/{id}/members — backend route is /teams/{id}/add-member  (FIXED)
// 2. Original getById GET /teams/{id} — no such endpoint in backend (REMOVED)
// 3. Legacy team_functions.js used /api/admin/teams — actual router prefix is /api/teams (noted)
// 4. Added: removeMember, deleteTeam, updateManager, getEmployees (ADDED)

export const teamsApi = {
  getAll: () =>
    client.get('/teams'),

  create: (data: CreateTeamPayload) =>
    client.post('/teams/create', data),

  deleteTeam: (teamId: number) =>
    client.delete(`/teams/${teamId}`),

  getMembers: (teamId: number) =>
    client.get(`/teams/${teamId}/members`),

  addMember: (teamId: number, employeeId: string) =>
    client.post(`/teams/${teamId}/add-member`, { employee_id: employeeId }),

  removeMember: (teamId: number, employeeId: string) =>
    client.post(`/teams/${teamId}/remove-member`, { employee_id: employeeId }),

  updateManager: (teamId: number, managerId: string) =>
    client.put(`/teams/${teamId}/manager`, { manager_id: managerId }),

  getEmployees: () =>
    client.get('/teams/employees/list'),
}
