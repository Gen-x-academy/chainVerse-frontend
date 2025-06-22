import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type UserRole = 'student' | 'instructor' | null

interface User {
  id: string
  email: string
  role: UserRole
  walletAddress?: string
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  setUser: (user: User | null) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      logout: () => set({ user: null, isAuthenticated: false }),
    }),
    {
      name: 'auth-storage',
    }
  )
) 