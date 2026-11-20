import { describe, expect, it } from "vitest";
import {
  isAwaitingReview,
  submitDeliverables,
  submissionAudit,
  validateDeliverables,
  type MilestoneSubmission,
  type SubmissionContext,
} from "./milestone-submissions";

const submission = (): MilestoneSubmission => ({
  id: "sub-1", tenantId: "t1", projectId: "p1", milestoneId: "m1", version: 1,
  state: "draft", createdAt: "2026-01-01T00:00:00Z", deliverables: [],
});
const ctx: SubmissionContext = {
  tenantId: "t1", projectId: "p1", actorId: "student-1", submitterIds: ["student-1"],
  requirements: [{ id: "r1", kind: "file", minimum: 1 }, { id: "r2", kind: "commit", minimum: 1 }],
  projectState: "active",
};
const deliverables = [
  { id: "d1", requirementId: "r1", kind: "file" as const, reference: "sha256:abc", submittedBy: "student-1" },
  { id: "d2", requirementId: "r2", kind: "commit" as const, reference: "deadbeef", submittedBy: "student-1" },
];
const request = { requestId: "req-1", tenantId: "t1", projectId: "p1", milestoneId: "m1", expectedVersion: 1 };

describe("milestone deliverable submission", () => {
  it("rejects unauthorized submitters (deny by default)", () => {
    const result = submitDeliverables(submission(), request, { ...ctx, submitterIds: [] }, deliverables);
    expect(result).toMatchObject({ ok: false, code: "FORBIDDEN" });
  });

  it("enforces tenant and project boundaries", () => {
    const result = submitDeliverables(submission(), { ...request, tenantId: "t2" }, ctx, deliverables);
    expect(result).toMatchObject({ ok: false, code: "TENANT_MISMATCH" });
  });

  it("rejects stale versions and inactive projects with actionable errors", () => {
    expect(submitDeliverables(submission(), { ...request, expectedVersion: 0 }, ctx, deliverables)).toMatchObject({ ok: false, code: "STALE_VERSION" });
    expect(submitDeliverables(submission(), request, { ...ctx, projectState: "completed" }, deliverables)).toMatchObject({ ok: false, code: "INVALID_TRANSITION", allowed: ["active"] });
  });

  it("seals an immutable version that satisfies requirements", () => {
    const before = submission();
    const result = submitDeliverables(before, request, ctx, deliverables);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.submission.version).toBe(2);
    expect(result.submission.state).toBe("submitted");
    expect(before.deliverables).toEqual([]);
    expect(before.version).toBe(1);
  });

  it("replays a retry instead of creating a duplicate version", () => {
    const ledger = new Map();
    const first = submitDeliverables(submission(), request, ctx, deliverables, ledger);
    const retry = submitDeliverables(submission(), request, ctx, deliverables, ledger);
    expect(retry).toMatchObject({ ok: true, replayed: true });
    if (first.ok && retry.ok) expect(retry.submission.version).toBe(first.submission.version);
    expect(ledger.size).toBe(1);
  });

  it("validates requirements and rejects empty or mismatched references", () => {
    const invalid = submission();
    invalid.deliverables = [{ ...deliverables[0]!, reference: "  " }, { ...deliverables[1]!, kind: "text" }];
    expect(validateDeliverables(invalid, ctx)).toContain("d1: a deliverable needs a reference");
    expect(validateDeliverables(invalid, ctx)).toContain("d2: kind must be commit");
    expect(submitDeliverables(submission(), request, ctx, [deliverables[0]!])).toMatchObject({ ok: false, code: "INVALID_DELIVERABLE" });
  });

  it("keeps private payloads out of audit metadata", () => {
    const result = submitDeliverables(submission(), request, ctx, deliverables);
    if (!result.ok) throw new Error("expected success");
    const audit = submissionAudit(result.submission);
    expect(audit).not.toHaveProperty("reference");
    expect(JSON.stringify(audit)).not.toContain("sha256:abc");
  });

  it("detects milestones awaiting a submitted version", () => {
    expect(isAwaitingReview([])).toBe(true);
    expect(isAwaitingReview([{ ...submission(), state: "superseded" }])).toBe(true);
    expect(isAwaitingReview([{ ...submission(), state: "submitted" }])).toBe(false);
  });
});
