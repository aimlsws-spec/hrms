import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ProfileImageState {
  images: Record<string, string>
  setImage: (email: string, base64: string) => void
  getImage: (email: string) => string | null
}

export const useProfileImageStore = create<ProfileImageState>()(
  persist(
    (set, get) => ({
      images: {},
      setImage: (email, base64) =>
        set(state => ({ images: { ...state.images, [email.toLowerCase()]: base64 } })),
      getImage: (email) => get().images[email.toLowerCase()] ?? null,
    }),
    { name: 'hrms_profile_images' }
  )
)
