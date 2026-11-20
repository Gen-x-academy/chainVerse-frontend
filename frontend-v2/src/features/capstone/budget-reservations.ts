/**
 * Capstone approved-budget reservations (CAPSTONE-083).
 *
 * Reserving funds is a single atomic decision: the request carries the exact
 * project revision and fund pool state it was based on, and the returned pool
 * and project carry the updated values. Any stale or concurrent decision is
 * rejected, and a retried request id returns the original reservation instead
 * of reserving twice. Currency, expiry, caps and the approved budget are all
 * enforced before anything is written.
 */

export type ReservationRole = "sponsor" | "finance" | "program-manager" | "admin" | "student";
const WRITE_ROLES: readonly ReservationRole[] = ["sponsor", "finance", "program-manager", "admin"];

export interface FundPool {
  poolId: string;
  tenantId: string;
  /** ISO 4217-style code, normalised to upper case. */
  currency: string;
  capMinor: number;
  reservedMinor: number;
  /** Exclusive expiry, epoch milliseconds. */
  expiresAt: number;
}

export interface ApprovedBudget {
  projectId: string;
  tenantId: string;
  state: "approved" | "active";
  approvedTotalMinor: number;
  currency: string;
  revision: number;
}

export interface FundReservation {
  reservationId: string;
  tenantId: string;
  projectId: string;
  poolId: string;
  amountMinor: number;
  currency: string;
  createdAt: number;
  expiresAt: number;
  revision: number;
}

export interface ReserveRequest {
  /** Client-generated id; a retry with the same id is not applied again. */
  requestId: string;
  actorId: string;
  actorTenantId: string;
  actorRole: ReservationRole;
  budget: ApprovedBudget;
  pool: FundPool;
  /** Active reservations already charged to this project's approved budget. */
  existingReservations: readonly FundReservation[];
  expectedRevision: number;
  amountMinor: number;
  currency: string;
  now: number;
}

export type ReservationErrorCode =
  | "FORBIDDEN"
  | "TENANT_MISMATCH"
  | "CURRENCY_MISMATCH"
  | "POOL_EXPIRED"
  | "BUDGET_NOT_APPROVED"
  | "INVALID_AMOUNT"
  | "CAP_EXCEEDED"
  | "BUDGET_EXCEEDED"
  | "STALE_REVISION"
  | "REPLAY_CONFLICT";

export type ReservationResult =
  | { ok: true; reservation: FundReservation; pool: FundPool; budget: ApprovedBudget; replayed: boolean }
  | { ok: false; code: ReservationErrorCode; message: string; replayed: boolean };

export interface ReservationReceipt {
  result: ReservationResult;
  fingerprint: string;
}
export type ReservationLedger = Map<string, ReservationReceipt>;

export function currencyCode(value: string): string {
  return (value ?? "").trim().toUpperCase();
}

export function reservationFingerprint(request: ReserveRequest): string {
  return JSON.stringify({
    actorId: request.actorId,
    tenantId: request.budget.tenantId,
    projectId: request.budget.projectId,
    poolId: request.pool.poolId,
    amountMinor: request.amountMinor,
    currency: currencyCode(request.currency),
  });
}

/** Minor units still available in a pool. */
export function remainingCapacityMinor(pool: FundPool): number {
  return Math.max(0, pool.capMinor - pool.reservedMinor);
}

/** Minor units of the approved budget not yet reserved by this project. */
export function remainingBudgetMinor(budget: ApprovedBudget, existing: readonly FundReservation[]): number {
  const used = existing
    .filter((r) => r.projectId === budget.projectId && r.expiresAt > 0)
    .reduce((sum, r) => sum + r.amountMinor, 0);
  return Math.max(0, budget.approvedTotalMinor - used);
}

/**
 * Apply a reservation atomically. Only the ledger is mutated; all returned
 * domain objects are fresh copies, so a failed or replayed call writes nothing.
 */
export function applyReservation(request: ReserveRequest, ledger: ReservationLedger = new Map()): ReservationResult {
  const earlier = ledger.get(request.requestId);
  if (earlier) {
    if (earlier.fingerprint !== reservationFingerprint(request)) {
      return { ok: false, code: "REPLAY_CONFLICT", message: "This request id was already used for a different reservation.", replayed: false };
    }
    return { ...earlier.result, replayed: true };
  }

  const record = (result: ReservationResult): ReservationResult => {
    ledger.set(request.requestId, { result, fingerprint: reservationFingerprint(request) });
    return result;
  };
  const fail = (code: ReservationErrorCode, message: string): ReservationResult => record({ ok: false, code, message, replayed: false });

  // Deny by default, then enforce the tenant boundary before leaking details.
  if (!WRITE_ROLES.includes(request.actorRole)) return fail("FORBIDDEN", "You are not allowed to reserve project funds.");
  if (request.actorTenantId !== request.budget.tenantId || request.pool.tenantId !== request.budget.tenantId) {
    return fail("TENANT_MISMATCH", "The project and funding pool must belong to your tenant.");
  }
  if (request.budget.state !== "approved" && request.budget.state !== "active") {
    return fail("BUDGET_NOT_APPROVED", "Funds can only be reserved for an approved project budget.");
  }
  if (request.expectedRevision !== request.budget.revision) {
    return fail("STALE_REVISION", `The budget changed (revision ${request.budget.revision}); reload before retrying.`);
  }

  const currency = currencyCode(request.currency);
  if (!/^[A-Z]{3}$/.test(currency) || currency !== currencyCode(request.budget.currency) || currency !== currencyCode(request.pool.currency)) {
    return fail("CURRENCY_MISMATCH", "The request, budget and pool currencies must match.");
  }
  if (!Number.isSafeInteger(request.amountMinor) || request.amountMinor <= 0) {
    return fail("INVALID_AMOUNT", "The amount must be a positive whole number of minor units.");
  }
  if (!Number.isFinite(request.now) || request.now >= request.pool.expiresAt) {
    return fail("POOL_EXPIRED", "This funding pool has expired; choose an active one.");
  }
  if (request.amountMinor > remainingCapacityMinor(request.pool)) {
    return fail("CAP_EXCEEDED", "The reservation would exceed the funding pool cap.");
  }
  if (request.amountMinor > remainingBudgetMinor(request.budget, request.existingReservations)) {
    return fail("BUDGET_EXCEEDED", "The reservation would exceed the remaining approved budget.");
  }

  const reservation: FundReservation = {
    reservationId: `res-${request.requestId}`,
    tenantId: request.budget.tenantId,
    projectId: request.budget.projectId,
    poolId: request.pool.poolId,
    amountMinor: request.amountMinor,
    currency,
    createdAt: request.now,
    expiresAt: request.pool.expiresAt,
    revision: 1,
  };
  return record({
    ok: true,
    reservation,
    pool: { ...request.pool, reservedMinor: request.pool.reservedMinor + request.amountMinor },
    budget: { ...request.budget, revision: request.budget.revision + 1 },
    replayed: false,
  });
}

/** Privacy-safe audit record; no actor identities or private metadata. */
export function reservationAudit(reservation: FundReservation): Record<string, string | number> {
  return {
    reservationId: reservation.reservationId,
    tenantId: reservation.tenantId,
    projectId: reservation.projectId,
    poolId: reservation.poolId,
    amountMinor: reservation.amountMinor,
    currency: reservation.currency,
  };
}
