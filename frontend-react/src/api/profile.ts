import client from './client'
import type { MyProfile, UpdateProfilePayload, UpdateProfileResponse } from '../types/profile'

interface ProfileResponse {
  success: boolean
  profile?: MyProfile
  message?: string
}

export const profileApi = {
  getMyProfile: (userId: string | number) =>
    client.get<ProfileResponse>(`/profile/${userId}`),

  updateMyProfile: (userId: string | number, data: UpdateProfilePayload) =>
    client.put<UpdateProfileResponse>(`/profile/${userId}`, data),
}
