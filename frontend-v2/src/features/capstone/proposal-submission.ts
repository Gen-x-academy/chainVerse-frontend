/**
 * Atomic proposal submission (CAPSTONE-038).
 *
 * Submitting freezes the form and call versions the proposal was answered
 * under, checks every requirement, refuses a second active submission to the
 * same call, and records the intent under an idempotency key so a retried
 * request returns the original result instead of submitting twice.
 * `submitProposal` is a pure step: it takes the current ledger and returns the
 * next one together with the outcome, so a caller can apply it in one write.
 */

export interface SubmissionRequest {
  /** Client-generated key, the same for every retry of one submit action. */
  idempotencyKey: string;
  proposalId: string;
  ownerId: string;
  callId: string;
  formVersion: number;
  callVersion: number;
  /** Proposal revision the participant saw when pressing submit. */
  revision: number;
  submittedAt: string;
}

export interface FrozenSubmission {
  id: string;
  proposalId: string;
  ownerId: string;
  callId: string;
  formVersion: number;
  callVersion: number;
  revision: number;
  submittedAt: string;
  status: "active" | "withdrawn";
}

export interface SubmissionContext {
  currentFormVersion: number;
  currentCallVersion: number;
  currentRevision: number;
  callOpen: boolean;
  /** Result of validating the answers, attachments and preflight, already combined. */
  requirementIssues: string[];
}

export type SubmissionErrorCode = "call_closed" | "stale_form_version" | "stale_call_version" | "stale_revision" | "requirements_unmet" | "duplicate_active_submission" | "key_reused";

export type SubmissionOutcome =
  | { ok: true; submission: FrozenSubmission; replayed: boolean }
  | { ok: false; code: SubmissionErrorCode; message: string; details?: string[] };

export interface SubmissionLedger {
  submissions: FrozenSubmission[];
  /** Idempotency key to the request fingerprint and the outcome it produced. */
  intents: Record<string, { fingerprint: string; outcome: SubmissionOutcome }>;
}

export const emptyLedger = (): SubmissionLedger => ({ submissions: [], intents: {} });

const MESSAGES: Record<SubmissionErrorCode, string> = {
  call_closed: "This call is no longer accepting proposals.",
  stale_form_version: "The questions changed since you started. Review the form and submit again.",
  stale_call_version: "The call rules changed since you started. Review them and submit again.",
  stale_revision: "The proposal changed in another tab or by a teammate. Reload and submit again.",
  requirements_unmet: "Some requirements are not met yet.",
  duplicate_active_submission: "You already have an active submission to this call.",
  key_reused: "This request key was already used for a different proposal.",
};

const fail = (code: SubmissionErrorCode, details?: string[]): SubmissionOutcome => ({ ok: false, code, message: MESSAGES[code], ...(details ? { details } : {}) });

/** What identifies a request apart from its key, so key reuse with other data is caught. */
export function fingerprint(req: SubmissionRequest): string {
  return [req.proposalId, req.ownerId, req.callId, req.formVersion, req.callVersion, req.revision].join("|");
}

/**
 * Apply one submit request to the ledger. A repeated request with the same key
 * and data returns the stored outcome and leaves the ledger as it was.
 */
export function submitProposal(ledger: SubmissionLedger, req: SubmissionRequest, ctx: SubmissionContext): { ledger: SubmissionLedger; outcome: SubmissionOutcome } {
  const seen = ledger.intents[req.idempotencyKey];
  if (seen) {
    if (seen.fingerprint !== fingerprint(req)) return { ledger, outcome: fail("key_reused") };
    return { ledger, outcome: seen.outcome.ok ? { ...seen.outcome, replayed: true } : seen.outcome };
  }

  const record = (outcome: SubmissionOutcome, submissions: FrozenSubmission[] = ledger.submissions): { ledger: SubmissionLedger; outcome: SubmissionOutcome } => ({
    ledger: { submissions, intents: { ...ledger.intents, [req.idempotencyKey]: { fingerprint: fingerprint(req), outcome } } },
    outcome,
  });

  if (!ctx.callOpen) return record(fail("call_closed"));
  if (req.formVersion !== ctx.currentFormVersion) return record(fail("stale_form_version"));
  if (req.callVersion !== ctx.currentCallVersion) return record(fail("stale_call_version"));
  if (req.revision !== ctx.currentRevision) return record(fail("stale_revision"));
  if (ctx.requirementIssues.length > 0) return record(fail("requirements_unmet", ctx.requirementIssues));
  const duplicate = ledger.submissions.some((s) => s.status === "active" && s.callId === req.callId && s.ownerId === req.ownerId);
  if (duplicate) return record(fail("duplicate_active_submission"));

  const submission: FrozenSubmission = {
    id: `sub-${ledger.submissions.length + 1}`,
    proposalId: req.proposalId,
    ownerId: req.ownerId,
    callId: req.callId,
    formVersion: req.formVersion,
    callVersion: req.callVersion,
    revision: req.revision,
    submittedAt: req.submittedAt,
    status: "active",
  };
  return record({ ok: true, submission, replayed: false }, [...ledger.submissions, submission]);
}

/** Withdraw an active submission so the owner may submit again. */
export function withdrawSubmission(ledger: SubmissionLedger, submissionId: string): SubmissionLedger {
  return { ...ledger, submissions: ledger.submissions.map((s) => (s.id === submissionId && s.status === "active" ? { ...s, status: "withdrawn" as const } : s)) };
}
