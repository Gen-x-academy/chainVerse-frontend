import { describe, it, expect } from 'vitest';
import {
  hasLibrarianPermission,
  canViewCostData,
  canManageAcquisitions,
} from '@/src/features/library/hooks/useLibrarianPermissions';
import type { LibrarianPermission } from '@/components/elibrary/LibrarianNav';

describe('useLibrarianPermissions helpers', () => {
  const catalogPerms: LibrarianPermission[] = ['catalog', 'circulation', 'reports'];

  it('hasLibrarianPermission returns true for granted permission', () => {
    expect(hasLibrarianPermission(catalogPerms, 'catalog')).toBe(true);
  });

  it('hasLibrarianPermission returns false for missing permission', () => {
    expect(hasLibrarianPermission(catalogPerms, 'acquisitions')).toBe(false);
  });

  it('canViewCostData is restricted to admin', () => {
    expect(canViewCostData('admin')).toBe(true);
    expect(canViewCostData('instructor')).toBe(false);
    expect(canViewCostData('student')).toBe(false);
  });

  it('canManageAcquisitions requires acquisitions or configuration', () => {
    expect(canManageAcquisitions(['acquisitions'])).toBe(true);
    expect(canManageAcquisitions(['configuration'])).toBe(true);
    expect(canManageAcquisitions(['catalog'])).toBe(false);
  });
});
