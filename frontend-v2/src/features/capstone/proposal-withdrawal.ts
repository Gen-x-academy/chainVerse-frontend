/**
 * Capstone proposal withdrawal and resubmission (CAPSTONE-039).
 *
 * A submitted proposal can be withdrawn by its owner until a decision is
 * recorded, and a withdrawn proposal can be resubmitted as a new version while
 * the call is still open. Every withdrawal and resubmission is idempotent on
 * its request id, and earlier versions are never edited: resubmission adds a
 * new version and leaves the withdrawn one in place for the history.
 */
import { validateForSubmit, type CallWindow, type DraftIssue, type ProposalDraft } from "./proposal-drafts";

/** Versions a proposal may reach (the original plus resubmissions). */
export const MAX_SUBMISSION_VERSIONS = 3;
export const MAX_WITHDRAWAL_REASON = 500;

export type SubmissionStatus = "submitted" | "under_review" | "decided" | "withdrawn";

export interface ProposalSubmission {
  proposalId: string;
  ownerId: string;
  callId: string;
  version: number;
  status: SubmissionStatus;
  submittedAt: string;
  withdrawnAt?: string;
  /** Free text from the owner; keep it out of logs and public views. */
  withdrawalReason?: string;
  /** Increases by one on every applied change. */
  revision: number;
}

export interface WithdrawRequest {
  /** Client-generated id; a retry with the same id is not applied again. */
  requestId: string;
  actorId: string;
  expectedRevision: number;
  reason?: string;
  now: string;
}

export type WithdrawErrorCode = "NOT_OWNER" | "STALE_REVISION" | "NOT_WITHDRAWABLE" | "REASON_TOO_LONG";

export type WithdrawResult =
  | { ok: true; submission: ProposalSubmission; replayed: boolean }
  | { ok: false; code: WithdrawErrorCode; message: string };

export type WithdrawLedger = Map<string, WithdrawResult>;

/** Whether the owner can still withdraw: not decided and not already withdrawn. */
export function canWithdraw(submission: ProposalSubmission): boolean {
  return submission.status === "submitted" || submission.status === "under_review";
}

export function withdrawSubmission(
  submission: ProposalSubmission,
  request: WithdrawRequest,
  ledger: WithdrawLedger = new Map(),
): WithdrawResult {
  const earlier = ledger.get(request.requestId);
  if (earlier) return earlier.ok ? { ...earlier, replayed: true } : earlier;

  const record = (result: WithdrawResult): WithdrawResult => {
    ledger.set(request.requestId, result);
    return result;
  };
  const fail = (code: WithdrawErrorCode, message: string) => record({ ok: false, code, message });

  // Deny by default: only the owner may withdraw, and nothing else is revealed.
  if (request.actorId !== submission.ownerId) return fail("NOT_OWNER", "Only the proposal owner can withdraw it.");

  // A second withdrawal (a different request for the same outcome) changes nothing.
  if (submission.status === "withdrawn") return record({ ok: true, submission, replayed: true });

  if (!canWithdraw(submission)) return fail("NOT_WITHDRAWABLE", "A proposal with a recorded decision can no longer be withdrawn.");
  if (request.expectedRevision !== submission.revision) {
    return fail("STALE_REVISION", `The proposal changed (revision ${submission.revision}); reload before retrying.`);
  }

  const reason = request.reason?.trim();
  if (reason && reason.length > MAX_WITHDRAWAL_REASON) {
    return fail("REASON_TOO_LONG", `The reason can be at most ${MAX_WITHDRAWAL_REASON} characters.`);
  }

  return record({
    ok: true,
    replayed: false,
    submission: {
      ...submission,
      status: "withdrawn",
      withdrawnAt: request.now,
      ...(reason ? { withdrawalReason: reason } : {}),
      revision: submission.revision + 1,
    },
  });
}

export interface ResubmitRequest {
  requestId: string;
  actorId: string;
  /** A fresh draft of the proposal, still in draft status. */
  draft: ProposalDraft;
  call: CallWindow | undefined;
  now: string;
}

export type ResubmitErrorCode =
  | "NOT_OWNER"
  | "NOT_WITHDRAWN"
  | "VERSION_LIMIT"
  | "CALL_MISMATCH"
  | "CALL_CLOSED"
  | "DRAFT_ALREADY_SUBMITTED"
  | "DRAFT_INVALID";

export type ResubmitResult =
  | { ok: true; previous: ProposalSubmission; submission: ProposalSubmission; replayed: boolean }
  | { ok: false; code: ResubmitErrorCode; message: string; issues: DraftIssue[] };

export type ResubmitLedger = Map<string, ResubmitResult>;

/** Why a withdrawn proposal cannot be resubmitted now, or `null` when it can. */
export function resubmitBlocker(
  submission: ProposalSubmission,
  call: CallWindow | undefined,
): Exclude<ResubmitErrorCode, "NOT_OWNER" | "DRAFT_ALREADY_SUBMITTED" | "DRAFT_INVALID"> | null {
  if (submission.status !== "withdrawn") return "NOT_WITHDRAWN";
  if (submission.version >= MAX_SUBMISSION_VERSIONS) return "VERSION_LIMIT";
  if (!call || call.id !== submission.callId) return "CALL_MISMATCH";
  if (!call.open) return "CALL_CLOSED";
  return null;
}

const BLOCKER_MESSAGES = {
  NOT_WITHDRAWN: "Only a withdrawn proposal can be resubmitted.",
  VERSION_LIMIT: `A proposal can be submitted at most ${MAX_SUBMISSION_VERSIONS} times.`,
  CALL_MISMATCH: "The call for this proposal was not found.",
  CALL_CLOSED: "The call is no longer accepting proposals.",
} as const;

/**
 * Resubmit a withdrawn proposal as a new version. `previous` is returned
 * unchanged so a caller can persist both records in one transaction.
 */
export function resubmitProposal(
  withdrawn: ProposalSubmission,
  request: ResubmitRequest,
  ledger: ResubmitLedger = new Map(),
): ResubmitResult {
  const earlier = ledger.get(request.requestId);
  if (earlier) return earlier.ok ? { ...earlier, replayed: true } : earlier;

  const fail = (code: ResubmitErrorCode, message: string, issues: DraftIssue[] = []): ResubmitResult => {
    const result: ResubmitResult = { ok: false, code, message, issues };
    ledger.set(request.requestId, result);
    return result;
  };

  if (request.actorId !== withdrawn.ownerId || request.draft.ownerId !== withdrawn.ownerId) {
    return fail("NOT_OWNER", "Only the proposal owner can resubmit it.");
  }
  const blocker = resubmitBlocker(withdrawn, request.call);
  if (blocker) return fail(blocker, BLOCKER_MESSAGES[blocker]);
  if (request.draft.status === "submitted") return fail("DRAFT_ALREADY_SUBMITTED", "Start the resubmission from a draft that has not been submitted.");

  const issues = validateForSubmit(request.draft, request.call);
  if (request.draft.callId !== withdrawn.callId) issues.push({ field: "callId", message: "the draft must target the same call as the withdrawn proposal" });
  if (issues.length > 0) return fail("DRAFT_INVALID", "The draft needs changes before it can be submitted.", issues);

  const result: ResubmitResult = {
    ok: true,
    replayed: false,
    previous: withdrawn,
    submission: {
      proposalId: withdrawn.proposalId,
      ownerId: withdrawn.ownerId,
      callId: withdrawn.callId,
      version: withdrawn.version + 1,
      status: "submitted",
      submittedAt: request.now,
      revision: 1,
    },
  };
  ledger.set(request.requestId, result);
  return result;
}
