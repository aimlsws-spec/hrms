export interface Team {
  id: number
  team_name: string
  manager_id: string | null
  manager_name: string | null
  description: string | null
  created_by: string | null
  created_at: string
  member_count: number
}

export interface TeamMember {
  id: number
  employee_id: string
  full_name: string
  role: string
  email: string
  added_at: string
}

export interface TeamEmployee {
  employee_id: string
  full_name: string
  role: string
  email: string
}

export interface CreateTeamPayload {
  team_name: string
  manager_id?: string | null
  description?: string
  created_by?: string
}
