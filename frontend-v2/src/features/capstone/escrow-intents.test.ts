import { describe, expect, it } from "vitest";
import {
  createEscrowIntent,
  intentAudit,
  isIntentActive,
  validateConditions,
  type AcceptedCharter,
  type IntentLedger,
  type IntentRequest,
  type ReleaseCondition,
} from "./escrow-intents";

const charter = (over: Partial<AcceptedCharter> = {}): AcceptedCharter => ({
  charterId: "charter-1",
  tenantId: "t1",
  state: "accepted",
  currency: "USD",
  revision: 4,
  ...over,
});
const conditions = (): ReleaseCondition[] => [
  { type: "deliverable_accepted", ref: "d1" },
  { type: "challenge_window_closed", ref: "d1" },
];
const request = (over: Partial<IntentRequest> = {}): IntentRequest => ({
  requestId: "req-1",
  actorId: "u1",
  actorTenantId: "t1",
  actorRole: "sponsor",
  charter: charter(),
  payerId: "payer-secret-id",
  amountMinor: 500_000,
  asset: "USDC",
  currency: "usd",
  expiresAt: 2_000_000,
  conditions: conditions(),
  expectedCharterRevision: 4,
  now: 1_000_000,
  ...over,
});

describe("escrow intent validation", () => {
  it("accepts unique named release conditions", () => {
    expect(validateConditions(conditions())).toBe(true);
    expect(validateConditions([])).toBe(false);
    expect(validateConditions([{ type: "deliverable_accepted", ref: "d1" }, { type: "deliverable_accepted", ref: "d1" }])).toBe(false);
    expect(validateConditions([{ type: "bogus" as ReleaseCondition["type"], ref: "d1" }])).toBe(false);
    expect(validateConditions([{ type: "attestation", ref: " " }])).toBe(false);
  });

  it("reports whether an intent is active", () => {
    const result = createEscrowIntent(request(), new Map());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(isIntentActive(result.intent, 1_500_000)).toBe(true);
    expect(isIntentActive(result.intent, 2_000_000)).toBe(false);
    expect(isIntentActive(result.intent, Number.NaN)).toBe(false);
  });
});

describe("escrow intent lifecycle", () => {
  it("creates a deterministic intent tied to the accepted charter", () => {
    const result = createEscrowIntent(request(), new Map());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.intent.intentId).toBe("intent-req-1");
    expect(result.intent.amountMinor).toBe(500_000);
    expect(result.intent.currency).toBe("USD");
    expect(result.intent.conditions).toEqual(conditions());
  });

  it("replays a request id without a second intent and detects conflicts", () => {
    const ledger: IntentLedger = new Map();
    const first = createEscrowIntent(request(), ledger);
    const retry = createEscrowIntent(request({ now: 1_200_000 }), ledger);
    expect(first.ok && retry.ok && retry.replayed).toBe(true);
    if (first.ok && retry.ok) expect(retry.intent.intentId).toBe(first.intent.intentId);

    const conflict = createEscrowIntent(request({ amountMinor: 600_000 }), ledger);
    expect(conflict.ok).toBe(false);
    if (!conflict.ok) expect(conflict.code).toBe("REPLAY_CONFLICT");
  });

  it("denies by default and enforces the tenant boundary", () => {
    const denied = createEscrowIntent(request({ actorRole: "student" }), new Map());
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.code).toBe("FORBIDDEN");
    const cross = createEscrowIntent(request({ actorTenantId: "t2" }), new Map());
    expect(cross.ok).toBe(false);
    if (!cross.ok) expect(cross.code).toBe("TENANT_MISMATCH");
  });

  it("rejects stale, unaccepted and economically invalid requests", () => {
    const cases: Array<[Partial<IntentRequest>, string]> = [
      [{ charter: charter({ state: "draft" as AcceptedCharter["state"] }) }, "CHARTER_NOT_ACCEPTED"],
      [{ expectedCharterRevision: 3 }, "STALE_REVISION"],
      [{ amountMinor: 0 }, "INVALID_AMOUNT"],
      [{ asset: "BTC" as IntentRequest["asset"] }, "INVALID_ASSET"],
      [{ currency: "EUR" }, "INVALID_CURRENCY"],
      [{ expiresAt: 1_000_000 }, "INVALID_EXPIRY"],
      [{ conditions: [] }, "NO_RELEASE_CONDITIONS"],
    ];
    for (const [over, code] of cases) {
      const result = createEscrowIntent(request(over), new Map());
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe(code);
    }
  });

  it("keeps payer identity out of audit records", () => {
    const result = createEscrowIntent(request(), new Map());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const audit = intentAudit(result.intent);
    expect(audit.conditionCount).toBe(2);
    expect(JSON.stringify(audit)).not.toContain("payer-secret-id");
  });
});
