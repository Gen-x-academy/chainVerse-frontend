/**
 * Role-aware navigation for the mentorship identity surfaces
 * (MENTOR-008 … MENTOR-011).
 *
 * The guard is a UX boundary only; the API enforces the same grants (see
 * `docs/mentorship/MENTOR-003-role-permission-matrix.md`). The platform auth
 * store still carries the legacy `admin | instructor | student` vocabulary, so
 * those are mapped onto the mentorship roles before the check.
 */

export type IdentityArea =
  | 'mentor-profile'
  | 'learning-profile'
  | 'taxonomy'
  | 'verification';

export const IDENTITY_AREA_ROLES: Record<IdentityArea, readonly string[]> = {
  'mentor-profile': ['tutor', 'mentor', 'administrator'],
  'learning-profile': ['student', 'guardian', 'administrator'],
  taxonomy: ['tutor', 'mentor', 'organization-staff', 'administrator'],
  verification: ['mentor', 'moderator', 'administrator'],
};

/** Legacy platform roles mapped onto the mentorship vocabulary. */
const LEGACY_ROLE_ALIASES: Record<string, string> = {
  admin: 'administrator',
  instructor: 'mentor',
  student: 'student',
};

export function toIdentityRole(role?: string): string | undefined {
  if (!role) return undefined;
  return LEGACY_ROLE_ALIASES[role] ?? role;
}

export function canAccessIdentityArea(role: string | undefined, area: IdentityArea): boolean {
  const mapped = toIdentityRole(role);
  if (!mapped) return false;
  return IDENTITY_AREA_ROLES[area].includes(mapped);
}

export function accessibleIdentityAreas(role?: string): IdentityArea[] {
  const mapped = toIdentityRole(role);
  if (!mapped) return [];
  return (Object.keys(IDENTITY_AREA_ROLES) as IdentityArea[]).filter((area) =>
    IDENTITY_AREA_ROLES[area].includes(mapped),
  );
}
