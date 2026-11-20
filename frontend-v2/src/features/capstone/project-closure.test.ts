import { describe, expect, it } from "vitest";
import { afterClosure, closeProject, impliedStatus, type ClosureContext, type ClosureInput, type ClosureOutcome } from "./project-closure";

const outcome = (over: Partial<ClosureOutcome> = {}): ClosureOutcome => ({ status: "all_objectives_met", objectivesMet: 3, objectivesTotal: 3, deliverablesHandedOver: ["d1", "d1", "d2"], summary: "Delivered the study", ...over });
const ctx = (over: Partial<ClosureContext> = {}): ClosureContext => ({ participantIds: ["u1", "u2"], daysInactive: 0, alreadyClosed: false, openObligations: [], ...over });
const input = (over: Partial<ClosureInput> = {}): ClosureInput => ({ projectId: "p1", kind: "completed", closedOn: "2026-06-01", closedBy: "u1", outcome: outcome(), ...over });
const code = (r: ReturnType<typeof closeProject>) => (r.ok ? "ok" : r.code);

describe("outcome", () => {
  it("derives the status from the counts", () => {
    expect(impliedStatus(3, 3)).toBe("all_objectives_met");
    expect(impliedStatus(1, 3)).toBe("partly_met");
    expect(impliedStatus(0, 3)).toBe("not_met");
    expect(impliedStatus(0, 0)).toBe("not_met");
  });

  it("rejects an outcome that disagrees with its numbers", () => {
    expect(code(closeProject(input({ outcome: outcome({ status: "partly_met" }) }), ctx()))).toBe("bad_outcome");
    expect(code(closeProject(input({ outcome: outcome({ objectivesMet: 4 }) }), ctx()))).toBe("bad_outcome");
    expect(code(closeProject(input({ outcome: outcome({ summary: " " }) }), ctx()))).toBe("needs_summary");
  });
});

describe("completion", () => {
  it("closes and removes duplicate deliverables", () => {
    const r = closeProject(input(), ctx());
    expect(r.ok && r.closure.outcome.deliverablesHandedOver).toEqual(["d1", "d2"]);
  });

  it("refuses completion with no objectives met or open obligations", () => {
    expect(code(closeProject(input({ outcome: outcome({ status: "not_met", objectivesMet: 0 }) }), ctx()))).toBe("bad_outcome");
    const blocked = closeProject(input(), ctx({ openObligations: ["final report"] }));
    expect(blocked).toMatchObject({ ok: false, code: "open_obligations", details: ["final report"] });
  });

  it("allows a partly met completion", () => {
    expect(code(closeProject(input({ outcome: outcome({ status: "partly_met", objectivesMet: 2 }) }), ctx()))).toBe("ok");
  });
});

describe("other ways to close", () => {
  const unmet = outcome({ status: "not_met", objectivesMet: 0 });

  it("mutual termination needs every participant", () => {
    expect(code(closeProject(input({ kind: "mutual_termination", outcome: unmet, agreedBy: ["u1"] }), ctx()))).toBe("needs_unanimous_agreement");
    const r = closeProject(input({ kind: "mutual_termination", outcome: unmet, agreedBy: ["u1", "u2", "u2"] }), ctx());
    expect(r.ok && r.closure.agreedBy).toEqual(["u1", "u2"]);
  });

  it("inactivity needs enough idle days", () => {
    expect(code(closeProject(input({ kind: "inactivity", outcome: unmet }), ctx({ daysInactive: 59 })))).toBe("not_inactive");
    expect(code(closeProject(input({ kind: "inactivity", outcome: unmet }), ctx({ daysInactive: 60 })))).toBe("ok");
  });

  it("policy action and sponsor withdrawal need a reference", () => {
    expect(code(closeProject(input({ kind: "policy_action", outcome: unmet }), ctx()))).toBe("needs_authority");
    const r = closeProject(input({ kind: "sponsor_withdrawal", outcome: unmet, authorityRef: " notice-17 " }), ctx());
    expect(r.ok && r.closure.authorityRef).toBe("notice-17");
  });

  it("cannot close twice", () => {
    expect(code(closeProject(input(), ctx({ alreadyClosed: true })))).toBe("already_closed");
  });
});

describe("after closure", () => {
  it("is read-only and only completed projects can earn credentials", () => {
    expect(afterClosure("completed")).toEqual({ readOnly: true, credentialsEligible: true, exportAllowed: true });
    expect(afterClosure("inactivity").credentialsEligible).toBe(false);
  });
});
