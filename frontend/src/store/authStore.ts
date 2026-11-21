import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
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
      // sessionStorage = one login per browser tab, so HR in one tab and the accountant in another
      // no longer overwrite each other (localStorage is shared by every tab).
      storage: createJSONStorage(() => sessionStorage),
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
