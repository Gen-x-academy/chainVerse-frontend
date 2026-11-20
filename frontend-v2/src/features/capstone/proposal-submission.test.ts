import { describe, expect, it } from "vitest";
import { emptyLedger, submitProposal, withdrawSubmission, type SubmissionContext, type SubmissionRequest } from "./proposal-submission";

const req = (over: Partial<SubmissionRequest> = {}): SubmissionRequest => ({
  idempotencyKey: "k1",
  proposalId: "p1",
  ownerId: "u1",
  callId: "c1",
  formVersion: 2,
  callVersion: 3,
  revision: 7,
  submittedAt: "2026-03-01T10:00:00.000Z",
  ...over,
});
const ctx = (over: Partial<SubmissionContext> = {}): SubmissionContext => ({ currentFormVersion: 2, currentCallVersion: 3, currentRevision: 7, callOpen: true, requirementIssues: [], ...over });

describe("atomic submission", () => {
  it("freezes the versions it was submitted under", () => {
    const { ledger, outcome } = submitProposal(emptyLedger(), req(), ctx());
    expect(outcome.ok && outcome.submission).toMatchObject({ formVersion: 2, callVersion: 3, revision: 7, status: "active" });
    expect(ledger.submissions).toHaveLength(1);
  });

  it("returns the same result for a retry and does not submit twice", () => {
    const first = submitProposal(emptyLedger(), req(), ctx());
    const retry = submitProposal(first.ledger, req(), ctx());
    expect(retry.ledger).toBe(first.ledger);
    expect(retry.ledger.submissions).toHaveLength(1);
    expect(retry.outcome.ok && retry.outcome.replayed).toBe(true);
    expect(retry.outcome.ok && first.outcome.ok && retry.outcome.submission.id).toBe(first.outcome.ok && first.outcome.submission.id);
  });

  it("replays a stored failure instead of re-evaluating", () => {
    const failed = submitProposal(emptyLedger(), req(), ctx({ callOpen: false }));
    const retry = submitProposal(failed.ledger, req(), ctx());
    expect(retry.outcome).toMatchObject({ ok: false, code: "call_closed" });
  });

  it("rejects a key reused for different data", () => {
    const first = submitProposal(emptyLedger(), req(), ctx());
    const other = submitProposal(first.ledger, req({ proposalId: "p2" }), ctx());
    expect(other.outcome).toMatchObject({ ok: false, code: "key_reused" });
  });

  it("rejects stale versions and revisions with stable codes", () => {
    expect(submitProposal(emptyLedger(), req(), ctx({ currentFormVersion: 3 })).outcome).toMatchObject({ code: "stale_form_version" });
    expect(submitProposal(emptyLedger(), req(), ctx({ currentCallVersion: 4 })).outcome).toMatchObject({ code: "stale_call_version" });
    expect(submitProposal(emptyLedger(), req(), ctx({ currentRevision: 8 })).outcome).toMatchObject({ code: "stale_revision" });
  });

  it("rejects an unmet requirement and lists what is missing", () => {
    const { outcome } = submitProposal(emptyLedger(), req(), ctx({ requirementIssues: ["answers.why"] }));
    expect(outcome).toMatchObject({ ok: false, code: "requirements_unmet", details: ["answers.why"] });
  });

  it("allows only one active submission per owner and call", () => {
    const first = submitProposal(emptyLedger(), req(), ctx());
    const second = submitProposal(first.ledger, req({ idempotencyKey: "k2", proposalId: "p2" }), ctx());
    expect(second.outcome).toMatchObject({ ok: false, code: "duplicate_active_submission" });
  });

  it("allows a new submission after withdrawal", () => {
    const first = submitProposal(emptyLedger(), req(), ctx());
    const id = first.outcome.ok ? first.outcome.submission.id : "";
    const withdrawn = withdrawSubmission(first.ledger, id);
    const again = submitProposal(withdrawn, req({ idempotencyKey: "k2" }), ctx());
    expect(again.outcome.ok).toBe(true);
    expect(again.ledger.submissions).toHaveLength(2);
  });

  it("does not change the input ledger", () => {
    const start = emptyLedger();
    submitProposal(start, req(), ctx());
    expect(start).toEqual({ submissions: [], intents: {} });
  });
});
