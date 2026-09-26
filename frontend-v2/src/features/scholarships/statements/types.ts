/**
 * Sponsor financial statements (issue #1131).
 *
 * A statement is a period view of a sponsor's money movement. Every line
 * carries the `ledgerEntryId` it came from, so a statement can always be
 * reconciled back to the ledger rather than trusted on its own.
 *
 * Large exports run asynchronously as a job; small ones download directly.
 */

export type StatementPeriod = {
  from: string;
  to: string;
};

export type StatementLineKind =
  | 'contribution'
  | 'commitment'
  | 'payment'
  | 'fee'
  | 'refund'
  | 'recovery'
  | 'balance';

export type StatementLine = {
  id: string;
  kind: StatementLineKind;
  occurredAt: string;
  description: string;
  amountCents: number;
  currency: string;
  programId?: string;
  /** Required: a statement line that cannot be traced to the ledger is invalid. */
  ledgerEntryId: string;
};

export type StatementTotals = {
  contributionsCents: number;
  commitmentsCents: number;
  paymentsCents: number;
  feesCents: number;
  refundsCents: number;
  recoveriesCents: number;
  closingBalanceCents: number;
  currency: string;
};

export type StatementFormat = 'csv' | 'json' | 'pdf';

export type Statement = {
  id: string;
  sponsorId: string;
  programId: string;
  period: StatementPeriod;
  currency: string;
  lines: StatementLine[];
  totals: StatementTotals;
  generatedAt: string;
  generatedBy: string;
  format: StatementFormat;
  /** Hash of the ledger slice the statement was built from. */
  ledgerHash: string;
};

export type StatementExportStatus = 'queued' | 'processing' | 'ready' | 'failed' | 'expired';

export type StatementExportJob = {
  id: string;
  statementId: string;
  status: StatementExportStatus;
  requestedAt: string;
  readyAt?: string;
  downloadUrl?: string;
  expiresAt?: string;
  lineCount: number;
  error?: string;
};

/**
 * Above this line count an export MUST run asynchronously as a job, so the
 * request thread is never held open for a large CSV.
 */
export const ASYNCHRONOUS_EXPORT_THRESHOLD = 500;

/** How long a prepared download stays available. */
export const STATEMENT_EXPORT_TTL_MS = 72 * 60 * 60 * 1000;

export type StatementDiscrepancy = {
  ledgerEntryId: string;
  reason: string;
};

export type ReconciliationReport = {
  statementId: string;
  balanced: boolean;
  discrepancies: StatementDiscrepancy[];
};

export type ExportRequestInput = {
  sponsorId: string;
  programId: string;
  period: StatementPeriod;
  format: StatementFormat;
};

export type ExportRequestResult =
  | { kind: 'job'; job: StatementExportJob }
  | { kind: 'statement'; statement: Statement };

/** Minimal ledger shape needed to reconcile a statement. */
export type LedgerEntryRef = {
  id: string;
  amountCents: number;
  currency: string;
};
