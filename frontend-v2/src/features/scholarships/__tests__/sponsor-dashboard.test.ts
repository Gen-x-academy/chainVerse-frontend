import { describe, expect, it, vi } from 'vitest';
import {
  assertSponsorScope,
  assessFreshness,
  budgetSummary,
  funnelStages,
  isInScope,
  reconciles,
  reviewProgress,
  sponsorDashboardService,
  FUNNEL_STAGES,
} from '../dashboards/sponsor';
import type { ReviewAssignment, SponsorApplication, SponsorScope } from '../dashboards/sponsor';

vi.mock('@/src/lib/api-client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const NOW = new Date('2026-04-01T12:00:00.000Z');

const SCOPE: SponsorScope = { sponsorId: 'sponsor-acme', programIds: ['program-1', 'program-2'] };

const application = (stage: SponsorApplication['stage'], id: string): SponsorApplication => ({
  id,
  programId: 'program-1',
  stage,
  awarded: stage === 'awarded',
});

describe('sponsor scope', () => {
  it('allows a program in scope', () => {
    expect(isInScope(SCOPE, 'program-1')).toBe(true);
    expect(assertSponsorScope(SCOPE, 'program-2')).toEqual({ refused: false });
  });

  it('refuses a program outside the sponsor scope with an explanation', () => {
    expect(isInScope(SCOPE, 'program-other')).toBe(false);
    const refusal = assertSponsorScope(SCOPE, 'program-other');
    expect(refusal.refused).toBe(true);
    if (!refusal.refused) throw new Error('expected a refusal');
    expect(refusal.reason).toContain('program-other');
    expect(refusal.reason).toContain('sponsor-acme');
  });

  it('refuses a mismatched sponsor on the dashboard fetch', async () => {
    await expect(
      sponsorDashboardService.get('sponsor-other', SCOPE)
    ).rejects.toThrow(/does not match/i);
  });
});

describe('budgetSummary', () => {
  it('subtracts commitments from the budget', () => {
    expect(
      budgetSummary({
        programId: 'program-1',
        programName: 'Program One',
        budgetCents: 1_000_000,
        committedCents: 400_000,
        disbursedCents: 250_000,
        currency: 'USD',
      })
    ).toEqual({
      programId: 'program-1',
      programName: 'Program One',
      budgetCents: 1_000_000,
      committedCents: 400_000,
      disbursedCents: 250_000,
      remainingCents: 600_000,
      currency: 'USD',
      overspent: false,
    });
  });

  it('clamps remaining at zero and reports the overspend', () => {
    const summary = budgetSummary({
      programId: 'program-1',
      programName: 'Program One',
      budgetCents: 100_000,
      committedCents: 150_000,
      disbursedCents: 0,
      currency: 'USD',
    });
    expect(summary.remainingCents).toBe(0);
    expect(summary.overspent).toBe(true);
  });
});

describe('funnelStages', () => {
  it('returns stages in the fixed reportable order', () => {
    expect(funnelStages([], 'program-1').stages.map((stage) => stage.label)).toEqual([
      'Eligible',
      'Started',
      'Submitted',
      'Reviewed',
      'Decided',
      'Awarded',
    ]);
    expect(FUNNEL_STAGES.map((entry) => entry.stage)).toEqual([
      'eligible',
      'started',
      'submitted',
      'reviewed',
      'decided',
      'awarded',
    ]);
  });

  it('counts every application that reached a stage', () => {
    const applications = [
      application('eligible', 'a'),
      application('started', 'b'),
      application('submitted', 'c'),
      application('reviewed', 'd'),
      application('decided', 'e'),
      application('awarded', 'f'),
    ];
    const counts = funnelStages(applications, 'program-1').stages.map((stage) => stage.count);
    expect(counts).toEqual([6, 5, 4, 3, 2, 1]);
  });

  it('excludes applications from other programs', () => {
    const counts = funnelStages(
      [application('awarded', 'a'), { ...application('awarded', 'b'), programId: 'program-2' }],
      'program-1'
    ).stages.map((stage) => stage.count);
    expect(counts).toEqual([1, 1, 1, 1, 1, 1]);
  });
});

describe('reviewProgress', () => {
  const reviews: ReviewAssignment[] = [
    { programId: 'program-1', status: 'assigned', dueAt: '2026-04-02T00:00:00.000Z' },
    { programId: 'program-1', status: 'in-progress', dueAt: '2026-03-01T00:00:00.000Z' },
    { programId: 'program-1', status: 'completed', dueAt: '2026-03-01T00:00:00.000Z' },
    { programId: 'program-2', status: 'assigned', dueAt: '2026-03-01T00:00:00.000Z' },
  ];

  it('counts by status and flags overdue unfinished reviews', () => {
    expect(reviewProgress(reviews, 'program-1', NOW)).toEqual({
      programId: 'program-1',
      assigned: 1,
      inProgress: 1,
      completed: 1,
      overdue: 1,
    });
  });

  it('never counts a completed review as overdue', () => {
    const late: ReviewAssignment[] = [
      { programId: 'program-1', status: 'completed', dueAt: '2020-01-01T00:00:00.000Z' },
    ];
    expect(reviewProgress(late, 'program-1', NOW).overdue).toBe(0);
  });
});

describe('assessFreshness', () => {
  it('is fresh inside the window', () => {
    expect(assessFreshness('2026-04-01T12:00:00.000Z', NOW, 900)).toEqual({
      computedAt: '2026-04-01T12:00:00.000Z',
      ageSeconds: 0,
      stale: false,
    });
  });

  it('is stale beyond the window and reports the age', () => {
    const freshness = assessFreshness('2026-04-01T11:00:00.000Z', NOW, 900);
    expect(freshness.stale).toBe(true);
    expect(freshness.ageSeconds).toBe(3600);
  });

  it('treats an unparseable timestamp as stale', () => {
    expect(assessFreshness('not-a-date', NOW).stale).toBe(true);
  });
});

describe('reconciles', () => {
  const summary = budgetSummary({
    programId: 'program-1',
    programName: 'Program One',
    budgetCents: 1_000_000,
    committedCents: 400_000,
    disbursedCents: 250_000,
    currency: 'USD',
  });

  it('reconciles when committed and disbursed match the ledger', () => {
    expect(
      reconciles(summary, { programId: 'program-1', committedCents: 400_000, disbursedCents: 250_000, currency: 'USD' })
    ).toBe(true);
  });

  it('does not reconcile on a disbursement mismatch', () => {
    expect(
      reconciles(summary, { programId: 'program-1', committedCents: 400_000, disbursedCents: 240_000, currency: 'USD' })
    ).toBe(false);
  });

  it('does not reconcile across currencies', () => {
    expect(
      reconciles(summary, { programId: 'program-1', committedCents: 400_000, disbursedCents: 250_000, currency: 'EUR' })
    ).toBe(false);
  });
});
