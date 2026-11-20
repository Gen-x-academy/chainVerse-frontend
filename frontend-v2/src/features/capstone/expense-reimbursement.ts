/**
 * Expense reimbursement claims (CAPSTONE-087).
 *
 * Submit constrained evidence, keep private notes out of audit/analytics,
 * separate submitter from reviewer, and link at most one payout per claim.
 * Pure and deterministic; all ledgers are supplied by the caller.
 */
export const CLAIM_CATEGORIES = ["travel", "materials", "software", "services", "other"] as const;
export type ClaimCategory = (typeof CLAIM_CATEGORIES)[number];

export interface EvidenceFile {
  documentId: string;
  mediaType: string;
  sizeBytes: number;
}

export interface ReimbursementPolicy {
  maxAmountMinor: bigint;
  allowedCategories: readonly ClaimCategory[];
  requireEvidence: boolean;
  maxEvidenceFiles: number;
  allowedMediaTypes: readonly string[];
  maxEvidenceBytes: number;
}

export type ClaimStatus = "draft" | "submitted" | "under_review" | "approved" | "rejected" | "paid";

export interface ExpenseClaim {
  id: string;
  tenantId: string;
  projectId: string;
  submitterId: string;
  category: ClaimCategory;
  amountMinor: bigint;
  currency: string;
  evidence: readonly EvidenceFile[];
  /** Private payload: never written to audit events or analytics. */
  privateNote?: string;
  status: ClaimStatus;
  revision: number;
  reviewerId?: string;
  /** Private reason: stored with the claim only, never with the audit record. */
  decisionReason?: string;
  payoutReference?: string;
}

export type ClaimErrorCode =
  | "FORBIDDEN"
  | "TENANT_MISMATCH"
  | "STALE_REVISION"
  | "INVALID_STATE"
  | "POLICY_INVALID"
  | "REVIEWER_SEPARATION"
  | "REASON_REQUIRED"
  | "PAYOUT_CONFLICT";

export interface ClaimIssue {
  field: string;
  message: string;
}

export interface ClaimAuditEvent {
  type: "claim.submitted" | "claim.decided" | "claim.paid" | "claim.rejected" | "claim.replayed";
  claimId: string;
  requestId: string;
  /** Status/code only: no amounts, notes, evidence identifiers or payout references. */
  status?: ClaimStatus;
  code?: ClaimErrorCode;
}

export type SubmitClaimResult =
  | { ok: true; claim: ExpenseClaim; replayed: boolean; audit: ClaimAuditEvent }
  | { ok: false; code: ClaimErrorCode; message: string; issues: ClaimIssue[]; audit: ClaimAuditEvent };

export type DecideClaimResult =
  | { ok: true; claim: ExpenseClaim; replayed: boolean; audit: ClaimAuditEvent }
  | { ok: false; code: ClaimErrorCode; message: string; audit: ClaimAuditEvent };

export type PayoutResult = DecideClaimResult;

export interface ClaimContext {
  requests: Map<string, SubmitClaimResult | DecideClaimResult | PayoutResult>;
  /** Stable claim fingerprint -> claim id, so a retried submit cannot duplicate a claim. */
  fingerprints: Map<string, string>;
  /** Payout reference -> claim id, so one payout cannot pay two claims. */
  payouts: Map<string, string>;
}

export function newClaimContext(): ClaimContext {
  return { requests: new Map(), fingerprints: new Map(), payouts: new Map() };
}

/** Which UI state a typed API response should render. */
export type ClaimViewState = "loading" | "empty" | "error" | "conflict" | "success";

export function viewStateForClaim(result: { ok: boolean; code?: ClaimErrorCode } | undefined, pending = false): ClaimViewState {
  if (pending) return "loading";
  if (!result) return "empty";
  if (!result.ok) return result.code === "STALE_REVISION" || result.code === "PAYOUT_CONFLICT" ? "conflict" : "error";
  return "success";
}

export function validateForSubmission(claim: ExpenseClaim, policy: ReimbursementPolicy): ClaimIssue[] {
  const issues: ClaimIssue[] = [];
  if (!policy.allowedCategories.includes(claim.category)) issues.push({ field: "category", message: "This category is not reimbursable." });
  if (claim.amountMinor <= 0n) issues.push({ field: "amountMinor", message: "Enter an amount greater than zero." });
  if (claim.amountMinor > policy.maxAmountMinor) issues.push({ field: "amountMinor", message: "The amount exceeds the reimbursement limit." });
  if (policy.requireEvidence && claim.evidence.length === 0) issues.push({ field: "evidence", message: "Attach at least one evidence file." });
  if (claim.evidence.length > policy.maxEvidenceFiles) issues.push({ field: "evidence", message: `Attach at most ${policy.maxEvidenceFiles} files.` });
  for (const file of claim.evidence) {
    if (!policy.allowedMediaTypes.includes(file.mediaType)) issues.push({ field: "evidence", message: "An evidence file has an unsupported type." });
    if (file.sizeBytes > policy.maxEvidenceBytes) issues.push({ field: "evidence", message: "An evidence file is too large." });
  }
  return issues;
}

function fingerprint(claim: ExpenseClaim): string {
  const documents = claim.evidence.map((file) => file.documentId).sort().join(",");
  return [claim.tenantId, claim.projectId, claim.submitterId, claim.category, claim.amountMinor, claim.currency, documents].join("|");
}

export interface SubmitClaimRequest {
  requestId: string;
  actorId: string;
  actorTenantId: string;
  expectedRevision: number;
  reviewerId: string;
  now: string;
}

/** Submit a claim and assign a reviewer; the reviewer must be a different person. */
export function submitClaim(
  claim: ExpenseClaim,
  request: SubmitClaimRequest,
  policy: ReimbursementPolicy,
  context: ClaimContext = newClaimContext(),
): SubmitClaimResult {
  const audit = (type: ClaimAuditEvent["type"], code?: ClaimErrorCode): ClaimAuditEvent => ({
    type,
    claimId: claim.id,
    requestId: request.requestId,
    ...(code ? { code } : {}),
  });
  const earlier = context.requests.get(request.requestId);
  if (earlier && earlier.ok) return { ...earlier, replayed: true, audit: audit("claim.replayed") } as SubmitClaimResult;
  const fail = (code: ClaimErrorCode, message: string, issues: ClaimIssue[] = []): SubmitClaimResult => {
    const result: SubmitClaimResult = { ok: false, code, message, issues, audit: audit("claim.rejected", code) };
    context.requests.set(request.requestId, result);
    return result;
  };

  if (request.actorId !== claim.submitterId) return fail("FORBIDDEN", "Only the claim owner can submit it.");
  if (request.actorTenantId !== claim.tenantId) return fail("TENANT_MISMATCH", "This claim belongs to another tenant.");
  if (request.expectedRevision !== claim.revision) return fail("STALE_REVISION", `The claim changed (revision ${claim.revision}); reload before retrying.`);
  if (claim.status !== "draft") return fail("INVALID_STATE", "Only a draft claim can be submitted.");
  if (!request.reviewerId || request.reviewerId === claim.submitterId) return fail("REVIEWER_SEPARATION", "A different person must review this claim.");

  const issues = validateForSubmission(claim, policy);
  if (issues.length > 0) return fail("POLICY_INVALID", "The claim does not meet the expense policy.", issues);

  const key = fingerprint(claim);
  const existingId = context.fingerprints.get(key);
  if (existingId && existingId !== claim.id) return fail("PAYOUT_CONFLICT", "An identical claim was already submitted.");

  context.fingerprints.set(key, claim.id);
  const result: SubmitClaimResult = {
    ok: true,
    replayed: false,
    claim: { ...claim, status: "under_review", reviewerId: request.reviewerId, revision: claim.revision + 1 },
    audit: audit("claim.submitted"),
  };
  context.requests.set(request.requestId, result);
  return result;
}

export interface DecideClaimRequest {
  requestId: string;
  actorId: string;
  actorTenantId: string;
  expectedRevision: number;
  decision: "approve" | "reject";
  /** Required for rejection; kept on the claim only. */
  reason?: string;
  now: string;
}

/** Approve or reject a claim; the reviewer can never be the submitter. */
export function decideClaim(
  claim: ExpenseClaim,
  request: DecideClaimRequest,
  context: ClaimContext = newClaimContext(),
): DecideClaimResult {
  const audit = (type: ClaimAuditEvent["type"], code?: ClaimErrorCode): ClaimAuditEvent => ({
    type,
    claimId: claim.id,
    requestId: request.requestId,
    ...(code ? { code } : {}),
  });
  const earlier = context.requests.get(request.requestId);
  if (earlier && earlier.ok) return { ...earlier, replayed: true, audit: audit("claim.replayed") } as DecideClaimResult;
  const fail = (code: ClaimErrorCode, message: string): DecideClaimResult => {
    const result: DecideClaimResult = { ok: false, code, message, audit: audit("claim.rejected", code) };
    context.requests.set(request.requestId, result);
    return result;
  };

  if (request.actorTenantId !== claim.tenantId) return fail("TENANT_MISMATCH", "This claim belongs to another tenant.");
  if (request.actorId !== claim.reviewerId || request.actorId === claim.submitterId) {
    return fail("REVIEWER_SEPARATION", "Only the assigned reviewer, who is not the submitter, can decide this claim.");
  }
  if (request.expectedRevision !== claim.revision) return fail("STALE_REVISION", `The claim changed (revision ${claim.revision}); reload before retrying.`);
  if (claim.status !== "under_review") return fail("INVALID_STATE", "This claim is not awaiting a decision.");
  const reason = request.reason?.trim();
  if (request.decision === "reject" && !reason) return fail("REASON_REQUIRED", "Give a reason for rejecting this claim.");

  const result: DecideClaimResult = {
    ok: true,
    replayed: false,
    claim: {
      ...claim,
      status: request.decision === "approve" ? "approved" : "rejected",
      ...(reason ? { decisionReason: reason } : {}),
      revision: claim.revision + 1,
    },
    audit: audit(request.decision === "approve" ? "claim.decided" : "claim.rejected"),
  };
  context.requests.set(request.requestId, result);
  return result;
}

export interface LinkPayoutRequest {
  requestId: string;
  actorId: string;
  actorTenantId: string;
  expectedRevision: number;
  payoutReference: string;
  now: string;
}

/** Link an external payout once; retries and duplicate references are harmless. */
export function linkPayout(
  claim: ExpenseClaim,
  request: LinkPayoutRequest,
  context: ClaimContext = newClaimContext(),
): PayoutResult {
  const audit = (type: ClaimAuditEvent["type"], code?: ClaimErrorCode): ClaimAuditEvent => ({
    type,
    claimId: claim.id,
    requestId: request.requestId,
    ...(code ? { code } : {}),
  });
  const earlier = context.requests.get(request.requestId);
  if (earlier && earlier.ok) return { ...earlier, replayed: true, audit: audit("claim.replayed") } as PayoutResult;
  const fail = (code: ClaimErrorCode, message: string): PayoutResult => {
    const result: PayoutResult = { ok: false, code, message, audit: audit("claim.rejected", code) };
    context.requests.set(request.requestId, result);
    return result;
  };

  if (!request.actorId || request.actorTenantId !== claim.tenantId) return fail("TENANT_MISMATCH", "This claim belongs to another tenant.");
  if (request.expectedRevision !== claim.revision) return fail("STALE_REVISION", `The claim changed (revision ${claim.revision}); reload before retrying.`);
  if (claim.status === "paid") return { ok: true, replayed: true, claim, audit: audit("claim.replayed") };
  if (claim.status !== "approved") return fail("INVALID_STATE", "Only an approved claim can be linked to a payout.");
  if (!request.payoutReference.trim()) return fail("PAYOUT_CONFLICT", "A payout reference is required.");
  const owner = context.payouts.get(request.payoutReference);
  if (owner && owner !== claim.id) return fail("PAYOUT_CONFLICT", "This payout is already linked to another claim.");
  if (owner === claim.id) return { ok: true, replayed: true, claim, audit: audit("claim.replayed") };

  context.payouts.set(request.payoutReference, claim.id);
  const result: PayoutResult = {
    ok: true,
    replayed: false,
    claim: { ...claim, status: "paid", payoutReference: request.payoutReference, revision: claim.revision + 1 },
    audit: audit("claim.paid"),
  };
  context.requests.set(request.requestId, result);
  return result;
}
