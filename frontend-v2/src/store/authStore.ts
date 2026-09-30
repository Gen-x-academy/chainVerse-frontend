import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { clearUserScopedCache } from '@/src/lib/clear-user-query-cache';
import { queryClient } from '@/src/lib/query-client';

interface AuthUser {
  id?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: 'admin' | 'instructor' | 'student';
  avatarUrl?: string;
  /**
   * Owning tenant. Scholarship query keys are scoped by tenant as well as user
   * (issue #1227), so a user who is a member of more than one tenant must not
   * reuse another tenant's cached applications or awards.
   */
  tenantId?: string;
}

interface AuthState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  token: string | null;
  /**
   * Stellar public key currently connected via the wallet (issue #694).
   * Mirrored from WalletContext so enrollment / payment flows can read it
   * from a single source of truth without importing the wallet context.
   */
  walletPublicKey: string | null;
  login: (user: AuthUser, token: string) => void;
  logout: () => void;
  /** Alias for logout — clears all auth state. */
  clearAuth: () => void;
  setWalletPublicKey: (key: string | null) => void;
}

const ACCESS_TOKEN_KEY = 'accessToken';
const USER_KEY = 'auth_user';

function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      user: null,
      token: null,
      walletPublicKey: null,
      login: (user, token) => {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        localStorage.setItem(ACCESS_TOKEN_KEY, token);
        // Identity switch: purge before publishing the new identity so no
        // subscriber can read a key that still belongs to the previous user.
        // A first sign-in has nothing cached, so skip the teardown there.
        if (get().isAuthenticated || get().user) {
          void clearUserScopedCache(queryClient);
        }
        set({ isAuthenticated: true, user, token });
      },
      logout: () => {
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('token_expiry');
        set({
          isAuthenticated: false,
          user: null,
          token: null,
          walletPublicKey: null,
        });
        // Issue #1227: drop identity-scoped query data so the next session
        // cannot render the previous user's scholarship records. Sign-out
        // stays synchronous; teardown runs in the background.
        void clearUserScopedCache(queryClient);
      },
      clearAuth: () => {
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        set({ isAuthenticated: false, user: null, token: null });
        void clearUserScopedCache(queryClient);
      },
      setWalletPublicKey: (key) => set({ walletPublicKey: key }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        token: state.token,
        // walletPublicKey is intentionally NOT persisted: the wallet
        // extension is the source of truth and re-syncs on mount.
      }),
    },
  ),
);
