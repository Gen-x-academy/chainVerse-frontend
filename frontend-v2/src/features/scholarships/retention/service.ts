/**
 * Retention assessment and erasure planning (closes #1153).
 *
 * The order of the checks in `assessRetention` is the policy: a legal hold is
 * tested first, then the integrity-protected classes, then the retention
 * window. `isDeletableClass` is exported and used by `planErasure` as well, so
 * no caller can route around the financial and audit guarantee.
 */

import { apiClient } from '@/src/lib/api-client';
import type {
  ErasurePlan,
  LegalHold,
  RecordClass,
  RetentionAssessment,
  RetentionPolicy,
  RetentionRecord,
  RetentionRule,
} from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

export const RECORD_CLASSES: RecordClass[] = [
  'draft',
  'rejected',
  'withdrawn',
  'awarded',
  'financial',
  'audit',
  'legal-hold',
];

/** Classes whose integrity guarantee is never traded away for a shorter window. */
export const INTEGRITY_PROTECTED_CLASSES: RecordClass[] = ['financial', 'audit'];

export function isDeletableClass(recordClass: RecordClass): boolean {
  return !INTEGRITY_PROTECTED_CLASSES.includes(recordClass);
}

export function isHoldActive(hold: LegalHold): boolean {
  return !hold.releasedAt;
}

/** The hold that blocks this record, if any. A hold may name a record or a whole applicant. */
export function findActiveHold(
  record: RetentionRecord,
  holds: LegalHold[]
): LegalHold | undefined {
  return holds.find(
    (hold) =>
      isHoldActive(hold) &&
      hold.scope.includes(record.class) &&
      (hold.subjectId === record.id || hold.subjectId === record.applicantId)
  );
}

/**
 * Whole days until the retention window closes. Negative once the window has
 * passed; `null` when the class is retained indefinitely.
 */
export function daysUntilExpiry(
  record: RetentionRecord,
  rule: RetentionRule,
  now: Date
): number | null {
  if (rule.retentionDays === null) return null;
  const anchor = Date.parse(record.lastTouchedAt ?? record.createdAt);
  if (!Number.isFinite(anchor)) return null;
  const expiry = anchor + rule.retentionDays * DAY_MS;
  return Math.ceil((expiry - now.getTime()) / DAY_MS);
}

export function assessRetention(
  rule: RetentionRule,
  record: RetentionRecord,
  now: Date,
  holds: LegalHold[]
): RetentionAssessment {
  const remaining = daysUntilExpiry(record, rule, now);

  const hold = findActiveHold(record, holds);
  if (hold) {
    return {
      recordId: record.id,
      recordClass: record.class,
      action: 'blocked-by-hold',
      reason: `Legal hold ${hold.id} (${hold.reason}) placed by ${hold.placedBy} covers this record. It is retained until the hold is released.`,
      retentionDaysRemaining: remaining,
      protectedBy: 'legal-hold',
    };
  }

  if (!isDeletableClass(record.class)) {
    const protectedBy = record.class === 'financial' ? 'financial-integrity' : 'audit-integrity';
    return {
      recordId: record.id,
      recordClass: record.class,
      action: 'blocked-immutable',
      reason: `${record.class} records are never deleted: the ${record.class} trail must stay complete for audit and settlement.`,
      retentionDaysRemaining: remaining,
      protectedBy,
    };
  }

  if (rule.retentionDays === null) {
    return {
      recordId: record.id,
      recordClass: record.class,
      action: 'retain',
      reason: `Retained indefinitely on a ${rule.basis} basis (${rule.legalBasis}).`,
      retentionDaysRemaining: null,
      protectedBy: null,
    };
  }

  if (remaining !== null && remaining > 0) {
    return {
      recordId: record.id,
      recordClass: record.class,
      action: 'retain',
      reason: `Inside the ${rule.retentionDays}-day window with ${remaining} day(s) remaining.`,
      retentionDaysRemaining: remaining,
      protectedBy: null,
    };
  }

  if (remaining !== null && remaining === 0) {
    return {
      recordId: record.id,
      recordClass: record.class,
      action: 'expire',
      reason: `The ${rule.retentionDays}-day window closes today; deletion runs on the next scheduled sweep.`,
      retentionDaysRemaining: 0,
      protectedBy: null,
    };
  }

  if (!rule.deletable) {
    return {
      recordId: record.id,
      recordClass: record.class,
      action: 'retain',
      reason: `The window expired ${Math.abs(remaining ?? 0)} day(s) ago but the rule marks this class non-deletable (${rule.legalBasis}).`,
      retentionDaysRemaining: remaining,
      protectedBy: null,
    };
  }

  return {
    recordId: record.id,
    recordClass: record.class,
    action: 'delete',
    reason: `The ${rule.retentionDays}-day window expired ${Math.abs(remaining ?? 0)} day(s) ago and the class is deletable.`,
    retentionDaysRemaining: remaining,
    protectedBy: null,
  };
}

const FALLBACK_RULE: RetentionRule = {
  recordClass: 'draft',
  retentionDays: null,
  basis: 'operational',
  legalBasis: 'No rule is defined for this class, so the record is retained until policy is amended.',
  deletable: false,
  owner: 'Privacy and Legal',
};

/**
 * Splits one applicant's records into what an erasure may delete and what must
 * stay, with the basis for every protected record. Records with no matching
 * rule are protected, never deleted.
 */
export function planErasure(
  policy: RetentionPolicy,
  records: RetentionRecord[],
  holds: LegalHold[],
  applicantId: string,
  now: Date = new Date()
): ErasurePlan {
  const ruleFor = (recordClass: RecordClass): RetentionRule =>
    policy.rules.find((rule) => rule.recordClass === recordClass) ?? FALLBACK_RULE;

  const deletable: string[] = [];
  const protectedRecords: ErasurePlan['protected'] = [];
  const blockedByHolds: string[] = [];

  for (const record of records.filter((item) => item.applicantId === applicantId)) {
    const rule = ruleFor(record.class);
    const assessment = assessRetention(rule, record, now, holds);
    const hold = findActiveHold(record, holds);

    if (assessment.action === 'delete') {
      deletable.push(record.id);
      continue;
    }

    protectedRecords.push({ recordId: record.id, class: record.class, basis: rule.basis });
    if (hold && !blockedByHolds.includes(hold.id)) {
      blockedByHolds.push(hold.id);
    }
  }

  return { applicantId, deletable, protected: protectedRecords, blockedByHolds };
}

export function describeErasurePlan(plan: ErasurePlan): string {
  return `${plan.deletable.length} record(s) will be deleted, ${plan.protected.length} record(s) are protected, and ${plan.blockedByHolds.length} legal hold(s) apply. Financial and audit integrity is never broken.`;
}

const RETENTION_PATH = '/scholarships/retention';

export const scholarshipRetentionService = {
  getPolicy: (): Promise<RetentionPolicy> =>
    apiClient.get<RetentionPolicy>(`${RETENTION_PATH}/policy`),

  upsertPolicy: (policy: RetentionPolicy): Promise<RetentionPolicy> =>
    apiClient.put<RetentionPolicy>(`${RETENTION_PATH}/policy`, policy),

  listHolds: (): Promise<LegalHold[]> => apiClient.get<LegalHold[]>(`${RETENTION_PATH}/holds`),

  placeHold: (hold: LegalHold): Promise<LegalHold> =>
    apiClient.post<LegalHold>(`${RETENTION_PATH}/holds`, hold),

  releaseHold: (holdId: string, releasedBy: string): Promise<LegalHold> =>
    apiClient.post<LegalHold>(`${RETENTION_PATH}/holds/${encodeURIComponent(holdId)}/release`, {
      releasedBy,
    }),

  previewErasure: (
    applicantId: string,
    now?: string
  ): Promise<ErasurePlan> =>
    apiClient.post<ErasurePlan>(`${RETENTION_PATH}/erasure/preview`, {
      applicantId,
      now: now ?? new Date().toISOString(),
    }),
};
