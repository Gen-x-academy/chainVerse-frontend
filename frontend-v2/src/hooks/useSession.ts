'use client';

import { useEffect, useState } from 'react';
import { authService } from '@/features/auth/services/auth.service';

interface SessionState {
  isAuthenticated: boolean;
  isLoading: boolean;
  tenantId: string | null;
  workspaceRoles: string[];
  can: (capability: string) => boolean;
}

/**
 * useSession
 *
 * Returns auth status only. The raw token is intentionally not exposed —
 * components that need to make API calls should use apiClient directly,
 * which sends the HttpOnly session cookie automatically.
 *
 * #256 Fix: removed `token` from return value to avoid widening attack surface.
 *
 * CAPSTONE-070/071/073/075: also exposes tenantId, workspaceRoles and a
 * deny-by-default `can(capability)` helper so workspace pages can render
 * role-aware navigation and empty states without importing the auth store.
 */
export function useSession(): SessionState {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [workspaceRoles, setWorkspaceRoles] = useState<string[]>([]);

  useEffect(() => {
    const authenticated = authService.isAuthenticated();
    setIsAuthenticated(authenticated);

    if (authenticated) {
      const store = authService.getStore?.();
      setTenantId(store?.tenantId ?? null);
      setWorkspaceRoles(store?.workspaceRoles ?? []);
    } else {
      setTenantId(null);
      setWorkspaceRoles([]);
    }

    setIsLoading(false);
  }, []);

  const can = (capability: string): boolean => {
    if (!isAuthenticated || !capability) {
      return false;
    }
    return workspaceRoles.includes(capability);
  };

  return { isAuthenticated, isLoading, tenantId, workspaceRoles, can };
}