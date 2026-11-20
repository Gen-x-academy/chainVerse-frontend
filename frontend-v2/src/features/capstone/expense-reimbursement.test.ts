import { describe, expect, it } from "vitest";
import {
  decideClaim,
  linkPayout,
  newClaimContext,
  submitClaim,
  validateForSubmission,
  viewStateForClaim,
  type ExpenseClaim,
  type ReimbursementPolicy,
} from "./expense-reimbursement";

const policy: ReimbursementPolicy = {
  maxAmountMinor: 50_000n,
  allowedCategories: ["travel", "materials", "software", "services", "other"],
  requireEvidence: true,
  maxEvidenceFiles: 3,
  allowedMediaTypes: ["application/pdf", "image/png"],
  maxEvidenceBytes: 2_000_000,
};

const claim = (over: Partial<ExpenseClaim> = {}): ExpenseClaim => ({
  id: "clm_1",
  tenantId: "tenant_1",
  projectId: "prj_1",
  submitterId: "student_1",
  category: "travel",
  amountMinor: 12_000n,
  currency: "USD",
  evidence: [{ documentId: "doc_1", mediaType: "application/pdf", sizeBytes: 1000 }],
  privateNote: "private medical detail",
  status: "draft",
  revision: 2,
  ...over,
});

const submit = (over = {}) => ({
  requestId: "req_1",
  actorId: "student_1",
  actorTenantId: "tenant_1",
  expectedRevision: 2,
  reviewerId: "reviewer_1",
  now: "2026-11-20T10:00:00Z",
  ...over,
});

describe("expense reimbursement claims", () => {
  it("submits a policy-compliant claim with a separated reviewer", () => {
    const result = submitClaim(claim(), submit());
    expect(result).toMatchObject({ ok: true, replayed: false, claim: { status: "under_review", reviewerId: "reviewer_1", revision: 3 } });
    if (result.ok) {
      expect(result.audit.type).toBe("claim.submitted");
      expect(JSON.stringify(result.audit)).not.toContain("private medical detail");
      expect(JSON.stringify(result.audit)).not.toContain("doc_1");
    }
  });

  it("validates category, amount and constrained evidence", () => {
    expect(validateForSubmission(claim(), policy)).toEqual([]);
    expect(submitClaim(claim({ amountMinor: 60_000n }), submit(), policy)).toMatchObject({ ok: false, code: "POLICY_INVALID", issues: [{ field: "amountMinor" }] });
    expect(submitClaim(claim({ evidence: [] }), submit(), policy)).toMatchObject({ ok: false, code: "POLICY_INVALID" });
    expect(submitClaim(claim({ evidence: [{ documentId: "d", mediaType: "text/html", sizeBytes: 10 }] }), submit(), policy)).toMatchObject({ ok: false, code: "POLICY_INVALID" });
  });

  it("is deny-by-default, tenant-scoped and stale-safe", () => {
    expect(submitClaim(claim(), submit({ actorId: "other" }))).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(submitClaim(claim(), submit({ actorTenantId: "tenant_2" }))).toMatchObject({ ok: false, code: "TENANT_MISMATCH" });
    expect(submitClaim(claim(), submit({ expectedRevision: 1 }))).toMatchObject({ ok: false, code: "STALE_REVISION" });
    expect(submitClaim(claim(), submit({ reviewerId: "student_1" }))).toMatchObject({ ok: false, code: "REVIEWER_SEPARATION" });
    expect(submitClaim(claim({ status: "paid" }), submit())).toMatchObject({ ok: false, code: "INVALID_STATE" });
  });

  it("enforces reviewer separation and requires a rejection reason", () => {
    const pending = claim({ status: "under_review", reviewerId: "reviewer_1", revision: 3 });
    const decide = (over = {}) => ({ requestId: "d1", actorId: "reviewer_1", actorTenantId: "tenant_1", expectedRevision: 3, decision: "approve" as const, now: "2026-11-20T11:00:00Z", ...over });
    expect(decideClaim(pending, decide({ actorId: "student_1" }))).toMatchObject({ ok: false, code: "REVIEWER_SEPARATION" });
    expect(decideClaim(pending, decide({ decision: "reject" }))).toMatchObject({ ok: false, code: "REASON_REQUIRED" });
    const rejected = decideClaim(pending, decide({ decision: "reject", reason: "  Receipt incomplete  " }));
    expect(rejected).toMatchObject({ ok: true, claim: { status: "rejected", decisionReason: "Receipt incomplete", revision: 4 } });
    if (rejected.ok) expect(JSON.stringify(rejected.audit)).not.toContain("Receipt incomplete");
    expect(decideClaim(pending, decide()).ok).toBe(true);
    expect(decideClaim(claim({ status: "draft" }), decide())).toMatchObject({ ok: false, code: "INVALID_STATE" });
  });

  it("links one payout and never duplicates claims or payouts on retry", () => {
    const context = newClaimContext();
    const first = submitClaim(claim(), submit(), policy, context);
    const retry = submitClaim(claim(), submit(), policy, context);
    expect(first.ok && retry.ok && retry.replayed).toBe(true);
    const duplicate = submitClaim(claim(), submit({ requestId: "req_2" }), policy, context);
    expect(duplicate).toMatchObject({ ok: false, code: "PAYOUT_CONFLICT" });
    expect(viewStateForClaim(duplicate)).toBe("conflict");

    const approved = claim({ status: "approved", reviewerId: "reviewer_1", revision: 4 });
    const pay = (over = {}) => ({ requestId: "p1", actorId: "finance_1", actorTenantId: "tenant_1", expectedRevision: 4, payoutReference: "po_1", now: "2026-11-20T12:00:00Z", ...over });
    const paid = linkPayout(approved, pay(), context);
    expect(paid).toMatchObject({ ok: true, claim: { status: "paid", payoutReference: "po_1", revision: 5 } });
    expect(linkPayout(approved, pay(), context)).toMatchObject({ ok: true, replayed: true });
    expect(linkPayout(approved, pay({ requestId: "p2", payoutReference: "po_1" }), context)).toMatchObject({ ok: true, replayed: true });
    expect(linkPayout(claim({ id: "clm_2", status: "approved", revision: 4 }), pay({ requestId: "p3", payoutReference: "po_1" }), context)).toMatchObject({ ok: false, code: "PAYOUT_CONFLICT" });
    expect(linkPayout(claim({ status: "under_review" }), pay({ requestId: "p4", payoutReference: "po_3" }), context)).toMatchObject({ ok: false, code: "INVALID_STATE" });

    expect(viewStateForClaim(paid)).toBe("success");
    expect(viewStateForClaim(undefined)).toBe("empty");
    expect(viewStateForClaim(undefined, true)).toBe("loading");
  });
});
