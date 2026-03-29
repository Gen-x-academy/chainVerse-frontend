import { apiClient } from '@/lib/api-client';
import type { AuthResponse, LoginPayload, RegisterPayload } from '../types/auth.types';

// ─── Constants ────────────────────────────────────────────────────────────────

/** All storage keys written during auth — must all be cleared on logout. */
const TOKEN_KEY    = 'auth_token';
const USER_KEY     = 'auth_user';
const SESSION_KEYS = [TOKEN_KEY, USER_KEY] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Clears every auth-related key from both localStorage and sessionStorage.
 * O(k) where k = SESSION_KEYS.length (constant → O(1) in practice).
 */
function clearAllStorage(): void {
  for (const key of SESSION_KEYS) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }

  // Clear the HttpOnly-equivalent cookie if the server sets one
  // (document.cookie write only clears the JS-accessible variant)
  document.cookie = `${TOKEN_KEY}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Strict`;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const authService = {
  login: async (payload: LoginPayload): Promise<AuthResponse> => {
    const data = await apiClient.post<AuthResponse>('/api/auth/login', payload);
    authService.setToken(data.token);
    return data;
  },

  register: async (payload: RegisterPayload): Promise<AuthResponse> => {
    const data = await apiClient.post<AuthResponse>('/api/auth/register', payload);
    authService.setToken(data.token);
    return data;
  },

  getToken: (): string | null => localStorage.getItem(TOKEN_KEY),

  setToken: (token: string): void => {
    localStorage.setItem(TOKEN_KEY, token);
  },

  /**
   * logout
   *
   * 1. Fires a server-side token revocation request (fire-and-forget).
   *    A network failure NEVER blocks the client-side logout.
   * 2. Clears all auth keys from localStorage, sessionStorage, and cookies.
   *
   * Time:  O(1) — constant key-count clear.
   * Space: O(1) — no additional allocations.
   */
  logout: async (): Promise<void> => {
    // Fire-and-forget: server revokes the token (invalidates refresh token etc.)
    // We don't await or throw — client logout must always complete.
    try {
      await apiClient.post('/api/auth/logout', {});
    } catch {
      // Intentionally swallowed — client state is cleared regardless
    } finally {
      clearAllStorage();
    }
  },

  getAuthHeaders: (): Record<string, string> => {
    const token = authService.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  },

  isAuthenticated: (): boolean => !!authService.getToken(),
};
