'use client';

import { useEffect, useState } from 'react';
import { authService } from '@/features/auth/services/auth.service';

interface SessionState {
  isAuthenticated: boolean;
  isLoading: boolean;
}

/**
 * useSession
 *
 * Returns auth status only. The raw token is intentionally not exposed —
 * components that need to make API calls should use apiClient directly,
 * which sends the HttpOnly session cookie automatically.
 *
 * #256 Fix: removed `token` from return value to avoid widening attack surface.
 */
export function useSession(): SessionState {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsAuthenticated(authService.isAuthenticated());
    setIsLoading(false);
  }, []);

  return { isAuthenticated, isLoading };
}
