import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  acknowledgeDiscrepancy,
  canOperateTreasury,
  collectDiscrepancies,
  computePosition,
  detectCurrencyMismatch,
  evaluateAwardGate,
  payableLiabilityCents,
  runReconciliation,
  treasuryService,
  unacknowledgedDiscrepancies,
} from '../treasury/service';
import type { Liability, ReconciliationRun, TreasuryAccount } from '../treasury/types';

vi.mock('@/src/lib/api-client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const AS_OF = '2026-02-01T00:00:00.000Z';

function account(overrides: Partial<TreasuryAccount> = {}): TreasuryAccount {
  return {
    id: 'acct-program',
    programId: 'program-1',
    kind: 'program-pool',
    availableCents: 1_000_00,
    reservedCents: 200_00,
    payableCents: 300_00,
    currency: 'USD',
    asOf: AS_OF,
    ...overrides,
  };
}

function liability(overrides: Partial<Liability> = {}): Liability {
  return {
    id: 'liab-1',
    programId: 'program-1',
    kind: 'committed-award',
    amountCents: 300_00,
    currency: 'USD',
    createdAt: '2026-01-15T00:00:00.000Z',
    ...overrides,
  };
}

describe('treasury · position maths', () => {
  it('sums accounts and derives net as available minus payable', () => {
    const position = computePosition([
      account({ id: 'a', availableCents: 500_00, reservedCents: 50_00, payableCents: 100_00 }),
      account({ id: 'b', availableCents: 250_00, reservedCents: 25_00, payableCents: 200_00 }),
    ]);

    expect(position.availableCents).toBe(750_00);
    expect(position.reservedCents).toBe(75_00);
    expect(position.payableCents).toBe(300_00);
    expect(position.netCents).toBe(450_00);
    expect(position.currency).toBe('USD');
    expect(position.accounts).toHaveLength(2);
  });

  it('reports a negative net when payables exceed available balances', () => {
    const position = computePosition([account({ availableCents: 100_00, payableCents: 400_00 })]);
    expect(position.netCents).toBe(-300_00);
  });

  it('returns a zero position for an empty account list', () => {
    expect(computePosition([])).toEqual({
      availableCents: 0,
      reservedCents: 0,
      payableCents: 0,
      netCents: 0,
      currency: '',
      accounts: [],
    });
  });

  it('sums only payable liability kinds', () => {
    const total = payableLiabilityCents([
      liability({ id: '1', kind: 'committed-award', amountCents: 100_00 }),
      liability({ id: '2', kind: 'scheduled-payment', amountCents: 40_00 }),
      liability({ id: '3', kind: 'recovery-receivable', amountCents: 900_00 }),
    ]);
    expect(total).toBe(140_00);
  });
});

describe('treasury · currency safety', () => {
  it('flags accounts and liabilities denominated in another currency', () => {
    const position = computePosition([
      account({ id: 'a', currency: 'USD' }),
      account({ id: 'b', currency: 'NGN', availableCents: 10_00 }),
    ]);
    const mismatches = detectCurrencyMismatch(position, [
      liability({ id: 'l1', currency: 'USD' }),
      liability({ id: 'l2', currency: 'EUR', amountCents: 5_00 }),
    ]);

    expect(mismatches).toHaveLength(2);
    expect(mismatches.map((m) => m.source).sort()).toEqual(['account', 'liability']);
    expect(mismatches.every((m) => m.expectedCurrency === 'USD')).toBe(true);
  });

  it('raises a currency-mismatch discrepancy and suppresses the variance comparison', () => {
    const position = computePosition([
      account({ id: 'a', currency: 'USD', payableCents: 300_00 }),
      account({ id: 'b', currency: 'EUR', payableCents: 50_00 }),
    ]);
    const discrepancies = collectDiscrepancies(position, [liability()]);

    expect(discrepancies.some((d) => d.kind === 'currency-mismatch')).toBe(true);
    expect(discrepancies.some((d) => d.kind === 'variance')).toBe(false);
  });
});

describe('treasury · drift detection', () => {
  it('is balanced when liabilities agree with recorded payables', () => {
    const run = runReconciliation([account()], [liability()], AS_OF);
    expect(run.status).toBe('balanced');
    expect(run.balanced).toBe(true);
    expect(run.varianceCents).toBe(0);
    expect(run.discrepancies).toHaveLength(0);
  });

  it('detects a variance between the liability book and recorded payables', () => {
    const run = runReconciliation([account({ payableCents: 250_00 })], [liability()], AS_OF);
    const variance = run.discrepancies.find((d) => d.kind === 'variance');

    expect(run.status).toBe('drifted');
    expect(run.balanced).toBe(false);
    expect(variance?.expectedCents).toBe(300_00);
    expect(variance?.actualCents).toBe(250_00);
    expect(variance?.varianceCents).toBe(50_00);
  });

  it('detects an account whose commitments exceed its balance', () => {
    const run = runReconciliation(
      [account({ availableCents: 100_00, reservedCents: 80_00, payableCents: 50_00 }), account({ id: 'b', availableCents: 500_00, payableCents: 0 })],
      [],
      AS_OF
    );
    expect(run.discrepancies.some((d) => d.kind === 'account-mismatch')).toBe(true);
  });

  it('marks a run insolvent when the net position is negative', () => {
    const run = runReconciliation(
      [account({ availableCents: 100_00, payableCents: 900_00 })],
      [],
      AS_OF
    );
    expect(run.status).toBe('insolvent');
    expect(run.position.netCents).toBe(-800_00);
  });

  it('detects an account that vanished since the previous run', () => {
    const first = runReconciliation(
      [account({ id: 'a' }), account({ id: 'b', kind: 'reserve' })],
      [],
      AS_OF
    );
    const second = runReconciliation([account({ id: 'a' })], [], '2026-03-01T00:00:00.000Z', first);
    const missing = second.discrepancies.find((d) => d.kind === 'account-mismatch');

    expect(missing?.description).toContain('b');
    expect(missing?.actualCents).toBe(0);
  });

  it('detects a liability removed from the book without an audit entry', () => {
    const first = runReconciliation([account()], [liability({ id: 'l1' })], AS_OF);
    const second = runReconciliation([account()], [], '2026-03-01T00:00:00.000Z', first);
    const unrecorded = second.discrepancies.find((d) => d.kind === 'unrecorded-liability');

    expect(unrecorded?.expectedCents).toBe(300_00);
    expect(unrecorded?.varianceCents).toBe(-300_00);
  });

  it('detects a stale source account', () => {
    const first = runReconciliation([account({ asOf: '2026-02-10T00:00:00.000Z' })], [], AS_OF);
    const second = runReconciliation([account({ asOf: '2026-01-01T00:00:00.000Z' })], [], '2026-03-01T00:00:00.000Z', first);

    expect(second.discrepancies.some((d) => d.kind === 'stale-source')).toBe(true);
  });
});

describe('treasury · repeatability', () => {
  it('produces an equal run for identical inputs', () => {
    const accounts = [account()];
    const liabilities = [liability()];

    const first = runReconciliation(accounts, liabilities, AS_OF);
    const second = runReconciliation(accounts, liabilities, AS_OF);

    expect(second).toEqual(first);
    expect(second.id).toBe(first.id);
  });

  it('never mutates an earlier run', () => {
    const first = runReconciliation([account()], [liability()], AS_OF);
    const snapshot = JSON.stringify(first);
    const second = runReconciliation([account()], [liability()], '2026-03-01T00:00:00.000Z', first);

    expect(JSON.stringify(first)).toBe(snapshot);
    expect(second.id).not.toBe(first.id);
  });
});

describe('treasury · award gate', () => {
  it('allows new awards when the latest run is balanced', () => {
    const gate = evaluateAwardGate(runReconciliation([account()], [liability()], AS_OF));
    expect(gate.allowed).toBe(true);
    expect(gate.blockingDiscrepancyIds).toHaveLength(0);
  });

  it('blocks new awards while the treasury is insolvent', () => {
    const run = runReconciliation([account({ availableCents: 10_00, payableCents: 900_00 })], [], AS_OF);
    const gate = evaluateAwardGate(run);
    expect(gate.allowed).toBe(false);
    expect(gate.reason).toMatch(/insolvent/i);
  });

  it('blocks new awards while drift is unacknowledged', () => {
    const run = runReconciliation([account({ payableCents: 100_00 })], [liability()], AS_OF);
    const gate = evaluateAwardGate(run);

    expect(run.status).toBe('drifted');
    expect(gate.allowed).toBe(false);
    expect(gate.blockingDiscrepancyIds.length).toBeGreaterThan(0);
  });

  it('blocks new awards while a run is in progress', () => {
    const run: ReconciliationRun = {
      ...runReconciliation([account()], [liability()], AS_OF),
      status: 'running',
    };
    expect(evaluateAwardGate(run).allowed).toBe(false);
  });
});

describe('treasury · acknowledgement preserves history', () => {
  it('returns a new run and leaves the original discrepancies untouched', () => {
    const original = runReconciliation([account({ payableCents: 100_00 })], [liability()], AS_OF);
    const discrepancyId = original.discrepancies[0].id;

    const acknowledged = acknowledgeDiscrepancy(original, discrepancyId, 'finance-user', '2026-02-02T00:00:00.000Z');

    expect(acknowledged).not.toBe(original);
    expect(acknowledged.id).not.toBe(original.id);
    expect(acknowledged.approvedBy).toBe('finance-user');
    expect(acknowledged.approvedAt).toBe('2026-02-02T00:00:00.000Z');
    expect(acknowledged.discrepancies.find((d) => d.id === discrepancyId)?.acknowledgedBy).toBe('finance-user');

    expect(original.discrepancies[0].acknowledgedAt).toBeUndefined();
    expect(unacknowledgedDiscrepancies(original)).toHaveLength(original.discrepancies.length);
  });

  it('clears the award gate once every discrepancy is acknowledged', () => {
    const original = runReconciliation([account({ payableCents: 100_00 })], [liability()], AS_OF);
    let current = original;
    for (const discrepancy of original.discrepancies) {
      current = acknowledgeDiscrepancy(current, discrepancy.id, 'finance-user', '2026-02-02T00:00:00.000Z');
    }

    const gate = evaluateAwardGate(current);
    expect(gate.allowed).toBe(true);
    expect(gate.reason).toMatch(/acknowledged/i);
  });

  it('never unblocks an insolvent treasury', () => {
    const insolvent = runReconciliation([account({ availableCents: 10_00, payableCents: 900_00 })], [], AS_OF);
    const acknowledged = acknowledgeDiscrepancy(insolvent, insolvent.discrepancies[0]?.id ?? 'none', 'finance-user');
    expect(evaluateAwardGate(acknowledged).allowed).toBe(false);
  });

  it('rejects an unknown discrepancy id and a missing actor', () => {
    const run = runReconciliation([account({ payableCents: 100_00 })], [liability()], AS_OF);
    expect(() => acknowledgeDiscrepancy(run, 'nope', 'finance-user')).toThrow(/Unknown discrepancy/);
    expect(() => acknowledgeDiscrepancy(run, run.discrepancies[0].id, '')).toThrow(/actor is required/);
  });
});

describe('treasury · role guard and service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows only finance, sponsor, and administrator roles', () => {
    expect(canOperateTreasury('finance')).toBe(true);
    expect(canOperateTreasury('sponsor')).toBe(true);
    expect(canOperateTreasury('administrator')).toBe(true);
    expect(canOperateTreasury('student')).toBe(false);
    expect(canOperateTreasury('reviewer')).toBe(false);
    expect(canOperateTreasury(undefined)).toBe(false);
  });

  it('talks to the scholarships treasury endpoints via apiClient', async () => {
    const { apiClient } = await import('@/src/lib/api-client');
    const mock = vi.mocked(apiClient);
    mock.get.mockResolvedValueOnce([] as never).mockResolvedValueOnce([] as never).mockResolvedValueOnce([] as never);
    mock.post.mockResolvedValueOnce({ id: 'run-1' } as never);

    await treasuryService.listAccounts('program-1');
    expect(mock.get).toHaveBeenCalledWith('/scholarships/treasury/accounts?programId=program-1');

    await treasuryService.listLiabilities('program-1');
    expect(mock.get).toHaveBeenCalledWith('/scholarships/treasury/liabilities?programId=program-1');

    await treasuryService.listRuns();
    expect(mock.get).toHaveBeenCalledWith('/scholarships/treasury/reconciliation-runs');

    await treasuryService.runReconciliation({ asOf: AS_OF, idempotencyKey: 'k-1' });
    expect(mock.post).toHaveBeenCalledWith('/scholarships/treasury/reconciliation-runs', {
      asOf: AS_OF,
      idempotencyKey: 'k-1',
    });

    await treasuryService.beforeAward({ programId: 'program-1', amountCents: 100_00, currency: 'USD' });
    expect(mock.post).toHaveBeenLastCalledWith('/scholarships/treasury/before-award', {
      programId: 'program-1',
      amountCents: 100_00,
      currency: 'USD',
    });
  });
});
