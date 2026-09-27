import { describe, expect, it, vi } from 'vitest';
import {
  ASYNCHRONOUS_EXPORT_THRESHOLD,
  buildCsv,
  mismatchedCurrencies,
  pollExportJob,
  reconcileStatement,
  requiresAsyncExport,
  statementService,
  summariseLines,
} from '../statements';
import type { LedgerEntryRef, Statement, StatementExportJob, StatementLine } from '../statements';

vi.mock('@/src/lib/api-client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const line = (overrides: Partial<StatementLine> = {}): StatementLine => ({
  id: 'line-1',
  kind: 'contribution',
  occurredAt: '2026-01-10T00:00:00.000Z',
  description: 'Sponsor contribution',
  amountCents: 100_000,
  currency: 'USD',
  ledgerEntryId: 'ledger-1',
  ...overrides,
});

const statementWith = (lines: StatementLine[]): Statement => ({
  id: 'statement-1',
  sponsorId: 'sponsor-acme',
  programId: 'program-1',
  period: { from: '2026-01-01', to: '2026-03-31' },
  currency: 'USD',
  lines,
  totals: summariseLines(lines),
  generatedAt: '2026-04-01T00:00:00.000Z',
  generatedBy: 'finance-1',
  format: 'csv',
  ledgerHash: 'sha256:abc',
});

describe('summariseLines', () => {
  it('adds inflows and subtracts outflows', () => {
    const totals = summariseLines([
      line({ id: 'a', kind: 'contribution', amountCents: 500_000 }),
      line({ id: 'b', kind: 'commitment', amountCents: 200_000 }),
      line({ id: 'c', kind: 'payment', amountCents: 300_000 }),
      line({ id: 'd', kind: 'fee', amountCents: 25_000 }),
      line({ id: 'e', kind: 'refund', amountCents: 10_000 }),
      line({ id: 'f', kind: 'recovery', amountCents: 15_000 }),
    ]);

    expect(totals).toEqual({
      contributionsCents: 500_000,
      commitmentsCents: 200_000,
      paymentsCents: 300_000,
      feesCents: -25_000,
      refundsCents: -10_000,
      recoveriesCents: -15_000,
      closingBalanceCents: 450_000,
      currency: 'USD',
    });
  });

  it('is all zeroes for an empty period', () => {
    expect(summariseLines([]).closingBalanceCents).toBe(0);
  });

  it('takes the closing balance from a balance line when one is present', () => {
    const totals = summariseLines([
      line({ id: 'a', kind: 'contribution', amountCents: 100_000 }),
      line({ id: 'b', kind: 'balance', amountCents: 90_000 }),
    ]);
    expect(totals.closingBalanceCents).toBe(90_000);
  });
});

describe('requiresAsyncExport', () => {
  it('treats the threshold as inclusive of the async path only above it', () => {
    expect(requiresAsyncExport(499)).toBe(false);
    expect(requiresAsyncExport(500)).toBe(false);
    expect(requiresAsyncExport(501)).toBe(true);
    expect(ASYNCHRONOUS_EXPORT_THRESHOLD).toBe(500);
  });
});

describe('pollExportJob', () => {
  const queued: StatementExportJob = {
    id: 'job-1',
    statementId: 'statement-1',
    status: 'queued',
    requestedAt: '2026-04-01T00:00:00.000Z',
    lineCount: 900,
  };

  it('stays queued immediately after the request', () => {
    expect(pollExportJob(queued, new Date('2026-04-01T00:00:01.000Z')).status).toBe('queued');
  });

  it('advances to processing', () => {
    expect(pollExportJob(queued, new Date('2026-04-01T00:00:06.000Z')).status).toBe('processing');
  });

  it('becomes ready with a download url and an expiry', () => {
    const ready = pollExportJob(queued, new Date('2026-04-01T00:00:20.000Z'));
    expect(ready.status).toBe('ready');
    expect(ready.downloadUrl).toContain('job-1');
    expect(ready.expiresAt).toBe('2026-04-04T00:00:20.000Z');
  });

  it('expires a ready job that is past its expiry', () => {
    const ready = pollExportJob(queued, new Date('2026-04-01T00:00:20.000Z'));
    expect(pollExportJob(ready, new Date('2026-04-05T00:00:00.000Z')).status).toBe('expired');
  });

  it('never resurrects a failed job', () => {
    const failed: StatementExportJob = { ...queued, status: 'failed', error: 'ledger unavailable' };
    expect(pollExportJob(failed, new Date('2026-04-01T01:00:00.000Z'))).toBe(failed);
  });
});

describe('mismatchedCurrencies', () => {
  it('lists every currency in the lines', () => {
    expect(mismatchedCurrencies([line(), line({ id: 'b', currency: 'EUR' })])).toEqual(['EUR', 'USD']);
  });

  it('reports nothing for a single-currency statement', () => {
    expect(mismatchedCurrencies([line(), line({ id: 'b' })])).toEqual(['USD']);
  });
});

describe('reconcileStatement', () => {
  const ledger: LedgerEntryRef[] = [
    { id: 'ledger-1', amountCents: 100_000, currency: 'USD' },
    { id: 'ledger-2', amountCents: 50_000, currency: 'USD' },
  ];

  it('balances when every line maps to a ledger entry', () => {
    const report = reconcileStatement(
      [line(), line({ id: 'line-2', ledgerEntryId: 'ledger-2', amountCents: 50_000 })],
      ledger,
      'statement-1'
    );
    expect(report).toEqual({ statementId: 'statement-1', balanced: true, discrepancies: [] });
  });

  it('detects a missing ledger entry', () => {
    const report = reconcileStatement([line(), line({ id: 'line-2', ledgerEntryId: 'ledger-missing' })], ledger);
    expect(report.balanced).toBe(false);
    expect(report.discrepancies).toEqual([
      { ledgerEntryId: 'ledger-missing', reason: 'No matching ledger entry found for this statement line.' },
    ]);
  });

  it('detects an amount mismatch', () => {
    const report = reconcileStatement([line({ amountCents: 99_999 })], ledger);
    expect(report.balanced).toBe(false);
    expect(report.discrepancies[0].reason).toMatch(/amount mismatch/i);
  });

  it('detects a ledger entry claimed twice', () => {
    const report = reconcileStatement([line(), line({ id: 'line-2' })], ledger);
    expect(report.balanced).toBe(false);
    expect(report.discrepancies[0].reason).toMatch(/more than one/i);
  });
});

describe('buildCsv', () => {
  const csv = buildCsv(
    statementWith([
      line(),
      line({ id: 'line-2', kind: 'payment', amountCents: 50_000, ledgerEntryId: 'ledger-2', description: 'Payment, tranche 1' }),
    ])
  );
  const rows = csv.split('\n');

  it('emits a header row followed by one row per line', () => {
    expect(rows).toHaveLength(3);
    expect(rows[0]).toBe('line_id,kind,occurred_at,description,amount_minor_units,currency,program_id,ledger_entry_id');
  });

  it('keeps the amount in minor units and repeats the currency on every row', () => {
    expect(rows[1]).toContain('100000');
    expect(rows[1]).toContain('USD');
    expect(rows[2]).toContain('50000');
    expect(rows[2]).toContain('USD');
  });

  it('quotes descriptions containing a comma', () => {
    expect(rows[2]).toContain('"Payment, tranche 1"');
  });

  it('includes the ledger entry id so the row reconciles', () => {
    expect(rows[1]).toContain('ledger-1');
  });
});

describe('statementService.requestExport', () => {
  const input = {
    sponsorId: 'sponsor-acme',
    programId: 'program-1',
    period: { from: '2026-01-01', to: '2026-03-31' },
    format: 'csv' as const,
  };

  it('queues a job above the threshold', async () => {
    const { apiClient } = await import('@/src/lib/api-client');
    const job: StatementExportJob = {
      id: 'job-1',
      statementId: 'statement-1',
      status: 'queued',
      requestedAt: '2026-04-01T00:00:00.000Z',
      lineCount: 900,
    };
    vi.mocked(apiClient.post).mockResolvedValue(job);

    const result = await statementService.requestExport(input, 501);
    expect(result).toEqual({ kind: 'job', job });
    expect(apiClient.post).toHaveBeenCalledWith('/scholarships/statements/exports', expect.objectContaining({ mode: 'async' }));
  });

  it('returns a statement inline at the threshold', async () => {
    const { apiClient } = await import('@/src/lib/api-client');
    const statement = statementWith([line()]);
    vi.mocked(apiClient.post).mockResolvedValue(statement);

    const result = await statementService.requestExport(input, 500);
    expect(result).toEqual({ kind: 'statement', statement });
    expect(apiClient.post).toHaveBeenCalledWith('/scholarships/statements', expect.objectContaining({ mode: 'sync' }));
  });
});
