'use client';

import { useMemo } from 'react';
import type { LibrarianPermission } from '@/components/elibrary/LibrarianNav';
import {
  resolveLibrarianPermissions,
  canPerformLibrarianAction,
  type LibrarianAction,
} from '../utils/librarian-permissions';

/** Resolves librarian permissions from role until auth exposes explicit librarian grants. */
export function useLibrarianPermissions(role?: string): LibrarianPermission[] {
  return useMemo(() => resolveLibrarianPermissions(role ?? ''), [role]);
}

export function useCanPerformLibrarianAction(
  permissions: LibrarianPermission[],
  action: LibrarianAction
): boolean {
  return useMemo(
    () => canPerformLibrarianAction(permissions, action),
    [permissions, action]
  );
}
