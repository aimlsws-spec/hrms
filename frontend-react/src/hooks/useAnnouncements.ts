import { useState, useEffect, useCallback } from 'react'
import { announcementsApi } from '../api/announcements'
import type { Announcement } from '../types/dashboard'

export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setIsLoading(true)
    setError(null)
    announcementsApi.getAll()
      .then(({ data }) => {
        const items = data.announcements ?? data.results ?? []
        setAnnouncements(items)
        setIsLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setIsLoading(false)
      })
  }, [])

  useEffect(() => { load() }, [load])

  return { announcements, isLoading, error, refetch: load }
}
