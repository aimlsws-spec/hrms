/**
 * Pending-Salaries Controller (MVC controller layer)
 *
 * Bridges the view and the model: holds data state, exposes actions, and
 * applies the optimistic list update. Contains no JSX and no presentational
 * concerns — those belong to the view.
 */
import { useState, useEffect, useCallback } from 'react'
import { salaryModel, type EmployeeSalaryRecord, type SalarySaveResult } from '../models/salaryModel'

export function usePendingSalaries() {
  const [pending, setPending] = useState<EmployeeSalaryRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      setPending(await salaryModel.fetchPending())
    } catch {
      setPending([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // New sign-ups should show up without a manual reload: re-check every 30 s and when the tab regains focus.
  useEffect(() => {
    const quiet = async () => {
      try { setPending(await salaryModel.fetchPending()) } catch { /* keep the current list */ }
    }
    const timer = setInterval(quiet, 30_000)
    const onVisible = () => { if (document.visibilityState === 'visible') quiet() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [])

  /** Save a salary; on success drop the employee from the pending list. */
  const saveSalary = useCallback(async (employeeId: string, ctc: number, designation?: string): Promise<SalarySaveResult> => {
    const res = await salaryModel.setSalaryFromCtc(employeeId, ctc, designation)
    if (res.success) {
      setPending((prev) => prev.filter((e) => e.employee_id !== employeeId))
    }
    return res
  }, [])

  return { pending, isLoading, saveSalary, reload: load }
}
