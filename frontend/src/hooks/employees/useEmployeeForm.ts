import { useState } from 'react'
import { employeesApi } from '../../api/employees'
import { hrSalaryApi } from '../../api/hrSalaryApi'
import type { Employee, CreateEmployeePayload, EditEmployeePayload } from '../../types/employee'

export type FormMode = 'create' | 'edit'

export function useEmployeeForm(onSuccess: () => void) {
  const [mode, setMode]               = useState<FormMode>('create')
  const [editing, setEditing]         = useState<Employee | null>(null)
  const [isOpen, setIsOpen]           = useState(false)
  const [isSubmitting, setSubmitting] = useState(false)
  const [error, setError]             = useState<string | null>(null)

  function openCreate() {
    setMode('create')
    setEditing(null)
    setError(null)
    setIsOpen(true)
  }

  function openEdit(emp: Employee) {
    setMode('edit')
    setEditing(emp)
    setError(null)
    setIsOpen(true)
  }

  function close() {
    setIsOpen(false)
    setEditing(null)
    setError(null)
  }

  async function submitCreate(payload: CreateEmployeePayload) {
    setSubmitting(true)
    setError(null)
    try {
      const { data } = await employeesApi.create(payload)
      if (data.success) { close(); onSuccess() }
      else setError(data.message ?? 'Failed to create employee')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Connection failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function submitEdit(id: string, payload: EditEmployeePayload) {
    setSubmitting(true)
    setError(null)
    try {
      const { annual_ctc, ...profilePayload } = payload
      const { data } = await employeesApi.update(id, profilePayload)
      if (!data.success) {
        setError(data.message ?? 'Failed to update employee')
        return
      }

      // Save salary if CTC was provided
      if (annual_ctc && annual_ctc > 0) {
        const today = new Date()
        const effectiveFrom = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
        await hrSalaryApi.setSalary({
          employee_id:        id,
          ctc:                annual_ctc,
          basic_salary:       0,
          hra:                0,
          da:                 0,
          transport_allowance: 0,
          medical_allowance:  0,
          special_allowance:  0,
          pf_deduction:       0,
          esi_deduction:      0,
          professional_tax:   0,
          income_tax:         0,
          effective_from:     effectiveFrom,
        })
      }

      close()
      onSuccess()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Connection failed')
    } finally {
      setSubmitting(false)
    }
  }

  return { mode, editing, isOpen, isSubmitting, error, openCreate, openEdit, close, submitCreate, submitEdit }
}
