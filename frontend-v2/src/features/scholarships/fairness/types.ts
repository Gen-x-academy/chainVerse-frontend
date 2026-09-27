/**
 * Equitable-outcome reporting for scholarship selection (issues #1144, #1145).
 *
 * Two guarantees are encoded in the types: every rate ships with a written
 * definition and a caveat, and a cohort smaller than `MIN_COHORT_SIZE` is
 * suppressed rather than published. No export may contain an individual
 * applicant.
 */

export type FunnelStage =
  | 'eligible'
  | 'started'
  | 'submitted'
  | 'reviewed'
  | 'decided'
  | 'awarded';

export const FUNNEL_STAGES: FunnelStage[] = [
  'eligible',
  'started',
  'submitted',
  'reviewed',
  'decided',
  'awarded',
];

export type SuppressionReason = 'SMALL_COHORT' | 'NO_DATA';

export type FunnelMetric = {
  programId: string;
  stage: FunnelStage;
  /** Applicants in the cohort backing this stage. Reported as 0 when suppressed. */
  cohortSize: number;
  /** Suppressed cells report 0 — the true figure is never emitted. */
  count: number;
  /** null when the previous stage is unknown or suppressed. */
  rateFromPrevious: number | null;
  rateFromEligible: number;
  suppressed: boolean;
  suppressedReason?: SuppressionReason;
};

export type FunnelStageInput = {
  programId?: string;
  stage: FunnelStage;
  cohortSize: number;
  count: number;
};

/** Every published metric must reference one of these definitions. */
export type FairnessDefinition = {
  id: string;
  name: string;
  definition: string;
  caveat: string;
  sourceCohort: string;
  computedAt: string;
};

export type SmallCohortThreshold = {
  threshold: number;
  rationale: string;
};

export type CohortDimension = 'region' | 'incomeBand' | 'institution' | 'firstGeneration';

export type CohortSlice = {
  programId: string;
  dimension: CohortDimension;
  value: string;
  cohortSize: number;
  count: number;
  rateFromEligible: number;
  suppressed: boolean;
  suppressedReason?: SuppressionReason;
};

export type CohortSliceInput = Omit<CohortSlice, 'suppressed' | 'suppressedReason' | 'count' | 'rateFromEligible'> & {
  count: number;
  eligibleCount: number;
};

export type BiasAuditOutcome = 'cleared' | 'changes-required' | 'approved-with-mitigation';

export type BiasAudit = {
  id: string;
  ruleVersionId: string;
  owner: string;
  testCohort: string;
  /** Worst affected group divided by the reference group. */
  disparateImpactRatio: number;
  worstAffectedGroup?: string;
  outcome: BiasAuditOutcome;
  mitigations: string[];
  rollbackPlan: string;
  approvalRequired: boolean;
  approvedBy?: string;
  reviewedAt: string;
};

export type ProhibitedProxyClass = 'prohibited' | 'sensitive' | 'permissible';

export type ProhibitedProxy = {
  field: string;
  reason: string;
  class: ProhibitedProxyClass;
  detectedIn: string[];
};

export type ProxyCandidate = {
  field: string;
  detectedIn?: string[];
};

export type FairnessExport = {
  rows: Array<Record<string, unknown>>;
};
