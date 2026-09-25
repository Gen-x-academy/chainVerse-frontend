import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * UserRole now includes scholarship-specific portal roles.
 *
 * Role capabilities:
 *   student    – browse & apply for scholarships
 *   instructor – create courses (no scholarship portal access)
 *   sponsor    – create scholarship programs, view submissions
 *   reviewer   – assess and decide on submitted applications
 *   finance    – initiate and track disbursements
 *   admin      – full platform oversight across all scholarship entities
 */
export type UserRole =
  | 'student'
  | 'instructor'
  | 'sponsor'
  | 'reviewer'
  | 'finance'
  | 'admin'
  | null

interface User {
  id: string
  email: string
  role: UserRole
  walletAddress?: string
  /** Display name used in dashboards */
  name?: string
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