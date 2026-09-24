import type { ScholarshipRole } from '../types/scholarship.types';

/**
 * Role-scoped access for the scholarship feature (issue #1079).
 *
 * The frontend route guard is a UX boundary only — the API must enforce the
 * same grants; see ADR-001: Privacy boundaries.
 */
export type ScholarshipArea =
  | 'hub'
  | 'apply'
  | 'applications'
  | 'awards'
  | 'manage';

const AREA_ACCESS: Record<ScholarshipArea, readonly ScholarshipRole[]> = {
  hub: ['student', 'sponsor', 'reviewer', 'finance', 'administrator'],
  apply: ['student'],
  applications: ['reviewer', 'finance', 'administrator'],
  awards: ['sponsor', 'finance', 'administrator'],
  manage: ['administrator'],
};

export const SCHOLARSHIP_ROLES: readonly ScholarshipRole[] = [
  'student',
  'sponsor',
  'reviewer',
  'finance',
  'administrator',
];

function toScholarshipRole(role?: string): ScholarshipRole | undefined {
  if (!role) return undefined;
  if ((SCHOLARSHIP_ROLES as readonly string[]).includes(role)) {
    return role as ScholarshipRole;
  }
  return undefined;
}

export function canAccessScholarshipArea(
  role: string | undefined,
  area: ScholarshipArea
): boolean {
  const mapped = toScholarshipRole(role);
  if (!mapped) return false;
  return AREA_ACCESS[area].includes(mapped);
}

export function accessibleScholarshipAreas(role?: string): ScholarshipArea[] {
  const mapped = toScholarshipRole(role);
  if (!mapped) return [];
  return (Object.keys(AREA_ACCESS) as ScholarshipArea[])
    .filter((area) => area !== 'hub' && AREA_ACCESS[area].includes(mapped));
}

export const SCHOLARSHIP_AREA_ACCESS = AREA_ACCESS;