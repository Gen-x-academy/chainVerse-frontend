import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MINIMUM_REFUND_CENTS,
  authorizeRefund,
  canOperateRefunds,
  canRequestRefund,
  checkSolvency,
  ledgerAfterRefund,
  ledgerNetCents,
  markRefundProcessing,
  refundAuthorityFor,
  refundService,
  reverseEntry,
  settleRefund,
  type SettledRefund,
} from '../refunds/service';
import type { LedgerEntry, RefundRequest } from '../refunds/types';

vi.mock('@/src/lib/api-client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const AT = '2026-02-01T00:00:00.000Z';

function request(overrides: Partial<RefundRequest> = {}): RefundRequest {
  return {
    id: 'ref-1',
    programId: 'program-1',
    sponsorId: 'sponsor-1',
    trigger: 'sponsor-request',
    amountCents: 100_00,
    currency: 'USD',
    assetCode: 'USDC',
    destinationAccountId: 'acct-1',
    status: 'requested',
    requestedBy: 'sponsor-1',
    requestedAt: AT,
    reason: 'Program closed with funds unspent.',
    clientToken: 'token-1',
    ...overrides,
  };
}

function entry(overrides: Partial<LedgerEntry> = {}): LedgerEntry {
  return {
    id: 'led-1',
    entryType: 'debit',
    amountCents: 100_00,
    currency: 'USD',
    programId: 'program-1',
    memo: 'Disbursement to recipient.',
    occurredAt: AT,
    ...overrides,
  };
}

describe('refunds · authority matrix', () => {
  it('grants authority to sponsor, finance, and administrator only', () => {
    expect(refundAuthorityFor('sponsor')).toBe('sponsor');
    expect(refundAuthorityFor('finance')).toBe('finance');
    expect(refundAuthorityFor('administrator')).toBe('administrator');
  });

  it('never grants authority to a student or a reviewer', () => {
    expect(refundAuthorityFor('student')).toBe('none');
    expect(refundAuthorityFor('reviewer')).toBe('none');
    expect(refundAuthorityFor('')).toBe('none');
    expect(refundAuthorityFor(undefined)).toBe('none');
  });

  it('ignores any authority claimed by the client', () => {
    const forged = request({ status: 'authorized', authorizedBy: 'someone' });
    expect(refundAuthorityFor('student')).toBe('none');
    expect(canRequestRefund(forged, 'student', 'program-1', forged.sponsorId)).toBe(false);
  });

  it('lets a sponsor request a refund of their own program', () => {
    expect(canRequestRefund(request(), 'sponsor', 'program-1', 'sponsor-1')).toBe(true);
  });

  it('refuses a sponsor refund for another program or another sponsor', () => {
    expect(canRequestRefund(request(), 'sponsor', 'program-2', 'sponsor-1')).toBe(false);
    expect(canRequestRefund(request(), 'sponsor', 'program-1', 'sponsor-2')).toBe(false);
  });

  it('lets finance and administrators act on any program', () => {
    expect(canRequestRefund(request(), 'finance', 'program-2')).toBe(true);
    expect(canRequestRefund(request(), 'administrator', 'program-2')).toBe(true);
  });

  it('refuses a refund below the minimum', () => {
    expect(canRequestRefund(request({ amountCents: MINIMUM_REFUND_CENTS - 1 }), 'finance')).toBe(false);
    expect(canRequestRefund(request({ amountCents: 10.5 }), 'finance')).toBe(false);
  });

  it('limits the refund surface itself to the three operational roles', () => {
    expect(canOperateRefunds('sponsor')).toBe(true);
    expect(canOperateRefunds('finance')).toBe(true);
    expect(canOperateRefunds('administrator')).toBe(true);
    expect(canOperateRefunds('reviewer')).toBe(false);
    expect(canOperateRefunds(undefined)).toBe(false);
  });
});

describe('refunds · solvency', () => {
  it('is solvent when pending refunds fit in the free balance', () => {
    const check = checkSolvency(
      { availableCents: 500_00, payableCents: 200_00, currency: 'USD' },
      [request()]
    );
    expect(check.solvent).toBe(true);
    expect(check.shortfallCents).toBe(0);
    expect(check.availableCents).toBe(500_00);
    expect(check.payableCents).toBe(200_00);
    expect(check.currency).toBe('USD');
  });

  it('blocks a refund that would exceed the free balance', () => {
    const check = checkSolvency(
      { availableCents: 250_00, payableCents: 200_00, currency: 'USD' },
      [request({ amountCents: 100_00 })]
    );
    expect(check.solvent).toBe(false);
    expect(check.shortfallCents).toBe(50_00);
  });

  it('sums several pending refunds before deciding', () => {
    const check = checkSolvency(
      { availableCents: 300_00, payableCents: 0, currency: 'USD' },
      [
        request({ id: 'a', amountCents: 200_00, status: 'requested' }),
        request({ id: 'b', amountCents: 150_00, status: 'authorized' }),
      ]
    );
    expect(check.solvent).toBe(false);
    expect(check.shortfallCents).toBe(50_00);
  });

  it('ignores settled, rejected, and reversed refunds', () => {
    const check = checkSolvency(
      { availableCents: 0, payableCents: 0, currency: 'USD' },
      [
        request({ id: 'a', status: 'settled' }),
        request({ id: 'b', status: 'rejected' }),
        request({ id: 'c', status: 'reversed' }),
      ]
    );
    expect(check.solvent).toBe(true);
    expect(check.shortfallCents).toBe(0);
  });

  it('never counts a refund in another currency', () => {
    const check = checkSolvency(
      { availableCents: 0, payableCents: 0, currency: 'USD' },
      [request({ currency: 'NGN' })]
    );
    expect(check.solvent).toBe(true);
  });

  it('blocks settlement of an authorized refund that would break the treasury', () => {
    const processing = { ...request(), status: 'processing' as const };
    expect(() =>
      settleRefund(processing, AT, { availableCents: 50_00, payableCents: 0, currency: 'USD' })
    ).toThrow(/shortfall/i);
  });
});

describe('refunds · status transitions', () => {
  it('authorizes a requested refund with a named authorizer and a reason', () => {
    const authorized = authorizeRefund(request(), 'finance-user', AT);
    expect(authorized.status).toBe('authorized');
    expect(authorized.authorizedBy).toBe('finance-user');
    expect(authorized.authorizedAt).toBe(AT);
  });

  it('refuses to authorize without an authorizer or a reason', () => {
    expect(() => authorizeRefund(request(), '  ', AT)).toThrow(/named authorizer is required/i);
    expect(() => authorizeRefund(request({ reason: '' }), 'finance-user', AT)).toThrow(
      /documented reason is required/i
    );
  });

  it('refuses to authorize a refund that is not in requested state', () => {
    expect(() => authorizeRefund(request({ status: 'settled' }), 'finance-user', AT)).toThrow(
      /cannot be authorized/i
    );
  });

  it('never mutates the request it was given', () => {
    const original = request();
    authorizeRefund(original, 'finance-user', AT);
    expect(original.status).toBe('requested');
    expect(original.authorizedBy).toBeUndefined();
  });

  it('walks requested → authorized → processing → settled', () => {
    const authorized = authorizeRefund(request(), 'finance-user', AT);
    const processing = markRefundProcessing(authorized);
    const settled = settleRefund(processing, AT);

    expect(authorized.status).toBe('authorized');
    expect(processing.status).toBe('processing');
    expect(settled.status).toBe('settled');
    expect(settled.settledAt).toBe(AT);
  });

  it('refuses to skip states', () => {
    expect(() => markRefundProcessing(request())).toThrow(/Only an authorized refund/i);
    expect(() => settleRefund(request(), AT)).toThrow(/requested refund cannot be settled/i);
    expect(() =>
      settleRefund(authorizeRefund(request(), 'finance-user', AT), AT)
    ).toThrow(/authorized refund cannot be settled/i);
  });
});

describe('refunds · reversal, never deletion', () => {
  it('builds a reversal with the opposite entry type', () => {
    const reversal = reverseEntry(entry(), 'Returned by the sponsor.', AT);
    expect(reversal.entryType).toBe('credit');
    expect(reversal.amountCents).toBe(100_00);
    expect(reversal.currency).toBe('USD');
    expect(reversal.reversesEntryId).toBe('led-1');
    expect(reversal.ledgerEntryId).toBe('led-led-1-rev');
    expect(reversal.memo).toBe('Returned by the sponsor.');
  });

  it('reverses a credit back to a debit', () => {
    expect(reverseEntry(entry({ entryType: 'credit' }), 'memo', AT).entryType).toBe('debit');
  });

  it('requires a memo', () => {
    expect(() => reverseEntry(entry(), '  ', AT)).toThrow(/documented memo is required/i);
  });

  it('refuses to reverse a reversal', () => {
    const reversal = reverseEntry(entry(), 'memo', AT);
    expect(() =>
      reverseEntry(
        { ...entry(), id: reversal.id, reversesEntryId: reversal.reversesEntryId },
        'memo',
        AT
      )
    ).toThrow(/cannot itself be reversed/i);
  });

  it('keeps the original entry alongside its reversal in the ledger', () => {
    const original = entry();
    const settled: SettledRefund = {
      ...settleRefund({ ...request(), status: 'processing' }, AT),
      originalEntryId: 'led-1',
    };

    const next = ledgerAfterRefund([original], settled);

    expect(next).toHaveLength(2);
    expect(next[0]).toEqual(original);
    expect(next[1].reversesEntryId).toBe('led-1');
    expect(ledgerNetCents(next)).toBe(0);
  });

  it('does not mutate the ledger it was given', () => {
    const entries = [entry()];
    const snapshot = JSON.stringify(entries);
    const settled: SettledRefund = {
      ...settleRefund({ ...request(), status: 'processing' }, AT),
      originalEntryId: 'led-1',
    };
    ledgerAfterRefund(entries, settled);
    expect(JSON.stringify(entries)).toBe(snapshot);
  });

  it('refuses a reversal for an entry that is not on the ledger', () => {
    const settled: SettledRefund = {
      ...settleRefund({ ...request(), status: 'processing' }, AT),
      originalEntryId: 'led-missing',
    };
    expect(() => ledgerAfterRefund([entry()], settled)).toThrow(/is not on the ledger/i);
  });

  it('never converts currency or changes the amount on a reversal', () => {
    const settled: SettledRefund = {
      ...settleRefund({ ...request({ amountCents: 100_00 }), status: 'processing' }, AT),
      originalEntryId: 'led-1',
    };
    expect(() => ledgerAfterRefund([entry()], settled, 'memo')).not.toThrow();
    expect(() => ledgerAfterRefund([entry()], { ...settled, currency: 'NGN' })).toThrow(
      /never converted/i
    );
    expect(() => ledgerAfterRefund([entry()], { ...settled, amountCents: 5_00 })).toThrow(
      /must equal the amount/i
    );
  });
});

describe('refunds · service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('talks to the scholarships refunds endpoints via apiClient', async () => {
    const { apiClient } = await import('@/src/lib/api-client');
    const mock = vi.mocked(apiClient);
    mock.get.mockResolvedValue([] as never);
    mock.post.mockResolvedValue({ id: 'ref-1' } as never);
    mock.patch.mockResolvedValue({ id: 'ref-1' } as never);

    await refundService.listRequests('program-1');
    expect(mock.get).toHaveBeenCalledWith('/scholarships/refunds?programId=program-1');

    await refundService.listLedger('program-1');
    expect(mock.get).toHaveBeenCalledWith('/scholarships/refunds/ledger?programId=program-1');

    await refundService.checkSolvency('program-1');
    expect(mock.get).toHaveBeenCalledWith('/scholarships/refunds/solvency?programId=program-1');

    await refundService.request({ ...request(), idempotencyKey: 'k-1' });
    expect(mock.post).toHaveBeenCalledWith('/scholarships/refunds', { ...request(), idempotencyKey: 'k-1' });

    await refundService.settle('ref-1', { idempotencyKey: 'k-2' });
    expect(mock.post).toHaveBeenCalledWith('/scholarships/refunds/ref-1/settlement', {
      idempotencyKey: 'k-2',
    });

    await refundService.reverse('ref-1', { memo: 'returned', originalEntryId: 'led-1' });
    expect(mock.post).toHaveBeenCalledWith('/scholarships/refunds/ref-1/reversal', {
      memo: 'returned',
      originalEntryId: 'led-1',
    });

    await refundService.authorize('ref-1', {
      authorizedBy: 'finance-user',
      reason: 'because',
      expectedStatus: 'requested',
    });
    expect(mock.patch).toHaveBeenCalledWith('/scholarships/refunds/ref-1', {
      authorizedBy: 'finance-user',
      reason: 'because',
      expectedStatus: 'requested',
    });
  });
});
