import { useState } from 'react'
import type { TeamEmployee, CreateTeamPayload } from '../../types/team'
import Button from '../ui/Button'
import ErrorAlert from '../ui/ErrorAlert'

interface Props {
  employees: TeamEmployee[]
  createdBy: string
  onSubmit: (payload: CreateTeamPayload) => Promise<{ success: boolean; message: string }>
  onCancel: () => void
}

export default function TeamForm({ employees, createdBy, onSubmit, onCancel }: Props) {
  const [teamName, setTeamName]       = useState('')
  const [managerId, setManagerId]     = useState('')
  const [description, setDescription] = useState('')
  const [isLoading, setLoading]       = useState(false)
  const [error, setError]             = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!teamName.trim()) { setError('Team name is required.'); return }
    setError('')
    setLoading(true)
    const result = await onSubmit({
      team_name:   teamName.trim(),
      manager_id:  managerId || null,
      description: description.trim() || undefined,
      created_by:  createdBy,
    })
    setLoading(false)
    if (!result.success) setError(result.message || 'Failed to create team.')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <ErrorAlert type="error" message={error} />}

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
          Team Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={teamName}
          onChange={e => setTeamName(e.target.value)}
          required
          placeholder="e.g. Engineering"
          className="w-full h-11 px-3 border-2 border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-primary-700"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Manager</label>
        <select
          value={managerId}
          onChange={e => setManagerId(e.target.value)}
          className="w-full h-11 px-3 border-2 border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-primary-700"
        >
          <option value="">-- No Manager --</option>
          {employees.map(emp => (
            <option key={emp.employee_id} value={emp.employee_id}>
              {emp.full_name} ({emp.role})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={3}
          placeholder="Optional team description"
          className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-primary-700 resize-none"
        />
      </div>

      <div className="flex gap-3 pt-1">
        <Button type="submit" loading={isLoading} className="flex-1">
          Create Team
        </Button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 h-[52px] mt-3 border-2 border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
