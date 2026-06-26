import { useState, useEffect, useMemo } from 'react'
import type { Employee, CreateEmployeePayload, EditEmployeePayload } from '../../types/employee'
import { DEPARTMENTS } from '../../types/employee'
import Input from '../ui/Input'
import Button from '../ui/Button'
import { hrSalaryApi } from '../../api/hrSalaryApi'

// ── Create form default state ─────────────────────────────────────────────
const CREATE_DEFAULTS = {
  first_name: '', middle_name: '', last_name: '',
  email: '', phone: '', department: '', title: '', password: '', annual_ctc: '',
}

// ── Edit form default state ───────────────────────────────────────────────
function editDefaults(emp: Employee) {
  return { full_name: emp.name, email: emp.email ?? '', department: emp.department ?? '', title: emp.title ?? '', phone: '', annual_ctc: '' }
}

// ── Props ─────────────────────────────────────────────────────────────────
interface CreateProps {
  mode: 'create'
  initial?: null
  isSubmitting: boolean
  onSubmit: (data: CreateEmployeePayload) => void
  onCancel: () => void
}

interface EditProps {
  mode: 'edit'
  initial: Employee
  isSubmitting: boolean
  onSubmit: (data: EditEmployeePayload) => void
  onCancel: () => void
}

type Props = CreateProps | EditProps

// ── Component ─────────────────────────────────────────────────────────────
export default function EmployeeForm({ mode, initial, isSubmitting, onSubmit, onCancel }: Props) {
  const [form, setForm] = useState<Record<string, string>>(
    mode === 'edit' && initial ? editDefaults(initial) : CREATE_DEFAULTS
  )
  const [salaryLoading, setSalaryLoading] = useState(false)

  // Track custom department text when "Other" is selected
  const isOtherDept = form.department === 'Other'
  const [customDept, setCustomDept] = useState('')

  // Reset when modal re-opens with different initial data
  useEffect(() => {
    const defaults = mode === 'edit' && initial ? editDefaults(initial) : CREATE_DEFAULTS
    // If editing and the stored department is not in the known list, treat it as "Other"
    const knownDepts = DEPARTMENTS as readonly string[]
    const storedDept = defaults.department
    if (storedDept && !knownDepts.includes(storedDept)) {
      setForm({ ...defaults, department: 'Other' })
      setCustomDept(storedDept)
    } else {
      setForm(defaults)
      setCustomDept('')
    }
  }, [mode, initial])

  // Load current salary for edit mode
  useEffect(() => {
    if (mode !== 'edit' || !initial) return
    setSalaryLoading(true)
    hrSalaryApi.getEmployeeSalary(initial.employee_id)
      .then(res => {
        if (res.data) setForm(prev => ({ ...prev, annual_ctc: String(res.data!.ctc) }))
      })
      .catch(() => {})
      .finally(() => setSalaryLoading(false))
  }, [mode, initial?.employee_id])

  // Estimate monthly net: monthly salary − PT(₹200)
  const estimatedMonthlyNet = useMemo(() => {
    const ctc = parseFloat(form.annual_ctc) || 0
    if (!ctc) return 0
    return Math.max(0, Math.round(ctc / 12 - 200))
  }, [form.annual_ctc])

  function set(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const deptValue = isOtherDept ? customDept.trim() : form.department
    if (mode === 'create') {
      const payload: CreateEmployeePayload = {
        first_name:  form.first_name,
        middle_name: form.middle_name || undefined,
        last_name:   form.last_name,
        full_name:   [form.first_name, form.middle_name, form.last_name].filter(Boolean).join(' '),
        email:       form.email,
        phone:       form.phone,
        department:  deptValue,
        title:       form.title,
        password:    form.password,
        annual_ctc:  parseFloat(form.annual_ctc) || 0,
      }
      ;(onSubmit as CreateProps['onSubmit'])(payload)
    } else {
      const payload: EditEmployeePayload = {
        full_name:  form.full_name  || undefined,
        email:      form.email      || undefined,
        department: deptValue       || undefined,
        title:      form.title      || undefined,
        phone:      form.phone      || undefined,
        annual_ctc: form.annual_ctc ? parseFloat(form.annual_ctc) : undefined,
      }
      ;(onSubmit as EditProps['onSubmit'])(payload)
    }
  }

  const labelCls = 'block mb-1.5 text-sm font-semibold text-gray-700'
  const inputCls = 'w-full h-[44px] px-3 border-2 border-gray-200 rounded-xl text-sm bg-slate-50 text-gray-900 focus:outline-none focus:border-primary-700 focus:bg-white transition-all'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* ── Create-only fields ── */}
      {mode === 'create' && (
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>First Name *</label>
            <input className={inputCls} value={form.first_name} onChange={set('first_name')} required placeholder="First" />
          </div>
          <div>
            <label className={labelCls}>Middle Name</label>
            <input className={inputCls} value={form.middle_name} onChange={set('middle_name')} placeholder="Middle" />
          </div>
          <div>
            <label className={labelCls}>Last Name *</label>
            <input className={inputCls} value={form.last_name} onChange={set('last_name')} required placeholder="Last" />
          </div>
        </div>
      )}

      {/* ── Edit-only full name ── */}
      {mode === 'edit' && (
        <div>
          <label className={labelCls}>Full Name</label>
          <input className={inputCls} value={form.full_name} onChange={set('full_name')} placeholder="Full name" />
        </div>
      )}

      {/* ── Shared fields ── */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Email *</label>
          <input type="email" className={inputCls} value={form.email} onChange={set('email')} required={mode === 'create'} placeholder="email@company.com" />
        </div>
        <div>
          <label className={labelCls}>Phone {mode === 'create' && '*'}</label>
          <input type="tel" className={inputCls} value={form.phone} onChange={set('phone')} required={mode === 'create'} placeholder="+91 …" />
        </div>
        <div>
          <label className={labelCls}>Department *</label>
          <select
            className={inputCls}
            value={form.department}
            onChange={e => {
              set('department')(e)
              if (e.target.value !== 'Other') setCustomDept('')
            }}
            required
          >
            <option value="">Select…</option>
            {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
            <option value="Other">Other…</option>
          </select>
          {isOtherDept && (
            <input
              className={inputCls + ' mt-2'}
              value={customDept}
              onChange={e => setCustomDept(e.target.value)}
              placeholder="Enter department name"
              required
              autoFocus
            />
          )}
        </div>
        <div>
          <label className={labelCls}>Job Title *</label>
          <input className={inputCls} value={form.title} onChange={set('title')} required={mode === 'create'} placeholder="e.g. Software Engineer" />
        </div>
      </div>

      {/* ── Create-only: password + CTC ── */}
      {mode === 'create' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Password * <span className="text-gray-400 font-normal">(min 8)</span></label>
            <Input
              wrapperClass=""
              type="password"
              value={form.password}
              onChange={set('password')}
              required
              minLength={8}
              placeholder="Min 8 characters"
            />
          </div>
          <div>
            <label className={labelCls}>Annual CTC *</label>
            <input type="number" className={inputCls} value={form.annual_ctc} onChange={set('annual_ctc')} required min={0} step={1000} placeholder="e.g. 600000" />
          </div>
        </div>
      )}

      {/* ── Salary (edit mode only) ── */}
      {mode === 'edit' && (
        <div className="pt-1">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-1">Salary</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>
          <div>
            <label className={labelCls}>Annual CTC (₹)</label>
            <input
              type="number"
              className={inputCls}
              value={form.annual_ctc}
              onChange={set('annual_ctc')}
              min={0}
              step={10000}
              placeholder="e.g. 600000"
            />
            {salaryLoading && (
              <p className="text-[11px] text-gray-400 mt-1">Loading current salary…</p>
            )}
            {!salaryLoading && estimatedMonthlyNet > 0 && (
              <p className="text-[11px] text-gray-400 mt-1">
                Est. monthly net: ₹{estimatedMonthlyNet.toLocaleString('en-IN')}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Actions ── */}
      <div className="flex gap-3 pt-2">
        <Button type="submit" loading={isSubmitting} className="flex-1 mt-0">
          {mode === 'create' ? 'Add Employee' : 'Save Changes'}
        </Button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 h-[52px] border-2 border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
