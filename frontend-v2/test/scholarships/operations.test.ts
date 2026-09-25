// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  buildScholarshipEvent,
  dedupeScholarshipEvents,
  scholarshipDedupeKey,
  validateScholarshipEvent,
} from '@/src/features/scholarships/events';
import {
  reconcileAllSettlements,
  reconcileSettlement,
  type LedgerTransaction,
  type SettlementIntent,
} from '@/src/features/scholarships/settlement';
import { runLegacyMigration, type LegacyFinancialAidRecord } from '@/src/features/scholarships/migration';
import {
  DEFAULT_ADMIN_CONFIG,
  previewAdminConfigChange,
  redactAdminConfig,
  validateAdminConfig,
} from '@/src/features/scholarships/admin-config';

describe('scholarship domain events (#1162)', () => {
  it('produces a stable dedupe key for retries of the same operation', () => {
    const first = buildScholarshipEvent({
      name: 'scholarship.application.submitted',
      aggregateId: 'application-1',
      correlationId: 'corr-1',
      producer: 'scholarships-ui',
      idempotencyKey: 'submit-1',
      occurredAt: '2026-09-24T10:00:00.000Z',
    });
    const retry = buildScholarshipEvent({
      name: 'scholarship.application.submitted',
      aggregateId: 'application-1',
      correlationId: 'corr-2',
      producer: 'scholarships-ui',
      idempotencyKey: 'submit-1',
      occurredAt: '2026-09-24T10:00:05.000Z',
    });

    expect(first.dedupeKey).toBe(retry.dedupeKey);
    expect(first.eventId).toBe(scholarshipDedupeKey('scholarship.application.submitted', 'application-1', 'submit-1'));
    expect(dedupeScholarshipEvents([first, retry])).toHaveLength(1);
  });

  it('reports invalid envelopes before they reach the outbox', () => {
    const event = buildScholarshipEvent({
      name: 'scholarship.award.accepted',
      aggregateId: '',
      correlationId: '',
      producer: 'scholarships-ui',
      idempotencyKey: 'accept-1',
    });

    const errors = validateScholarshipEvent(event);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('settlement reconciliation (#1164)', () => {
  const intent: SettlementIntent = {
    id: 'intent-1',
    awardId: 'award-1',
    amount: '100.00',
    asset: 'XLM',
    destination: 'GDEST',
    status: 'submitted',
    txHash: 'tx-1',
  };

  it('confirms a matching transaction once it is final', () => {
    const transactions: LedgerTransaction[] = [
      { hash: 'tx-1', successful: true, ledger: 10, amount: '100.00', asset: 'XLM', destination: 'GDEST' },
    ];

    const result = reconcileSettlement(intent, transactions, 13);
    expect(result.reconciledStatus).toBe('confirmed');
    expect(result.final).toBe(true);
    expect(result.mismatches).toEqual([]);
  });

  it('flags mismatched amounts and missing transactions', () => {
    const transactions: LedgerTransaction[] = [
      { hash: 'tx-1', successful: true, ledger: 10, amount: '90.00', asset: 'XLM', destination: 'GDEST' },
    ];

    const mismatched = reconcileSettlement(intent, transactions, 13);
    expect(mismatched.mismatches).toContain('AMOUNT_MISMATCH');
    expect(mismatched.reconciledStatus).toBe('submitted');

    const missing = reconcileSettlement(intent, [], 13);
    expect(missing.mismatches).toContain('MISSING_TRANSACTION');
    expect(missing.reconciledStatus).toBe('pending');
  });

  it('reprocessing the same intents yields one outcome per intent', () => {
    const results = reconcileAllSettlements([intent], [], 13);
    expect(results).toHaveLength(1);
    expect(results[0].intentId).toBe('intent-1');
  });
});

describe('legacy financial-aid migration (#1165)', () => {
  const records: LegacyFinancialAidRecord[] = [
    {
      legacyId: 'aid-1',
      applicantId: 'student-1',
      programName: 'Legacy bursary',
      requestedAmount: 100,
      currency: 'USD',
      status: 'approved',
      submittedAt: '2019-01-01T00:00:00.000Z',
    },
    {
      legacyId: 'aid-2',
      applicantId: 'student-2',
      programName: 'Legacy bursary',
      requestedAmount: 200,
      currency: 'USD',
      status: 'rejected',
      submittedAt: '2019-02-01T00:00:00.000Z',
    },
  ];

  it('is dry-runnable and preserves legacy identifiers and timestamps', () => {
    const report = runLegacyMigration(records, { scholarshipId: 'scholarship-1', dryRun: true });
    expect(report.dryRun).toBe(true);
    expect(report.migratedLegacyIds).toEqual(['aid-1']);
    expect(report.skippedLegacyIds).toEqual(['aid-2']);
  });

  it('is resumable in batches and idempotent from the checkpoint', () => {
    const first = runLegacyMigration(records, {
      scholarshipId: 'scholarship-1',
      dryRun: true,
      batchSize: 1,
    });
    expect(first.complete).toBe(false);
    expect(first.resumableFrom).toBe('aid-1');

    const second = runLegacyMigration(records, {
      scholarshipId: 'scholarship-1',
      dryRun: true,
      resumeFromLegacyId: first.resumableFrom,
    });
    expect(second.complete).toBe(true);
    expect(second.migratedLegacyIds).toEqual([]);
    expect(second.skippedLegacyIds).toEqual(['aid-2']);
  });
});

describe('scholarship administration configuration (#1167)', () => {
  it('validates limits and thresholds', () => {
    expect(validateAdminConfig(DEFAULT_ADMIN_CONFIG)).toEqual([]);
    expect(
      validateAdminConfig({ ...DEFAULT_ADMIN_CONFIG, maxApplicationsPerApplicant: 99 }).length
    ).toBeGreaterThan(0);
  });

  it('previews changes and never returns secret values', () => {
    const changes = previewAdminConfigChange(DEFAULT_ADMIN_CONFIG, {
      ...DEFAULT_ADMIN_CONFIG,
      maxAwardAmount: 9000,
    });
    expect(changes.some((change) => change.field === 'maxAwardAmount')).toBe(true);

    const redacted = redactAdminConfig(DEFAULT_ADMIN_CONFIG);
    expect(redacted.webhookSigningSecretRef).toBe('ref:redacted');
  });
});
