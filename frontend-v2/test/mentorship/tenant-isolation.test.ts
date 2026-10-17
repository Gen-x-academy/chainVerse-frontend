// @vitest-environment node
/**
 * Tenant isolation verification suite for mentorship (#1360, MENTOR-112).
 *
 * Continuously verifies that every mentorship data domain is deny-by-default
 * across tenants. `canPerformMentorshipAction` (MENTOR-003) is the authoritative
 * client check: the tenant compare runs before the matrix, so a cross-tenant
 * principal is denied regardless of role or grant.
 *
 * Failure messages name the tenant ids (never resource bodies) so a leak is
 * identifiable without echoing the payload that leaked.
 */
import { describe, expect, it } from 'vitest';
import {
  MENTORSHIP_ROLES,
  canPerformMentorshipAction,
  type MentorshipAction,
  type MentorshipPermissionDecision,
  type MentorshipPrincipal,
  type MentorshipResource,
  type MentorshipResourceRef,
  type MentorshipRole,
} from '@/src/features/mentorship/rbac';

const HOME = 'tenant-home';
const OTHER = 'tenant-other';

function makePrincipal(role: MentorshipRole, tenantId: string): MentorshipPrincipal {
  return { userId: `${role}-principal`, role, tenantId };
}

/** A scoped resource reference owned by `id`; callers spread in `resource`. */
function makeResource(tenantId: string, id: string): Omit<MentorshipResourceRef, 'resource'> {
  return { tenantId, ownerId: id };
}

function ctx(principal: MentorshipPrincipal, resource: MentorshipResourceRef): string {
  return `principal tenant=${principal.tenantId} role=${principal.role} ` +
    `resource tenant=${resource.tenantId} resource=${resource.resource}`;
}

function expectCrossTenantDenied(
  decision: MentorshipPermissionDecision,
  context: string,
): void {
  expect(decision.allowed, context).toBe(false);
  if (!decision.allowed) {
    expect(decision.reason, context).toBe('CROSS_TENANT_DENIED');
  }
  // A denial is exactly a decision — it must not carry a resource body.
  expect(Object.keys(decision), context).toEqual(['allowed', 'reason']);
}

type DomainCase = {
  domain: string;
  resource: MentorshipResource;
  action: MentorshipAction;
  role: MentorshipRole;
};

/**
 * One representative grant per domain. The positive case proves the grant is
 * reachable in-tenant; the same case is reused cross-tenant to prove refusal.
 */
const DOMAINS: DomainCase[] = [
  { domain: 'organization', resource: 'configuration', action: 'read', role: 'organization-staff' },
  { domain: 'program', resource: 'program', action: 'read', role: 'organization-staff' },
  { domain: 'profile', resource: 'mentor-profile', action: 'read', role: 'mentor' },
  { domain: 'application', resource: 'engagement', action: 'read', role: 'student' },
  { domain: 'agreement', resource: 'engagement', action: 'update', role: 'mentor' },
  { domain: 'session', resource: 'session', action: 'create', role: 'mentor' },
  { domain: 'payment', resource: 'payment', action: 'read', role: 'finance' },
  { domain: 'report', resource: 'audit-event', action: 'read', role: 'finance' },
  { domain: 'analytics', resource: 'audit-event', action: 'export', role: 'finance' },
];

for (const { domain, resource, action, role } of DOMAINS) {
  describe(`tenant isolation — ${domain}`, () => {
    it('allows a same-tenant principal to act on the resource', () => {
      const principal = makePrincipal(role, HOME);
      const ref: MentorshipResourceRef = { resource, ...makeResource(HOME, 'owner-in-home') };
      const decision = canPerformMentorshipAction(principal, ref, action);
      expect(decision, ctx(principal, ref)).toEqual({ allowed: true });
    });

    it('denies a cross-tenant principal (deny-by-default)', () => {
      const principal = makePrincipal(role, HOME);
      const ref: MentorshipResourceRef = { resource, ...makeResource(OTHER, 'owner-in-other') };
      expectCrossTenantDenied(canPerformMentorshipAction(principal, ref, action), ctx(principal, ref));
    });

    it('denies the reverse direction (other tenant reading home)', () => {
      const principal = makePrincipal(role, OTHER);
      const ref: MentorshipResourceRef = { resource, ...makeResource(HOME, 'owner-in-home') };
      expectCrossTenantDenied(canPerformMentorshipAction(principal, ref, action), ctx(principal, ref));
    });
  });
}

const ALL_RESOURCES: MentorshipResource[] = [
  'mentor-profile',
  'mentee-profile',
  'expertise-taxonomy',
  'verification',
  'program',
  'engagement',
  'session',
  'deliverable',
  'payment',
  'dispute',
  'configuration',
  'audit-event',
];

const ALL_ACTIONS: MentorshipAction[] = [
  'read',
  'create',
  'update',
  'delete',
  'approve',
  'publish',
  'settle',
  'export',
];

describe('tenant isolation — full role × resource × action matrix', () => {
  it('denies every cross-tenant attempt across all roles, resources, and actions', () => {
    for (const role of MENTORSHIP_ROLES) {
      for (const resource of ALL_RESOURCES) {
        for (const action of ALL_ACTIONS) {
          const principal = makePrincipal(role, HOME);
          const ref: MentorshipResourceRef = { resource, ...makeResource(OTHER, 'other-owner') };
          expectCrossTenantDenied(
            canPerformMentorshipAction(principal, ref, action),
            ctx(principal, ref),
          );
        }
      }
    }
  });
});

describe('tenant isolation — mutation paths', () => {
  const mutations: MentorshipAction[] = ['create', 'update', 'delete', 'settle'];

  it('denies cross-tenant mutations even for roles that may mutate in-tenant', () => {
    for (const role of MENTORSHIP_ROLES) {
      for (const resource of ALL_RESOURCES) {
        for (const action of mutations) {
          const principal = makePrincipal(role, HOME);
          const ref: MentorshipResourceRef = { resource, ...makeResource(OTHER, 'other-owner') };
          expectCrossTenantDenied(
            canPerformMentorshipAction(principal, ref, action),
            ctx(principal, ref),
          );
        }
      }
    }
  });
});

describe('tenant isolation — administrator is not exempt', () => {
  const adminResources: MentorshipResource[] = [
    'mentor-profile',
    'program',
    'engagement',
    'payment',
    'configuration',
  ];

  it('denies an administrator acting on any resource in another tenant', () => {
    for (const resource of adminResources) {
      for (const action of ALL_ACTIONS) {
        const principal = makePrincipal('administrator', HOME);
        const ref: MentorshipResourceRef = { resource, ...makeResource(OTHER, 'other-owner') };
        expectCrossTenantDenied(
          canPerformMentorshipAction(principal, ref, action),
          ctx(principal, ref),
        );
      }
    }
  });
});

describe('tenant isolation — denials do not echo resource bodies', () => {
  it('returns only { allowed, reason } and never leaks sensitive fields', () => {
    const secretPayload = {
      resource: 'payment' as MentorshipResource,
      tenantId: OTHER,
      ownerId: 'owner-in-other',
      body: { cardNumber: '4111111111111111', note: 'private-case-note' },
    } as unknown as MentorshipResourceRef;

    const decision = canPerformMentorshipAction(makePrincipal('finance', HOME), secretPayload, 'read');

    expectCrossTenantDenied(decision, ctx(makePrincipal('finance', HOME), secretPayload));
    const serialised = JSON.stringify(decision);
    expect(serialised).not.toContain('4111111111111111');
    expect(serialised).not.toContain('private-case-note');
  });
});
