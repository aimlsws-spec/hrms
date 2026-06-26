import { useState } from 'react'
import Button from '../ui/Button'
import ErrorAlert from '../ui/ErrorAlert'
import DocumentResult from './DocumentResult'
import EmployeeSelect from './EmployeeSelect'
import { useGenerateDocument } from '../../hooks/documents/useGenerateDocument'

const now = new Date()
const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

interface Props {
  onCancel: () => void
}

export default function SalarySlipForm({ onCancel }: Props) {
  const { isLoading, error, result, reset, salarySlip } = useGenerateDocument()
  const [employeeId, setEmployeeId] = useState('')
  const [monthYear, setMonthYear]   = useState(defaultMonth)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!employeeId) return
    const [year, month] = monthYear.split('-')
    await salarySlip({ employee_id: employeeId, month: parseInt(month), year: parseInt(year) })
  }

  if (result) {
    const [year, month] = monthYear.split('-')
    return (
      <DocumentResult
        title="Salary Slip"
        filename={result.filename}
        filepath={result.filepath}
        html={result.html}
        details={[
          { label: 'Employee', value: employeeId },
          { label: 'Period', value: `${month}/${year}` },
        ]}
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

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Month <span className="text-red-500">*</span>
          </label>
          <input
            type="month"
            value={monthYear}
            onChange={e => setMonthYear(e.target.value)}
            required
            className="w-full h-11 px-3 border-2 border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-primary-700"
          />
        </div>

        <div className="flex gap-3 pt-1">
          <Button type="submit" loading={isLoading} loadingText="Generating..." className="flex-1">
            Generate Salary Slip
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
