/**
 * Fairness domain logic (issues #1144, #1145).
 *
 * Small-cohort suppression is applied at the data-shaping layer, not in the
 * view: a suppressed `FunnelMetric` carries zero for both its cohort size and
 * its count and a null stage-to-stage rate, so no downstream consumer can
 * recover a small number.
 */

import { apiClient } from '@/src/lib/api-client';
import {
  FUNNEL_STAGES,
  type BiasAudit,
  type CohortSlice,
  type CohortSliceInput,
  type FairnessDefinition,
  type FairnessExport,
  type FunnelMetric,
  type FunnelStage,
  type FunnelStageInput,
  type ProhibitedProxy,
  type ProxyCandidate,
  type SmallCohortThreshold,
} from './types';

const FAIRNESS_PATH = '/scholarships/fairness';

/** Below this many applicants a cell is suppressed rather than published. */
export const MIN_COHORT_SIZE = 10;

export const SMALL_COHORT_THRESHOLD: SmallCohortThreshold = {
  threshold: MIN_COHORT_SIZE,
  rationale:
    'Cohorts below 10 applicants make a published rate re-identifying, so the cell is suppressed and the true figure is never emitted.',
};

/** Four-fifths rule: below 0.8 the rule version is treated as high risk. */
export const DISPARATE_IMPACT_THRESHOLD = 0.8;

function round4(value: number): number {
  return Number(value.toFixed(4));
}

/** True when a cohort is too small to publish. */
export function suppressCohort(size: number, threshold: number = MIN_COHORT_SIZE): boolean {
  return size < threshold;
}

export function suppressionThreshold(threshold?: number): SmallCohortThreshold {
  return threshold && threshold !== MIN_COHORT_SIZE
    ? { threshold, rationale: `Cohorts below ${threshold} applicants are suppressed.` }
    : SMALL_COHORT_THRESHOLD;
}

/**
 * Shapes raw stage counts into publishable metrics. Suppressed stages report
 * `count: 0`, `cohortSize: 0`, and a null stage-to-stage rate; the eligible
 * denominator is only used when it is itself publishable.
 */
export function buildFunnel(
  stages: FunnelStageInput[],
  threshold: number = MIN_COHORT_SIZE,
  programId = 'chainverse-scholarship'
): FunnelMetric[] {
  const ordered = [...stages].sort(
    (left, right) => FUNNEL_STAGES.indexOf(left.stage) - FUNNEL_STAGES.indexOf(right.stage)
  );
  const eligible = ordered.find((stage) => stage.stage === 'eligible');
  const eligiblePublishable = eligible ? !suppressCohort(eligible.cohortSize, threshold) : false;
  const eligibleRateBase = eligiblePublishable && eligible ? eligible.count : 0;

  return ordered.map((stage) => {
    const suppressed = suppressCohort(stage.cohortSize, threshold);

    if (suppressed) {
      return {
        programId: stage.programId ?? programId,
        stage: stage.stage,
        cohortSize: 0,
        count: 0,
        rateFromPrevious: null,
        rateFromEligible: 0,
        suppressed: true,
        suppressedReason: 'SMALL_COHORT' as const,
      };
    }

    const previous = ordered[ordered.indexOf(stage) - 1];
    const previousPublishable = previous ? !suppressCohort(previous.cohortSize, threshold) : false;
    const rateFromPrevious =
      stage.stage === 'eligible' || !previous || !previousPublishable || previous.count === 0
        ? null
        : round4(stage.count / previous.count);

    return {
      programId: stage.programId ?? programId,
      stage: stage.stage,
      cohortSize: stage.cohortSize,
      count: stage.count,
      rateFromPrevious,
      rateFromEligible: eligibleRateBase === 0 ? 0 : round4(stage.count / eligibleRateBase),
      suppressed: false,
    };
  });
}

export function buildCohortSlices(
  slices: CohortSliceInput[],
  threshold: number = MIN_COHORT_SIZE
): CohortSlice[] {
  return slices.map((slice) => {
    const suppressed = suppressCohort(slice.cohortSize, threshold);
    return {
      programId: slice.programId,
      dimension: slice.dimension,
      value: slice.value,
      cohortSize: suppressed ? 0 : slice.cohortSize,
      count: suppressed ? 0 : slice.count,
      rateFromEligible:
        suppressed || slice.eligibleCount === 0 ? 0 : round4(slice.count / slice.eligibleCount),
      suppressed,
      ...(suppressed ? { suppressedReason: 'SMALL_COHORT' as const } : {}),
    };
  });
}

/** Group rate divided by the reference (best-performing) rate. */
export function disparateImpactRatio(groupRate: number, referenceRate: number): number {
  if (referenceRate <= 0) return 0;
  return round4(groupRate / referenceRate);
}

export type DisparateImpactEvaluation = {
  ratio: number;
  threshold: number;
  belowThreshold: boolean;
  /** The four-fifths rule is one-sided; a ratio above 1.25 also warrants review. */
  reciprocalConcern: boolean;
  summary: string;
};

export function evaluateDisparateImpact(ratio: number): DisparateImpactEvaluation {
  const belowThreshold = ratio < DISPARATE_IMPACT_THRESHOLD;
  const reciprocalConcern = ratio > 1 / DISPARATE_IMPACT_THRESHOLD;
  return {
    ratio,
    threshold: DISPARATE_IMPACT_THRESHOLD,
    belowThreshold,
    reciprocalConcern,
    summary: belowThreshold
      ? `Selection rate is ${Math.round(ratio * 100)}% of the reference group, below the 80% floor.`
      : `Selection rate is ${Math.round(ratio * 100)}% of the reference group, at or above the 80% floor.`,
  };
}

const PROHIBITED_FIELDS: Record<string, string> = {
  name: 'A name is a direct identifier and can encode race, gender, or national origin.',
  firstname: 'A given name is a direct identifier and can encode race, gender, or national origin.',
  lastname: 'A family name is a direct identifier and can encode national origin.',
  fullname: 'A full name is a direct identifier and can encode race, gender, or national origin.',
  email: 'An email address is a direct identifier.',
  phone: 'A phone number is a direct identifier.',
  dob: 'Date of birth is a direct identifier and a proxy for age.',
  dateofbirth: 'Date of birth is a direct identifier and a proxy for age.',
  gender: 'Sex or gender must not influence scholarship selection.',
  sex: 'Sex or gender must not influence scholarship selection.',
  race: 'Race must not influence scholarship selection.',
  ethnicity: 'Ethnicity must not influence scholarship selection.',
  nationality: 'Nationality must not influence scholarship selection.',
  religion: 'Religious affiliation must not influence scholarship selection.',
  maritalstatus: 'Marital status is a protected characteristic and a proxy for family income.',
  photo: 'A photograph is biometric data and may encode race, gender, or disability.',
  disability: 'Disability status must not influence scholarship selection.',
  socialsecuritynumber: 'A national identifier is a direct identifier.',
  nationalid: 'A national identifier is a direct identifier.',
};

const SENSITIVE_FIELDS: Record<string, string> = {
  age: 'Age correlates with protected characteristics; a banded age cut-off needs documented justification.',
  postcode: 'Postcode is a strong proxy for ethnicity and household income.',
  zipcode: 'Zip code is a strong proxy for ethnicity and household income.',
  address: 'A home address is a direct identifier and a proxy for socio-economic status.',
  income: 'Household income is a proxy for socio-economic status and family origin.',
  householdincome: 'Household income is a proxy for socio-economic status and family origin.',
  employer: 'Employer is a proxy for socio-economic status and immigration status.',
  firstgeneration: 'First-generation status is permitted only for an explicitly targeted programme.',
  housingsupport: 'Housing support is a proxy for socio-economic status.',
  refugee: 'Refugee status is a protected characteristic and needs explicit justification.',
  immigrationstatus: 'Immigration status is a protected characteristic and needs explicit justification.',
};

const PERMISSIBLE_REASON =
  'No known proxy risk. Academic and programme-specific fields may be scored directly.';

function classify(field: string): { class: ProhibitedProxy['class']; reason: string } {
  const key = field.toLowerCase().replace(/[^a-z]/g, '');
  if (PROHIBITED_FIELDS[key]) return { class: 'prohibited', reason: PROHIBITED_FIELDS[key] };
  if (SENSITIVE_FIELDS[key]) return { class: 'sensitive', reason: SENSITIVE_FIELDS[key] };
  return { class: 'permissible', reason: PERMISSIBLE_REASON };
}

/** Screens selection-rule fields for prohibited and sensitive proxies. */
export function screenProxies(candidates: ProxyCandidate[]): ProhibitedProxy[] {
  return candidates.map((candidate) => {
    const { class: classification, reason } = classify(candidate.field);
    return {
      field: candidate.field,
      reason,
      class: classification,
      detectedIn: candidate.detectedIn?.length ? candidate.detectedIn : ['selection-rules'],
    };
  });
}

export function prohibitedProxies(candidates: ProxyCandidate[]): ProhibitedProxy[] {
  return screenProxies(candidates).filter((proxy) => proxy.class === 'prohibited');
}

export type BiasAuditDecision = {
  outcome: BiasAudit['outcome'];
  highRisk: boolean;
  approvalRequired: boolean;
  /** A high-risk audit without a named approver can never be cleared. */
  silentlyApproved: boolean;
  explanation: string;
};

export function auditOutcome(audit: BiasAudit): BiasAuditDecision {
  const evaluation = evaluateDisparateImpact(audit.disparateImpactRatio);
  const highRisk = evaluation.belowThreshold;
  const hasMitigation = audit.mitigations.length > 0;

  if (highRisk && !audit.approvedBy) {
    return {
      outcome: 'changes-required',
      highRisk: true,
      approvalRequired: true,
      silentlyApproved: audit.outcome !== 'changes-required',
      explanation:
        'The rule version is high risk and has no named approver. It cannot be cleared: record a mitigation and a named approver first.',
    };
  }

  if (highRisk) {
    return {
      outcome: hasMitigation ? 'approved-with-mitigation' : 'changes-required',
      highRisk: true,
      approvalRequired: true,
      silentlyApproved: false,
      explanation: hasMitigation
        ? `High risk but approved by ${audit.approvedBy} with a recorded mitigation.`
        : `High risk and approved by ${audit.approvedBy}, but no mitigation is recorded.`,
    };
  }

  return {
    outcome: hasMitigation ? 'approved-with-mitigation' : 'cleared',
    highRisk: false,
    approvalRequired: false,
    silentlyApproved: false,
    explanation: evaluation.summary,
  };
}

const IDENTIFIER_FIELDS = ['applicantid', 'studentid', 'name', 'email', 'applicationid', 'nationalid'];

/**
 * Last line of defence before an export leaves the client: refuses any payload
 * that carries a direct identifier or a single-person cell.
 */
export function hasUnsuppressedIndividual(exported: FairnessExport | Array<Record<string, unknown>>): boolean {
  const rows = Array.isArray(exported) ? exported : exported.rows;
  if (!Array.isArray(rows)) return true;

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    for (const key of Object.keys(row)) {
      const normalised = key.toLowerCase().replace(/[^a-z]/g, '');
      if (IDENTIFIER_FIELDS.includes(normalised)) return true;
    }
    if (row.count === 1 && row.suppressed !== true) return true;
  }
  return false;
}

const FAIRNESS_DEFINITIONS: FairnessDefinition[] = [
  {
    id: 'funnel.rate-from-eligible',
    name: 'Rate from eligible',
    definition:
      'Applicants reaching this stage divided by all applicants who were eligible to apply for the programme in the same round.',
    caveat:
      'Eligibility itself may already exclude some groups, so a high rate here does not prove the funnel is equitable overall.',
    sourceCohort: 'Eligible applicants in the round, excluding withdrawn and duplicate records.',
    computedAt: '2025-09-01T00:00:00.000Z',
  },
  {
    id: 'funnel.rate-from-previous',
    name: 'Stage conversion rate',
    definition: 'Applicants reaching this stage divided by the applicants recorded at the previous stage.',
    caveat:
      'Both the numerator and denominator are subject to small-cohort suppression; a conversion rate is withheld when either side is suppressed.',
    sourceCohort: 'Applicants recorded at the previous stage of the same round.',
    computedAt: '2025-09-01T00:00:00.000Z',
  },
  {
    id: 'fairness.disparate-impact-ratio',
    name: 'Disparate impact ratio',
    definition:
      'Selection rate of the least advantaged group divided by the selection rate of the reference group, per the four-fifths (80%) rule.',
    caveat:
      'A ratio below 0.8 flags a rule version for review; it is not proof of unlawful discrimination and is never published for a cohort below 10.',
    sourceCohort: 'Test cohort declared on the bias audit, frozen before the rule version ran.',
    computedAt: '2025-09-01T00:00:00.000Z',
  },
];

export function fairnessDefinitions(): FairnessDefinition[] {
  return FAIRNESS_DEFINITIONS;
}

export function definitionFor(id: string): FairnessDefinition | undefined {
  return FAIRNESS_DEFINITIONS.find((definition) => definition.id === id);
}

export const FUNNEL_STAGE_LABELS: Record<FunnelStage, string> = {
  eligible: 'Eligible',
  started: 'Started an application',
  submitted: 'Submitted',
  reviewed: 'Reviewed',
  decided: 'Decision published',
  awarded: 'Awarded',
};

export const fairnessService = {
  getFunnel: (programId: string): Promise<FunnelMetric[]> =>
    apiClient.get<FunnelMetric[]>(`${FAIRNESS_PATH}/funnel?programId=${encodeURIComponent(programId)}`),
  getSlices: (programId: string, dimension?: CohortSlice['dimension']): Promise<CohortSlice[]> =>
    apiClient.get<CohortSlice[]>(
      dimension
        ? `${FAIRNESS_PATH}/slices?programId=${encodeURIComponent(programId)}&dimension=${encodeURIComponent(dimension)}`
        : `${FAIRNESS_PATH}/slices?programId=${encodeURIComponent(programId)}`
    ),
  getAudits: (programId: string): Promise<BiasAudit[]> =>
    apiClient.get<BiasAudit[]>(`${FAIRNESS_PATH}/bias-audits?programId=${encodeURIComponent(programId)}`),
  screenFields: (input: { fields: ProxyCandidate[]; idempotencyKey: string }): Promise<ProhibitedProxy[]> =>
    apiClient.post<ProhibitedProxy[]>(`${FAIRNESS_PATH}/proxy-screen`, input),
  recordAudit: (input: { audit: BiasAudit; idempotencyKey: string }): Promise<BiasAudit> =>
    apiClient.post<BiasAudit>(`${FAIRNESS_PATH}/bias-audits`, input),
};
