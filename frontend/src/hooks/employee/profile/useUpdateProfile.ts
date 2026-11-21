import { useState } from 'react'
import { profileApi } from '../../../api/profile'
import type { UpdateProfilePayload } from '../../../types/profile'

export function useUpdateProfile(userId: number | null) {
  const [isSaving,     setIsSaving]     = useState(false)
  const [saveError,    setSaveError]    = useState<string | null>(null)
  const [saveSuccess,  setSaveSuccess]  = useState(false)

  async function updateProfile(data: UpdateProfilePayload): Promise<boolean> {
    if (!userId) return false
    setIsSaving(true)
    setSaveError(null)
    setSaveSuccess(false)
    try {
      const res = await profileApi.updateMyProfile(userId, data)
      if (res.data.success) {
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 3000)
        return true
      }
      setSaveError(res.data.message ?? 'Update failed')
      return false
    } catch {
      setSaveError('Update failed')
      return false
    } finally {
      setIsSaving(false)
    }
  }

  return { updateProfile, isSaving, saveError, saveSuccess }
}
