'use client';

import { useMemo } from 'react';
import { useAuthStore } from '@/src/store/authStore';
import type { LibrarianPermission } from '@/components/elibrary/LibrarianNav';

const ROLE_PERMISSIONS: Record<string, LibrarianPermission[]> = {
  admin: ['catalog', 'circulation', 'patrons', 'acquisitions', 'reports', 'configuration', 'audits'],
  instructor: ['catalog', 'circulation', 'reports'],
  student: [],
};

/** Maps the authenticated user's role to their librarian section permissions. */
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

/** Cost fields are restricted to admin role. */
export function canViewCostData(role?: string): boolean {
  return role === 'admin';
}

export function canManageAcquisitions(permissions: LibrarianPermission[]): boolean {
  return permissions.includes('acquisitions') || permissions.includes('configuration');
}
