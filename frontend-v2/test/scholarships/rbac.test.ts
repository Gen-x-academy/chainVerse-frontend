import { describe, expect, it } from 'vitest';
import {
  canPerform,
  describeDenial,
  scopeListQuery,
  type ScholarshipPrincipal,
} from '@/src/features/scholarships/rbac';

const reviewer: ScholarshipPrincipal = { userId: 'reviewer-1', role: 'reviewer', tenantId: 'platform' };
const student: ScholarshipPrincipal = { userId: 'student-1', role: 'student', tenantId: 'platform' };
const sponsorAdmin: ScholarshipPrincipal = { userId: 'sponsor-1', role: 'sponsor', tenantId: 'sponsor-a' };
const finance: ScholarshipPrincipal = { userId: 'finance-1', role: 'finance', tenantId: 'platform' };
const auditor: ScholarshipPrincipal = { userId: 'auditor-1', role: 'auditor', tenantId: 'platform' };

describe('scholarship RBAC and tenant isolation (#1149)', () => {
  it('denies direct object access across tenants', () => {
    const decision = canPerform(
      sponsorAdmin,
      { resource: 'application', tenantId: 'sponsor-b', ownerId: 'student-9' },
      'read'
    );

    expect(decision).toEqual({ allowed: false, reason: 'CROSS_TENANT_DENIED' });
    expect(describeDenial(decision)).toContain('different organization');
  });

  it('denies a student reaching another student record', () => {
    const decision = canPerform(
      student,
      { resource: 'application', tenantId: 'platform', ownerId: 'student-2' },
      'read'
    );

    expect(decision).toEqual({ allowed: false, reason: 'NO_PERMISSION' });
  });

  it('allows a student to reach their own application', () => {
    expect(
      canPerform(student, { resource: 'application', tenantId: 'platform', ownerId: 'student-1' }, 'read')
    ).toEqual({ allowed: true });
  });

  it('allows a reviewer to review but not to approve a decision', () => {
    expect(
      canPerform(reviewer, { resource: 'review', tenantId: 'platform' }, 'create')
    ).toEqual({ allowed: true });
    expect(
      canPerform(reviewer, { resource: 'decision', tenantId: 'platform' }, 'approve')
    ).toEqual({ allowed: false, reason: 'NO_PERMISSION' });
  });

  it('keeps an auditor read-only', () => {
    expect(
      canPerform(auditor, { resource: 'payment', tenantId: 'platform' }, 'export')
    ).toEqual({ allowed: true });
    expect(
      canPerform(auditor, { resource: 'payment', tenantId: 'platform' }, 'update')
    ).toEqual({ allowed: false, reason: 'NO_PERMISSION' });
    expect(
      canPerform(auditor, { resource: 'configuration', tenantId: 'platform' }, 'update')
    ).toEqual({ allowed: false, reason: 'NO_PERMISSION' });
  });

  it('lets finance move money but not read unrelated resources', () => {
    expect(
      canPerform(finance, { resource: 'payment', tenantId: 'platform' }, 'update')
    ).toEqual({ allowed: true });
    expect(
      canPerform(finance, { resource: 'review', tenantId: 'platform' }, 'read')
    ).toEqual({ allowed: false, reason: 'NO_PERMISSION' });
  });

  it('scopes list queries by tenant and by owner for students', () => {
    expect(scopeListQuery(reviewer)).toEqual({ tenantId: 'platform' });
    expect(scopeListQuery(sponsorAdmin)).toEqual({ tenantId: 'sponsor-a' });
    expect(scopeListQuery(student)).toEqual({ tenantId: 'platform', ownerId: 'student-1' });
  });
});
