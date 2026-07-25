import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
    (set) => ({
      isAuthenticated: false,
      user: null,
      token: null,
      walletPublicKey: null,
      login: (user, token) => {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        localStorage.setItem(ACCESS_TOKEN_KEY, token);
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
      },
      clearAuth: () => {
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        set({ isAuthenticated: false, user: null, token: null });
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
