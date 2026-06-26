import { useState, useEffect, useCallback } from 'react'
import Card from '../ui/Card'
import SectionHeader from '../ui/SectionHeader'
import Avatar from '../ui/Avatar'
import { hrSalaryApi, type EmployeeSalaryRecord } from '../../api/hrSalaryApi'

/**
 * PendingSalaryPanel
 *
 * HR/Admin dashboard widget that surfaces newly-onboarded employees who do not
 * yet have an active salary record. HR can set the salary inline by entering an
 * annual CTC — the backend (/api/hr/salary) auto-computes the full breakdown.
 */
export default function PendingSalaryPanel() {
  const [pending, setPending] = useState<EmployeeSalaryRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [activeId, setActiveId] = useState<string | null>(null)
  const [ctc, setCtc] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const { data } = await hrSalaryApi.getAllSalaries()
      setPending((data ?? []).filter(e => !e.has_salary))
    } catch {
      setPending([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function openForm(employeeId: string) {
    setActiveId(employeeId)
    setCtc('')
    setError(null)
  }

  async function save(employeeId: string) {
    const value = parseFloat(ctc)
    if (!value || value <= 0) {
      setError('Enter a valid annual CTC')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const { data } = await hrSalaryApi.setSalaryFromCtc(employeeId, value)
      if (!data.success) {
        setError(data.message ?? 'Failed to save salary')
        return
      }
      // Drop the employee from the pending list on success
      setPending(prev => prev.filter(e => e.employee_id !== employeeId))
      setActiveId(null)
    } catch {
      setError('Failed to save salary')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <SectionHeader
        title="Action Required: Set Salary"
        action={
          pending.length > 0 ? (
            <span className="text-xs bg-amber-50 text-amber-600 px-2.5 py-1 rounded-full font-semibold">
              {pending.length} pending
            </span>
          ) : undefined
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1].map(i => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gray-100 rounded-full animate-pulse shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-gray-100 rounded animate-pulse w-1/3" />
                <div className="h-3 bg-gray-100 rounded animate-pulse w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : pending.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center mb-2">
            <i className="fas fa-circle-check text-emerald-500" />
          </div>
          <p className="text-sm text-gray-500">All employees have a salary set</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-gray-400 mb-1">
            New employees need a salary before payroll can run.
          </p>
          {pending.map(emp => (
            <div key={emp.employee_id} className="p-3 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-3">
                <Avatar name={emp.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900 truncate">{emp.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5 truncate">
                    {emp.employee_id} · {emp.department}
                  </div>
                </div>
                {activeId !== emp.employee_id && (
                  <button
                    onClick={() => openForm(emp.employee_id)}
                    className="shrink-0 text-xs bg-primary-600 text-white hover:bg-primary-700 px-3 py-1.5 rounded-lg font-semibold transition-colors"
                  >
                    Set Salary
                  </button>
                )}
              </div>

              {activeId === emp.employee_id && (
                <div className="mt-3 space-y-2">
                  <label className="block text-[11px] font-semibold text-gray-500">
                    Annual CTC (₹)
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[13px]">₹</span>
                      <input
                        type="number"
                        autoFocus
                        value={ctc}
                        onChange={e => { setCtc(e.target.value); setError(null) }}
                        onKeyDown={e => e.key === 'Enter' && save(emp.employee_id)}
                        placeholder="e.g. 600000"
                        className="w-full h-9 pl-7 pr-3 text-[13px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-50 transition"
                      />
                    </div>
                    <button
                      onClick={() => save(emp.employee_id)}
                      disabled={saving || !ctc.trim()}
                      className="h-9 px-4 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg transition shrink-0"
                    >
                      {saving ? <i className="fas fa-circle-notch animate-spin" /> : 'Save'}
                    </button>
                    <button
                      onClick={() => setActiveId(null)}
                      disabled={saving}
                      className="h-9 px-3 text-xs font-semibold text-gray-500 hover:text-gray-700 transition shrink-0"
                    >
                      Cancel
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    The salary breakdown (basic, HRA, PF, etc.) is auto-calculated from the CTC.
                  </p>
                  {error && (
                    <p className="text-[11px] text-red-500 flex items-center gap-1">
                      <i className="fas fa-circle-exclamation" /> {error}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
