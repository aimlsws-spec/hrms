import { useState } from 'react'
import type { TeamMember, TeamEmployee } from '../../types/team'
import ErrorAlert from '../ui/ErrorAlert'
import Button from '../ui/Button'

function fmtDate(d?: string) {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return d }
}

function roleBadgeClass(role: string) {
  const r = role.toLowerCase()
  if (r === 'admin')    return 'bg-purple-50 text-purple-700 border-purple-200'
  if (r === 'hr')       return 'bg-blue-50 text-blue-700 border-blue-200'
  if (r === 'manager')  return 'bg-amber-50 text-amber-700 border-amber-200'
  return 'bg-gray-50 text-gray-600 border-gray-200'
}

interface Props {
  teamId: number
  teamName: string
  members: TeamMember[]
  employees: TeamEmployee[]
  isLoading: boolean
  isHRAdmin: boolean
  onAddMember: (employeeId: string) => Promise<{ success: boolean; message: string }>
  onRemoveMember: (employeeId: string) => Promise<{ success: boolean; message: string }>
}

export default function TeamMemberList({
  teamId: _teamId,
  teamName,
  members,
  employees,
  isLoading,
  isHRAdmin,
  onAddMember,
  onRemoveMember,
}: Props) {
  const [selectedEmployee, setSelectedEmployee] = useState('')
  const [addLoading, setAddLoading]             = useState(false)
  const [removingId, setRemovingId]             = useState<string | null>(null)
  const [feedback, setFeedback]                 = useState<{ type: 'error' | 'success'; msg: string } | null>(null)

  const memberIds = new Set(members.map(m => m.employee_id))
  const available = employees.filter(e => !memberIds.has(e.employee_id))

  async function handleAdd() {
    if (!selectedEmployee) return
    setAddLoading(true)
    setFeedback(null)
    const result = await onAddMember(selectedEmployee)
    setAddLoading(false)
    if (result.success) {
      setSelectedEmployee('')
      setFeedback({ type: 'success', msg: result.message || 'Member added.' })
    } else {
      setFeedback({ type: 'error', msg: result.message || 'Failed to add member.' })
    }
  }

  async function handleRemove(employeeId: string) {
    if (!confirm('Remove this member from the team?')) return
    setRemovingId(employeeId)
    setFeedback(null)
    const result = await onRemoveMember(employeeId)
    setRemovingId(null)
    if (!result.success) setFeedback({ type: 'error', msg: result.message || 'Failed to remove.' })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-base font-semibold text-gray-900">
          {teamName} — Members
          <span className="ml-2 text-sm font-normal text-gray-400">({members.length})</span>
        </h4>
      </div>

      {feedback && (
        <div className="mb-4">
          <ErrorAlert type={feedback.type} message={feedback.msg} />
        </div>
      )}

      {/* Add member row — HR/Admin only */}
      {isHRAdmin && available.length > 0 && (
        <div className="flex gap-2 mb-5">
          <select
            value={selectedEmployee}
            onChange={e => setSelectedEmployee(e.target.value)}
            className="flex-1 h-10 px-3 border-2 border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-primary-700"
          >
            <option value="">Add a member…</option>
            {available.map(emp => (
              <option key={emp.employee_id} value={emp.employee_id}>
                {emp.full_name} ({emp.role})
              </option>
            ))}
          </select>
          <Button
            onClick={handleAdd}
            loading={addLoading}
            disabled={!selectedEmployee}
            className="!h-10 !mt-0 px-4 text-sm"
          >
            Add
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : members.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">No members yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-100">
                <th className="text-left pb-3 pr-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Name</th>
                <th className="text-left pb-3 pr-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Role</th>
                <th className="text-left pb-3 pr-4 font-semibold text-gray-500 text-xs uppercase tracking-wide">Email</th>
                <th className="text-left pb-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Added</th>
                {isHRAdmin && <th className="pb-3" />}
              </tr>
            </thead>
            <tbody>
              {members.map(m => (
                <tr key={m.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="py-3 pr-4 font-medium text-gray-800 whitespace-nowrap">{m.full_name}</td>
                  <td className="py-3 pr-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${roleBadgeClass(m.role)}`}>
                      {m.role}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-gray-500 text-xs">{m.email}</td>
                  <td className="py-3 text-gray-500 text-xs whitespace-nowrap">{fmtDate(m.added_at)}</td>
                  {isHRAdmin && (
                    <td className="py-3 text-right">
                      <button
                        onClick={() => handleRemove(m.employee_id)}
                        disabled={removingId === m.employee_id}
                        className="px-2 py-1 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                      >
                        {removingId === m.employee_id ? '…' : 'Remove'}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
