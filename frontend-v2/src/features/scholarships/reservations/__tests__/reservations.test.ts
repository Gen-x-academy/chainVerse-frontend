import { describe, it, expect } from 'vitest';
import {
  validateAcquisition,
  buildReservation,
  releaseReservation,
  commitReservation,
  expireStaleReservations,
  heldCentsForProgram,
  committedCentsForProgram,
} from '../domain';
import type { BudgetReservation, AcquireReservationPayload, ReservationPolicy } from '../types';

const POLICY: ReservationPolicy = { maxHoldHours: 48, maxBudgetCents: 100_000_00 };

const BASE_PAYLOAD: AcquireReservationPayload = {
  programId: 'prog-001',
  applicationId: 'app-001',
  decisionId: 'dec-001',
  amountCents: 4_000_00,
  currency: 'USD',
  idempotencyKey: 'idem-abc',
};

const HELD_RESERVATION: BudgetReservation = {
  id: 'res-001',
  programId: 'prog-001',
  applicationId: 'app-001',
  decisionId: 'dec-001',
  amountCents: 4_000_00,
  currency: 'USD',
  expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
  status: 'held',
  idempotencyKey: 'idem-abc',
  createdAt: new Date().toISOString(),
};

describe('validateAcquisition', () => {
  it('returns no errors for a valid payload within budget', () => {
    const errors = validateAcquisition(BASE_PAYLOAD, 0, 0, POLICY);
    expect(errors).toHaveLength(0);
  });

  it('rejects zero amount', () => {
    const errors = validateAcquisition({ ...BASE_PAYLOAD, amountCents: 0 }, 0, 0, POLICY);
    expect(errors.some((e) => e.field === 'amountCents')).toBe(true);
  });

  it('rejects negative amount', () => {
    const errors = validateAcquisition({ ...BASE_PAYLOAD, amountCents: -100 }, 0, 0, POLICY);
    expect(errors.some((e) => e.field === 'amountCents')).toBe(true);
  });

  it('rejects when projected total exceeds budget', () => {
    const errors = validateAcquisition(
      { ...BASE_PAYLOAD, amountCents: 6_000_00 },
      50_000_00,
      55_000_00,
      POLICY
    );
    expect(errors.some((e) => e.field === 'amountCents')).toBe(true);
    expect(errors[0].message).toMatch(/exceed/i);
  });

  it('allows acquisition that exactly reaches budget ceiling', () => {
    const errors = validateAcquisition(
      { ...BASE_PAYLOAD, amountCents: 100_000_00 },
      0,
      0,
      POLICY
    );
    expect(errors).toHaveLength(0);
  });

  it('rejects empty idempotency key', () => {
    const errors = validateAcquisition({ ...BASE_PAYLOAD, idempotencyKey: '  ' }, 0, 0, POLICY);
    expect(errors.some((e) => e.field === 'idempotencyKey')).toBe(true);
  });
});

describe('buildReservation', () => {
  it('creates a reservation with held status', () => {
    const r = buildReservation(BASE_PAYLOAD, POLICY, () => 'res-test');
    expect(r.status).toBe('held');
    expect(r.id).toBe('res-test');
    expect(r.amountCents).toBe(BASE_PAYLOAD.amountCents);
  });

  it('sets expiry to maxHoldHours from now', () => {
    const before = Date.now();
    const r = buildReservation(BASE_PAYLOAD, POLICY);
    const after = Date.now();
    const expiresMs = new Date(r.expiresAt).getTime();
    expect(expiresMs).toBeGreaterThanOrEqual(before + 48 * 60 * 60 * 1000 - 10);
    expect(expiresMs).toBeLessThanOrEqual(after + 48 * 60 * 60 * 1000 + 10);
  });
});

describe('releaseReservation', () => {
  it('transitions held → released', () => {
    const released = releaseReservation(HELD_RESERVATION);
    expect(released.status).toBe('released');
    expect(released.releasedAt).toBeDefined();
  });

  it('is a noop on an already released reservation (release exactly once)', () => {
    const already: BudgetReservation = { ...HELD_RESERVATION, status: 'released', releasedAt: '2024-01-01T00:00:00Z' };
    const result = releaseReservation(already);
    expect(result.releasedAt).toBe('2024-01-01T00:00:00Z');
    expect(result.status).toBe('released');
  });

  it('is a noop on a committed reservation', () => {
    const committed: BudgetReservation = { ...HELD_RESERVATION, status: 'committed' };
    expect(releaseReservation(committed).status).toBe('committed');
  });

  it('is a noop on an expired reservation', () => {
    const expired: BudgetReservation = { ...HELD_RESERVATION, status: 'expired' };
    expect(releaseReservation(expired).status).toBe('expired');
  });
});

describe('commitReservation', () => {
  it('transitions held → committed', () => {
    const committed = commitReservation(HELD_RESERVATION);
    expect(committed.status).toBe('committed');
    expect(committed.committedAt).toBeDefined();
  });

  it('is a noop on non-held reservations', () => {
    const expired: BudgetReservation = { ...HELD_RESERVATION, status: 'expired' };
    expect(commitReservation(expired).status).toBe('expired');
  });
});

describe('expireStaleReservations', () => {
  it('expires held reservations past their expiry', () => {
    const stale: BudgetReservation = {
      ...HELD_RESERVATION,
      id: 'res-stale',
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    };
    const result = expireStaleReservations([stale, HELD_RESERVATION]);
    expect(result[0].status).toBe('expired');
    expect(result[1].status).toBe('held');
  });

  it('does not expire committed reservations', () => {
    const committed: BudgetReservation = {
      ...HELD_RESERVATION,
      status: 'committed',
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    };
    const result = expireStaleReservations([committed]);
    expect(result[0].status).toBe('committed');
  });
});

describe('heldCentsForProgram / committedCentsForProgram', () => {
  const reservations: BudgetReservation[] = [
    { ...HELD_RESERVATION, id: 'r1', status: 'held', amountCents: 2_000_00 },
    { ...HELD_RESERVATION, id: 'r2', status: 'held', amountCents: 1_000_00 },
    { ...HELD_RESERVATION, id: 'r3', status: 'committed', amountCents: 3_000_00 },
    { ...HELD_RESERVATION, id: 'r4', status: 'released', amountCents: 5_000_00 },
    { ...HELD_RESERVATION, id: 'r5', programId: 'prog-999', status: 'held', amountCents: 9_000_00 },
  ];

  it('sums only held reservations for the given program', () => {
    expect(heldCentsForProgram(reservations, 'prog-001')).toBe(3_000_00);
  });

  it('sums only committed reservations for the given program', () => {
    expect(committedCentsForProgram(reservations, 'prog-001')).toBe(3_000_00);
  });

  it('excludes different program', () => {
    expect(heldCentsForProgram(reservations, 'prog-999')).toBe(9_000_00);
  });
});
