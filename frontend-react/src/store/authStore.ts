import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '../types/user'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isHydrated: boolean
  setUser: (user: User) => void
  clearUser: () => void
  _setHydrated: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isHydrated: false,

      setUser: (user) => set({ user, isAuthenticated: true }),
      clearUser: () => set({ user: null, isAuthenticated: false }),
      _setHydrated: () => set({ isHydrated: true }),
    }),
    {
      name: 'hrms_user',
      // never persist the transient hydration flag
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?._setHydrated()
      },
    }
  )
)
