import { useState, useEffect, useCallback } from 'react'
import { documentsApi } from '../../api/documents'
import type { UserOption } from '../../types/document'

export function useEmployees() {
  const [employees, setEmployees] = useState<UserOption[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError]         = useState('')

  const load = useCallback(() => {
    setIsLoading(true)
    setError('')
    documentsApi.getUsers()
      .then(({ data }) => {
        if (data.success && data.users?.length) {
          setEmployees(data.users)
        } else {
          setError(data.message || 'No active employees found.')
        }
      })
      .catch((err) => {
        const detail =
          err?.response?.data?.detail ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to load employee list.'
        setError(detail)
      })
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  return { employees, isLoading, error, retry: load }
}
