import { describe, expect, it } from "vitest";
import {
  PROJECT_STATES,
  PROJECT_TRANSITIONS,
  allowedTransitions,
  applyTransition,
  canTransition,
  type LifecycleProject,
} from "./project-lifecycle";

const project = (state: LifecycleProject["state"] = "draft", revision = 1): LifecycleProject => ({ id: "p1", state, revision });

describe("project lifecycle state machine", () => {
  it("defines every documented state with only known targets", () => {
    expect(PROJECT_STATES).toHaveLength(13);
    for (const state of PROJECT_STATES) {
      for (const target of PROJECT_TRANSITIONS[state]) expect(PROJECT_STATES).toContain(target);
      expect(PROJECT_TRANSITIONS[state]).not.toContain(state);
    }
    expect(allowedTransitions("archived")).toEqual([]);
  });

  it("applies a valid transition and bumps the revision", () => {
    const result = applyTransition(project("draft", 3), { requestId: "r1", to: "proposed", expectedRevision: 3 });
    expect(result).toMatchObject({ ok: true, replayed: false, project: { state: "proposed", revision: 4 } });
  });

  it("walks the happy path from draft to archived", () => {
    let p = project();
    const path = ["proposed", "screening", "approved", "recruiting", "active", "under-review", "completed", "published", "archived"] as const;
    path.forEach((to, i) => {
      const r = applyTransition(p, { requestId: `r${i}`, to, expectedRevision: p.revision });
      expect(r.ok).toBe(true);
      if (r.ok) p = r.project;
    });
    expect(p.state).toBe("archived");
  });

  it("rejects invalid transitions with an actionable message and the allowed list", () => {
    const r = applyTransition(project("draft"), { requestId: "x", to: "published", expectedRevision: 1 });
    expect(r).toMatchObject({ ok: false, code: "INVALID_TRANSITION", allowed: ["proposed", "cancelled"] });
    if (!r.ok) expect(r.message).toMatch(/cannot become published/);
  });

  it("rejects stale revisions before looking at the edge", () => {
    const r = applyTransition(project("draft", 5), { requestId: "x", to: "proposed", expectedRevision: 4 });
    expect(r).toMatchObject({ ok: false, code: "STALE_REVISION" });
  });

  it("rejects unknown states and no-op transitions", () => {
    expect(applyTransition(project(), { requestId: "a", to: "nope" as never, expectedRevision: 1 })).toMatchObject({ code: "UNKNOWN_STATE" });
    expect(applyTransition(project(), { requestId: "b", to: "draft", expectedRevision: 1 })).toMatchObject({ code: "ALREADY_IN_STATE" });
  });

  it("is idempotent: a retried request id returns the original outcome and never applies twice", () => {
    const ledger = new Map();
    const p = project("draft", 1);
    const first = applyTransition(p, { requestId: "same", to: "proposed", expectedRevision: 1 }, ledger);
    const retry = applyTransition(p, { requestId: "same", to: "proposed", expectedRevision: 1 }, ledger);
    expect(first).toMatchObject({ ok: true, replayed: false });
    expect(retry).toMatchObject({ ok: true, replayed: true, project: { state: "proposed", revision: 2 } });
    // The input project is never mutated.
    expect(p).toEqual({ id: "p1", state: "draft", revision: 1 });
  });

  it("a second concurrent request on the old revision is rejected as stale", () => {
    const ledger = new Map();
    const p = project("recruiting", 7);
    const a = applyTransition(p, { requestId: "a", to: "active", expectedRevision: 7 }, ledger);
    expect(a.ok).toBe(true);
    // The other client also started from revision 7, so the revision it holds is now stale.
    const next = a.ok ? a.project : p;
    expect(applyTransition(next, { requestId: "b", to: "cancelled", expectedRevision: 7 }, ledger)).toMatchObject({ ok: false, code: "STALE_REVISION" });
  });

  it("canTransition mirrors the table", () => {
    expect(canTransition("active", "paused")).toBe(true);
    expect(canTransition("cancelled", "active")).toBe(false);
  });
});
