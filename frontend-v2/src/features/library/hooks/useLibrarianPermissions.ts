'use client';

import { useMemo } from 'react';
import { useAuthStore } from '@/src/store/authStore';
import type { LibrarianPermission } from '@/components/elibrary/LibrarianNav';

const ROLE_PERMISSIONS: Record<string, LibrarianPermission[]> = {
  admin: ['catalog', 'circulation', 'patrons', 'acquisitions', 'reports', 'configuration', 'audits'],
  instructor: ['catalog', 'circulation', 'reports'],
  student: [],
};

/** Maps auth role to librarian section permissions. */
export function useLibrarianPermissions(): LibrarianPermission[] {
  const role = useAuthStore((s) => s.user?.role);
  return useMemo(() => ROLE_PERMISSIONS[role ?? ''] ?? [], [role]);
}

export function hasLibrarianPermission(
  permissions: LibrarianPermission[],
  required: LibrarianPermission,
): boolean {
  return permissions.includes(required);
}

/** Cost fields are restricted to admin and acquisitions roles. */
export function canViewCostData(role?: string): boolean {
  return role === 'admin';
}

export function canManageAcquisitions(permissions: LibrarianPermission[]): boolean {
  return permissions.includes('acquisitions') || permissions.includes('configuration');
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
