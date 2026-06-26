import { useState, useEffect } from 'react'
import { employeesApi } from '../../api/employees'

export interface EmployeeOption {
  employee_id: string
  name: string
}

export function useEmployeeOptions() {
  const [options, setOptions]   = useState<EmployeeOption[]>([])
  const [isLoading, setLoading] = useState(true)

  useEffect(() => {
    employeesApi.search({ limit: 500 })
      .then(({ data }) => {
        setOptions((data.results ?? []).map(e => ({
          employee_id: e.employee_id,
          name: e.name,
        })))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return { options, isLoading }
}
