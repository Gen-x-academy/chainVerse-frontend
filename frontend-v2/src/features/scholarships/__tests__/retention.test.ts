import { describe, expect, it } from 'vitest';
import {
  assessRetention,
  daysUntilExpiry,
  describeErasurePlan,
  findActiveHold,
  isDeletableClass,
  planErasure,
} from '../retention/service';
import type {
  LegalHold,
  RetentionPolicy,
  RetentionRecord,
  RetentionRule,
} from '../retention/types';

const NOW = new Date('2025-03-01T00:00:00.000Z');

function rule(overrides: Partial<RetentionRule> = {}): RetentionRule {
  return {
    recordClass: 'draft',
    retentionDays: 30,
    basis: 'operational',
    legalBasis: 'Draft working copies are not evidence.',
    deletable: true,
    owner: 'Privacy and Legal',
    ...overrides,
  };
}

function record(overrides: Partial<RetentionRecord> = {}): RetentionRecord {
  return {
    id: 'rec-1',
    applicantId: 'applicant-001',
    class: 'draft',
    createdAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function hold(overrides: Partial<LegalHold> = {}): LegalHold {
  return {
    id: 'hold-1',
    subjectId: 'applicant-001',
    scope: ['draft'],
    reason: 'Dispute investigation',
    placedAt: '2025-02-01T00:00:00.000Z',
    placedBy: 'legal-1',
    ...overrides,
  };
}

const POLICY: RetentionPolicy = {
  version: '2025.03',
  updatedAt: '2025-02-01T00:00:00.000Z',
  approvedBy: 'Privacy and Legal',
  rules: [
    rule({ recordClass: 'draft', retentionDays: 30 }),
    rule({ recordClass: 'withdrawn', retentionDays: 90, basis: 'contractual' }),
    rule({ recordClass: 'awarded', retentionDays: null, basis: 'contractual' }),
    rule({ recordClass: 'financial', retentionDays: 2555, deletable: true, basis: 'legal' }),
    rule({ recordClass: 'audit', retentionDays: 2555, deletable: true, basis: 'legal' }),
  ],
};

describe('daysUntilExpiry', () => {
  it('counts whole days remaining inside the window', () => {
    const days = daysUntilExpiry(
      record({ createdAt: '2025-02-20T00:00:00.000Z' }),
      rule({ retentionDays: 30 }),
      NOW
    );
    expect(days).toBe(21);
  });

  it('goes negative once the window has passed', () => {
    const days = daysUntilExpiry(
      record({ createdAt: '2024-12-01T00:00:00.000Z' }),
      rule({ retentionDays: 30 }),
      NOW
    );
    expect(days).toBeLessThan(0);
  });

  it('is null for a class retained indefinitely', () => {
    expect(
      daysUntilExpiry(record(), rule({ retentionDays: null }), NOW)
    ).toBeNull();
  });
});

describe('assessRetention', () => {
  it('expires a draft once its window closes', () => {
    const assessment = assessRetention(
      rule({ retentionDays: 30 }),
      record({ createdAt: '2025-01-01T00:00:00.000Z' }),
      NOW,
      []
    );
    expect(assessment.action).toBe('delete');
    expect(assessment.protectedBy).toBeNull();
  });

  it('retains a draft that is still inside its window', () => {
    const assessment = assessRetention(
      rule({ retentionDays: 30 }),
      record({ createdAt: '2025-02-27T00:00:00.000Z' }),
      NOW,
      []
    );
    expect(assessment.action).toBe('retain');
    expect(assessment.retentionDaysRemaining).toBe(28);
  });

  it('never deletes a financial record, even when the rule says deletable', () => {
    const assessment = assessRetention(
      rule({ recordClass: 'financial', retentionDays: 1, deletable: true, basis: 'legal' }),
      record({ id: 'rec-fin', class: 'financial', createdAt: '2000-01-01T00:00:00.000Z' }),
      NOW,
      []
    );
    expect(assessment.action).toBe('blocked-immutable');
    expect(assessment.protectedBy).toBe('financial-integrity');
  });

  it('never deletes an audit record, even when the rule says deletable', () => {
    const assessment = assessRetention(
      rule({ recordClass: 'audit', retentionDays: 1, deletable: true, basis: 'legal' }),
      record({ id: 'rec-audit', class: 'audit', createdAt: '2000-01-01T00:00:00.000Z' }),
      NOW,
      []
    );
    expect(assessment.action).toBe('blocked-immutable');
    expect(assessment.protectedBy).toBe('audit-integrity');
  });

  it('lets an active legal hold override an expiry', () => {
    const assessment = assessRetention(
      rule({ retentionDays: 1 }),
      record({ createdAt: '2024-12-01T00:00:00.000Z' }),
      NOW,
      [hold()]
    );
    expect(assessment.action).toBe('blocked-by-hold');
    expect(assessment.protectedBy).toBe('legal-hold');
    expect(assessment.reason).toContain('hold-1');
  });

  it('lets a legal hold override financial integrity protection', () => {
    const assessment = assessRetention(
      rule({ recordClass: 'financial', retentionDays: 30 }),
      record({ id: 'rec-fin', class: 'financial' }),
      NOW,
      [hold({ scope: ['financial'] })]
    );
    expect(assessment.action).toBe('blocked-by-hold');
  });

  it('ignores a released hold', () => {
    const assessment = assessRetention(
      rule({ retentionDays: 1 }),
      record({ createdAt: '2024-12-01T00:00:00.000Z' }),
      NOW,
      [hold({ releasedAt: '2025-02-15T00:00:00.000Z' })]
    );
    expect(assessment.action).toBe('delete');
  });

  it('ignores a hold scoped to a different class', () => {
    const assessment = assessRetention(
      rule({ retentionDays: 1 }),
      record({ createdAt: '2024-12-01T00:00:00.000Z' }),
      NOW,
      [hold({ scope: ['audit'] })]
    );
    expect(assessment.action).toBe('delete');
  });

  it('retains a class marked non-deletable even after expiry', () => {
    const assessment = assessRetention(
      rule({ retentionDays: 1, deletable: false, basis: 'contractual' }),
      record({ createdAt: '2024-12-01T00:00:00.000Z' }),
      NOW,
      []
    );
    expect(assessment.action).toBe('retain');
  });
});

describe('planErasure', () => {
  const records: RetentionRecord[] = [
    record({ id: 'rec-draft', class: 'draft', createdAt: '2024-12-01T00:00:00.000Z' }),
    record({ id: 'rec-withdrawn', class: 'withdrawn', createdAt: '2024-01-01T00:00:00.000Z' }),
    record({ id: 'rec-awarded', class: 'awarded', createdAt: '2024-01-01T00:00:00.000Z' }),
    record({ id: 'rec-financial', class: 'financial', createdAt: '2024-01-01T00:00:00.000Z' }),
    record({ id: 'rec-audit', class: 'audit', createdAt: '2024-01-01T00:00:00.000Z' }),
    record({ id: 'rec-other', applicantId: 'applicant-002', class: 'draft', createdAt: '2024-12-01T00:00:00.000Z' }),
  ];

  it('splits deletable records from protected ones', () => {
    const plan = planErasure(POLICY, records, [], 'applicant-001', NOW);
    expect(plan.deletable).toEqual(['rec-draft', 'rec-withdrawn']);
    expect(plan.protected.map((entry) => entry.recordId)).toEqual([
      'rec-awarded',
      'rec-financial',
      'rec-audit',
    ]);
  });

  it('carries the basis for every protected record', () => {
    const plan = planErasure(POLICY, records, [], 'applicant-001', NOW);
    const awarded = plan.protected.find((entry) => entry.recordId === 'rec-awarded');
    const financial = plan.protected.find((entry) => entry.recordId === 'rec-financial');
    expect(awarded?.basis).toBe('contractual');
    expect(financial?.basis).toBe('legal');
  });

  it('ignores another applicant’s records', () => {
    const plan = planErasure(POLICY, records, [], 'applicant-001', NOW);
    expect(plan.deletable).not.toContain('rec-other');
    expect(plan.protected.some((entry) => entry.recordId === 'rec-other')).toBe(false);
  });

  it('lists the holds that block deletion', () => {
    const plan = planErasure(
      POLICY,
      records,
      [hold({ id: 'hold-9', scope: ['draft', 'withdrawn'] })],
      'applicant-001',
      NOW
    );
    expect(plan.deletable).toEqual([]);
    expect(plan.blockedByHolds).toEqual(['hold-9']);
  });

  it('protects a record whose class has no rule', () => {
    const plan = planErasure(
      POLICY,
      [record({ id: 'rec-unknown', class: 'rejected' })],
      [],
      'applicant-001',
      NOW
    );
    expect(plan.deletable).toEqual([]);
    expect(plan.protected[0].basis).toBe('operational');
  });

  it('summarises the plan', () => {
    const plan = planErasure(POLICY, records, [], 'applicant-001', NOW);
    expect(describeErasurePlan(plan)).toContain('2 record(s) will be deleted');
    expect(describeErasurePlan(plan)).toContain('integrity is never broken');
  });
});

describe('integrity helpers', () => {
  it('marks financial and audit as non-deletable', () => {
    expect(isDeletableClass('financial')).toBe(false);
    expect(isDeletableClass('audit')).toBe(false);
    expect(isDeletableClass('draft')).toBe(true);
  });

  it('finds a hold by record id or by applicant id', () => {
    expect(findActiveHold(record(), [hold({ subjectId: 'rec-1' })])?.id).toBe('hold-1');
    expect(findActiveHold(record(), [hold({ subjectId: 'applicant-001' })])?.id).toBe('hold-1');
    expect(findActiveHold(record(), [hold({ subjectId: 'somebody-else' })])).toBeUndefined();
  });
});
