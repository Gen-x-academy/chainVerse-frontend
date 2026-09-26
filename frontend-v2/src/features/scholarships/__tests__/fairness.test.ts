import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  auditOutcome,
  buildCohortSlices,
  buildFunnel,
  definitionFor,
  disparateImpactRatio,
  DISPARATE_IMPACT_THRESHOLD,
  evaluateDisparateImpact,
  fairnessService,
  hasUnsuppressedIndividual,
  MIN_COHORT_SIZE,
  prohibitedProxies,
  screenProxies,
  suppressCohort,
} from '../fairness/service';
import type { BiasAudit, FunnelStageInput } from '../fairness/types';

vi.mock('@/src/lib/api-client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import { apiClient } from '@/src/lib/api-client';

const STAGES: FunnelStageInput[] = [
  { stage: 'eligible', cohortSize: 100, count: 100 },
  { stage: 'started', cohortSize: 100, count: 60 },
  { stage: 'submitted', cohortSize: 100, count: 40 },
  { stage: 'reviewed', cohortSize: 100, count: 32 },
  { stage: 'decided', cohortSize: 100, count: 30 },
  { stage: 'awarded', cohortSize: 100, count: 12 },
];

function audit(overrides: Partial<BiasAudit> = {}): BiasAudit {
  return {
    id: 'audit-1',
    ruleVersionId: 'scoring-v4',
    owner: 'equity-team',
    testCohort: '2024-25 round, all eligible',
    disparateImpactRatio: 0.62,
    mitigations: ['Re-weight the rubric band for short-answer scoring'],
    rollbackPlan: 'Restore scoring-v3 and re-score the 2025 round.',
    approvalRequired: true,
    outcome: 'approved-with-mitigation',
    approvedBy: 'equity-lead',
    reviewedAt: '2025-09-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('small-cohort suppression', () => {
  it('defaults the threshold to 10', () => {
    expect(MIN_COHORT_SIZE).toBe(10);
  });

  it('suppresses cohorts below the threshold only', () => {
    expect(suppressCohort(9)).toBe(true);
    expect(suppressCohort(10)).toBe(false);
    expect(suppressCohort(4, 5)).toBe(true);
    expect(suppressCohort(6, 5)).toBe(false);
  });

  it('never emits the number for a suppressed cell', () => {
    const funnel = buildFunnel([
      { stage: 'eligible', cohortSize: 100, count: 100 },
      { stage: 'submitted', cohortSize: 3, count: 2 },
    ]);
    const suppressed = funnel.find((metric) => metric.stage === 'submitted');

    expect(suppressed?.suppressed).toBe(true);
    expect(suppressed?.suppressedReason).toBe('SMALL_COHORT');
    expect(suppressed?.count).toBe(0);
    expect(suppressed?.rateFromPrevious).toBeNull();
    expect(suppressed?.rateFromEligible).toBe(0);
    expect(JSON.stringify(suppressed)).not.toContain('"count":2');
    expect(JSON.stringify(suppressed)).not.toContain('"cohortSize":3');
  });

  it('suppresses a cohort slice the same way', () => {
    const [slice] = buildCohortSlices([
      { programId: 'p1', dimension: 'region', value: 'North', cohortSize: 4, count: 1, eligibleCount: 4 },
    ]);
    expect(slice.suppressed).toBe(true);
    expect(slice.count).toBe(0);
    expect(slice.rateFromEligible).toBe(0);
  });
});

describe('buildFunnel rate maths', () => {
  it('computes both rate types and orders by stage', () => {
    const funnel = buildFunnel([...STAGES].reverse());
    expect(funnel.map((metric) => metric.stage)).toEqual([
      'eligible',
      'started',
      'submitted',
      'reviewed',
      'decided',
      'awarded',
    ]);
    expect(funnel[0].rateFromPrevious).toBeNull();
    expect(funnel[1].rateFromPrevious).toBe(0.6);
    expect(funnel[2].rateFromPrevious).toBeCloseTo(0.6667, 3);
    expect(funnel[1].rateFromEligible).toBe(0.6);
    expect(funnel[5].rateFromEligible).toBe(0.12);
  });

  it('withholds a stage rate when the previous stage is suppressed', () => {
    const funnel = buildFunnel([
      { stage: 'eligible', cohortSize: 100, count: 100 },
      { stage: 'started', cohortSize: 2, count: 2 },
      { stage: 'submitted', cohortSize: 100, count: 50 },
    ]);
    expect(funnel[2].rateFromPrevious).toBeNull();
  });
});

describe('disparate impact', () => {
  it('divides the group rate by the reference rate', () => {
    expect(disparateImpactRatio(0.4, 0.8)).toBe(0.5);
    expect(disparateImpactRatio(0.8, 0.8)).toBe(1);
  });

  it('returns 0 when there is no reference rate to compare against', () => {
    expect(disparateImpactRatio(0.4, 0)).toBe(0);
  });

  it('flags a ratio below the 80% floor', () => {
    expect(DISPARATE_IMPACT_THRESHOLD).toBe(0.8);
    expect(evaluateDisparateImpact(0.79).belowThreshold).toBe(true);
    expect(evaluateDisparateImpact(0.8).belowThreshold).toBe(false);
    expect(evaluateDisparateImpact(0.62).summary).toMatch(/below the 80% floor/);
  });

  it('also flags an implausibly high ratio', () => {
    expect(evaluateDisparateImpact(1.6).reciprocalConcern).toBe(true);
    expect(evaluateDisparateImpact(1).reciprocalConcern).toBe(false);
  });
});

describe('screenProxies', () => {
  it('classifies prohibited, sensitive, and permissible fields', () => {
    const screened = screenProxies([
      { field: 'dateOfBirth', detectedIn: ['scoring-rubric'] },
      { field: 'postcode', detectedIn: ['eligibility'] },
      { field: 'gpa' },
    ]);

    expect(screened[0].class).toBe('prohibited');
    expect(screened[0].detectedIn).toEqual(['scoring-rubric']);
    expect(screened[1].class).toBe('sensitive');
    expect(screened[2].class).toBe('permissible');
    expect(screened[2].detectedIn).toEqual(['selection-rules']);
  });

  it('filters to the prohibited set only', () => {
    const prohibited = prohibitedProxies([{ field: 'gender' }, { field: 'essayScore' }]);
    expect(prohibited).toHaveLength(1);
    expect(prohibited[0].field).toBe('gender');
  });

  it('gives every screened field a reason', () => {
    for (const proxy of screenProxies([{ field: 'name' }, { field: 'essay' }])) {
      expect(proxy.reason.length).toBeGreaterThan(10);
    }
  });
});

describe('auditOutcome', () => {
  it('cannot clear a high-risk audit without a named approver', () => {
    const decision = auditOutcome(
      audit({ disparateImpactRatio: 0.62, approvedBy: undefined, outcome: 'cleared' })
    );
    expect(decision.highRisk).toBe(true);
    expect(decision.approvalRequired).toBe(true);
    expect(decision.outcome).toBe('changes-required');
    expect(decision.silentlyApproved).toBe(true);
  });

  it('still requires a mitigation when an approver is present', () => {
    expect(auditOutcome(audit({ mitigations: [] })).outcome).toBe('changes-required');
    expect(auditOutcome(audit()).outcome).toBe('approved-with-mitigation');
  });

  it('clears a rule version that is not high risk', () => {
    const decision = auditOutcome(
      audit({ disparateImpactRatio: 0.95, mitigations: [], approvedBy: undefined, outcome: 'cleared' })
    );
    expect(decision.outcome).toBe('cleared');
    expect(decision.approvalRequired).toBe(false);
  });
});

describe('hasUnsuppressedIndividual', () => {
  it('rejects a payload carrying a direct identifier', () => {
    expect(
      hasUnsuppressedIndividual({ rows: [{ region: 'North', count: 20, applicantId: 'app-1' }] })
    ).toBe(true);
  });

  it('rejects a single-person cell that is not suppressed', () => {
    expect(hasUnsuppressedIndividual({ rows: [{ region: 'Islands', count: 1, suppressed: false }] })).toBe(
      true
    );
  });

  it('accepts aggregated rows where the smallest cell is 10', () => {
    expect(
      hasUnsuppressedIndividual({
        rows: [
          { region: 'North', count: 40, suppressed: false },
          { region: 'Islands', count: 0, suppressed: true },
        ],
      })
    ).toBe(false);
  });
});

describe('definitions', () => {
  it('ships a definition and a caveat for every published metric', () => {
    for (const id of ['funnel.rate-from-eligible', 'funnel.rate-from-previous', 'fairness.disparate-impact-ratio']) {
      const definition = definitionFor(id);
      expect(definition?.definition.length).toBeGreaterThan(20);
      expect(definition?.caveat.length).toBeGreaterThan(20);
    }
  });
});

describe('fairnessService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads the funnel and audits from the scholarships namespace', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([]);
    await fairnessService.getFunnel('p1');
    await fairnessService.getAudits('p1');
    expect(vi.mocked(apiClient.get).mock.calls[0][0]).toBe('/scholarships/fairness/funnel?programId=p1');
    expect(vi.mocked(apiClient.get).mock.calls[1][0]).toBe('/scholarships/fairness/bias-audits?programId=p1');
  });

  it('sends an idempotency key when recording an audit', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(audit());
    await fairnessService.recordAudit({ audit: audit(), idempotencyKey: 'audit-1' });
    expect(vi.mocked(apiClient.post).mock.calls[0][0]).toBe('/scholarships/fairness/bias-audits');
    expect(vi.mocked(apiClient.post).mock.calls[0][1]).toMatchObject({ idempotencyKey: 'audit-1' });
  });
});
