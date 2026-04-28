import { create } from 'zustand';
import { authService } from '@/src/features/auth/services/auth.service';
import type { User } from '@/src/features/auth/types/auth.types';

// ─── Types ────────────────────────────────────────────────────────────────────

type AuthState = {
  isAuthenticated: boolean;
  user: User | null;
  setAuth: (user: User) => void;
  clearAuth: () => void;
};

// ─── Store ────────────────────────────────────────────────────────────────────

/**
 * useAuthStore
 *
 * Reactive auth state layer on top of authService.
 * Initializes from the existing token in localStorage (client-side only).
 *
 * setAuth   — called after a successful login/register.
 * clearAuth — called after logout; clears both store and authService storage.
 *
 * All actions — O(1).
 */
export const useAuthStore = create<AuthState>()((set) => ({
  // Guard against SSR: localStorage is unavailable on the server.
  isAuthenticated: typeof window !== 'undefined' && authService.isAuthenticated(),
  user: null,

  setAuth: (user) => set({ isAuthenticated: true, user }),

  clearAuth: () => set({ isAuthenticated: false, user: null }),
}));
