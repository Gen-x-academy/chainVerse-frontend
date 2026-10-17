/**
 * Mentorship RBAC and least-privilege permission matrix (closes #1250, MENTOR-003).
 *
 * Authorization is deny-by-default: an action is allowed only when the
 * principal's role grants it *and* the resource belongs to the principal's
 * tenant. Two extra rules apply on top of the matrix:
 *
 * - **Cross-tenant access is always denied.** Tenant is compared before any
 *   grant, so a role that lists an action still cannot reach another tenant's
 *   record.
 * - **Self-approval is always denied.** A principal can never approve, publish,
 *   or settle a resource they own, even as an administrator. Separating the
 *   author from the approver is the control this module exists to prove.
 *
 * The frontend guard is a UX boundary only; the API must enforce the same
 * grants. See `docs/mentorship/MENTOR-003-role-permission-matrix.md`.
 */

export type MentorshipRole =
  | 'student'
  | 'tutor'
  | 'mentor'
  | 'guardian'
  | 'organization-staff'
  | 'moderator'
  | 'finance'
  | 'administrator';

export const MENTORSHIP_ROLES: readonly MentorshipRole[] = [
  'student',
  'tutor',
  'mentor',
  'guardian',
  'organization-staff',
  'moderator',
  'finance',
  'administrator',
];

export type MentorshipResource =
  | 'mentor-profile'
  | 'mentee-profile'
  | 'expertise-taxonomy'
  | 'verification'
  | 'program'
  | 'engagement'
  | 'session'
  | 'deliverable'
  | 'payment'
  | 'dispute'
  | 'configuration'
  | 'audit-event';

export type MentorshipAction =
  | 'read'
  | 'create'
  | 'update'
  | 'delete'
  | 'approve'
  | 'publish'
  | 'settle'
  | 'export';

export type MentorshipPrincipal = {
  userId: string;
  role: MentorshipRole;
  /** A sponsor organization, guardian household, or the platform. */
  tenantId: string;
  /** For `guardian`: the mentee user ids this guardian may read. */
  wards?: readonly string[];
};

export type MentorshipResourceRef = {
  resource: MentorshipResource;
  /** Tenant that owns the resource. */
  tenantId: string;
  /** The principal who authored the resource; used for self-approval checks. */
  ownerId?: string;
};

export type MentorshipDenialReason =
  | 'CROSS_TENANT_DENIED'
  | 'NO_PERMISSION'
  | 'SELF_APPROVAL_DENIED'
  | 'GUARDIAN_SCOPE_DENIED';

export type MentorshipPermissionDecision =
  | { allowed: true }
  | { allowed: false; reason: MentorshipDenialReason };

export type MentorshipRolePermissionMatrix = Record<
  MentorshipRole,
  Partial<Record<MentorshipResource, MentorshipAction[]>>
>;

/**
 * The least-privilege matrix. Each operation maps to exactly one listed
 * action; there are no wildcards, and no role can reach another tenant.
 */
export const MENTORSHIP_ROLE_PERMISSIONS: MentorshipRolePermissionMatrix = {
  student: {
    'mentor-profile': ['read'],
    program: ['read'],
    engagement: ['read'],
    session: ['read'],
    deliverable: ['read'],
    payment: ['read'],
  },
  tutor: {
    'mentor-profile': ['read', 'update'],
    'expertise-taxonomy': ['read'],
    program: ['read'],
    session: ['read'],
  },
  mentor: {
    'mentor-profile': ['read', 'create', 'update'],
    'expertise-taxonomy': ['read'],
    verification: ['read', 'create'],
    program: ['read'],
    engagement: ['read', 'update'],
    session: ['read', 'create', 'update'],
    deliverable: ['read', 'approve'],
    payment: ['read'],
  },
  guardian: {
    'mentor-profile': ['read'],
    'mentee-profile': ['read'],
    program: ['read'],
    engagement: ['read'],
    session: ['read'],
    payment: ['read'],
  },
  'organization-staff': {
    'mentor-profile': ['read', 'update'],
    'expertise-taxonomy': ['read', 'create', 'update', 'delete'],
    program: ['read', 'create', 'update', 'publish'],
    engagement: ['read', 'update'],
    session: ['read'],
    deliverable: ['read'],
    configuration: ['read'],
    'audit-event': ['read'],
  },
  moderator: {
    'mentor-profile': ['read'],
    verification: ['read', 'approve'],
    engagement: ['read'],
    session: ['read'],
    deliverable: ['read'],
    dispute: ['read', 'create', 'update', 'approve'],
    'audit-event': ['read'],
  },
  finance: {
    'mentor-profile': ['read'],
    program: ['read'],
    engagement: ['read'],
    payment: ['read', 'create', 'update', 'settle'],
    dispute: ['read'],
    'audit-event': ['read', 'export'],
  },
  administrator: {
    'mentor-profile': ['read', 'create', 'update', 'delete', 'approve', 'export'],
    'mentee-profile': ['read', 'update', 'delete', 'export'],
    'expertise-taxonomy': ['read', 'create', 'update', 'delete', 'publish'],
    verification: ['read', 'create', 'update', 'approve'],
    program: ['read', 'create', 'update', 'delete', 'publish', 'export'],
    engagement: ['read', 'create', 'update', 'delete', 'export'],
    session: ['read', 'create', 'update', 'delete'],
    deliverable: ['read', 'create', 'update', 'delete', 'approve'],
    payment: ['read', 'create', 'update', 'settle', 'export'],
    dispute: ['read', 'create', 'update', 'approve'],
    configuration: ['read', 'create', 'update', 'delete', 'publish'],
    'audit-event': ['read', 'export'],
  },
};

/** Actions that must never be performed by the author of the resource. */
const SELF_APPROVAL_ACTIONS: readonly MentorshipAction[] = ['approve', 'publish', 'settle'];

/**
 * Authoritative access check. Order matters: tenant first, then self-approval,
 * then guardian scope, then the grant. Every denial carries a stable reason.
 */
export function canPerformMentorshipAction(
  principal: MentorshipPrincipal,
  resource: MentorshipResourceRef,
  action: MentorshipAction,
): MentorshipPermissionDecision {
  if (principal.tenantId !== resource.tenantId) {
    return { allowed: false, reason: 'CROSS_TENANT_DENIED' };
  }

  if (
    resource.ownerId !== undefined &&
    resource.ownerId === principal.userId &&
    SELF_APPROVAL_ACTIONS.includes(action)
  ) {
    return { allowed: false, reason: 'SELF_APPROVAL_DENIED' };
  }

  // A guardian may only read the mentee records for the wards they are linked
  // to, regardless of the matrix grant.
  if (principal.role === 'guardian' && resource.resource === 'mentee-profile') {
    const owner = resource.ownerId;
    if (owner === undefined || !(principal.wards ?? []).includes(owner)) {
      return { allowed: false, reason: 'GUARDIAN_SCOPE_DENIED' };
    }
  }

  const grants = MENTORSHIP_ROLE_PERMISSIONS[principal.role][resource.resource] ?? [];
  if (!grants.includes(action)) {
    return { allowed: false, reason: 'NO_PERMISSION' };
  }

  return { allowed: true };
}

export function describeMentorshipDenial(decision: MentorshipPermissionDecision): string {
  if (decision.allowed) return 'Access granted.';
  switch (decision.reason) {
    case 'CROSS_TENANT_DENIED':
      return 'This record belongs to a different organization.';
    case 'SELF_APPROVAL_DENIED':
      return 'You cannot approve a record you own.';
    case 'GUARDIAN_SCOPE_DENIED':
      return 'You can only view the learners linked to your guardian account.';
    case 'NO_PERMISSION':
    default:
      return 'Your role does not allow this action.';
  }
}

/** Every operation a role may attempt, used to render a permission matrix. */
export function operationsForRole(
  role: MentorshipRole,
): { resource: MentorshipResource; actions: MentorshipAction[] }[] {
  const granted = MENTORSHIP_ROLE_PERMISSIONS[role];
  return (Object.keys(granted) as MentorshipResource[]).map((resource) => ({
    resource,
    actions: [...(granted[resource] ?? [])],
  }));
}

// ─── Role-aware navigation ────────────────────────────────────────────────────

export type MentorshipArea =
  | 'hub'
  | 'mentor-profile'
  | 'learning-profile'
  | 'taxonomy'
  | 'verification'
  | 'roles'
  | 'config'
  | 'availability'
  | 'credentials'
  | 'trust'
  | 'programs';

const AREA_ACCESS: Record<MentorshipArea, readonly MentorshipRole[]> = {
  hub: MENTORSHIP_ROLES,
  'mentor-profile': ['tutor', 'mentor', 'administrator'],
  'learning-profile': ['student', 'guardian', 'administrator'],
  taxonomy: ['tutor', 'mentor', 'organization-staff', 'administrator'],
  verification: ['mentor', 'moderator', 'administrator'],
  roles: ['administrator'],
  config: ['organization-staff', 'administrator'],
  availability: ['mentor', 'organization-staff', 'administrator'],
  credentials: ['mentor', 'moderator', 'administrator'],
  trust: ['student', 'organization-staff', 'moderator', 'administrator'],
  programs: MENTORSHIP_ROLES,
};

export const MENTORSHIP_AREA_ACCESS = AREA_ACCESS;

export function toMentorshipRole(role?: string): MentorshipRole | undefined {
  if (!role) return undefined;
  return (MENTORSHIP_ROLES as readonly string[]).includes(role)
    ? (role as MentorshipRole)
    : undefined;
}

export function canAccessMentorshipArea(role: string | undefined, area: MentorshipArea): boolean {
  const mapped = toMentorshipRole(role);
  if (!mapped) return false;
  return AREA_ACCESS[area].includes(mapped);
}

export function accessibleMentorshipAreas(role?: string): MentorshipArea[] {
  const mapped = toMentorshipRole(role);
  if (!mapped) return [];
  return (Object.keys(AREA_ACCESS) as MentorshipArea[]).filter(
    (area) => area !== 'hub' && AREA_ACCESS[area].includes(mapped),
  );
}

export const mentorshipAccessService = {
  /** The matrix is a client constant; the API is the source of truth. */
  permissions: (): MentorshipRolePermissionMatrix => MENTORSHIP_ROLE_PERMISSIONS,

  check: async (payload: {
    role: MentorshipRole;
    tenantId: string;
    resource: MentorshipResource;
    action: MentorshipAction;
    ownerId?: string;
  }): Promise<MentorshipPermissionDecision> => {
    const { apiClient } = await import('@/src/lib/api-client');
    return apiClient.post<MentorshipPermissionDecision>('/mentorship/access/check', payload);
  },
};
