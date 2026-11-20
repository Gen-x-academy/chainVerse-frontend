import { describe, expect, it } from "vitest";
import { newDraft, type CallWindow, type ProposalDraft } from "./proposal-drafts";
import {
  MAX_SUBMISSION_VERSIONS,
  MAX_WITHDRAWAL_REASON,
  canWithdraw,
  resubmitBlocker,
  resubmitProposal,
  withdrawSubmission,
  type ProposalSubmission,
  type ResubmitLedger,
  type WithdrawLedger,
} from "./proposal-withdrawal";

const call: CallWindow = { id: "cal_1", projectsStartOn: "2026-03-15", projectsEndOn: "2026-09-01", open: true };
const long = (n: number) => "x".repeat(n);
const submission = (over: Partial<ProposalSubmission> = {}): ProposalSubmission => ({
  proposalId: "prp_1",
  ownerId: "u1",
  callId: "cal_1",
  version: 1,
  status: "submitted",
  submittedAt: "2026-04-01T10:00:00Z",
  revision: 3,
  ...over,
});
const withdraw = (over = {}) => ({ requestId: "r1", actorId: "u1", expectedRevision: 3, now: "2026-04-05T09:00:00Z", ...over });
const draft = (): ProposalDraft => ({
  ...newDraft("prp_1", "u1", "cal_1"),
  title: "Open climate dashboard",
  abstract: long(60),
  problem: long(60),
  objectives: ["Publish an open dataset"],
  methods: long(40),
  expectedOutputs: ["Dataset"],
  timeline: { startsOn: "2026-04-01", endsOn: "2026-08-01" },
  risks: ["Data access delays"],
  resources: "Laptop",
  preferredRoles: ["developer"],
});
const resubmit = (over = {}) => ({ requestId: "s1", actorId: "u1", draft: draft(), call, now: "2026-04-10T09:00:00Z", ...over });

describe("proposal withdrawal", () => {
  it("withdraws a submitted or in-review proposal and records when and why", () => {
    const result = withdrawSubmission(submission(), withdraw({ reason: "  Changing scope  " }));
    expect(result).toMatchObject({ ok: true, replayed: false, submission: { status: "withdrawn", withdrawnAt: "2026-04-05T09:00:00Z", withdrawalReason: "Changing scope", revision: 4 } });
    expect(withdrawSubmission(submission({ status: "under_review" }), withdraw()).ok).toBe(true);
    expect(canWithdraw(submission())).toBe(true);
    expect(canWithdraw(submission({ status: "decided" }))).toBe(false);
  });

  it("omits a blank reason", () => {
    const result = withdrawSubmission(submission(), withdraw({ reason: "   " }));
    expect(result.ok && "withdrawalReason" in result.submission).toBe(false);
  });

  it("is deny-by-default: only the owner can withdraw", () => {
    expect(withdrawSubmission(submission(), withdraw({ actorId: "someone" }))).toMatchObject({ ok: false, code: "NOT_OWNER" });
  });

  it("refuses once a decision is recorded", () => {
    expect(withdrawSubmission(submission({ status: "decided" }), withdraw())).toMatchObject({ ok: false, code: "NOT_WITHDRAWABLE" });
  });

  it("rejects a stale revision and an over-long reason", () => {
    expect(withdrawSubmission(submission(), withdraw({ expectedRevision: 2 }))).toMatchObject({ ok: false, code: "STALE_REVISION" });
    expect(withdrawSubmission(submission(), withdraw({ reason: long(MAX_WITHDRAWAL_REASON + 1) }))).toMatchObject({ ok: false, code: "REASON_TOO_LONG" });
    expect(withdrawSubmission(submission(), withdraw({ reason: long(MAX_WITHDRAWAL_REASON) })).ok).toBe(true);
  });

  it("applies a retried request once and replays its outcome", () => {
    const ledger: WithdrawLedger = new Map();
    const first = withdrawSubmission(submission(), withdraw(), ledger);
    const retry = withdrawSubmission(submission(), withdraw(), ledger);
    expect(first).toMatchObject({ ok: true, replayed: false });
    expect(retry).toMatchObject({ ok: true, replayed: true });
    expect(retry.ok && first.ok && retry.submission).toEqual(first.ok && first.submission);
  });

  it("treats a second withdrawal of the same proposal as a no-op", () => {
    const already = submission({ status: "withdrawn", revision: 4, withdrawnAt: "2026-04-05T09:00:00Z" });
    const result = withdrawSubmission(already, withdraw({ requestId: "other", expectedRevision: 1 }));
    expect(result).toMatchObject({ ok: true, replayed: true });
    expect(result.ok && result.submission).toEqual(already);
  });

  it("replays a failed outcome without re-evaluating", () => {
    const ledger: WithdrawLedger = new Map();
    withdrawSubmission(submission(), withdraw({ actorId: "intruder" }), ledger);
    expect(withdrawSubmission(submission(), withdraw({ actorId: "u1" }), ledger)).toMatchObject({ ok: false, code: "NOT_OWNER" });
  });
});

describe("proposal resubmission", () => {
  const withdrawn = (over: Partial<ProposalSubmission> = {}) => submission({ status: "withdrawn", ...over });

  it("creates the next version and leaves the withdrawn one untouched", () => {
    const original = withdrawn();
    const result = resubmitProposal(original, resubmit());
    expect(result).toMatchObject({ ok: true, replayed: false, submission: { proposalId: "prp_1", version: 2, status: "submitted", submittedAt: "2026-04-10T09:00:00Z", revision: 1 } });
    expect(result.ok && result.previous).toBe(original);
    expect(original.status).toBe("withdrawn");
  });

  it("only resubmits a withdrawn proposal", () => {
    for (const status of ["submitted", "under_review", "decided"] as const) {
      expect(resubmitProposal(submission({ status }), resubmit())).toMatchObject({ ok: false, code: "NOT_WITHDRAWN" });
    }
  });

  it("limits the number of versions", () => {
    expect(MAX_SUBMISSION_VERSIONS).toBe(3);
    expect(resubmitProposal(withdrawn({ version: 2 }), resubmit()).ok).toBe(true);
    expect(resubmitProposal(withdrawn({ version: 3 }), resubmit())).toMatchObject({ ok: false, code: "VERSION_LIMIT" });
  });

  it("requires the call to exist, match and still be open", () => {
    expect(resubmitProposal(withdrawn(), resubmit({ call: undefined }))).toMatchObject({ ok: false, code: "CALL_MISMATCH" });
    expect(resubmitProposal(withdrawn(), resubmit({ call: { ...call, id: "cal_2" } }))).toMatchObject({ ok: false, code: "CALL_MISMATCH" });
    expect(resubmitProposal(withdrawn(), resubmit({ call: { ...call, open: false } }))).toMatchObject({ ok: false, code: "CALL_CLOSED" });
    expect(resubmitBlocker(withdrawn(), call)).toBeNull();
  });

  it("is deny-by-default: the actor and the draft must belong to the owner", () => {
    expect(resubmitProposal(withdrawn(), resubmit({ actorId: "u2" }))).toMatchObject({ ok: false, code: "NOT_OWNER" });
    expect(resubmitProposal(withdrawn(), resubmit({ draft: { ...draft(), ownerId: "u2" } }))).toMatchObject({ ok: false, code: "NOT_OWNER" });
  });

  it("rejects a draft that is already submitted or still incomplete", () => {
    expect(resubmitProposal(withdrawn(), resubmit({ draft: { ...draft(), status: "submitted" } }))).toMatchObject({ ok: false, code: "DRAFT_ALREADY_SUBMITTED" });
    const result = resubmitProposal(withdrawn(), resubmit({ draft: { ...draft(), title: "" } }));
    expect(result).toMatchObject({ ok: false, code: "DRAFT_INVALID" });
    expect(!result.ok && result.issues.map((i) => i.field)).toContain("title");
  });

  it("rejects a draft for a different call", () => {
    const result = resubmitProposal(withdrawn(), resubmit({ draft: { ...draft(), callId: "cal_2" } }));
    expect(result).toMatchObject({ ok: false, code: "DRAFT_INVALID" });
  });

  it("applies a retried request once", () => {
    const ledger: ResubmitLedger = new Map();
    const first = resubmitProposal(withdrawn(), resubmit(), ledger);
    const retry = resubmitProposal(withdrawn(), resubmit(), ledger);
    expect(first).toMatchObject({ ok: true, replayed: false });
    expect(retry).toMatchObject({ ok: true, replayed: true });
    expect(retry.ok && first.ok && retry.submission).toEqual(first.ok && first.submission);
  });
});
