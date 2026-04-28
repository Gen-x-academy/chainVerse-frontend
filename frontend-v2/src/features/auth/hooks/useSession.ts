'use client';

import { useState, useEffect, useCallback } from 'react';
import { authService } from '../services/auth.service';

interface SessionState {
  isAuthenticated: boolean;
  token: string | null;
  isLoading: boolean;
}

export function useSession() {
  const [session, setSession] = useState<SessionState>({
    isAuthenticated: false,
    token: null,
    isLoading: true,
  });

  const clear = useCallback(() => {
    sessionStorage.removeItem('session_expires_at');
    setSession({ isAuthenticated: false, token: null, isLoading: false });
  }, []);

  const refresh = useCallback(() => {
    const isAuth = authService.isAuthenticated();
    setSession({
      isAuthenticated: isAuth,
      token: authService.getToken(),
      isLoading: false,
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Schedule client-side expiry using the expiresIn value stored at login
  useEffect(() => {
    if (!session.isAuthenticated) return;

    const expiresAt = Number(sessionStorage.getItem('session_expires_at'));
    if (!expiresAt) return;

    const msUntilExpiry = expiresAt - Date.now();
    if (msUntilExpiry <= 0) {
      clear();
      return;
    }

    const timer = setTimeout(() => {
      clear();
    }, msUntilExpiry);

    return () => clearTimeout(timer);
  }, [session.isAuthenticated, clear]);

  return { ...session, refresh, clear };
}
