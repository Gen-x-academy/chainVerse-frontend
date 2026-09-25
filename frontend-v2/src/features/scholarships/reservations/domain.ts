/**
 * Budget reservation domain logic (issue #1110).
 *
 * Reservation invariants:
 *  - Atomic: capacity is checked and reserved in one logical step; the API
 *    must enforce this with an optimistic-lock or equivalent.
 *  - Never exceed budget: currentHeldCents + currentCommittedCents + amount
 *    must not exceed maxBudgetCents before a reservation is acquired.
 *  - Idempotent acquisition: a repeated call with the same idempotencyKey
 *    returns the existing reservation unchanged.
 *  - Release exactly once: releasing a reservation that is already released,
 *    expired, or committed is a no-op (returns as-is without error).
 *  - Automatic expiry: held reservations past expiresAt transition to
 *    'expired'; the caller must run expireStaleReservations periodically.
 */

import type {
  BudgetReservation,
  AcquireReservationPayload,
  ReservationPolicy,
  ReservationValidationError,
} from './types';

export function validateAcquisition(
  payload: AcquireReservationPayload,
  currentHeldCents: number,
  currentCommittedCents: number,
  policy: ReservationPolicy
): ReservationValidationError[] {
  const errors: ReservationValidationError[] = [];

  if (payload.amountCents <= 0) {
    errors.push({ field: 'amountCents', message: 'Reservation amount must be greater than zero.' });
  }

  const projected = currentHeldCents + currentCommittedCents + payload.amountCents;
  if (projected > policy.maxBudgetCents) {
    errors.push({
      field: 'amountCents',
      message: `Reservation would exceed program budget. Available: ${policy.maxBudgetCents - currentHeldCents - currentCommittedCents} cents.`,
    });
  }

  if (!payload.idempotencyKey.trim()) {
    errors.push({ field: 'idempotencyKey', message: 'An idempotency key is required.' });
  }

  return errors;
}

export function buildReservation(
  payload: AcquireReservationPayload,
  policy: ReservationPolicy,
  idGenerator: () => string = () => `res-${Date.now().toString(36)}`
): BudgetReservation {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + policy.maxHoldHours * 60 * 60 * 1000).toISOString();

  return {
    id: idGenerator(),
    programId: payload.programId,
    applicationId: payload.applicationId,
    decisionId: payload.decisionId,
    amountCents: payload.amountCents,
    currency: payload.currency,
    expiresAt,
    status: 'held',
    idempotencyKey: payload.idempotencyKey,
    createdAt: now.toISOString(),
  };
}

/** Idempotent release: noop if not in 'held' state. */
export function releaseReservation(reservation: BudgetReservation): BudgetReservation {
  if (reservation.status !== 'held') return reservation;
  return { ...reservation, status: 'released', releasedAt: new Date().toISOString() };
}

/** Commit a held reservation when the applicant accepts the award. */
export function commitReservation(reservation: BudgetReservation): BudgetReservation {
  if (reservation.status !== 'held') return reservation;
  return { ...reservation, status: 'committed', committedAt: new Date().toISOString() };
}

export function expireStaleReservations(
  reservations: BudgetReservation[],
  now: Date = new Date()
): BudgetReservation[] {
  return reservations.map((r) => {
    if (r.status === 'held' && new Date(r.expiresAt) <= now) {
      return { ...r, status: 'expired', expiredAt: now.toISOString() };
    }
    return r;
  });
}

export function heldCentsForProgram(
  reservations: BudgetReservation[],
  programId: string
): number {
  return reservations
    .filter((r) => r.programId === programId && r.status === 'held')
    .reduce((sum, r) => sum + r.amountCents, 0);
}

export function committedCentsForProgram(
  reservations: BudgetReservation[],
  programId: string
): number {
  return reservations
    .filter((r) => r.programId === programId && r.status === 'committed')
    .reduce((sum, r) => sum + r.amountCents, 0);
}
