import { useState, useEffect } from 'react'
import Button from '../ui/Button'
import ErrorAlert from '../ui/ErrorAlert'
import DocumentResult from './DocumentResult'
import EmployeeSelect from './EmployeeSelect'
import { useGenerateDocument } from '../../hooks/documents/useGenerateDocument'
import { documentsApi } from '../../api/documents'
import type { GenerateResult } from '../../types/document'

interface Props {
  onCancel: () => void
  /** Pre-select employee when opened from a document request */
  initialEmployeeId?: string
  /** Called after successful generation — parent handles request linking.
   *  When provided the form does NOT show DocumentResult; it closes via onCancel. */
  onSuccess?: (result: GenerateResult) => void
}

const inputCls =
  'w-full h-11 px-3 border-2 border-gray-200 rounded-xl text-sm bg-white ' +
  'focus:outline-none focus:border-primary-700 disabled:bg-gray-50 disabled:text-gray-400'

const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

export default function ExperienceLetterForm({ onCancel, initialEmployeeId, onSuccess }: Props) {
  const { isLoading, error, result, reset, experienceLetter } = useGenerateDocument()

  const [employeeId,   setEmployeeId]   = useState(initialEmployeeId ?? '')
  const [prefilling,   setPrefilling]   = useState(false)
  const [prefillError, setPrefillError] = useState('')

  // 9 editable fields
  const [name,       setName]       = useState('')
  const [position,   setPosition]   = useState('')
  const [department, setDepartment] = useState('')
  const [startDate,  setStartDate]  = useState('')
  const [endDate,    setEndDate]    = useState(today)
  const [address,    setAddress]    = useState('')
  const [contactNo,  setContactNo]  = useState('')
  const [email,      setEmail]      = useState('')
  const [letterDate, setLetterDate] = useState(today)

  // Auto-load when initialEmployeeId provided
  useEffect(() => {
    if (initialEmployeeId) loadPrefill(initialEmployeeId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialEmployeeId])

  // Linked-request mode: call onSuccess and close after generation
  useEffect(() => {
    if (result && onSuccess) {
      onSuccess(result)
      reset()
    }
  }, [result, onSuccess, reset])

  async function loadPrefill(id: string) {
    setPrefillError('')
    setPrefilling(true)
    try {
      const { data } = await documentsApi.getEmployeePrefill(id)
      if (data.success && data.data) {
        const d = data.data
        setName(d.full_name     || '')
        setPosition(d.position  || '')
        setDepartment(d.department || '')
        setAddress(d.address    || '')
        setContactNo(d.phone    || '')
        setEmail(d.email        || '')
        setStartDate(d.joining_date || '')
      } else {
        setPrefillError(data.message || 'Could not load employee details — fill manually.')
      }
    } catch {
      setPrefillError('Could not auto-fill employee details — fill manually.')
    } finally {
      setPrefilling(false)
    }
  }

  function handleEmployeeChange(id: string) {
    setEmployeeId(id)
    if (!id) {
      setName(''); setPosition(''); setDepartment(''); setStartDate('')
      setAddress(''); setContactNo(''); setEmail(''); setPrefillError('')
      return
    }
    loadPrefill(id)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!employeeId) return
    await experienceLetter({
      employee_id: employeeId,
      position:    position.trim(),
      department:  department.trim(),
      start_date:  startDate,
      end_date:    endDate,
      name:        name.trim(),
      address:     address.trim(),
      contact_no:  contactNo.trim(),
      email:       email.trim(),
      skip_insert: !!initialEmployeeId
    })
  }

  // Standalone mode: show DocumentResult with Download button
  if (result && !onSuccess) {
    return (
      <DocumentResult
        title="Experience Letter"
        filename={result.filename}
        filepath={result.filepath}
        details={[
          { label: 'Employee',   value: name || employeeId },
          { label: 'Position',   value: position },
          { label: 'Department', value: department },
          { label: 'Period',     value: `${startDate} – ${endDate}` },
        ]}
        onReset={reset}
      />
    )
  }

  return (
    <div>
      {error && <ErrorAlert type="error" message={error} />}

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Employee selector — hidden when pre-filled from a request */}
        {!initialEmployeeId && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Employee <span className="text-red-500">*</span>
            </label>
            <EmployeeSelect value={employeeId} onChange={handleEmployeeChange} required />
          </div>
        )}

        {prefilling && (
          <p className="text-xs text-gray-400 flex items-center gap-1.5">
            <i className="fa-solid fa-circle-notch animate-spin text-[10px]" />
            Loading employee details…
          </p>
        )}
        {prefillError && <p className="text-xs text-amber-500">{prefillError}</p>}

        {/* Name + Position */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Employee Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              required placeholder="Full name" className={inputCls} disabled={prefilling}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Position <span className="text-red-500">*</span>
            </label>
            <input
              type="text" value={position} onChange={e => setPosition(e.target.value)}
              required placeholder="e.g. Software Engineer" className={inputCls} disabled={prefilling}
            />
          </div>
        </div>

        {/* Department */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Department <span className="text-red-500">*</span>
          </label>
          <input
            type="text" value={department} onChange={e => setDepartment(e.target.value)}
            required placeholder="e.g. Engineering" className={inputCls} disabled={prefilling}
          />
        </div>

        {/* Start Date + End Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Starting Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              required className={inputCls} disabled={prefilling}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Ending Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              required className={inputCls}
            />
          </div>
        </div>

        {/* Address */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Address <span className="text-red-500">*</span>
          </label>
          <input
            type="text" value={address} onChange={e => setAddress(e.target.value)}
            required placeholder="Residential address" className={inputCls} disabled={prefilling}
          />
        </div>

        {/* Contact No + Email */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Contact No <span className="text-red-500">*</span>
            </label>
            <input
              type="text" value={contactNo} onChange={e => setContactNo(e.target.value)}
              required placeholder="+91-9876543210" className={inputCls} disabled={prefilling}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Email ID <span className="text-red-500">*</span>
            </label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              required placeholder="employee@email.com" className={inputCls} disabled={prefilling}
            />
          </div>
        </div>

        {/* Letter Date */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Date (Letter Date)
          </label>
          <input
            type="date" value={letterDate} onChange={e => setLetterDate(e.target.value)}
            className={inputCls}
          />
        </div>

        <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          <i className="fa-solid fa-clock text-[10px] mr-1" />
          PDF generation may take up to 90 seconds on first run (Word startup).
        </p>

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <Button
            type="submit" loading={isLoading} loadingText="Generating PDF…"
            className="flex-1" disabled={prefilling || !employeeId}
          >
            Generate Experience Letter
          </Button>
          <button
            type="button" onClick={onCancel}
            className="flex-1 h-[52px] mt-3 border-2 border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>

      </form>
    </div>
  )
}
