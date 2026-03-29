'use client';

import { useState, useEffect, useCallback } from 'react';
import { authService } from '../services/auth.service';

interface SessionState {
  isAuthenticated: boolean;
  token: string | null;
  isLoading: boolean;
}

/**
 * useSession
 *
 * Reads the persisted auth token from localStorage on mount and exposes
 * the current session state. Call `refresh()` to re-read the token after
 * a login or token rotation, and `clear()` to wipe the session on logout.
 *
 * Usage:
 *   const { isAuthenticated, isLoading, refresh, clear } = useSession();
 */
export function useSession() {
  const [session, setSession] = useState<SessionState>({
    isAuthenticated: false,
    token: null,
    isLoading: true,
  });

  const refresh = useCallback(() => {
    const token = authService.getToken();
    setSession({
      isAuthenticated: !!token,
      token,
      isLoading: false,
    });
  }, []);

  const clear = useCallback(() => {
    setSession({ isAuthenticated: false, token: null, isLoading: false });
  }, []);

  // Hydrate from localStorage on first render (client-side only)
  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...session, refresh, clear };
}
