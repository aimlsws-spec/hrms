import { useState, useEffect, useCallback } from 'react'
import { profileApi }    from '../../../api/profile'
import { employeesApi }  from '../../../api/employees'
import type { MyProfile } from '../../../types/profile'
import type { User }      from '../../../types/user'

export function useMyProfile(user: User | null) {
  const [profile,   setProfile]   = useState<MyProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error,     setError]     = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!user) { setIsLoading(false); return }

    setIsLoading(true)
    setError(null)

    // Base profile built directly from auth store — always available immediately
    const base: MyProfile = {
      user_id:      user.user_id as unknown as number,
      username:     user.username,
      full_name:    user.full_name,
      email:        user.email,
      role:         user.role,
      is_active:    true,
      employee_id:  null,
      department:   user.department ?? null,
      phone:        null,
      title:        null,
      joining_date: null,
      status:       'Active',
      city:         null,
      state:        null,
    }

    // Run employee search and profile API in parallel
    const [profileRes, searchRes] = await Promise.allSettled([
      profileApi.getMyProfile(user.user_id).catch(() => null),
      employeesApi.search({ q: user.email, limit: 10 }).catch(() => null),
    ])

    let merged = { ...base }

    // Apply employee table data (matched by email)
    if (searchRes.status === 'fulfilled' && searchRes.value) {
      const results = searchRes.value.data.results ?? []
      const emp = results.find(e =>
        e.email?.toLowerCase() === user.email.toLowerCase()
      ) ?? (results.length === 1 ? results[0] : undefined)
      if (emp) {
        merged = {
          ...merged,
          employee_id: emp.employee_id    ?? merged.employee_id,
          department:  emp.department     ?? merged.department,
          title:       emp.title          ?? merged.title,
          city:        (emp as { city?: string }).city  ?? merged.city,
          state:       (emp as { state?: string }).state ?? merged.state,
        }
      }
    }

    // If profile API succeeded (backend restarted with new endpoint), override
    const pData = profileRes.status === 'fulfilled' ? profileRes.value : null
    if (pData?.data?.success && pData.data.profile) {
      merged = { ...merged, ...pData.data.profile }
    }

    setProfile(merged)
    setIsLoading(false)
  }, [user])

  useEffect(() => { fetch() }, [fetch])

  return { profile, isLoading, error, setProfile, refetch: fetch }
}
