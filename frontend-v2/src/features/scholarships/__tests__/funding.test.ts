import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MINIMUM_DEPOSIT_CENTS,
  applyReallocation,
  authorizeReallocation,
  canFundRound,
  canOperateFunding,
  detectDuplicate,
  fundingService,
  recordDeposit,
  rejectReallocation,
  roundProgress,
  validateDeposit,
} from '../funding/service';
import {
  EXPECTED_SOURCE_ACCOUNT_ID,
  type Deposit,
  type DepositDraft,
  type FundingRound,
  type ReallocationRequest,
} from '../funding/types';

vi.mock('@/src/lib/api-client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const RECORDED_AT = '2026-02-01T00:00:00.000Z';

function draft(overrides: Partial<DepositDraft> = {}): DepositDraft {
  return {
    sponsorId: 'sponsor-1',
    allocation: 'specific-program',
    programId: 'program-1',
    amountCents: 500_00,
    currency: 'USD',
    assetCode: 'USDC',
    issuer: 'circle',
    sourceAccountId: EXPECTED_SOURCE_ACCOUNT_ID,
    reference: 'ref-001',
    clientToken: 'token-001',
    ...overrides,
  };
}

function deposit(overrides: Partial<Deposit> = {}): Deposit {
  return {
    id: 'dep-1',
    sponsorId: 'sponsor-1',
    allocation: 'specific-program',
    programId: 'program-1',
    amountCents: 500_00,
    currency: 'USD',
    asset: {
      assetCode: 'USDC',
      issuer: 'circle',
      sourceAccountId: EXPECTED_SOURCE_ACCOUNT_ID,
      verifiedAt: '2026-01-01T00:00:00.000Z',
    },
    reference: 'ref-001',
    status: 'credited',
    recordedAt: RECORDED_AT,
    creditedAt: RECORDED_AT,
    clientToken: 'token-001',
    ...overrides,
  };
}

function round(overrides: Partial<FundingRound> = {}): FundingRound {
  return {
    id: 'round-1',
    name: 'Spring round',
    programId: 'program-1',
    currency: 'USD',
    targetCents: 1_000_00,
    committedCents: 400_00,
    opensAt: '2026-01-01T00:00:00.000Z',
    closesAt: '2026-06-01T00:00:00.000Z',
    status: 'open',
    ...overrides,
  };
}

function reallocation(overrides: Partial<ReallocationRequest> = {}): ReallocationRequest {
  return {
    id: 'rea-1',
    depositId: 'dep-1',
    fromProgramId: 'program-1',
    toProgramId: 'program-2',
    amountCents: 100_00,
    currency: 'USD',
    status: 'requested',
    requestedBy: 'sponsor-1',
    requestedAt: RECORDED_AT,
    reason: 'Sponsor redirected funding to the engineering programme.',
    ...overrides,
  };
}

describe('funding · duplicate detection', () => {
  it('matches an existing deposit by reference', () => {
    const found = detectDuplicate([deposit()], draft({ reference: 'ref-001', clientToken: 'token-999' }));
    expect(found?.id).toBe('dep-1');
  });

  it('matches an existing deposit by client token', () => {
    const found = detectDuplicate([deposit()], draft({ reference: 'ref-999', clientToken: 'token-001' }));
    expect(found?.id).toBe('dep-1');
  });

  it('returns null when neither key matches', () => {
    expect(detectDuplicate([deposit()], draft({ reference: 'ref-999', clientToken: 'token-999' }))).toBeNull();
  });

  it('returns null against an empty ledger', () => {
    expect(detectDuplicate([], draft())).toBeNull();
  });
});

describe('funding · deposit validation', () => {
  it('accepts a well-formed deposit above the minimum', () => {
    const result = validateDeposit(draft(), [deposit({ reference: 'other', clientToken: 'other' })], [round()]);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects a duplicate reference with a duplicate-reference code', () => {
    const result = validateDeposit(draft(), [deposit()], []);
    const duplicate = result.errors.find((item) => item.field === 'reference');
    expect(result.valid).toBe(false);
    expect(duplicate?.code).toBe('duplicate-reference');
  });

  it('rejects a deposit below the minimum', () => {
    expect(MINIMUM_DEPOSIT_CENTS).toBe(10_000);
    const result = validateDeposit(draft({ amountCents: MINIMUM_DEPOSIT_CENTS - 1 }), [], []);
    const error = result.errors.find((item) => item.field === 'amountCents');
    expect(error?.code).toBe('below-minimum');
  });

  it('rejects an unknown asset', () => {
    const result = validateDeposit(draft({ assetCode: 'XYZ' }), [], []);
    expect(result.errors.find((item) => item.field === 'assetCode')?.code).toBe('unknown-asset');
  });

  it('rejects a deposit from an unverified source account', () => {
    const result = validateDeposit(draft({ sourceAccountId: 'somebody-elses-wallet' }), [], []);
    expect(result.errors.find((item) => item.field === 'sourceAccountId')?.code).toBe('source-mismatch');
  });

  it('rejects a specific-program deposit with no program', () => {
    const result = validateDeposit(draft({ programId: '' }), [], []);
    expect(result.errors.find((item) => item.field === 'programId')?.code).toBe('source-mismatch');
  });

  it('rejects a deposit that exceeds the round target', () => {
    const result = validateDeposit(draft({ amountCents: 900_00 }), [], [round()]);
    expect(result.errors.find((item) => item.field === 'amountCents')?.code).toBe('amount-exceeds-target');
  });

  it('rejects a deposit into a closed round', () => {
    const result = validateDeposit(draft(), [], [round({ status: 'closed' })]);
    expect(result.errors.find((item) => item.field === 'programId')?.code).toBe('round-closed');
  });

  it('rejects a deposit with a missing client token', () => {
    const result = validateDeposit(draft({ clientToken: '' }), [], []);
    expect(result.errors.some((item) => item.field === 'clientToken')).toBe(true);
  });
});

describe('funding · recordDeposit', () => {
  it('records a deposit in recorded state with both asset and source bound', () => {
    const recorded = recordDeposit(draft(), [], [round()], RECORDED_AT);

    expect(recorded.status).toBe('recorded');
    expect(recorded.creditedAt).toBeUndefined();
    expect(recorded.amountCents).toBe(500_00);
    expect(recorded.currency).toBe('USD');
    expect(recorded.asset.assetCode).toBe('USDC');
    expect(recorded.asset.sourceAccountId).toBe(EXPECTED_SOURCE_ACCOUNT_ID);
    expect(recorded.asset.verifiedAt).toBe(RECORDED_AT);
    expect(recorded.programId).toBe('program-1');
  });

  it('drops the program for an unrestricted-pool deposit', () => {
    const recorded = recordDeposit(
      draft({ allocation: 'unrestricted-pool', programId: 'program-1' }),
      [],
      [],
      RECORDED_AT
    );
    expect(recorded.programId).toBeUndefined();
  });

  it('throws rather than crediting a duplicate twice', () => {
    expect(() => recordDeposit(draft(), [deposit()], [], RECORDED_AT)).toThrow(/already been recorded/i);
  });

  it('is idempotent in the sense that the same key can never produce two records', () => {
    const first = recordDeposit(draft(), [], [], RECORDED_AT);
    expect(() => recordDeposit(draft(), [first], [], RECORDED_AT)).toThrow();
  });
});

describe('funding · reallocation authorization', () => {
  it('authorizes when the authorizer is distinct and a reason is present', () => {
    const authorized = authorizeReallocation(reallocation(), 'finance-user', RECORDED_AT);
    expect(authorized.status).toBe('authorized');
    expect(authorized.authorizedBy).toBe('finance-user');
    expect(authorized.authorizedAt).toBe(RECORDED_AT);
  });

  it('rejects an authorizer who is the requester', () => {
    expect(() => authorizeReallocation(reallocation(), 'sponsor-1', RECORDED_AT)).toThrow(
      /cannot be authorized by the person who requested it/i
    );
  });

  it('rejects a missing authorizer', () => {
    expect(() => authorizeReallocation(reallocation(), '  ', RECORDED_AT)).toThrow(/named authorizer is required/i);
  });

  it('rejects a missing reason', () => {
    expect(() => authorizeReallocation(reallocation({ reason: '' }), 'finance-user', RECORDED_AT)).toThrow(
      /documented reason is required/i
    );
  });

  it('cannot authorize an already authorized request again', () => {
    const authorized = authorizeReallocation(reallocation(), 'finance-user', RECORDED_AT);
    expect(() => authorizeReallocation(authorized, 'admin-user', RECORDED_AT)).toThrow(/cannot be authorized again/i);
  });

  it('leaves the original request untouched', () => {
    const original = reallocation();
    authorizeReallocation(original, 'finance-user', RECORDED_AT);
    expect(original.status).toBe('requested');
    expect(original.authorizedBy).toBeUndefined();
  });

  it('rejects a reallocation with a documented reason', () => {
    const rejected = rejectReallocation(reallocation(), 'finance-user', RECORDED_AT);
    expect(rejected.status).toBe('rejected');
  });

  it('applies only an authorized reallocation and never converts currency', () => {
    const authorized = authorizeReallocation(reallocation(), 'finance-user', RECORDED_AT);
    const { request, deposit: next } = applyReallocation(authorized, deposit(), RECORDED_AT);
    expect(request.status).toBe('applied');
    expect(next.programId).toBe('program-2');

    expect(() => applyReallocation(reallocation(), deposit(), RECORDED_AT)).toThrow(/authorized/i);
    expect(() => applyReallocation(authorized, deposit({ currency: 'NGN' }), RECORDED_AT)).toThrow(
      /never converted/i
    );
  });
});

describe('funding · rounds', () => {
  it('reports progress against the target', () => {
    const progress = roundProgress(round());
    expect(progress.committedCents).toBe(400_00);
    expect(progress.targetCents).toBe(1_000_00);
    expect(progress.remainingCents).toBe(600_00);
    expect(progress.percent).toBe(40);
    expect(progress.funded).toBe(false);
  });

  it('reports a fully funded round', () => {
    const progress = roundProgress(round({ committedCents: 1_000_00 }));
    expect(progress.percent).toBe(100);
    expect(progress.funded).toBe(true);
  });

  it('caps a fully funded round at 100 percent', () => {
    expect(roundProgress(round({ committedCents: 1_200_00 })).percent).toBe(100);
  });

  it('funds only while a round is open and within target', () => {
    expect(canFundRound(round(), 600_00)).toBe(true);
    expect(canFundRound(round(), 600_01)).toBe(false);
    expect(canFundRound(round({ status: 'draft' }), 100_00)).toBe(false);
    expect(canFundRound(round({ status: 'closed' }), 100_00)).toBe(false);
    expect(canFundRound(round(), MINIMUM_DEPOSIT_CENTS - 1)).toBe(false);
  });
});

describe('funding · roles and service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows only sponsor, finance, and administrator roles', () => {
    expect(canOperateFunding('sponsor')).toBe(true);
    expect(canOperateFunding('finance')).toBe(true);
    expect(canOperateFunding('administrator')).toBe(true);
    expect(canOperateFunding('student')).toBe(false);
    expect(canOperateFunding('reviewer')).toBe(false);
    expect(canOperateFunding(undefined)).toBe(false);
  });

  it('talks to the scholarships funding endpoints via apiClient', async () => {
    const { apiClient } = await import('@/src/lib/api-client');
    const mock = vi.mocked(apiClient);
    mock.get.mockResolvedValue([] as never);
    mock.post.mockResolvedValue({ id: 'dep-1' } as never);
    mock.patch.mockResolvedValue({ id: 'rea-1' } as never);

    await fundingService.listDeposits('sponsor-1');
    expect(mock.get).toHaveBeenCalledWith('/scholarships/funding/deposits?sponsorId=sponsor-1');

    await fundingService.listRounds();
    expect(mock.get).toHaveBeenCalledWith('/scholarships/funding/rounds');

    await fundingService.listReallocations('dep-1');
    expect(mock.get).toHaveBeenCalledWith('/scholarships/funding/reallocations?depositId=dep-1');

    await fundingService.recordDeposit({ ...draft(), idempotencyKey: 'k-1' });
    expect(mock.post).toHaveBeenCalledWith('/scholarships/funding/deposits', {
      ...draft(),
      idempotencyKey: 'k-1',
    });

    await fundingService.creditDeposit('dep-1', { idempotencyKey: 'k-2' });
    expect(mock.post).toHaveBeenCalledWith('/scholarships/funding/deposits/dep-1/credit', {
      idempotencyKey: 'k-2',
    });

    await fundingService.authorizeReallocation('rea-1', {
      authorizedBy: 'finance-user',
      reason: 'because',
      expectedStatus: 'requested',
    });
    expect(mock.patch).toHaveBeenCalledWith('/scholarships/funding/reallocations/rea-1', {
      authorizedBy: 'finance-user',
      reason: 'because',
      expectedStatus: 'requested',
    });
  });
});
