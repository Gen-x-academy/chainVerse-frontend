/**
 * Scholarship launch readiness and rollback.
 *
 * Establishes go-live checks for security, privacy, accessibility, solvency,
 * support, monitoring, and data migration. Owners sign off measurable
 * criteria, a rollback plan preserves active applications and funds, and a
 * post-launch review is scheduled before the checklist can close.
 */

import { apiClient } from '@/src/lib/api-client';

export type ReadinessCategory =
  | 'security'
  | 'privacy'
  | 'accessibility'
  | 'solvency'
  | 'support'
  | 'monitoring'
  | 'dataMigration';

export type CheckStatus = 'pending' | 'passed' | 'blocked' | 'waived';

export type GoLiveCheck = {
  id: string;
  category: ReadinessCategory;
  title: string;
  description: string;
  measurableCriteria: string;
  owner: string;
  severity: 'blocking' | 'advisory';
  status: CheckStatus;
  signedOffBy?: string;
  signedOffAt?: string;
};

export type ReadinessPolicy = {
  requireSignOff: boolean;
  requireAllBlockingChecks: boolean;
};

export type ReadinessVerdict = {
  ready: boolean;
  blockedCategories: ReadinessCategory[];
  unsignedOwners: string[];
  openAdvisoryChecks: number;
  summary: string;
};

// ─── Reference checklist ──────────────────────────────────────────────────────

export const GO_LIVE_CHECKS: GoLiveCheck[] = [
  {
    id: 'security-scan',
    category: 'security',
    title: 'Security review complete',
    description: 'Application, API, and wallet flows pass the security review gate.',
    measurableCriteria: 'Zero critical or high findings; medium findings have a dated remediation plan.',
    owner: 'Platform security team',
    severity: 'blocking',
    status: 'pending',
  },
  {
    id: 'privacy-policy',
    category: 'privacy',
    title: 'Privacy & consent policy current',
    description: 'Privacy notice, data sharing, and sponsor disclosure versions match the policy service.',
    measurableCriteria: 'Consent requirement versions returned by the API equal the approved policy versions.',
    owner: 'Privacy and Legal',
    severity: 'blocking',
    status: 'pending',
  },
  {
    id: 'accessibility-audit',
    category: 'accessibility',
    title: 'Accessibility audit passed',
    description: 'Applicant, reviewer, and sponsor journeys meet keyboard and screen-reader requirements.',
    measurableCriteria: 'Automated a11y suite passes and a manual screen-reader walkthrough is recorded.',
    owner: 'Accessibility lead',
    severity: 'blocking',
    status: 'pending',
  },
  {
    id: 'solvency-check',
    category: 'solvency',
    title: 'Program funds are solvent',
    description: 'Escrowed funds fully back every approved milestone and committed award.',
    measurableCriteria: 'Committed liabilities do not exceed the escrow balance for any program.',
    owner: 'Finance operations',
    severity: 'blocking',
    status: 'pending',
  },
  {
    id: 'support-runbook',
    category: 'support',
    title: 'Support runbook published',
    description: 'Applicant and sponsor support channels are staffed and documented.',
    measurableCriteria: 'Support runbook is public to operators and triage owners are on call.',
    owner: 'Student support',
    severity: 'blocking',
    status: 'pending',
  },
  {
    id: 'monitoring-alerts',
    category: 'monitoring',
    title: 'Monitoring and alerting live',
    description: 'Dashboards and alerts cover decisions, payments, consent, and evidence scans.',
    measurableCriteria: 'Uptime, p95 latency, decision slope, and payment failure alerts fire in staging.',
    owner: 'Platform engineering',
    severity: 'blocking',
    status: 'pending',
  },
  {
    id: 'data-migration',
    category: 'dataMigration',
    title: 'Data migration rehearsed',
    description: 'Migration to the policy service was rehearsed and rolled back successfully.',
    measurableCriteria: 'Migration dry-run passes and rollback preserves application and fund records.',
    owner: 'Data engineering',
    severity: 'blocking',
    status: 'pending',
  },
  {
    id: 'post-launch-review',
    category: 'monitoring',
    title: 'Post-launch review scheduled',
    description: 'A dated review with named reviewers is booked before go-live.',
    measurableCriteria: 'Review date is in the future and reviewers are assigned per rollback policy.',
    owner: 'Program delivery',
    severity: 'advisory',
    status: 'pending',
  },
];

export const defaultReadinessPolicy: ReadinessPolicy = {
  requireSignOff: true,
  requireAllBlockingChecks: true,
};

// ─── Readiness evaluation ─────────────────────────────────────────────────────

export function evaluateReadiness(
  checks: GoLiveCheck[],
  policy: ReadinessPolicy = defaultReadinessPolicy
): ReadinessVerdict {
  const blockingChecks = checks.filter((check) => check.severity === 'blocking');

  const blocked = blockingChecks.filter(
    (check) =>
      check.status !== 'passed' &&
      !(check.status === 'waived' && !policy.requireAllBlockingChecks)
  );

  const unsignedOwners = blockingChecks
    .filter((check) => check.status === 'passed' && !check.signedOffBy)
    .map((check) => check.owner);

  const blockedCategories = Array.from(new Set(blocked.map((check) => check.category)));
  const openAdvisoryChecks = checks.filter(
    (check) => check.severity === 'advisory' && check.status !== 'passed'
  ).length;

  const allBlockingGreen = blocked.length === 0;
  const signOffComplete = !policy.requireSignOff || unsignedOwners.length === 0;
  const ready = allBlockingGreen && signOffComplete;

  return {
    ready,
    blockedCategories,
    unsignedOwners,
    openAdvisoryChecks,
    summary: ready
      ? 'Launch readiness confirmed: all blocking criteria are signed off.'
      : `${blocked.length} blocking check${blocked.length === 1 ? '' : 's'} open, ${unsignedOwners.length} of ${blockingChecks.length} required owner sign-off${unsignedOwners.length === 1 ? '' : 's'} pending.`,
  };
}

// ─── Rollback planning ────────────────────────────────────────────────────────

export type ActiveApplication = {
  id: string;
  applicantId: string;
  status: string;
  version: number;
};

export type FundItem = {
  id: string;
  applicationId: string;
  amount: string;
  status: 'escrowed' | 'disbursing' | 'disbursed';
};

export type RollbackFundAction = {
  fundId: string;
  action: 'hold' | 'revert';
  guard: string;
};

export type RollbackPlan = {
  planId: string;
  createdAt: string;
  featureFlagsToDisable: string[];
  retainedApplicationIds: string[];
  fundActions: RollbackFundAction[];
  steps: { step: string; owner: string }[];
  preservesActiveApplications: boolean;
  preservesFunds: boolean;
};

export function planRollback(input: {
  featureFlagsToDisable: string[];
  applications: ActiveApplication[];
  funds: FundItem[];
  now?: Date;
}): RollbackPlan {
  const now = input.now ?? new Date();

  const fundActions: RollbackFundAction[] = input.funds.map((fund) => ({
    fundId: fund.id,
    action: fund.status === 'disbursed' ? 'revert' : 'hold',
    guard:
      fund.status === 'disbursed'
        ? 'revert stays in escrow until the affected application is verified'
        : 'no payout proceeds while the rollback lock is active',
  }));

  const retainedApplicationIds = input.applications.map((application) => application.id);

  return {
    planId: `rollback-${now.toISOString().slice(0, 10)}-${input.applications.length}`,
    createdAt: now.toISOString(),
    featureFlagsToDisable: input.featureFlagsToDisable,
    retainedApplicationIds,
    fundActions,
    steps: [
      { step: 'Disable every listed feature flag so new applications stop flowing.', owner: 'Platform engineering' },
      { step: 'Keep all active applications intact — applications are never deleted on rollback.', owner: 'Program delivery' },
      { step: 'Hold or revert in-flight fund movements per the fund actions above.', owner: 'Finance operations' },
      { step: 'Pause reviewer assignments and evidence scanning jobs.', owner: 'Platform engineering' },
      { step: 'Schedule the post-launch review and notify affected applicants.', owner: 'Student support' },
    ],
    preservesActiveApplications: true,
    preservesFunds: true,
  };
}

/** Confirms the plan would not delete applications or leave funds unguarded. */
export function verifyRollbackPreserves(
  plan: RollbackPlan,
  applications: ActiveApplication[],
  funds: FundItem[]
): boolean {
  const everyApplicationRetained = applications.every((application) =>
    plan.retainedApplicationIds.includes(application.id)
  );
  const everyFundGuarded = funds.every((fund) =>
    plan.fundActions.some((action) => action.fundId === fund.id)
  );
  return everyApplicationRetained && everyFundGuarded;
}

// ─── Post-launch review ───────────────────────────────────────────────────────

export type PostLaunchReview = {
  reviewId: string;
  scheduledFor: string;
  reviewers: string[];
  criteria: string[];
  owner: string;
  status: 'scheduled';
};

export function schedulePostLaunchReview(input: {
  reviewId?: string;
  scheduledFor: string;
  reviewers: string[];
  criteria: string[];
  owner: string;
  now?: Date;
}): PostLaunchReview {
  const now = input.now ?? new Date();
  const scheduled = new Date(input.scheduledFor);

  if (!Number.isFinite(scheduled.getTime())) {
    throw new Error('A valid post-launch review date is required.');
  }
  if (scheduled.getTime() <= now.getTime()) {
    throw new Error('The post-launch review must be scheduled in the future.');
  }
  if (input.reviewers.length === 0) {
    throw new Error('At least one reviewer must be assigned.');
  }
  if (input.criteria.length === 0) {
    throw new Error('The review must include at least one measurable criterion.');
  }
  if (!input.owner.trim()) {
    throw new Error('The review needs a named owner.');
  }

  return {
    reviewId: input.reviewId ?? `review-${scheduled.toISOString().slice(0, 10)}`,
    scheduledFor: scheduled.toISOString(),
    reviewers: Array.from(new Set(input.reviewers)),
    criteria: Array.from(new Set(input.criteria)),
    owner: input.owner.trim(),
    status: 'scheduled',
  };
}

// ─── API service ──────────────────────────────────────────────────────────────

export type ReadinessState = {
  checks: GoLiveCheck[];
  verdict: ReadinessVerdict;
  rollbackPlan: RollbackPlan | null;
  review: PostLaunchReview | null;
};

export const scholarshipReleaseService = {
  getReadiness: (): Promise<{ checks: GoLiveCheck[] }> =>
    apiClient.get<{ checks: GoLiveCheck[] }>('/scholarships/release/readiness'),

  signOffCheck: (checkId: string, owner: string): Promise<GoLiveCheck> =>
    apiClient.post<GoLiveCheck>('/scholarships/release/readiness/sign-off', { checkId, owner }),

  createRollbackPlan: (payload: {
    featureFlagsToDisable: string[];
    applications: ActiveApplication[];
    funds: FundItem[];
  }): Promise<RollbackPlan> => apiClient.post<RollbackPlan>('/scholarships/release/rollback/plan', payload),

  scheduleReview: (payload: {
    scheduledFor: string;
    reviewers: string[];
    criteria: string[];
    owner: string;
  }): Promise<PostLaunchReview> => apiClient.post<PostLaunchReview>('/scholarships/release/review', payload),
};