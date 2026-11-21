import { useState, useEffect, useCallback, useMemo } from 'react'
import { employeesApi } from '../../api/employees'
import type { Employee } from '../../types/employee'

export function useEmployees() {
  const [all, setAll]           = useState<Employee[]>([])
  const [isLoading, setLoading] = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [search, setSearch]     = useState('')
  const [deptFilter, setDept]   = useState('')

  // Fetch from backend — debounced when search changes
  const load = useCallback(async (query: string) => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await employeesApi.search({ q: query, limit: 200 })
      setAll(data.success ? data.results : [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load employees')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => load(search), search ? 400 : 0)
    return () => clearTimeout(timer)
  }, [load, search])

  // Client-side department filter (no extra API call)
  const employees = useMemo(
    () => (deptFilter ? all.filter(e => e.department === deptFilter) : all),
    [all, deptFilter]
  )

  // Unique departments from current dataset
  const departments = useMemo(
    () => [...new Set(all.map(e => e.department).filter((d): d is string => Boolean(d)))],
    [all]
  )

  return {
    employees,
    total: employees.length,
    isLoading,
    error,
    search,
    setSearch,
    deptFilter,
    setDeptFilter: setDept,
    departments,
    refetch: () => load(search),
  }
}
