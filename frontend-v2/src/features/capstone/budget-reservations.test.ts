import { describe, expect, it } from "vitest";
import {
  applyReservation,
  currencyCode,
  remainingBudgetMinor,
  remainingCapacityMinor,
  reservationAudit,
  type ApprovedBudget,
  type FundPool,
  type ReserveRequest,
  type ReservationLedger,
} from "./budget-reservations";

const budget = (over: Partial<ApprovedBudget> = {}): ApprovedBudget => ({
  projectId: "p1",
  tenantId: "t1",
  state: "approved",
  approvedTotalMinor: 1_000_000,
  currency: "usd",
  revision: 3,
  ...over,
});
const pool = (over: Partial<FundPool> = {}): FundPool => ({
  poolId: "pool-1",
  tenantId: "t1",
  currency: "USD",
  capMinor: 800_000,
  reservedMinor: 100_000,
  expiresAt: 2_000_000,
  ...over,
});
const request = (over: Partial<ReserveRequest> = {}): ReserveRequest => ({
  requestId: "req-1",
  actorId: "u1",
  actorTenantId: "t1",
  actorRole: "sponsor",
  budget: budget(),
  pool: pool(),
  existingReservations: [],
  expectedRevision: 3,
  amountMinor: 200_000,
  currency: "usd",
  now: 1_000_000,
  ...over,
});

describe("reservation capacity", () => {
  it("normalises currency and reports remaining capacity and budget", () => {
    expect(currencyCode(" usd ")).toBe("USD");
    expect(remainingCapacityMinor(pool())).toBe(700_000);
    expect(remainingCapacityMinor(pool({ reservedMinor: 900_000 }))).toBe(0);
    expect(remainingBudgetMinor(budget(), [])).toBe(1_000_000);
    expect(remainingBudgetMinor(budget(), [
      { reservationId: "r1", tenantId: "t1", projectId: "p1", poolId: "pool-1", amountMinor: 250_000, currency: "USD", createdAt: 1, expiresAt: 10, revision: 1 },
      { reservationId: "r2", tenantId: "t1", projectId: "other", poolId: "pool-1", amountMinor: 500_000, currency: "USD", createdAt: 1, expiresAt: 10, revision: 1 },
    ])).toBe(750_000);
  });
});

describe("budget reservation lifecycle", () => {
  it("reserves atomically and advances pool and budget state once", () => {
    const ledger: ReservationLedger = new Map();
    const result = applyReservation(request(), ledger);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.reservation.amountMinor).toBe(200_000);
    expect(result.reservation.currency).toBe("USD");
    expect(result.pool.reservedMinor).toBe(300_000);
    expect(result.budget.revision).toBe(4);
  });

  it("replays a request id without reserving twice and detects conflicts", () => {
    const ledger: ReservationLedger = new Map();
    const first = applyReservation(request(), ledger);
    const retry = applyReservation(request({ now: 1_100_000 }), ledger);
    expect(first.ok && retry.ok && retry.replayed).toBe(true);
    if (first.ok && retry.ok) {
      expect(retry.reservation.reservationId).toBe(first.reservation.reservationId);
      expect(retry.pool.reservedMinor).toBe(first.pool.reservedMinor);
    }
    const conflict = applyReservation(request({ amountMinor: 300_000 }), ledger);
    expect(conflict.ok).toBe(false);
    if (!conflict.ok) expect(conflict.code).toBe("REPLAY_CONFLICT");
  });

  it("rejects concurrent and stale decisions", () => {
    const stale = applyReservation(request({ expectedRevision: 2 }), new Map());
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.code).toBe("STALE_REVISION");
  });

  it("denies by default and enforces tenant boundaries", () => {
    const denied = applyReservation(request({ actorRole: "student" }), new Map());
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.code).toBe("FORBIDDEN");
    const cross = applyReservation(request({ actorTenantId: "t2" }), new Map());
    expect(cross.ok).toBe(false);
    if (!cross.ok) expect(cross.code).toBe("TENANT_MISMATCH");
    const foreignPool = applyReservation(request({ pool: pool({ tenantId: "t2" }) }), new Map());
    expect(foreignPool.ok).toBe(false);
    if (!foreignPool.ok) expect(foreignPool.code).toBe("TENANT_MISMATCH");
  });

  it("enforces eligibility, currency, expiry, caps and the approved budget", () => {
    const cases: Array<[Partial<ReserveRequest>, string]> = [
      [{ budget: budget({ state: "draft" as ApprovedBudget["state"] }) }, "BUDGET_NOT_APPROVED"],
      [{ currency: "EUR" }, "CURRENCY_MISMATCH"],
      [{ pool: pool({ expiresAt: 900_000 }) }, "POOL_EXPIRED"],
      [{ amountMinor: 800_000 }, "CAP_EXCEEDED"],
      [{ budget: budget({ approvedTotalMinor: 150_000 }) }, "BUDGET_EXCEEDED"],
      [{ amountMinor: 0 }, "INVALID_AMOUNT"],
    ];
    for (const [over, code] of cases) {
      const result = applyReservation(request(over), new Map());
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe(code);
    }
  });

  it("emits a privacy-safe audit record", () => {
    const result = applyReservation(request(), new Map());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(reservationAudit(result.reservation)).toEqual({
      reservationId: "res-req-1",
      tenantId: "t1",
      projectId: "p1",
      poolId: "pool-1",
      amountMinor: 200_000,
      currency: "USD",
    });
  });
});
