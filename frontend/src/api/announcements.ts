import client from './client'
import type { Announcement, CreateAnnouncementPayload } from '../types/dashboard'

interface AnnouncementsResponse {
  success: boolean
  announcements?: Announcement[]
  results?: Announcement[]
}

interface CreateResponse {
  success: boolean
  message?: string
}

export const announcementsApi = {
  getAll: () => client.get<AnnouncementsResponse>('/announcements'),
  create: (data: CreateAnnouncementPayload) =>
    client.post<CreateResponse>('/announcements/create', data),
}
