import { describe, expect, it, vi } from 'vitest';
import {
  canIssueInstruction,
  effectiveCollections,
  isReversalOnly,
  issueInstruction,
  outstandingCents,
  reconcileClaim,
  reconcileClaimRecord,
  reverseCollection,
  recoveryService,
} from '../recovery/service';
import type { RecoveryClaim, RecoveryCollection } from '../recovery/types';

vi.mock('@/src/lib/api-client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const APPROVED: RecoveryClaim = {
  id: 'claim-1',
  awardId: 'award-1',
  studentId: 'student-1',
  programId: 'program-1',
  amountCents: 250_000,
  currency: 'USD',
  reason: 'milestone-failure',
  legalBasis: 'program-terms',
  status: 'approved',
  requestedCents: 250_000,
  collectedCents: 100_000,
  requestedAt: '2026-01-05T00:00:00.000Z',
  approvedBy: 'finance-1',
  approvedAt: '2026-01-06T00:00:00.000Z',
};

const collection = (overrides: Partial<RecoveryCollection> = {}): RecoveryCollection => ({
  id: 'col-1',
  claimId: 'claim-1',
  amountCents: 100_000,
  currency: 'USD',
  ledgerEntryId: 'ledger-1',
  collectedAt: '2026-02-01T00:00:00.000Z',
  reversed: false,
  ...overrides,
});

describe('outstandingCents', () => {
  it('is requested minus collected', () => {
    expect(outstandingCents(APPROVED)).toBe(150_000);
  });

  it('never goes negative when collections exceed the request', () => {
    expect(outstandingCents({ ...APPROVED, collectedCents: 300_000 })).toBe(0);
  });
});

describe('canIssueInstruction', () => {
  it('allows an approved claim with a legal basis and an outstanding balance', () => {
    expect(canIssueInstruction(APPROVED)).toEqual({ allowed: true, reasons: [] });
  });

  it('blocks a claim with no legal basis', () => {
    const decision = canIssueInstruction({ ...APPROVED, legalBasis: 'none' });
    expect(decision.allowed).toBe(false);
    expect(decision.reasons.join(' ')).toMatch(/no legal basis/i);
  });

  it('blocks a claim that has not been approved', () => {
    const decision = canIssueInstruction({ ...APPROVED, status: 'under-review' });
    expect(decision.allowed).toBe(false);
    expect(decision.reasons.join(' ')).toMatch(/approved/i);
  });

  it('blocks a claim with nothing outstanding', () => {
    const decision = canIssueInstruction({ ...APPROVED, collectedCents: APPROVED.requestedCents });
    expect(decision.allowed).toBe(false);
    expect(decision.reasons.join(' ')).toMatch(/nothing outstanding/i);
  });

  it('reports every blocker at once', () => {
    const decision = canIssueInstruction({
      ...APPROVED,
      legalBasis: 'none',
      status: 'requested',
      collectedCents: APPROVED.requestedCents,
    });
    expect(decision.reasons).toHaveLength(3);
  });
});

describe('issueInstruction', () => {
  const input = {
    amountCents: 150_000,
    currency: 'USD',
    requiresStudentConsent: true,
    authorizationId: 'auth-1',
    issuedAt: '2026-03-01T00:00:00.000Z',
  };

  it('issues an instruction carrying the authorization id', () => {
    const result = issueInstruction(APPROVED, input);
    expect('instruction' in result).toBe(true);
    if (!('instruction' in result)) throw new Error('expected an instruction');
    expect(result.instruction).toEqual({
      claimId: 'claim-1',
      amountCents: 150_000,
      currency: 'USD',
      requiresStudentConsent: true,
      authorizationId: 'auth-1',
      reason: 'milestone-failure',
      issuedAt: '2026-03-01T00:00:00.000Z',
    });
  });

  it('refuses without an authorization id', () => {
    const result = issueInstruction(APPROVED, { ...input, authorizationId: '   ' });
    expect('error' in result).toBe(true);
    if (!('error' in result)) throw new Error('expected an error');
    expect(result.error).toMatch(/authorization id is required/i);
  });

  it('refuses when the claim is not approved', () => {
    const result = issueInstruction({ ...APPROVED, status: 'requested' }, input);
    expect('error' in result).toBe(true);
  });

  it('refuses more than the outstanding balance', () => {
    const result = issueInstruction(APPROVED, { ...input, amountCents: 150_001 });
    expect('error' in result).toBe(true);
    if (!('error' in result)) throw new Error('expected an error');
    expect(result.error).toMatch(/exceeds/i);
  });

  it('refuses a mismatched currency', () => {
    const result = issueInstruction(APPROVED, { ...input, currency: 'EUR' });
    expect('error' in result).toBe(true);
    if (!('error' in result)) throw new Error('expected an error');
    expect(result.error).toMatch(/currency mismatch/i);
  });
});

describe('reconcileClaim', () => {
  it('balances when the collections match the claim', () => {
    expect(reconcileClaim(APPROVED, [collection()])).toEqual({
      claimId: 'claim-1',
      requestedCents: 250_000,
      collectedCents: 100_000,
      outstandingCents: 150_000,
      reconciles: true,
      discrepancyCents: 0,
    });
  });

  it('reports a discrepancy when a collection is missing from the claim', () => {
    const report = reconcileClaim({ ...APPROVED, collectedCents: 0 }, [collection()]);
    expect(report.reconciles).toBe(false);
    expect(report.discrepancyCents).toBe(100_000);
    expect(report.outstandingCents).toBe(250_000);
  });

  it('ignores reversed collections when totalling', () => {
    const report = reconcileClaim(APPROVED, [collection({ reversed: true })]);
    expect(report.reconciles).toBe(false);
    expect(report.discrepancyCents).toBe(-100_000);
  });

  it('nets a reversal pair back to zero', () => {
    const report = reconcileClaim(
      { ...APPROVED, collectedCents: 0 },
      [
        collection({ reversed: true }),
        collection({ id: 'col-1-reversal', ledgerEntryId: 'ledger-1-reversal', reversesCollectionId: 'col-1' }),
      ]
    );
    expect(report.discrepancyCents).toBe(0);
    expect(report.reconciles).toBe(true);
    expect(report.outstandingCents).toBe(250_000);
  });
});

describe('reconcileClaimRecord', () => {
  it('balances a partially collected claim', () => {
    expect(reconcileClaimRecord(APPROVED)).toEqual({
      claimId: 'claim-1',
      requestedCents: 250_000,
      collectedCents: 100_000,
      outstandingCents: 150_000,
      reconciles: true,
      discrepancyCents: 0,
    });
  });

  it('reports an over-collection as a discrepancy', () => {
    const report = reconcileClaimRecord({ ...APPROVED, collectedCents: 275_000 });
    expect(report.reconciles).toBe(false);
    expect(report.discrepancyCents).toBe(25_000);
    expect(report.outstandingCents).toBe(0);
  });
});

describe('reverseCollection', () => {
  it('appends a reversing entry without deleting the original collection', () => {
    const claim = { ...APPROVED, collections: [collection()] };
    const result = reverseCollection(claim, claim.collections[0], '2026-03-02T00:00:00.000Z');

    if (!('claim' in result)) throw new Error('expected a reversed claim');
    expect(result.claim.collections).toHaveLength(2);
    expect(result.claim.collections?.[0]).toMatchObject({ id: 'col-1', reversed: true });
    expect(result.reversingEntry.reversesCollectionId).toBe('col-1');
    // gross collected is untouched; only the net effect changes
    expect(result.claim.collectedCents).toBe(APPROVED.collectedCents);
  });

  it('does not mutate the claim it was given', () => {
    const claim = { ...APPROVED, collections: [collection()] };
    reverseCollection(claim, claim.collections[0], '2026-03-02T00:00:00.000Z');
    expect(claim.collections).toHaveLength(1);
    expect(claim.collections?.[0].reversed).toBe(false);
  });

  it('marks the claim reversed only when every collection is reversed', () => {
    const claim = { ...APPROVED, collections: [collection()] };
    const result = reverseCollection(claim, claim.collections[0], '2026-03-02T00:00:00.000Z');
    if (!('claim' in result)) throw new Error('expected a reversed claim');
    expect(result.claim.status).toBe('reversed');
    expect(isReversalOnly(result.claim)).toBe(true);
    expect(effectiveCollections(result.claim)).toHaveLength(0);
  });

  it('refuses to reverse the same collection twice', () => {
    const claim = { ...APPROVED, collections: [collection({ reversed: true })] };
    const result = reverseCollection(claim, claim.collections[0], '2026-03-02T00:00:00.000Z');
    expect('error' in result).toBe(true);
  });

  it('is not reversal-only when collections are still in force', () => {
    expect(isReversalOnly({ ...APPROVED, collections: [collection()] })).toBe(false);
  });
});

describe('recoveryService', () => {
  it('posts an instruction with the authorization id', async () => {
    const { apiClient } = await import('@/src/lib/api-client');
    const instruction = { claimId: 'claim-1', amountCents: 1, currency: 'USD', requiresStudentConsent: false, authorizationId: 'auth-1', reason: 'fraud' as const, issuedAt: '2026-03-01T00:00:00.000Z' };
    vi.mocked(apiClient.post).mockResolvedValue(instruction);

    await expect(recoveryService.issueInstruction('claim-1', {
      amountCents: 1,
      currency: 'USD',
      requiresStudentConsent: false,
      authorizationId: 'auth-1',
      issuedAt: '2026-03-01T00:00:00.000Z',
    })).resolves.toBe(instruction);

    expect(apiClient.post).toHaveBeenCalledWith(
      '/scholarships/recovery/claims/claim-1/instructions',
      expect.objectContaining({ authorizationId: 'auth-1' })
    );
  });
});
