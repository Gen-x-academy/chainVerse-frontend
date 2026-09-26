import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  activeSchedule,
  applyBasisPoints,
  assertQuoteBalanced,
  canManageFees,
  createDraftVersion,
  divideWithRounding,
  feeService,
  nextScheduleVersion,
  quoteFees,
  splitFeeRevenue,
  supersedeSchedule,
} from '../fees/service';
import type { FeeComponent, FeeQuote, FeeScheduleVersion, RoundingMode } from '../fees/types';

vi.mock('@/src/lib/api-client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const QUOTED_AT = '2026-02-01T00:00:00.000Z';

function component(overrides: Partial<FeeComponent> = {}): FeeComponent {
  return {
    id: 'fee-1',
    name: 'Platform fee',
    kind: 'platform',
    basis: 'gross-amount',
    rateBps: 250,
    flatCents: 0,
    currency: 'USD',
    ...overrides,
  };
}

function version(overrides: Partial<FeeScheduleVersion> = {}): FeeScheduleVersion {
  return {
    version: 'v1.0.0',
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    components: [component()],
    createdBy: 'finance-user',
    createdAt: '2025-12-01T00:00:00.000Z',
    status: 'active',
    ...overrides,
  };
}

const TWO_COMPONENT_SCHEDULE = version({
  components: [
    component({ id: 'p', name: 'Platform fee', kind: 'platform', basis: 'gross-amount', rateBps: 250 }),
    component({ id: 'n', name: 'Network fee', kind: 'network', basis: 'gross-amount', rateBps: 50 }),
  ],
});

describe('fees · integer rounding', () => {
  it('rounds a plain quotient up when the remainder is above half', () => {
    expect(divideWithRounding(5, 2, 'half-up')).toBe(3);
    expect(divideWithRounding(5, 2, 'down')).toBe(2);
  });

  it('rounds exact halves to even for half-even', () => {
    expect(divideWithRounding(1, 2, 'half-even')).toBe(0);
    expect(divideWithRounding(3, 2, 'half-even')).toBe(2);
    expect(divideWithRounding(5, 2, 'half-even')).toBe(2);
    expect(divideWithRounding(7, 2, 'half-even')).toBe(4);
    expect(divideWithRounding(9, 2, 'half-even')).toBe(4);
  });

  it('rounds exact halves away from zero for half-up', () => {
    expect(divideWithRounding(1, 2, 'half-up')).toBe(1);
    expect(divideWithRounding(3, 2, 'half-up')).toBe(2);
    expect(divideWithRounding(5, 2, 'half-up')).toBe(3);
  });

  it('rounds exact halves toward zero for down', () => {
    expect(divideWithRounding(1, 2, 'down')).toBe(0);
    expect(divideWithRounding(5, 2, 'down')).toBe(2);
  });

  it('handles negative numerators symmetrically', () => {
    expect(divideWithRounding(-5, 2, 'half-even')).toBe(-2);
    expect(divideWithRounding(-5, 2, 'half-up')).toBe(-3);
    expect(divideWithRounding(-5, 2, 'down')).toBe(-2);
  });

  it('rejects a zero denominator', () => {
    expect(() => divideWithRounding(1, 0, 'half-up')).toThrow(/divide by zero/i);
  });

  it('applies basis points exactly at a half-even boundary', () => {
    // 1 bps of 5000 cents is exactly 0.5 cents.
    expect(applyBasisPoints(5_000, 1, 'half-even')).toBe(0);
    expect(applyBasisPoints(5_000, 1, 'half-up')).toBe(1);
    expect(applyBasisPoints(5_000, 1, 'down')).toBe(0);
    // 1 bps of 15000 cents is exactly 1.5 cents.
    expect(applyBasisPoints(15_000, 1, 'half-even')).toBe(2);
    expect(applyBasisPoints(15_000, 1, 'half-up')).toBe(2);
    // 1 bps of 25000 cents is exactly 2.5 cents → half-even picks the even 2.
    expect(applyBasisPoints(25_000, 1, 'half-even')).toBe(2);
    expect(applyBasisPoints(25_000, 1, 'half-up')).toBe(3);
  });

  it('applies a 250 bps rate without floating point drift', () => {
    expect(applyBasisPoints(100_00, 250, 'half-even')).toBe(2_50);
    // 250 bps of 40 cents is exactly 1 cent.
    expect(applyBasisPoints(40, 250, 'half-even')).toBe(1);
    // 250 bps of 4 cents is 0.1 cents and truncates to zero in every mode.
    expect(applyBasisPoints(4, 250, 'half-even')).toBe(0);
    expect(applyBasisPoints(4, 250, 'half-up')).toBe(0);
  });
});

describe('fees · basis-point maths by basis', () => {
  const rounding: RoundingMode = 'half-even';

  it('computes a gross-amount platform fee', () => {
    const quote = quoteFees(100_00, TWO_COMPONENT_SCHEDULE, rounding, QUOTED_AT);
    expect(quote.platformFeeCents).toBe(2_50);
    expect(quote.networkFeeCents).toBe(50);
    expect(quote.totalFeeCents).toBe(3_00);
    expect(quote.netRecipientCents).toBe(97_00);
  });

  it('computes a net-amount platform fee from the remaining amount', () => {
    const schedule = version({
      components: [component({ basis: 'net-amount', rateBps: 1000 })],
    });
    const quote = quoteFees(100_00, schedule, rounding, QUOTED_AT);
    // 10% of the net: net = 10000 * 9000/10000 = 9000, fee = 1000.
    expect(quote.platformFeeCents).toBe(1_000);
    expect(quote.netRecipientCents).toBe(9_000);
  });

  it('adds a flat per-award component', () => {
    const schedule = version({
      components: [component({ basis: 'flat-per-award', rateBps: 0, flatCents: 30 })],
    });
    const quote = quoteFees(100_00, schedule, rounding, QUOTED_AT);
    expect(quote.platformFeeCents).toBe(30);
    expect(quote.netRecipientCents).toBe(9_970);
  });

  it('computes a percentage-of-platform-fee component against the platform fee', () => {
    const schedule = version({
      components: [
        component({ id: 'p', kind: 'platform', basis: 'gross-amount', rateBps: 1000 }),
        component({ id: 'n', kind: 'network', basis: 'percentage-of-platform-fee', rateBps: 5000 }),
      ],
    });
    const quote = quoteFees(100_00, schedule, rounding, QUOTED_AT);
    expect(quote.platformFeeCents).toBe(1_000);
    expect(quote.networkFeeCents).toBe(500);
    expect(quote.netRecipientCents).toBe(8_500);
  });
});

describe('fees · the balance invariant', () => {
  const schedules: FeeScheduleVersion[] = [
    TWO_COMPONENT_SCHEDULE,
    version({
      version: 'v1.1.0',
      components: [
        component({ id: 'p', basis: 'gross-amount', rateBps: 333 }),
        component({ id: 'n1', kind: 'network', basis: 'gross-amount', rateBps: 7, flatCents: 1 }),
        component({ id: 'n2', kind: 'network', basis: 'percentage-of-platform-fee', rateBps: 1234 }),
        component({ id: 'f', kind: 'network', basis: 'flat-per-award', rateBps: 0, flatCents: 2 }),
      ],
    }),
  ];
  const modes: RoundingMode[] = ['half-even', 'half-up', 'down'];

  it('holds net + totalFee === gross across many amounts, schedules, and rounding modes', () => {
    for (const schedule of schedules) {
      for (const mode of modes) {
        for (let grossCents = 0; grossCents <= 2_000; grossCents += 1) {
          const quote = quoteFees(grossCents, schedule, mode, QUOTED_AT);
          expect(assertQuoteBalanced(quote)).toBe(true);
          expect(quote.netRecipientCents + quote.totalFeeCents).toBe(grossCents);
        }
      }
    }
  });

  it('never leaves a recipient short of gross minus the quoted fees', () => {
    const quote = quoteFees(1_234_56, TWO_COMPONENT_SCHEDULE, 'half-up', QUOTED_AT);
    expect(quote.netRecipientCents).toBe(quote.grossCents - quote.totalFeeCents);
  });
});

describe('fees · schedule versioning', () => {
  it('returns the active version in force at a point in time', () => {
    const versions = [
      version({ version: 'v1.0.0', effectiveFrom: '2026-01-01T00:00:00.000Z', status: 'superseded' }),
      version({ version: 'v1.1.0', effectiveFrom: '2026-02-01T00:00:00.000Z', status: 'active' }),
    ];
    expect(activeSchedule(versions, '2026-01-15T00:00:00.000Z')).toBeNull();
    expect(activeSchedule(versions, '2026-02-02T00:00:00.000Z')?.version).toBe('v1.1.0');
  });

  it('ignores drafts and returns null when nothing is active', () => {
    expect(activeSchedule([version({ status: 'draft' })], QUOTED_AT)).toBeNull();
    expect(activeSchedule([], QUOTED_AT)).toBeNull();
  });

  it('increments the patch version', () => {
    expect(nextScheduleVersion([version({ version: 'v1.2.3' })])).toBe('v1.2.4');
    expect(nextScheduleVersion([version({ version: 'v1.2.9' })])).toBe('v1.2.10');
    expect(nextScheduleVersion([version({ version: 'v1.2.999' })])).toBe('v1.3.0');
    expect(nextScheduleVersion([])).toBe('v1.0.0');
    expect(nextScheduleVersion([version({ version: 'not-a-version' })])).toBe('v1.0.0');
  });

  it('leaves exactly one active version after a supersede', () => {
    const versions = [version({ version: 'v1.0.0' }), version({ version: 'v1.1.0', status: 'draft' })];
    const next = supersedeSchedule(versions, versions[1]);

    expect(next.filter((item) => item.status === 'active')).toHaveLength(1);
    expect(next.find((item) => item.version === 'v1.1.0')?.status).toBe('active');
    expect(next.find((item) => item.version === 'v1.0.0')?.status).toBe('superseded');
  });

  it('never mutates the versions it was given', () => {
    const versions = [version({ version: 'v1.0.0' })];
    const snapshot = JSON.stringify(versions);
    supersedeSchedule(versions, version({ version: 'v2.0.0' }));
    expect(JSON.stringify(versions)).toBe(snapshot);
  });

  it('creates a draft from the active template with a fresh version', () => {
    const versions = [version({ version: 'v1.4.0' })];
    const draft = createDraftVersion(versions, versions[0].components, 'finance-user', QUOTED_AT, '2026-06-01T00:00:00.000Z');

    expect(draft.version).toBe('v1.4.1');
    expect(draft.status).toBe('draft');
    expect(versions[0].status).toBe('active');
  });
});

describe('fees · revenue is separate from disbursement', () => {
  const schedule = TWO_COMPONENT_SCHEDULE;

  it('sums platform revenue and network cost into one fee ledger', () => {
    const quotes: FeeQuote[] = [
      quoteFees(100_00, schedule, 'half-even', QUOTED_AT),
      quoteFees(200_00, schedule, 'half-even', QUOTED_AT),
    ];
    const ledger = splitFeeRevenue(quotes);

    expect(ledger.platformRevenueCents).toBe(750);
    expect(ledger.networkCostCents).toBe(150);
    expect(ledger.currency).toBe('USD');
  });

  it('never mixes currencies', () => {
    const quotes: FeeQuote[] = [
      quoteFees(100_00, schedule, 'half-even', QUOTED_AT),
      { ...quoteFees(100_00, schedule, 'half-even', QUOTED_AT), currency: 'NGN' },
    ];
    expect(() => splitFeeRevenue(quotes)).toThrow(/cannot mix currencies/i);
  });

  it('returns a zeroed account for no quotes', () => {
    expect(splitFeeRevenue([])).toEqual({
      platformRevenueCents: 0,
      networkCostCents: 0,
      currency: '',
    });
  });
});

describe('fees · roles and service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('limits schedule management to finance and administrators', () => {
    expect(canManageFees('finance')).toBe(true);
    expect(canManageFees('administrator')).toBe(true);
    expect(canManageFees('sponsor')).toBe(false);
    expect(canManageFees('student')).toBe(false);
    expect(canManageFees(undefined)).toBe(false);
  });

  it('talks to the scholarships fees endpoints via apiClient', async () => {
    const { apiClient } = await import('@/src/lib/api-client');
    const mock = vi.mocked(apiClient);
    mock.get.mockResolvedValue([] as never);
    mock.post.mockResolvedValue({ version: 'v2.0.0' } as never);

    await feeService.listVersions();
    expect(mock.get).toHaveBeenCalledWith('/scholarships/fees/schedules');

    await feeService.getActiveVersion(QUOTED_AT);
    expect(mock.get).toHaveBeenCalledWith(`/scholarships/fees/schedules/active?at=${encodeURIComponent(QUOTED_AT)}`);

    await feeService.getFeeLedger('USD');
    expect(mock.get).toHaveBeenCalledWith('/scholarships/fees/revenue?currency=USD');

    await feeService.quote({
      grossCents: 100_00,
      currency: 'USD',
      scheduleVersion: 'v1.0.0',
      rounding: 'half-even',
      idempotencyKey: 'k-1',
    });
    expect(mock.post).toHaveBeenCalledWith('/scholarships/fees/quotes', {
      grossCents: 100_00,
      currency: 'USD',
      scheduleVersion: 'v1.0.0',
      rounding: 'half-even',
      idempotencyKey: 'k-1',
    });

    await feeService.activate('v1.1.0', { activatedBy: 'finance-user', expectedStatus: 'draft' });
    expect(mock.post).toHaveBeenCalledWith('/scholarships/fees/schedules/v1.1.0/activation', {
      activatedBy: 'finance-user',
      expectedStatus: 'draft',
    });
  });
});
