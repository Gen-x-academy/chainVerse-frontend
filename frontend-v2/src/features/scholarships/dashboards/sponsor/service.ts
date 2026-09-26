/**
 * Sponsor dashboard domain rules (issue #1133).
 *
 * Two properties are enforced here rather than left to the caller: scope
 * enforcement (out-of-scope programs are refused, not fetched) and honest
 * budget arithmetic (overspend is clamped at zero and reported, never hidden
 * behind a negative "remaining").
 */

import { apiClient } from '@/src/lib/api-client';
import {
  FRESHNESS_MAX_AGE_SECONDS,
  FUNNEL_STAGES,
  type ApplicationFunnel,
  type Freshness,
  type LedgerTotals,
  type ProgramBudgetSummary,
  type ReviewAssignment,
  type ReviewProgress,
  type ScopeRefusal,
  type SponsorApplication,
  type SponsorDashboard,
  type SponsorScope,
} from './types';

export function isInScope(scope: SponsorScope, programId: string): boolean {
  return scope.programIds.includes(programId);
}

/** Refuses out-of-scope programs explicitly, so the refusal is auditable. */
export function assertSponsorScope(scope: SponsorScope, programId: string): ScopeRefusal {
  if (!isInScope(scope, programId)) {
    return {
      refused: true,
      reason: `Program ${programId} is outside this sponsor's scope. Ask the platform administrator to add it to sponsor ${scope.sponsorId}.`,
    };
  }
  return { refused: false };
}

export type BudgetSummaryInput = {
  programId: string;
  programName: string;
  budgetCents: number;
  committedCents: number;
  disbursedCents: number;
  currency: string;
};

/**
 * Remaining is `budget − committed`, clamped at zero. When commitments exceed
 * the budget the overspend is reported through `overspent` so the tile can say
 * "over budget by X" instead of showing a negative remainder.
 */
export function budgetSummary(input: BudgetSummaryInput): ProgramBudgetSummary {
  const rawRemaining = input.budgetCents - input.committedCents;
  return {
    programId: input.programId,
    programName: input.programName,
    budgetCents: input.budgetCents,
    committedCents: input.committedCents,
    disbursedCents: input.disbursedCents,
    remainingCents: Math.max(0, rawRemaining),
    currency: input.currency,
    overspent: rawRemaining < 0,
  };
}

/** Cumulative funnel: each stage counts every application that reached it. */
export function funnelStages(
  applications: readonly SponsorApplication[],
  programId: string
): ApplicationFunnel {
  const forProgram = applications.filter((application) => application.programId === programId);
  const reachedIndex = (application: SponsorApplication) =>
    FUNNEL_STAGES.findIndex((entry) => entry.stage === application.stage);

  return {
    programId,
    stages: FUNNEL_STAGES.map((entry, index) => ({
      label: entry.label,
      count: forProgram.filter((application) => reachedIndex(application) >= index).length,
    })),
  };
}

export function reviewProgress(
  reviews: readonly ReviewAssignment[],
  programId: string,
  now: Date
): ReviewProgress {
  const forProgram = reviews.filter((review) => review.programId === programId);
  return {
    programId,
    assigned: forProgram.filter((review) => review.status === 'assigned').length,
    inProgress: forProgram.filter((review) => review.status === 'in-progress').length,
    completed: forProgram.filter((review) => review.status === 'completed').length,
    overdue: forProgram.filter(
      (review) => review.status !== 'completed' && Date.parse(review.dueAt) < now.getTime()
    ).length,
  };
}

export function assessFreshness(
  computedAt: string,
  now: Date,
  maxAgeSeconds = FRESHNESS_MAX_AGE_SECONDS
): Freshness {
  const computed = Date.parse(computedAt);
  const ageSeconds = Number.isNaN(computed)
    ? Number.POSITIVE_INFINITY
    : Math.max(0, Math.round((now.getTime() - computed) / 1000));
  return {
    computedAt,
    ageSeconds,
    stale: ageSeconds > maxAgeSeconds,
  };
}

/** True when the dashboard's committed/disbursed figures match the ledger. */
export function reconciles(
  summary: ProgramBudgetSummary,
  ledgerTotals: LedgerTotals
): boolean {
  return (
    summary.programId === ledgerTotals.programId &&
    summary.currency === ledgerTotals.currency &&
    summary.committedCents === ledgerTotals.committedCents &&
    summary.disbursedCents === ledgerTotals.disbursedCents
  );
}

export const sponsorDashboardService = {
  async get(sponsorId: string, scope: SponsorScope): Promise<SponsorDashboard> {
    if (scope.sponsorId !== sponsorId) {
      throw new Error('The requested sponsor does not match this dashboard scope.');
    }
    return apiClient.get<SponsorDashboard>(
      `/scholarships/dashboard/sponsor/${encodeURIComponent(sponsorId)}?programIds=${encodeURIComponent(scope.programIds.join(','))}`
    );
  },
};
