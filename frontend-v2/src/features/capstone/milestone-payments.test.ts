import { describe, expect, it } from "vitest";
import {
  alreadyReleased,
  calculateFeeMinor,
  challengeWindowEndsAt,
  paymentAudit,
  releaseMilestonePayment,
  type Milestone,
  type PaymentLedger,
  type PaymentRequest,
} from "./milestone-payments";

const milestone = (over: Partial<Milestone> = {}): Milestone => ({
  id: "m1",
  title: "Prototype accepted",
  amountMinor: 1_000_000,
  requiredDeliverableIds: ["d1", "d2"],
  challengeWindowDays: 7,
  acceptedAt: 1_000_000,
  challenged: false,
  ...over,
});
const request = (over: Partial<PaymentRequest> = {}): PaymentRequest => ({
  requestId: "req-1",
  actorId: "u1",
  actorTenantId: "t1",
  actorRole: "finance",
  tenantId: "t1",
  projectId: "p1",
  milestone: milestone(),
  config: { feeBps: 250, minFeeMinor: 100 },
  acceptedDeliverableIds: ["d1", "d2"],
  expectedRevision: 0,
  revision: 0,
  now: 1_000_000 + 7 * 86_400_000,
  ...over,
});

describe("deterministic fee calculation", () => {
  it("rounds half up in integer minor units and applies the floor and cap", () => {
    expect(calculateFeeMinor(1_000_000, { feeBps: 250, minFeeMinor: 100 })).toBe(25_000);
    expect(calculateFeeMinor(101, { feeBps: 5000, minFeeMinor: 0 })).toBe(51); // 50.5 -> 51
    expect(calculateFeeMinor(100_000, { feeBps: 1, minFeeMinor: 500 })).toBe(500); // floor beats 10 bp fee
    expect(calculateFeeMinor(100, { feeBps: 20_000, minFeeMinor: 0 })).toBe(100);
    expect(calculateFeeMinor(0, { feeBps: 250, minFeeMinor: 100 })).toBe(0);
  });

  it("computes the challenge window end from acceptance and configured days", () => {
    expect(challengeWindowEndsAt(milestone())).toBe(1_000_000 + 7 * 86_400_000);
    expect(challengeWindowEndsAt(milestone({ acceptedAt: undefined }))).toBeUndefined();
  });
});

describe("milestone payment release", () => {
  it("releases gross, fee and net deterministically after all gates pass", () => {
    const result = releaseMilestonePayment(request(), new Map());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payment.grossMinor).toBe(1_000_000);
    expect(result.payment.feeMinor).toBe(25_000);
    expect(result.payment.netMinor).toBe(975_000);
  });

  it("replays a request id without a second transfer and detects conflicts", () => {
    const ledger: PaymentLedger = new Map();
    const first = releaseMilestonePayment(request(), ledger);
    const retry = releaseMilestonePayment(request({ now: request().now + 1 }), ledger);
    expect(first.ok && retry.ok && retry.replayed).toBe(true);
    if (first.ok && retry.ok) expect(retry.payment.paymentId).toBe(first.payment.paymentId);

    const conflict = releaseMilestonePayment(request({ config: { feeBps: 300, minFeeMinor: 100 } }), ledger);
    expect(conflict.ok).toBe(false);
    if (!conflict.ok) expect(conflict.code).toBe("REPLAY_CONFLICT");
  });

  it("denies by default and enforces tenant boundaries and revisions", () => {
    const denied = releaseMilestonePayment(request({ actorRole: "student" }), new Map());
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.code).toBe("FORBIDDEN");
    const cross = releaseMilestonePayment(request({ actorTenantId: "t2" }), new Map());
    expect(cross.ok).toBe(false);
    if (!cross.ok) expect(cross.code).toBe("TENANT_MISMATCH");
    const stale = releaseMilestonePayment(request({ revision: 1 }), new Map());
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.code).toBe("STALE_REVISION");
  });

  it("blocks release before acceptance, missing deliverables or a closed window", () => {
    const cases: Array<[Partial<PaymentRequest>, string]> = [
      [{ milestone: milestone({ acceptedAt: undefined }) }, "NOT_ACCEPTED"],
      [{ acceptedDeliverableIds: ["d1"] }, "DELIVERABLES_MISSING"],
      [{ milestone: milestone({ challenged: true }) }, "CHALLENGE_OPEN"],
      [{ now: 1_000_000 }, "CHALLENGE_OPEN"],
      [{ milestone: milestone({ amountMinor: 0 }) }, "INVALID_AMOUNT"],
      [{ config: { feeBps: -1, minFeeMinor: 0 } }, "INVALID_FEE"],
    ];
    for (const [over, code] of cases) {
      const result = releaseMilestonePayment(request(over), new Map());
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe(code);
    }
  });

  it("detects a prior release for the same milestone and emits a safe audit record", () => {
    const result = releaseMilestonePayment(request(), new Map());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(alreadyReleased([result.payment], "m1")).toBe(true);
    expect(alreadyReleased([result.payment], "m2")).toBe(false);
    expect(paymentAudit(result.payment)).toEqual({
      paymentId: "pay-req-1",
      tenantId: "t1",
      projectId: "p1",
      milestoneId: "m1",
      grossMinor: 1_000_000,
      feeMinor: 25_000,
      netMinor: 975_000,
      feeBps: 250,
    });
  });
});
