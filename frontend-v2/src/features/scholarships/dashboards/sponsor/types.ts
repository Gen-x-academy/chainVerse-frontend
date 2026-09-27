/**
 * Sponsor program dashboard (issue #1133).
 *
 * Everything on this dashboard is sponsor-scoped: a program that is not in
 * `SponsorScope.programIds` is refused outright rather than queried, because
 * the point of the scope is to avoid ever fetching another sponsor's numbers.
 *
 * Impact indicators always ship with the definition they were computed from —
 * a number without its definition is marketing, not reporting.
 */

export type SponsorScope = {
  sponsorId: string;
  programIds: string[];
};

export type ProgramBudgetSummary = {
  programId: string;
  programName: string;
  budgetCents: number;
  committedCents: number;
  disbursedCents: number;
  remainingCents: number;
  currency: string;
  /** True when commitments exceeded the budget and `remainingCents` was clamped. */
  overspent: boolean;
};

export type FunnelStage = {
  label: string;
  count: number;
};

export type ApplicationFunnel = {
  programId: string;
  stages: FunnelStage[];
};

export type ReviewProgress = {
  programId: string;
  assigned: number;
  inProgress: number;
  completed: number;
  overdue: number;
};

export type ReviewAssignment = {
  programId: string;
  status: 'assigned' | 'in-progress' | 'completed';
  dueAt: string;
};

export type SponsorApplication = {
  id: string;
  programId: string;
  /** Ordered funnel stage the application has reached. */
  stage: SponsorApplicationStage;
  submittedAt?: string;
  reviewedAt?: string;
  decidedAt?: string;
  awarded: boolean;
};

export type SponsorApplicationStage =
  | 'eligible'
  | 'started'
  | 'submitted'
  | 'reviewed'
  | 'decided'
  | 'awarded';

export type ImpactUnit = 'currency' | 'count' | 'percent';

export type ImpactIndicator = {
  id: string;
  label: string;
  value: string;
  unit?: ImpactUnit;
  direction?: 'up' | 'down' | 'flat';
  definition: string;
};

export type Freshness = {
  computedAt: string;
  ageSeconds: number;
  stale: boolean;
};

export type LedgerTotals = {
  programId: string;
  committedCents: number;
  disbursedCents: number;
  currency: string;
};

export type SponsorDashboard = {
  scope: SponsorScope;
  budget: ProgramBudgetSummary[];
  funnel: ApplicationFunnel[];
  review: ReviewProgress[];
  impact: ImpactIndicator[];
  freshness: Freshness;
  reconcilesWithLedger: boolean;
};

export type ScopeRefusal = { refused: true; reason: string } | { refused: false };

/** Funnel stages in their fixed, reportable order. */
export const FUNNEL_STAGES: readonly { stage: SponsorApplicationStage; label: string }[] = [
  { stage: 'eligible', label: 'Eligible' },
  { stage: 'started', label: 'Started' },
  { stage: 'submitted', label: 'Submitted' },
  { stage: 'reviewed', label: 'Reviewed' },
  { stage: 'decided', label: 'Decided' },
  { stage: 'awarded', label: 'Awarded' },
];

/** Beyond this age the dashboard is labelled stale rather than presented as current. */
export const FRESHNESS_MAX_AGE_SECONDS = 900;
