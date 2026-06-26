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

  /** Save a salary; on success drop the employee from the pending list. */
  const saveSalary = useCallback(async (employeeId: string, ctc: number): Promise<SalarySaveResult> => {
    const res = await salaryModel.setSalaryFromCtc(employeeId, ctc)
    if (res.success) {
      setPending((prev) => prev.filter((e) => e.employee_id !== employeeId))
    }
    return res
  }, [])

  return { pending, isLoading, saveSalary, reload: load }
}
