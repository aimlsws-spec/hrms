import { useState } from 'react'
import Button from '../ui/Button'
import ErrorAlert from '../ui/ErrorAlert'
import DocumentResult from './DocumentResult'
import EmployeeSelect from './EmployeeSelect'
import { useGenerateDocument } from '../../hooks/documents/useGenerateDocument'

interface Props {
  onCancel: () => void
}

export default function AppointmentLetterForm({ onCancel }: Props) {
  const { isLoading, error, result, reset, appointmentLetter } = useGenerateDocument()
  const [employeeId, setEmployeeId] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!employeeId) return
    await appointmentLetter(employeeId)
  }

  if (result) {
    return (
      <DocumentResult
        title="Appointment Letter"
        filename={result.filename}
        filepath={result.filepath}
        details={[{ label: 'Employee', value: employeeId }]}
        onReset={reset}
      />
    )
  }

  return (
    <div>
      {error && <ErrorAlert type="error" message={error} />}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Employee <span className="text-red-500">*</span>
          </label>
          <EmployeeSelect value={employeeId} onChange={setEmployeeId} required />
        </div>

        <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          <i className="fa-solid fa-clock text-[10px] mr-1" />
          PDF generation may take up to 90 seconds on first run (Word startup).
        </p>

        <div className="flex gap-3 pt-1">
          <Button type="submit" loading={isLoading} loadingText="Generating PDF…" className="flex-1">
            Generate Appointment Letter
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
    </div>
  )
}
