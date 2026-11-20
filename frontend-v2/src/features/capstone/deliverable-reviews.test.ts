import { describe, expect, it } from "vitest";
import {
  decideReview,
  reviewAudit,
  validateReview,
  weightedScore,
  type ReviewContext,
  type ReviewRecord,
} from "./deliverable-reviews";

const criteria = [
  { id: "accuracy", label: "Accuracy", weightBps: 6000, maximum: 5 },
  { id: "clarity", label: "Clarity", weightBps: 4000, maximum: 5 },
];
const review = (): ReviewRecord => ({
  id: "rev-1", tenantId: "t1", projectId: "p1", submissionId: "sub-1", submissionVersion: 2,
  reviewerId: "reviewer-1", decision: "accept",
  scores: [{ criterionId: "accuracy", score: 5 }, { criterionId: "clarity", score: 4 }],
  reason: "The repository, demo and report all satisfy the stated rubric.", decidedAt: "2026-01-02T00:00:00Z",
});
const ctx: ReviewContext = {
  tenantId: "t1", projectId: "p1", actorId: "reviewer-1", reviewerIds: ["reviewer-1"],
  criteria, currentVersion: 2, currentState: "submitted",
};
const request = { requestId: "req-1", tenantId: "t1", projectId: "p1", submissionId: "sub-1", expectedVersion: 2 };

describe("milestone deliverable review", () => {
  it("denies non-reviewers and enforces tenant boundaries", () => {
    expect(decideReview(review(), request, { ...ctx, reviewerIds: [] })).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(decideReview(review(), { ...request, projectId: "p2" }, ctx)).toMatchObject({ ok: false, code: "TENANT_MISMATCH" });
  });

  it("rejects stale or non-reviewable submissions", () => {
    expect(decideReview(review(), { ...request, expectedVersion: 1 }, ctx)).toMatchObject({ ok: false, code: "STALE_VERSION" });
    expect(decideReview(review(), request, { ...ctx, currentState: "superseded" })).toMatchObject({ ok: false, code: "NOT_REVIEWABLE" });
  });

  it("supports request-changes, accept and reject decisions", () => {
    for (const decision of ["request-changes", "accept", "reject"] as const) {
      const result = decideReview({ ...review(), decision }, request, ctx);
      expect(result.ok).toBe(true);
    }
  });

  it("validates rubric coverage and reasoned decisions", () => {
    expect(weightedScore(review().scores, criteria)).toBe(92);
    expect(weightedScore([{ criterionId: "accuracy", score: 5 }], criteria)).toBeNull();
    expect(validateReview({ ...review(), reason: "ok" }, ctx)).toContain("reason: give a reasoned decision of 20 to 4000 characters");
    expect(validateReview(review(), { ...ctx, criteria: [] })).toContain("criteria: rubric weights must add up to 10000 basis points");
    expect(decideReview({ ...review(), scores: [{ criterionId: "accuracy", score: 9 }] }, request, ctx)).toMatchObject({ ok: false, code: "INVALID_RUBRIC" });
  });

  it("replays retries without duplicating the decision", () => {
    const ledger = new Map();
    const first = decideReview(review(), request, ctx, ledger);
    const retry = decideReview(review(), request, ctx, ledger);
    expect(retry).toMatchObject({ ok: true, replayed: true });
    if (first.ok && retry.ok) expect(retry.review.id).toBe(first.review.id);
    expect(ledger.size).toBe(1);
  });

  it("omits reasons and scores from audit records", () => {
    const result = decideReview(review(), request, ctx);
    if (!result.ok) throw new Error("expected success");
    expect(reviewAudit(result.review)).not.toHaveProperty("reason");
    expect(JSON.stringify(reviewAudit(result.review))).not.toContain("satisfy the stated rubric");
  });
});
