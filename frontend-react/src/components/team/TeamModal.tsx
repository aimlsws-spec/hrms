import TeamForm from './TeamForm'
import type { TeamEmployee, CreateTeamPayload } from '../../types/team'

interface Props {
  employees: TeamEmployee[]
  createdBy: string
  onClose: () => void
  onSubmit: (payload: CreateTeamPayload) => Promise<{ success: boolean; message: string }>
}

export default function TeamModal({ employees, createdBy, onClose, onSubmit }: Props) {
  async function handleSubmit(payload: CreateTeamPayload) {
    const result = await onSubmit(payload)
    if (result.success) onClose()
    return result
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-5">Create New Team</h3>
        <TeamForm
          employees={employees}
          createdBy={createdBy}
          onSubmit={handleSubmit}
          onCancel={onClose}
        />
      </div>
    </div>
  )
}
