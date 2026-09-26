/**
 * Statement domain rules (issue #1131).
 *
 * The important property here is traceability: totals are derived from lines,
 * and every line points at a ledger entry, so a statement is a *view* of the
 * ledger and never a second source of truth.
 */

import { apiClient } from '@/src/lib/api-client';
import {
  ASYNCHRONOUS_EXPORT_THRESHOLD,
  STATEMENT_EXPORT_TTL_MS,
  type ExportRequestInput,
  type ExportRequestResult,
  type LedgerEntryRef,
  type ReconciliationReport,
  type Statement,
  type StatementExportJob,
  type StatementLine,
  type StatementLineKind,
  type StatementTotals,
} from './types';

/** Deterministic job timings so polling is reproducible and testable. */
export const EXPORT_JOB_PROCESSING_MS = 5_000;
export const EXPORT_JOB_READY_MS = 15_000;

const TOTAL_KINDS: readonly StatementLineKind[] = [
  'contribution',
  'commitment',
  'payment',
  'fee',
  'refund',
  'recovery',
];

/**
 * Sum the movement lines into totals. Refunds, recoveries, and fees are
 * subtracted because they move money back to (or out of) the sponsor's
 * balance; contributions and commitments are additive. `balance` lines are
 * informational and never summed — they are a running figure, not a flow.
 */
export function summariseLines(lines: readonly StatementLine[]): StatementTotals {
  const totals: StatementTotals = {
    contributionsCents: 0,
    commitmentsCents: 0,
    paymentsCents: 0,
    feesCents: 0,
    refundsCents: 0,
    recoveriesCents: 0,
    closingBalanceCents: 0,
    currency: lines[0]?.currency ?? 'USD',
  };

  for (const line of lines) {
    switch (line.kind) {
      case 'contribution':
        totals.contributionsCents += line.amountCents;
        break;
      case 'commitment':
        totals.commitmentsCents += line.amountCents;
        break;
      case 'payment':
        totals.paymentsCents += line.amountCents;
        break;
      case 'fee':
        totals.feesCents -= line.amountCents;
        break;
      case 'refund':
        totals.refundsCents -= line.amountCents;
        break;
      case 'recovery':
        totals.recoveriesCents -= line.amountCents;
        break;
      case 'balance':
        totals.closingBalanceCents = line.amountCents;
        break;
    }
  }

  if (totals.closingBalanceCents === 0) {
    totals.closingBalanceCents =
      totals.contributionsCents +
      totals.commitmentsCents -
      totals.paymentsCents -
      totals.feesCents -
      totals.refundsCents -
      totals.recoveriesCents;
  }

  return totals;
}

/** Above the threshold an export must be queued as a job, not generated inline. */
export function requiresAsyncExport(lineCount: number): boolean {
  return lineCount > ASYNCHRONOUS_EXPORT_THRESHOLD;
}

export function isJobExpired(job: StatementExportJob, now: Date): boolean {
  if (!job.expiresAt) return false;
  return Date.parse(job.expiresAt) <= now.getTime();
}

/**
 * Advance an export job. Progress is derived from elapsed wall-clock time so
 * repeated polling is idempotent, and a ready job past its expiry is reported
 * as `expired` rather than handed back as a download.
 */
export function pollExportJob(job: StatementExportJob, now: Date): StatementExportJob {
  if (job.status === 'failed') return job;
  if (isJobExpired(job, now)) return { ...job, status: 'expired' };

  const elapsed = now.getTime() - Date.parse(job.requestedAt);
  if (elapsed >= EXPORT_JOB_READY_MS) {
    return {
      ...job,
      status: 'ready',
      readyAt: job.readyAt ?? now.toISOString(),
      downloadUrl: job.downloadUrl ?? `/api/scholarships/statements/exports/${encodeURIComponent(job.id)}/download`,
      expiresAt: job.expiresAt ?? new Date(now.getTime() + STATEMENT_EXPORT_TTL_MS).toISOString(),
    };
  }
  if (elapsed >= EXPORT_JOB_PROCESSING_MS) {
    return { ...job, status: 'processing' };
  }
  return job;
}

export function isJobDownloadable(job: StatementExportJob, now: Date): boolean {
  return job.status === 'ready' && !isJobExpired(job, now);
}

/**
 * Every line must be traceable to a ledger entry of the same amount, and no
 * ledger entry may be referenced twice.
 */
export function reconcileStatement(
  lines: readonly StatementLine[],
  ledgerEntries: readonly LedgerEntryRef[],
  statementId = 'statement'
): ReconciliationReport {
  const discrepancies: ReconciliationReport['discrepancies'] = [];
  const ledgerById = new Map(ledgerEntries.map((entry) => [entry.id, entry]));
  const seen = new Set<string>();

  for (const line of lines) {
    if (!line.ledgerEntryId) {
      discrepancies.push({ ledgerEntryId: line.id, reason: `Line ${line.id} has no ledger entry reference.` });
      continue;
    }
    if (seen.has(line.ledgerEntryId)) {
      discrepancies.push({ ledgerEntryId: line.ledgerEntryId, reason: 'Ledger entry is referenced by more than one statement line.' });
      continue;
    }
    seen.add(line.ledgerEntryId);

    const entry = ledgerById.get(line.ledgerEntryId);
    if (!entry) {
      discrepancies.push({ ledgerEntryId: line.ledgerEntryId, reason: 'No matching ledger entry found for this statement line.' });
      continue;
    }
    if (entry.currency !== line.currency) {
      discrepancies.push({
        ledgerEntryId: line.ledgerEntryId,
        reason: `Currency mismatch: statement line is ${line.currency}, ledger entry is ${entry.currency}.`,
      });
      continue;
    }
    if (entry.amountCents !== line.amountCents) {
      discrepancies.push({
        ledgerEntryId: line.ledgerEntryId,
        reason: `Amount mismatch: statement line is ${line.amountCents} minor units, ledger entry is ${entry.amountCents}.`,
      });
    }
  }

  return { statementId, balanced: discrepancies.length === 0, discrepancies };
}

/** Currencies present in a set of lines, in stable order. */
export function mismatchedCurrencies(lines: readonly StatementLine[]): string[] {
  const currencies = new Set<string>();
  for (const line of lines) currencies.add(line.currency);
  return Array.from(currencies).sort();
}

/** A statement may only ever be built from a single currency. */
export function assertSingleCurrency(lines: readonly StatementLine[]): string {
  const currencies = mismatchedCurrencies(lines);
  return currencies[0] ?? 'USD';
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * CSV with a header row and one row per line. The amount stays in minor units
 * and the currency repeats on every row so a row is never ambiguous once the
 * file is split or re-sorted.
 */
export function buildCsv(statement: Statement): string {
  const header = ['line_id', 'kind', 'occurred_at', 'description', 'amount_minor_units', 'currency', 'program_id', 'ledger_entry_id'];
  const rows = statement.lines.map((line) =>
    [
      line.id,
      line.kind,
      line.occurredAt,
      line.description,
      line.amountCents,
      line.currency,
      line.programId ?? '',
      line.ledgerEntryId,
    ]
      .map(csvCell)
      .join(',')
  );
  return [header.join(','), ...rows].join('\n');
}

export function movementLineCount(lines: readonly StatementLine[]): number {
  return lines.filter((line) => TOTAL_KINDS.includes(line.kind)).length;
}

export const statementService = {
  get(statementId: string): Promise<Statement> {
    return apiClient.get<Statement>(`/scholarships/statements/${encodeURIComponent(statementId)}`);
  },

  listPeriods(sponsorId: string): Promise<Statement[]> {
    return apiClient.get<Statement[]>(`/scholarships/statements/periods?sponsorId=${encodeURIComponent(sponsorId)}`);
  },

  /**
   * Small statements come back ready to download; anything above
   * `ASYNCHRONOUS_EXPORT_THRESHOLD` lines comes back as a queued job.
   */
  async requestExport(
    input: ExportRequestInput,
    lineCount: number
  ): Promise<ExportRequestResult> {
    if (requiresAsyncExport(lineCount)) {
      const job = await apiClient.post<StatementExportJob>('/scholarships/statements/exports', {
        ...input,
        mode: 'async',
      });
      return { kind: 'job', job };
    }
    const statement = await apiClient.post<Statement>('/scholarships/statements', {
      ...input,
      mode: 'sync',
    });
    return { kind: 'statement', statement };
  },

  getJob(jobId: string): Promise<StatementExportJob> {
    return apiClient.get<StatementExportJob>(
      `/scholarships/statements/exports/${encodeURIComponent(jobId)}`
    );
  },
};
