// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  GO_LIVE_CHECKS,
  defaultReadinessPolicy,
  evaluateReadiness,
  planRollback,
  schedulePostLaunchReview,
  verifyRollbackPreserves,
} from '@/src/features/scholarships/release';
import type { ActiveApplication, FundItem, GoLiveCheck, ReadinessPolicy } from '@/src/features/scholarships/release';

const applications: ActiveApplication[] = [
  { id: 'app-2001', applicantId: 'apt-9001', status: 'under-review', version: 3 },
  { id: 'app-2002', applicantId: 'apt-9002', status: 'committed', version: 2 },
];

const funds: FundItem[] = [
  { id: 'fund-301', applicationId: 'app-2001', amount: '500', status: 'escrowed' },
  { id: 'fund-302', applicationId: 'app-2001', amount: '1200', status: 'disbursed' },
  { id: 'fund-303', applicationId: 'app-2002', amount: '800', status: 'disbursing' },
];

const approvedChecks = (): GoLiveCheck[] =>
  GO_LIVE_CHECKS.map((check) =>
    check.severity === 'blocking'
      ? { ...check, status: 'passed', signedOffBy: check.owner, signedOffAt: '2026-09-24T00:00:00.000Z' }
      : check
  );

describe('scholarships launch readiness', () => {
  it('starts blocked with blocking checks pending', () => {
    const verdict = evaluateReadiness(GO_LIVE_CHECKS, defaultReadinessPolicy);

    expect(verdict.ready).toBe(false);
    expect(verdict.blockedCategories.length).toBeGreaterThan(0);
  });

  it('blocks when a passed blocking check lacks owner sign-off', () => {
    const checks = GO_LIVE_CHECKS.map((check) => ({ ...check, status: 'passed' as const }));
    const verdict = evaluateReadiness(checks, defaultReadinessPolicy);

    expect(verdict.ready).toBe(false);
    expect(verdict.unsignedOwners.length).toBeGreaterThan(0);
  });

  it('opens when every blocking check is passed and signed off', () => {
    const verdict = evaluateReadiness(approvedChecks(), defaultReadinessPolicy);

    expect(verdict.ready).toBe(true);
    expect(verdict.blockedCategories).toEqual([]);
  });

  it('leaves advisory checks open without blocking launch', () => {
    const policy: ReadinessPolicy = { requireSignOff: true, requireAllBlockingChecks: true };
    const verdict = evaluateReadiness(approvedChecks(), policy);

    const advisoryOpen = GO_LIVE_CHECKS.filter((check) => check.severity === 'advisory').length;
    expect(verdict.ready).toBe(true);
    expect(verdict.openAdvisoryChecks).toBe(advisoryOpen);
  });
});

describe('scholarships rollback plan', () => {
  it('retains every active application and guards every fund', () => {
    const plan = planRollback({ featureFlagsToDisable: ['scholarships.payments'], applications, funds });

    expect(plan.retainedApplicationIds).toEqual(['app-2001', 'app-2002']);
    expect(plan.preservesActiveApplications).toBe(true);
    expect(plan.preservesFunds).toBe(true);
    expect(verifyRollbackPreserves(plan, applications, funds)).toBe(true);
  });

  it('reverts disbursed funds and holds in-flight funds', () => {
    const plan = planRollback({ featureFlagsToDisable: [], applications, funds });

    expect(plan.fundActions.find((action) => action.fundId === 'fund-302')?.action).toBe('revert');
    expect(plan.fundActions.find((action) => action.fundId === 'fund-303')?.action).toBe('hold');
  });

  it('fails verification when an application would be dropped', () => {
    const plan = planRollback({ featureFlagsToDisable: [], applications, funds });
    const extraApplication: ActiveApplication = { id: 'app-2099', applicantId: 'apt-9099', status: 'under-review', version: 1 };

    expect(verifyRollbackPreserves(plan, [...applications, extraApplication], funds)).toBe(false);
  });
});

describe('scholarships post-launch review', () => {
  const now = new Date('2026-09-24T00:00:00.000Z');

  it('schedules a review in the future with named reviewers', () => {
    const review = schedulePostLaunchReview({
      scheduledFor: '2026-10-15T09:00:00.000Z',
      reviewers: ['Finance operations', 'Platform engineering'],
      criteria: ['Payment failure rate within target.'],
      owner: 'Program delivery',
      now,
    });

    expect(review.status).toBe('scheduled');
    expect(review.reviewers).toHaveLength(2);
  });

  it('rejects a review in the past or without reviewers', () => {
    expect(() =>
      schedulePostLaunchReview({
        scheduledFor: '2026-09-01T09:00:00.000Z',
        reviewers: ['Platform engineering'],
        criteria: ['Criterion'],
        owner: 'Program delivery',
        now,
      })
    ).toThrow('must be scheduled in the future');

    expect(() =>
      schedulePostLaunchReview({
        scheduledFor: '2026-10-15T09:00:00.000Z',
        reviewers: [],
        criteria: ['Criterion'],
        owner: 'Program delivery',
        now,
      })
    ).toThrow('At least one reviewer');
  });
});