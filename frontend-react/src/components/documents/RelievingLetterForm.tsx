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
  /** Called after generation — parent handles request linking */
  onSuccess?: (result: GenerateResult) => void
}

const inputCls =
  'w-full h-11 px-3 border-2 border-gray-200 rounded-xl text-sm bg-white ' +
  'focus:outline-none focus:border-primary-700 disabled:bg-gray-50 disabled:text-gray-400'

const today = new Date().toISOString().slice(0, 10)

export default function RelievingLetterForm({ onCancel, initialEmployeeId, onSuccess }: Props) {
  const { isLoading, error, result, reset, relievingLetter } = useGenerateDocument()

  const [employeeId,       setEmployeeId]       = useState(initialEmployeeId ?? '')
  const [prefilling,       setPrefilling]       = useState(false)
  const [prefillError,     setPrefillError]     = useState('')

  // 8 editable fields
  const [name,             setName]             = useState('')
  const [position,         setPosition]         = useState('')
  const [address,          setAddress]          = useState('')
  const [contactNo,        setContactNo]        = useState('')
  const [email,            setEmail]            = useState('')
  const [resignationDate,  setResignationDate]  = useState('')
  const [lastDate,         setLastDate]         = useState(today)
  const [letterDate,       setLetterDate]       = useState(today)

  useEffect(() => {
    if (initialEmployeeId) loadPrefill(initialEmployeeId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialEmployeeId])

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
        setName(d.full_name  || '')
        setPosition(d.position || '')
        setAddress(d.address  || '')
        setContactNo(d.phone  || '')
        setEmail(d.email      || '')
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
      setName(''); setPosition(''); setAddress(''); setContactNo(''); setEmail('')
      setPrefillError('')
      return
    }
    loadPrefill(id)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!employeeId) return
    await relievingLetter({
      employee_id:      employeeId,
      last_date:        lastDate,
      resignation_date: resignationDate || undefined,
      position:         position.trim()  || undefined,
      name:             name.trim()      || undefined,
      address:          address.trim()   || undefined,
      contact_no:       contactNo.trim() || undefined,
      email:            email.trim()     || undefined,
    })
  }

  if (result && !onSuccess) {
    return (
      <DocumentResult
        title="Relieving Letter"
        filename={result.filename}
        filepath={result.filepath}
        details={[
          { label: 'Employee',         value: name || employeeId },
          { label: 'Position',         value: position },
          { label: 'Last Working Day', value: lastDate },
        ]}
        onReset={reset}
      />
    )
  }

  return (
    <div>
      {error && <ErrorAlert type="error" message={error} />}

      <form onSubmit={handleSubmit} className="space-y-4">

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

        {/* Contact + Email */}
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

        {/* Resignation Date + Last Working Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Resignation Letter Date
            </label>
            <input
              type="date" value={resignationDate} onChange={e => setResignationDate(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Last Working Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date" value={lastDate} onChange={e => setLastDate(e.target.value)}
              required className={inputCls}
            />
          </div>
        </div>

        {/* Letter Date */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Letter Date
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

        <div className="flex gap-3 pt-1">
          <Button
            type="submit" loading={isLoading} loadingText="Generating PDF…"
            className="flex-1" disabled={prefilling || !employeeId}
          >
            Generate Relieving Letter
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
