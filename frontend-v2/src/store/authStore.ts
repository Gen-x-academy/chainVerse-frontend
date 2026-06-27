import { create } from 'zustand';

interface AuthUser {
  id?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: 'admin' | 'instructor' | 'student';
  avatarUrl?: string;
}

interface AuthState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  token: string | null;
  login: (user: AuthUser, token: string) => void;
  logout: () => void;
  /** Alias for logout — clears all auth state. */
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  user: null,
  token: null,
  login: (user, token) => set({ isAuthenticated: true, user, token }),
  logout: () => set({ isAuthenticated: false, user: null, token: null }),
  clearAuth: () => set({ isAuthenticated: false, user: null, token: null }),
}));
