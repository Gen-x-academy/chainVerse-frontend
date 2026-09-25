/**
 * Scholarship RBAC and tenant isolation (issue #1149).
 *
 * Student, sponsor, reviewer, verifier, finance, auditor, and administrator
 * permissions are enforced on every resource. Access is denied when the
 * principal belongs to a different tenant than the resource, when the role has
 * no grant for the action, and when a student tries to reach another student's
 * record. List queries are always scoped to the principal's tenant (and to the
 * principal's own records when they are a student).
 */

import { apiClient } from '@/src/lib/api-client';

export type ScholarshipRole =
  | 'student'
  | 'sponsor'
  | 'reviewer'
  | 'verifier'
  | 'finance'
  | 'auditor'
  | 'administrator';

export type ScholarshipResource =
  | 'program'
  | 'application'
  | 'review'
  | 'decision'
  | 'award'
  | 'milestone'
  | 'payment'
  | 'refund'
  | 'audit-event'
  | 'configuration';

export type ScholarshipAction = 'read' | 'create' | 'update' | 'delete' | 'approve' | 'export';

export type ScholarshipPrincipal = {
  userId: string;
  role: ScholarshipRole;
  /** Tenant the principal belongs to: a sponsor organization or the platform. */
  tenantId: string;
};

export type ScholarshipResourceRef = {
  resource: ScholarshipResource;
  /** Tenant that owns the resource. */
  tenantId: string;
  /** Owner used for student self-service checks. */
  ownerId?: string;
};

export type PermissionDenialReason = 'CROSS_TENANT_DENIED' | 'NO_PERMISSION';

export type PermissionDecision =
  | { allowed: true }
  | { allowed: false; reason: PermissionDenialReason };

export type RolePermissionMatrix = Record<
  ScholarshipRole,
  Partial<Record<ScholarshipResource, ScholarshipAction[]>>
>;

export const SCHOLARSHIP_ROLE_PERMISSIONS: RolePermissionMatrix = {
  student: {
    program: ['read'],
    application: ['read', 'create', 'update'],
    award: ['read'],
    milestone: ['read'],
    payment: ['read'],
  },
  sponsor: {
    program: ['read', 'create', 'update'],
    award: ['read'],
    payment: ['read'],
  },
  reviewer: {
    program: ['read'],
    application: ['read', 'update'],
    review: ['read', 'create', 'update'],
    decision: ['read'],
  },
  verifier: {
    program: ['read'],
    application: ['read'],
    milestone: ['read', 'update'],
  },
  finance: {
    program: ['read'],
    award: ['read'],
    payment: ['read', 'create', 'update'],
    refund: ['read', 'create'],
    'audit-event': ['read'],
  },
  auditor: {
    program: ['read', 'export'],
    application: ['read', 'export'],
    review: ['read', 'export'],
    decision: ['read', 'export'],
    award: ['read', 'export'],
    milestone: ['read', 'export'],
    payment: ['read', 'export'],
    refund: ['read', 'export'],
    'audit-event': ['read', 'export'],
    configuration: ['read'],
  },
  administrator: {
    program: ['read', 'create', 'update', 'delete', 'approve', 'export'],
    application: ['read', 'create', 'update', 'delete', 'approve', 'export'],
    review: ['read', 'create', 'update', 'delete', 'approve', 'export'],
    decision: ['read', 'create', 'update', 'delete', 'approve', 'export'],
    award: ['read', 'create', 'update', 'delete', 'approve', 'export'],
    milestone: ['read', 'create', 'update', 'delete', 'approve', 'export'],
    payment: ['read', 'create', 'update', 'delete', 'approve', 'export'],
    refund: ['read', 'create', 'update', 'delete', 'approve', 'export'],
    'audit-event': ['read', 'export'],
    configuration: ['read', 'create', 'update', 'delete', 'approve', 'export'],
  },
};

export function canPerform(
  principal: ScholarshipPrincipal,
  resource: ScholarshipResourceRef,
  action: ScholarshipAction
): PermissionDecision {
  if (principal.tenantId !== resource.tenantId) {
    return { allowed: false, reason: 'CROSS_TENANT_DENIED' };
  }

  if (principal.role === 'student' && resource.ownerId && resource.ownerId !== principal.userId) {
    return { allowed: false, reason: 'NO_PERMISSION' };
  }

  const grants = SCHOLARSHIP_ROLE_PERMISSIONS[principal.role][resource.resource] ?? [];
  if (!grants.includes(action)) {
    return { allowed: false, reason: 'NO_PERMISSION' };
  }

  return { allowed: true };
}

/** Every list query is scoped; students only ever see their own records. */
export function scopeListQuery(
  principal: ScholarshipPrincipal
): { tenantId: string; ownerId?: string } {
  return principal.role === 'student'
    ? { tenantId: principal.tenantId, ownerId: principal.userId }
    : { tenantId: principal.tenantId };
}

export function describeDenial(decision: PermissionDecision): string {
  if (decision.allowed) return 'Access granted.';
  return decision.reason === 'CROSS_TENANT_DENIED'
    ? 'This record belongs to a different organization.'
    : 'Your role does not allow this action.';
}

export const scholarshipAccessService = {
  permissions: (): Promise<RolePermissionMatrix> =>
    apiClient.get<RolePermissionMatrix>('/scholarships/access/permissions'),

  check: (payload: {
    role: ScholarshipRole;
    tenantId: string;
    resource: ScholarshipResource;
    action: ScholarshipAction;
  }): Promise<PermissionDecision> =>
    apiClient.post<PermissionDecision>('/scholarships/access/check', payload),
};
