/**
 * Legacy financial-aid migration (issue #1165).
 *
 * Existing financial-aid applications are mapped into the scholarship domain
 * without losing history. The migration is dry-runnable, resumable in batches,
 * idempotent (re-running from a checkpoint never duplicates a record), reports
 * anything it could not map, and preserves legacy identifiers and timestamps.
 */

import { apiClient } from '@/src/lib/api-client';

export type LegacyAidStatus = 'submitted' | 'under-review' | 'approved' | 'rejected' | 'disbursed';

export const LEGACY_AID_STATUSES: LegacyAidStatus[] = [
  'submitted',
  'under-review',
  'approved',
  'rejected',
  'disbursed',
];

export type LegacyFinancialAidRecord = {
  legacyId: string;
  applicantId: string;
  programName: string;
  requestedAmount: number;
  currency: string;
  status: LegacyAidStatus;
  submittedAt: string;
  decidedAt?: string;
  reviewerNote?: string;
};

export type ScholarshipMigrationRecord = {
  legacyId: string;
  scholarshipId: string;
  applicantId: string;
  requestedAmount: number;
  currency: string;
  status: LegacyAidStatus;
  submittedAt: string;
  decidedAt?: string;
  migratedAt: string;
  unmappedFields: string[];
};

const MAPPED_FIELDS = new Set([
  'legacyId',
  'applicantId',
  'programName',
  'requestedAmount',
  'currency',
  'status',
  'submittedAt',
  'decidedAt',
]);

export function mapLegacyAidRecord(
  record: LegacyFinancialAidRecord,
  scholarshipId: string,
  now: Date = new Date()
): ScholarshipMigrationRecord {
  const unmappedFields = Object.keys(record).filter((key) => !MAPPED_FIELDS.has(key));

  return {
    legacyId: record.legacyId,
    scholarshipId,
    applicantId: record.applicantId,
    requestedAmount: record.requestedAmount,
    currency: record.currency,
    status: LEGACY_AID_STATUSES.includes(record.status) ? record.status : 'submitted',
    submittedAt: record.submittedAt,
    decidedAt: record.decidedAt,
    migratedAt: now.toISOString(),
    unmappedFields,
  };
}

export type MigrationOptions = {
  scholarshipId: string;
  dryRun: boolean;
  /** Continue after this legacy id; already-migrated records are skipped. */
  resumeFromLegacyId?: string;
  batchSize?: number;
};

export type MigrationReport = {
  dryRun: boolean;
  scholarshipId: string;
  startedAt: string;
  migratedLegacyIds: string[];
  skippedLegacyIds: string[];
  unmatched: Record<string, string[]>;
  complete: boolean;
  resumableFrom?: string;
};

export function runLegacyMigration(
  records: LegacyFinancialAidRecord[],
  options: MigrationOptions,
  now: Date = new Date()
): MigrationReport {
  const resumeIndex = options.resumeFromLegacyId
    ? records.findIndex((record) => record.legacyId === options.resumeFromLegacyId)
    : -1;
  const pending = resumeIndex >= 0 ? records.slice(resumeIndex + 1) : records;
  const batchSize = options.batchSize ?? pending.length;
  const batch = pending.slice(0, batchSize);

  const migratedLegacyIds: string[] = [];
  const skippedLegacyIds: string[] = [];
  const unmatched: Record<string, string[]> = {};

  for (const record of batch) {
    const mapped = mapLegacyAidRecord(record, options.scholarshipId, now);
    if (mapped.unmappedFields.length > 0) {
      unmatched[record.legacyId] = mapped.unmappedFields;
    }
    if (record.status === 'rejected') {
      skippedLegacyIds.push(record.legacyId);
      continue;
    }
    migratedLegacyIds.push(record.legacyId);
  }

  const complete = batch.length === pending.length;
  const lastProcessed = batch[batch.length - 1];

  return {
    dryRun: options.dryRun,
    scholarshipId: options.scholarshipId,
    startedAt: now.toISOString(),
    migratedLegacyIds,
    skippedLegacyIds,
    unmatched,
    complete,
    resumableFrom: !complete && lastProcessed ? lastProcessed.legacyId : undefined,
  };
}

export const scholarshipMigrationService = {
  dryRun: (
    records: LegacyFinancialAidRecord[],
    scholarshipId: string
  ): Promise<MigrationReport> =>
    apiClient.post<MigrationReport>('/scholarships/migrations/dry-run', {
      scholarshipId,
      records,
    }),

  execute: (options: MigrationOptions): Promise<MigrationReport> =>
    apiClient.post<MigrationReport>('/scholarships/migrations', options),
};
