import { describe, expect, it } from 'vitest';
import {
  MENTORSHIP_ROLE_PERMISSIONS,
  MENTORSHIP_ROLES,
  accessibleMentorshipAreas,
  canAccessMentorshipArea,
  canPerformMentorshipAction,
  describeMentorshipDenial,
  operationsForRole,
  type MentorshipPrincipal,
  type MentorshipResourceRef,
} from '../rbac';

function principal(overrides: Partial<MentorshipPrincipal> = {}): MentorshipPrincipal {
  return { userId: 'user-1', role: 'student', tenantId: 'tenant-a', ...overrides };
}

function resource(overrides: Partial<MentorshipResourceRef> = {}): MentorshipResourceRef {
  return { resource: 'program', tenantId: 'tenant-a', ...overrides };
}

describe('mentorship permission matrix', () => {
  it('grants every operation through an explicit entry only', () => {
    for (const role of MENTORSHIP_ROLES) {
      const operations = operationsForRole(role);
      expect(operations.length).toBeGreaterThan(0);
      for (const operation of operations) {
        expect(operation.actions.length).toBeGreaterThan(0);
      }
    }
  });

  it('lets a student read a program but not create one', () => {
    expect(canPerformMentorshipAction(principal(), resource(), 'read').allowed).toBe(true);
    expect(canPerformMentorshipAction(principal(), resource(), 'create').allowed).toBe(false);
  });

  it('denies cross-tenant access before any grant is considered', () => {
    const decision = canPerformMentorshipAction(
      principal({ role: 'administrator' }),
      resource({ tenantId: 'tenant-b' }),
      'read',
    );
    expect(decision).toEqual({ allowed: false, reason: 'CROSS_TENANT_DENIED' });
  });

  it('denies self-approval even for an administrator', () => {
    const decision = canPerformMentorshipAction(
      principal({ role: 'administrator', userId: 'admin-1' }),
      { resource: 'verification', tenantId: 'tenant-a', ownerId: 'admin-1' },
      'approve',
    );
    expect(decision).toEqual({ allowed: false, reason: 'SELF_APPROVAL_DENIED' });
  });

  it('lets a moderator approve another principal verification but not their own', () => {
    const other = canPerformMentorshipAction(
      principal({ role: 'moderator', userId: 'mod-1' }),
      { resource: 'verification', tenantId: 'tenant-a', ownerId: 'mentor-9' },
      'approve',
    );
    expect(other.allowed).toBe(true);

    const own = canPerformMentorshipAction(
      principal({ role: 'moderator', userId: 'mod-1' }),
      { resource: 'verification', tenantId: 'tenant-a', ownerId: 'mod-1' },
      'approve',
    );
    expect(own).toEqual({ allowed: false, reason: 'SELF_APPROVAL_DENIED' });
  });

  it('scopes a guardian to their linked wards', () => {
    const linked = canPerformMentorshipAction(
      principal({ role: 'guardian', wards: ['mentee-1'] }),
      { resource: 'mentee-profile', tenantId: 'tenant-a', ownerId: 'mentee-1' },
      'read',
    );
    expect(linked.allowed).toBe(true);

    const unlinked = canPerformMentorshipAction(
      principal({ role: 'guardian', wards: ['mentee-1'] }),
      { resource: 'mentee-profile', tenantId: 'tenant-a', ownerId: 'mentee-2' },
      'read',
    );
    expect(unlinked).toEqual({ allowed: false, reason: 'GUARDIAN_SCOPE_DENIED' });
  });

  it('denies a role with no grant for the resource', () => {
    const decision = canPerformMentorshipAction(
      principal({ role: 'finance' }),
      resource({ resource: 'expertise-taxonomy' }),
      'update',
    );
    expect(decision).toEqual({ allowed: false, reason: 'NO_PERMISSION' });
  });

  it('lets finance settle a payment', () => {
    expect(
      canPerformMentorshipAction(
        principal({ role: 'finance' }),
        { resource: 'payment', tenantId: 'tenant-a' },
        'settle',
      ).allowed,
    ).toBe(true);
  });

  it('describes every denial reason', () => {
    expect(describeMentorshipDenial({ allowed: true })).toMatch(/granted/i);
    expect(describeMentorshipDenial({ allowed: false, reason: 'CROSS_TENANT_DENIED' })).toMatch(
      /different organization/i,
    );
    expect(describeMentorshipDenial({ allowed: false, reason: 'SELF_APPROVAL_DENIED' })).toMatch(
      /cannot approve/i,
    );
    expect(describeMentorshipDenial({ allowed: false, reason: 'GUARDIAN_SCOPE_DENIED' })).toMatch(
      /linked to your guardian/i,
    );
    expect(describeMentorshipDenial({ allowed: false, reason: 'NO_PERMISSION' })).toMatch(
      /role does not allow/i,
    );
  });

  it('keeps the matrix typed for every role', () => {
    for (const role of MENTORSHIP_ROLES) {
      expect(MENTORSHIP_ROLE_PERMISSIONS[role]).toBeDefined();
    }
  });
});

describe('role-aware navigation', () => {
  it('denies an unmapped role', () => {
    expect(canAccessMentorshipArea(undefined, 'hub')).toBe(false);
    expect(canAccessMentorshipArea('stranger', 'hub')).toBe(false);
  });

  it('lists only the non-hub areas a role can reach', () => {
    expect(accessibleMentorshipAreas('administrator')).not.toContain('hub');
    expect(accessibleMentorshipAreas('student')).toEqual(['learning-profile']);
    expect(accessibleMentorshipAreas('mentor')).toContain('verification');
  });

  it('restricts the roles dashboard to administrators', () => {
    expect(canAccessMentorshipArea('administrator', 'roles')).toBe(true);
    expect(canAccessMentorshipArea('mentor', 'roles')).toBe(false);
  });
});
