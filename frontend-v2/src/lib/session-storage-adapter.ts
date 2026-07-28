/**
 * Single session storage authority for issue #828.
 * authStore, auth-token.service, and auth.service each read/clear
 * overlapping localStorage keys independently. This adapter is the one
 * place that owns key names, (de)serialization, and cleanup.
 */

const KEYS = {
  accessToken: 'accessToken',
  refreshToken: 'refreshToken',
  user: 'auth_user',
  tokenExpiry: 'token_expiry',
} as const;

export const sessionStorageAdapter = {
  getAccessToken: (): string | null => localStorage.getItem(KEYS.accessToken),

  getRefreshToken: (): string | null => localStorage.getItem(KEYS.refreshToken),

  getUser: <T>(): T | null => {
    const raw = localStorage.getItem(KEYS.user);
    try {
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },

  setSession: (accessToken: string, refreshToken: string, user: unknown) => {
    localStorage.setItem(KEYS.accessToken, accessToken);
    localStorage.setItem(KEYS.refreshToken, refreshToken);
    localStorage.setItem(KEYS.user, JSON.stringify(user));
  },

  clear: () => {
    Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
  },
};
