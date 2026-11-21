import { describe, expect, it } from "vitest";
import {
  caseAuditEvent,
  caseTimer,
  routingTarget,
  triageCase,
  type SafetyCase,
  type TriageContext,
} from "./case-triage";

const safetyCase = (over: Partial<SafetyCase> = {}): SafetyCase => ({
  id: "case1",
  projectId: "p1",
  organizationId: "org1",
  severity: "high",
  reportedAt: "2026-06-01T00:00:00Z",
  state: "new",
  revision: 0,
  requiresAgePolicy: false,
  hasConflict: false,
  hasFundingImpact: false,
  responderScope: "organization",
  assigneeId: null,
  ...over,
});
const ctx = (over: Partial<TriageContext> = {}): TriageContext => ({
  organizationId: "org1",
  responders: { safety: ["s1"], ethics: ["e1"], finance: ["f1"], organization: ["o1"] },
  now: "2026-06-01T01:00:00Z",
  ...over,
});
const request = (over: Partial<Parameters<typeof triageCase>[2]> = {}) => ({
  requestId: "r1",
  actorId: "o1",
  expectedRevision: 0,
  to: "triaged" as const,
  at: "2026-06-01T01:00:00Z",
  ...over,
});

describe("case routing", () => {
  it("routes by severity, conflict, funding, age policy then scope", () => {
    expect(routingTarget(safetyCase({ severity: "critical", hasConflict: true }))).toBe("safety");
    expect(routingTarget(safetyCase({ hasConflict: true, hasFundingImpact: true }))).toBe("ethics");
    expect(routingTarget(safetyCase({ hasFundingImpact: true, requiresAgePolicy: true }))).toBe("finance");
    expect(routingTarget(safetyCase({ requiresAgePolicy: true }))).toBe("organization");
    expect(routingTarget(safetyCase({ responderScope: "ethics" }))).toBe("ethics");
  });

  it("derives severity timers and detects overdue cases", () => {
    const timer = caseTimer(safetyCase(), "2026-06-01T01:00:00Z");
    expect(timer.dueAt).toBe("2026-06-02T00:00:00.000Z");
    expect(timer.remainingMs).toBe(23 * 3_600_000);
    expect(timer.overdue).toBe(false);
    expect(caseTimer(safetyCase(), "2026-06-03T00:00:00Z").overdue).toBe(true);
    expect(caseTimer(safetyCase({ severity: "critical" }), "2026-06-01T05:00:00Z").overdue).toBe(true);
    expect(caseTimer(safetyCase({ severity: "critical" }), ctx().now).escalationTarget).toBe("safety");
  });
});

describe("triage decisions", () => {
  it("routes an in-time case and assigns the responder", () => {
    const result = triageCase(safetyCase(), ctx(), request());
    expect(result).toMatchObject({ ok: true, replayed: false });
    if (result.ok) {
      expect(result.safetyCase.state).toBe("triaged");
      expect(result.safetyCase.assigneeId).toBe("o1");
      expect(result.safetyCase.revision).toBe(1);
    }
  });

  it("escalates automatically when the SLA timer has expired", () => {
    const result = triageCase(safetyCase(), ctx({ now: "2026-06-05T00:00:00Z" }), request());
    expect(result.ok && result.safetyCase.state).toBe("escalated");
  });

  it("denies unauthorized and cross-tenant actors by default", () => {
    expect(triageCase(safetyCase(), ctx(), request({ actorId: "stranger" }))).toMatchObject({ ok: false, code: "NOT_AUTHORIZED" });
    expect(triageCase(safetyCase(), ctx({ organizationId: "org2" }), request())).toMatchObject({ ok: false, code: "TENANT_MISMATCH" });
    expect(triageCase(safetyCase({ severity: "critical" }), ctx(), request())).toMatchObject({ ok: false, code: "NOT_AUTHORIZED" });
  });

  it("rejects stale revisions and invalid transitions with actionable errors", () => {
    expect(triageCase(safetyCase(), ctx(), request({ expectedRevision: 5 }))).toMatchObject({ ok: false, code: "STALE_REVISION" });
    const invalid = triageCase(safetyCase(), ctx(), request({ to: "resolved" }));
    expect(invalid).toMatchObject({ ok: false, code: "INVALID_TRANSITION" });
    if (!invalid.ok) expect(invalid.message).toContain("triaged");
    expect(triageCase(safetyCase({ state: "closed" }), ctx(), request())).toMatchObject({ ok: false, code: "CASE_CLOSED" });
    expect(triageCase(safetyCase({ severity: "urgent" as never }), ctx(), request())).toMatchObject({ ok: false, code: "UNKNOWN_SEVERITY" });
  });

  it("does not assign a second responder", () => {
    expect(triageCase(safetyCase({ assigneeId: "o2" }), ctx(), request())).toMatchObject({ ok: false, code: "ALREADY_ASSIGNED" });
  });

  it("replays a retried request without duplicating the decision", () => {
    const ledger = new Map();
    const r = request();
    const first = triageCase(safetyCase(), ctx(), r, ledger);
    const retry = triageCase(safetyCase(), ctx(), r, ledger);
    expect(first).toMatchObject({ ok: true, replayed: false });
    expect(retry).toMatchObject({ ok: true, replayed: true });
    if (first.ok && retry.ok) expect(retry.safetyCase).toEqual(first.safetyCase);
    expect(ledger.size).toBe(1);
  });
});

describe("audited access", () => {
  it("records identifiers and metadata only", () => {
    const event = caseAuditEvent("case.accessed", safetyCase(), "o1", "2026-06-01T01:00:00Z");
    expect(event).toMatchObject({ type: "integrity.case.accessed", organizationId: "org1", projectId: "p1", caseId: "case1", severity: "high", actorId: "o1" });
    expect(Object.keys(event)).not.toContain("narrative");
  });
});
