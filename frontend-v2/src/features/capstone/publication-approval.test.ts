import { describe, expect, it } from "vitest";
import {
  approvalAuditEvent,
  canRelease,
  requiredSteps,
  submitDecision,
  type ApprovalContext,
  type ApprovalWorkflow,
  type ReleaseContext,
} from "./publication-approval";

const ctx = (over: Partial<ApprovalContext> = {}): ApprovalContext => ({
  organizationId: "org1",
  requiresSponsor: true,
  requiresEthics: true,
  assignedByRole: { author: ["u1"], supervisor: ["u2"], sponsor: ["u3"], ethics: ["u4"], organization: ["u5"] },
  ...over,
});
const workflow = (over: Partial<ApprovalWorkflow> = {}): ApprovalWorkflow => ({
  id: "w1",
  projectId: "p1",
  organizationId: "org1",
  revision: 0,
  status: "collecting",
  decisions: {},
  ...over,
});
const release = (over: Partial<ReleaseContext> = {}): ReleaseContext => ({
  expectedRevision: 0,
  ipTermsAccepted: true,
  embargoed: false,
  publicShowcaseEnabled: true,
  ...over,
});
const approve = (step: "author" | "supervisor" | "sponsor" | "ethics" | "organization", actorId: string, revision: number, requestId?: string) => ({
  requestId: requestId ?? `r-${step}`,
  step,
  actorId,
  decision: "approved" as const,
  expectedRevision: revision,
  at: "2026-06-01T00:00:00Z",
});

/** Walk a workflow through all required approvals in order. */
function fullyApproved(w = workflow(), c = ctx()): ApprovalWorkflow {
  let current = w;
  for (const step of requiredSteps(c)) {
    const result = submitDecision(current, c, approve(step, c.assignedByRole[step]![0]!, current.revision));
    if (!result.ok) throw new Error(result.message);
    current = result.workflow;
  }
  return current;
}

describe("publication approval workflow", () => {
  it("requires only the steps relevant to the project, in order", () => {
    expect(requiredSteps(ctx())).toEqual(["author", "supervisor", "sponsor", "ethics", "organization"]);
    expect(requiredSteps(ctx({ requiresSponsor: false, requiresEthics: false }))).toEqual(["author", "supervisor", "organization"]);
  });

  it("reaches approved after every required step is decided", () => {
    const done = fullyApproved();
    expect(done.status).toBe("approved");
    expect(done.revision).toBe(5);
    expect(Object.keys(done.decisions)).toHaveLength(5);
  });

  it("enforces step order with a stable actionable error", () => {
    const result = submitDecision(workflow(), ctx(), approve("ethics", "u4", 0));
    expect(result).toMatchObject({ ok: false, code: "UNSATISFIED_PREREQUISITE" });
    if (!result.ok) expect(result.message).toContain("author");
  });

  it("denies unknown, unassigned and cross-tenant approvers", () => {
    expect(submitDecision(workflow(), ctx(), approve("author", "u1", 0))).toMatchObject({ ok: true });
    expect(submitDecision(workflow(), ctx(), { ...approve("author", "u1", 0), requestId: "dup" })).toMatchObject({ ok: true });
    expect(submitDecision(workflow(), ctx(), approve("nobody" as never, "u1", 0))).toMatchObject({ ok: false, code: "UNKNOWN_STEP" });
    expect(submitDecision(workflow(), ctx(), approve("supervisor", "u9", 0))).toMatchObject({ ok: false, code: "NOT_ASSIGNED" });
    expect(submitDecision(workflow(), ctx({ organizationId: "org2" }), approve("author", "u1", 0))).toMatchObject({ ok: false, code: "TENANT_MISMATCH" });
  });

  it("rejects stale revisions and duplicate decisions", () => {
    expect(submitDecision(workflow(), ctx(), approve("author", "u1", 3))).toMatchObject({ ok: false, code: "STALE_REVISION" });
    const first = submitDecision(workflow(), ctx(), approve("author", "u1", 0));
    if (!first.ok) return;
    expect(submitDecision(first.workflow, ctx(), approve("author", "u1", 1))).toMatchObject({ ok: false, code: "ALREADY_DECIDED" });
  });

  it("stops collecting when a step is rejected", () => {
    const rejected = submitDecision(workflow(), ctx(), { ...approve("author", "u1", 0), decision: "rejected" });
    expect(rejected).toMatchObject({ ok: true });
    if (!rejected.ok) return;
    expect(rejected.workflow.status).toBe("rejected");
    expect(submitDecision(rejected.workflow, ctx(), approve("supervisor", "u2", 1))).toMatchObject({ ok: false, code: "WORKFLOW_CLOSED" });
  });

  it("replays a retried request id without recording a second decision", () => {
    const ledger = new Map();
    const request = approve("author", "u1", 0, "retry-1");
    const first = submitDecision(workflow(), ctx(), request, ledger);
    const retry = submitDecision(workflow(), ctx(), request, ledger);
    expect(first).toMatchObject({ ok: true, replayed: false });
    expect(retry).toMatchObject({ ok: true, replayed: true });
    if (first.ok && retry.ok) expect(retry.workflow).toEqual(first.workflow);
    expect(ledger.size).toBe(1);
  });
});

describe("release gate", () => {
  it("allows release only when every precondition holds at one revision", () => {
    const done = fullyApproved();
    const c = ctx();
    expect(canRelease(done, c, release({ expectedRevision: done.revision }))).toEqual({ ok: true });
    expect(canRelease(workflow(), c, release())).toMatchObject({ ok: false, code: "NOT_APPROVED" });
    expect(canRelease(done, c, release({ expectedRevision: done.revision - 1 }))).toMatchObject({ ok: false, code: "STALE_REVISION" });
    expect(canRelease(done, c, release({ expectedRevision: done.revision, ipTermsAccepted: false }))).toMatchObject({ ok: false, code: "IP_TERMS_PENDING" });
    expect(canRelease(done, c, release({ expectedRevision: done.revision, embargoed: true }))).toMatchObject({ ok: false, code: "EMBARGOED" });
    expect(canRelease(done, c, release({ expectedRevision: done.revision, publicShowcaseEnabled: false }))).toMatchObject({ ok: false, code: "FEATURE_DISABLED" });
  });
});

describe("audit records", () => {
  it("records identifiers and status, never approval content", () => {
    const event = approvalAuditEvent("approval.submitted", workflow(), "u1", "2026-06-01T00:00:00Z");
    expect(event).toMatchObject({ type: "publication.approval.submitted", projectId: "p1", workflowId: "w1", actorId: "u1", revision: 0 });
    expect(Object.keys(event)).not.toContain("comment");
  });
});
