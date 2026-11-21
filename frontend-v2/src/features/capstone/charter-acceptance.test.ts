import { describe, expect, it } from "vitest";
import { allAccepted, emptyAcceptanceLedger, hasValidAcceptance, pendingAcceptors, recordAcceptance, type AcceptanceIntent, type AcceptanceLedger, type AcceptanceResult, type SealedCharterRef } from "./charter-acceptance";

const charter: SealedCharterRef = { charterId: "ch1", version: 2, hash: "h".repeat(64) };
const now = "2026-03-01T10:00:00.000Z";
const until = "2026-09-01T00:00:00.000Z";
const people = ["u1", "u2"];
const intent = (over: Partial<AcceptanceIntent> = {}): AcceptanceIntent => ({ nonce: "n1", charterId: "ch1", charterVersion: 2, charterHash: charter.hash, actorId: "u1", expiresAt: "2026-03-01T11:00:00.000Z", ...over });
const code = (r: AcceptanceResult) => (r.ok ? "ok" : r.code);
const ledgerOf = (r: AcceptanceResult): AcceptanceLedger => {
  if (!r.ok) throw new Error(r.code);
  return r.ledger;
};

describe("recording acceptance", () => {
  it("stores actor, hash, version, time and expiry", () => {
    const r = recordAcceptance(emptyAcceptanceLedger(), intent(), charter, people, now, until);
    expect(r.ok && r.record).toMatchObject({ actorId: "u1", charterHash: charter.hash, charterVersion: 2, acceptedAt: now, validUntil: until });
  });

  it("refuses expired intents, strangers and bad end dates", () => {
    expect(code(recordAcceptance(emptyAcceptanceLedger(), intent({ expiresAt: now }), charter, people, now, until))).toBe("intent_expired");
    expect(code(recordAcceptance(emptyAcceptanceLedger(), intent({ actorId: "zz" }), charter, people, now, until))).toBe("not_a_participant");
    expect(code(recordAcceptance(emptyAcceptanceLedger(), intent(), charter, people, now, now))).toBe("bad_validity");
  });

  it("refuses an acceptance of a changed or older charter", () => {
    expect(code(recordAcceptance(emptyAcceptanceLedger(), intent({ charterHash: "x".repeat(64) }), charter, people, now, until))).toBe("hash_mismatch");
    expect(code(recordAcceptance(emptyAcceptanceLedger(), intent({ charterVersion: 1 }), charter, people, now, until))).toBe("version_mismatch");
  });
});

describe("replay resistance", () => {
  it("returns the stored record when the same intent is sent again", () => {
    const first = recordAcceptance(emptyAcceptanceLedger(), intent(), charter, people, now, until);
    const again = recordAcceptance(ledgerOf(first), intent(), charter, people, "2026-03-01T10:30:00.000Z", until);
    expect(again.ok && again.replayed).toBe(true);
    expect(ledgerOf(again).records).toHaveLength(1);
  });

  it("does not let a new intent create a second record for the same version", () => {
    const first = recordAcceptance(emptyAcceptanceLedger(), intent(), charter, people, now, until);
    expect(code(recordAcceptance(ledgerOf(first), intent({ nonce: "n2" }), charter, people, now, until))).toBe("already_accepted");
  });

  it("refuses a nonce that was used by another actor", () => {
    const first = recordAcceptance(emptyAcceptanceLedger(), intent(), charter, people, now, until);
    expect(code(recordAcceptance(ledgerOf(first), intent({ actorId: "u2" }), charter, people, now, until))).toBe("nonce_used");
  });
});

describe("who still has to approve", () => {
  it("tracks pending and complete acceptance", () => {
    let ledger = ledgerOf(recordAcceptance(emptyAcceptanceLedger(), intent(), charter, people, now, until));
    expect(pendingAcceptors(ledger, people, charter, now)).toEqual(["u2"]);
    expect(allAccepted(ledger, people, charter, now)).toBe(false);
    ledger = ledgerOf(recordAcceptance(ledger, intent({ nonce: "n2", actorId: "u2" }), charter, people, now, until));
    expect(allAccepted(ledger, people, charter, now)).toBe(true);
  });

  it("stops counting an approval after it expires or the charter changes", () => {
    const ledger = ledgerOf(recordAcceptance(emptyAcceptanceLedger(), intent(), charter, people, now, until));
    expect(hasValidAcceptance(ledger, "u1", charter, until)).toBe(false);
    expect(hasValidAcceptance(ledger, "u1", { ...charter, hash: "y".repeat(64) }, now)).toBe(false);
  });

  it("is never complete with nobody to approve", () => {
    expect(allAccepted(emptyAcceptanceLedger(), [], charter, now)).toBe(false);
  });
});
