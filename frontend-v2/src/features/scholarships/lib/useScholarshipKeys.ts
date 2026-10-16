'use client';

import { useMemo } from 'react';
import { useAuthStore } from '@/src/store/authStore';
import {
  scholarshipQueryKeys,
  type ScholarshipIdentity,
  type ScholarshipQueryKeySet,
} from './queryKeys';

/**
 * Derives the cache identity for scholarship queries from the signed-in
 * principal (issue #1227).
 *
 * Reading the identity through the auth store is what makes a key unscoped
 * impossible to build: every scholarship hook calls this, and the returned
 * `keys` only exposes factories bound to the current user and role.
 */
export function useScholarshipIdentity(): ScholarshipIdentity {
  const userId = useAuthStore((state) => state.user?.id);
  const role = useAuthStore((state) => state.user?.role);
  const tenantId = useAuthStore((state) => state.user?.tenantId);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return useMemo<ScholarshipIdentity>(
    () =>
      isAuthenticated && userId
        ? { userId, role: role ?? 'unknown', tenantId }
        : { userId: 'anonymous', role: 'anonymous' },
    [isAuthenticated, userId, role, tenantId],
  );
}

/** The identity-scoped scholarship key set for the current session. */
export function useScholarshipKeys(): ScholarshipQueryKeySet {
  const identity = useScholarshipIdentity();
  return useMemo(() => scholarshipQueryKeys(identity), [identity]);
}
