import { describe, expect, it } from "vitest";
import {
  acceptanceComplete,
  ipAuditEvent,
  isEmbargoed,
  publicIpTerms,
  recordAcceptance,
  validateIpTerms,
  type AcceptanceState,
  type IpTerms,
} from "./intellectual-property-terms";

const terms = (over: Partial<IpTerms> = {}): IpTerms => ({
  id: "ip1",
  projectId: "p1",
  organizationId: "org1",
  version: 1,
  status: "pending_acceptance",
  license: "cc-by-4.0",
  ownership: "The university and the sponsoring lab jointly own the results.",
  privateAgreementRef: "ref_deed_001",
  embargoUntil: "2026-12-31",
  commercialization: "with-approval",
  reuse: "with-attribution",
  sponsorRights: ["acknowledgement", "embargo"],
  fundingAcknowledgement: "Funded by the Example Foundation.",
  participantIds: ["u1", "u2"],
  ...over,
});
const state = (over: Partial<AcceptanceState> = {}): AcceptanceState => ({ version: 1, decisions: {}, ...over });
const fields = (issues: { field: string }[]) => issues.map((i) => i.field).sort();

describe("intellectual property terms", () => {
  it("accepts a complete, well-formed set of terms", () => {
    expect(validateIpTerms(terms())).toEqual([]);
  });

  it("rejects unknown enums and an invalid version", () => {
    const bad = terms({ license: "all-rights" as never, status: "done" as never, reuse: "any" as never, commercialization: "sell" as never, version: 0 });
    expect(fields(validateIpTerms(bad))).toEqual(["commercialization", "license", "reuse", "status", "version"]);
  });

  it("requires an ownership summary and an opaque private-agreement reference", () => {
    expect(fields(validateIpTerms(terms({ ownership: "  " })))).toEqual(["ownership"]);
    expect(fields(validateIpTerms(terms({ privateAgreementRef: "See signed PDF page 4, section 9 with bank details" })))).toEqual(["privateAgreementRef"]);
    expect(validateIpTerms(terms({ privateAgreementRef: undefined }))).toEqual([]);
  });

  it("validates the embargo date, sponsor rights and participants", () => {
    expect(fields(validateIpTerms(terms({ embargoUntil: "soon" })))).toEqual(["embargoUntil"]);
    expect(validateIpTerms(terms({ embargoUntil: null }))).toEqual([]);
    expect(fields(validateIpTerms(terms({ sponsorRights: ["unknown" as never, "acknowledgement"] })))).toEqual(["sponsorRights"]);
    expect(fields(validateIpTerms(terms({ sponsorRights: ["acknowledgement", "acknowledgement"] })))).toEqual(["sponsorRights"]);
    expect(fields(validateIpTerms(terms({ participantIds: [] })))).toEqual(["participantIds"]);
    expect(fields(validateIpTerms(terms({ participantIds: ["u1", "u1"] })))).toEqual(["participantIds"]);
  });

  it("computes embargo status without exposing contents", () => {
    expect(isEmbargoed(terms(), "2026-06-01")).toBe(true);
    expect(isEmbargoed(terms(), "2027-01-01")).toBe(false);
    expect(isEmbargoed(terms({ embargoUntil: null }), "2026-06-01")).toBe(false);
  });
});

describe("public terms view", () => {
  it("keeps only public-safe fields and never private payloads", () => {
    const publicView = publicIpTerms(terms());
    expect(publicView).toEqual({
      license: "cc-by-4.0",
      ownership: terms().ownership,
      reuse: "with-attribution",
      commercialization: "with-approval",
      embargoUntil: "2026-12-31",
      fundingAcknowledgement: "Funded by the Example Foundation.",
    });
    const serialized = JSON.stringify(publicView);
    expect(serialized).not.toContain("ref_deed_001");
    expect(serialized).not.toContain("u1");
    expect(serialized).not.toContain("org1");
    expect(serialized).not.toContain("sponsorRights");
  });
});

describe("participant acceptance", () => {
  it("moves to accepted only when every participant accepts the current version", () => {
    const first = recordAcceptance(terms(), state(), { requestId: "r1", participantId: "u1", decision: "accepted", expectedVersion: 1 });
    expect(first).toMatchObject({ ok: true, status: "pending_acceptance" });
    if (!first.ok) return;
    expect(acceptanceComplete(terms(), first.state)).toBe(false);
    const second = recordAcceptance(terms(), first.state, { requestId: "r2", participantId: "u2", decision: "accepted", expectedVersion: 1 });
    expect(second).toMatchObject({ ok: true, status: "accepted" });
    if (second.ok) expect(acceptanceComplete(terms(), second.state)).toBe(true);
  });

  it("marks the terms rejected if any participant rejects", () => {
    const result = recordAcceptance(terms(), state(), { requestId: "r1", participantId: "u1", decision: "rejected", expectedVersion: 1 });
    expect(result).toMatchObject({ ok: true, status: "rejected" });
  });

  it("replays a retried request id instead of applying it twice", () => {
    const ledger = new Map();
    const request = { requestId: "r1", participantId: "u1", decision: "accepted" as const, expectedVersion: 1 };
    const first = recordAcceptance(terms(), state(), request, ledger);
    const retry = recordAcceptance(terms(), state(), request, ledger);
    expect(first).toMatchObject({ ok: true, replayed: false });
    expect(retry).toMatchObject({ ok: true, replayed: true });
    if (first.ok && retry.ok) expect(retry.state).toEqual(first.state);
    expect(ledger.size).toBe(1);
  });

  it("rejects strangers, stale versions, bad decisions and closed terms", () => {
    expect(recordAcceptance(terms(), state(), { requestId: "r1", participantId: "x", decision: "accepted", expectedVersion: 1 })).toMatchObject({ ok: false, code: "UNKNOWN_PARTICIPANT" });
    expect(recordAcceptance(terms(), state(), { requestId: "r2", participantId: "u1", decision: "accepted", expectedVersion: 2 })).toMatchObject({ ok: false, code: "STALE_VERSION" });
    expect(recordAcceptance(terms(), state(), { requestId: "r3", participantId: "u1", decision: "maybe" as never, expectedVersion: 1 })).toMatchObject({ ok: false, code: "INVALID_DECISION" });
    expect(recordAcceptance(terms({ status: "superseded" }), state(), { requestId: "r4", participantId: "u1", decision: "accepted", expectedVersion: 1 })).toMatchObject({ ok: false, code: "TERMS_CLOSED" });
  });

  it("does not consider acceptances to an older version complete", () => {
    expect(acceptanceComplete(terms({ version: 2 }), state({ version: 1, decisions: { u1: "accepted", u2: "accepted" } }))).toBe(false);
  });
});

describe("audit records", () => {
  it("contains identifiers and metadata only", () => {
    const event = ipAuditEvent("terms.accepted", terms(), "u1", "2026-06-01T00:00:00Z");
    expect(event).toEqual({
      type: "ip.terms.accepted",
      organizationId: "org1",
      projectId: "p1",
      termsId: "ip1",
      version: 1,
      actorId: "u1",
      at: "2026-06-01T00:00:00Z",
    });
    expect(JSON.stringify(event)).not.toContain("ref_deed_001");
    expect(JSON.stringify(event)).not.toContain("jointly own");
  });
});
