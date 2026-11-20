/**
 * Review and accept milestone deliverables (CAPSTONE-080).
 *
 * Designated reviewers decide the current submission version against weighted
 * rubric criteria. Decisions are immutable; a retry with the same request id
 * replays the original decision. Reasons are kept on the decision for the
 * submitter, while audit records carry status only — no private payloads.
 */

export const REVIEW_DECISIONS = ["request-changes", "accept", "reject"] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

export interface RubricCriterion {
  id: string;
  label: string;
  /** Weight in basis points; all criteria must add up to 10000. */
  weightBps: number;
  /** Highest score allowed for this criterion. */
  maximum: number;
}

export interface CriterionScore {
  criterionId: string;
  score: number;
}

export interface ReviewRecord {
  id: string;
  tenantId: string;
  projectId: string;
  submissionId: string;
  submissionVersion: number;
  reviewerId: string;
  decision: ReviewDecision;
  scores: readonly CriterionScore[];
  /** Reasoned decision, addressed to the submitter. */
  reason: string;
  decidedAt: string;
}

export interface ReviewContext {
  tenantId: string;
  projectId: string;
  actorId: string;
  /** Deny by default: only designated reviewers may decide. */
  reviewerIds: readonly string[];
  criteria: readonly RubricCriterion[];
  currentVersion: number;
  /** A superseded or withdrawn submission cannot be reviewed. */
  currentState: "draft" | "submitted" | "superseded";
}

export type ReviewErrorCode =
  | "FORBIDDEN"
  | "TENANT_MISMATCH"
  | "STALE_VERSION"
  | "NOT_REVIEWABLE"
  | "INVALID_RUBRIC"
  | "INVALID_REASON"
  | "INVALID_DECISION";

export type ReviewResult =
  | { ok: true; review: ReviewRecord; replayed: boolean; audit: { reviewId: string; decision: ReviewDecision; submissionVersion: number } }
  | { ok: false; code: ReviewErrorCode; message: string; allowed: readonly ReviewDecision[] };

export interface ReviewRequest {
  requestId: string;
  tenantId: string;
  projectId: string;
  submissionId: string;
  expectedVersion: number;
}

export type ReviewLedger = Map<string, ReviewResult>;

/** Weighted, rounded score out of 100, or null when scores are incomplete. */
export function weightedScore(scores: readonly CriterionScore[], criteria: readonly RubricCriterion[]): number | null {
  if (criteria.length === 0) return null;
  let total = 0;
  for (const criterion of criteria) {
    const score = scores.find((s) => s.criterionId === criterion.id)?.score;
    if (!Number.isFinite(score) || (score as number) < 0 || (score as number) > criterion.maximum) return null;
    total += ((score as number) / criterion.maximum) * criterion.weightBps;
  }
  return Math.round(total / 100);
}

/** Stable validation errors for a review before it is recorded. */
export function validateReview(review: ReviewRecord, ctx: Pick<ReviewContext, "criteria">): string[] {
  const errors: string[] = [];
  if (!(REVIEW_DECISIONS as readonly string[]).includes(review.decision)) errors.push("decision: choose request-changes, accept or reject");
  if (review.reason.trim().length < 20 || review.reason.length > 4000) errors.push("reason: give a reasoned decision of 20 to 4000 characters");
  const rubricWeight = ctx.criteria.reduce((sum, c) => sum + c.weightBps, 0);
  if (ctx.criteria.length === 0 || rubricWeight !== 10000) errors.push("criteria: rubric weights must add up to 10000 basis points");
  if (ctx.criteria.some((c) => !Number.isFinite(c.maximum) || c.maximum <= 0)) errors.push("criteria: each criterion needs a positive maximum");
  if (weightedScore(review.scores, ctx.criteria) === null) errors.push("scores: score every criterion within its maximum");
  const ids = new Set(review.scores.map((s) => s.criterionId));
  if (ids.size !== review.scores.length) errors.push("scores: score each criterion only once");
  return errors;
}

/** Audit record never contains the reason, scores, or deliverable content. */
export function reviewAudit(review: ReviewRecord) {
  return {
    reviewId: review.id,
    tenantId: review.tenantId,
    projectId: review.projectId,
    submissionId: review.submissionId,
    submissionVersion: review.submissionVersion,
    decision: review.decision,
  };
}

/** Record an immutable reviewer decision for the current submission version. */
export function decideReview(
  review: ReviewRecord,
  request: ReviewRequest,
  ctx: ReviewContext,
  ledger: ReviewLedger = new Map(),
): ReviewResult {
  const earlier = ledger.get(request.requestId);
  if (earlier) return earlier.ok ? { ...earlier, replayed: true } : earlier;

  const fail = (code: ReviewErrorCode, message: string, allowed: readonly ReviewDecision[] = REVIEW_DECISIONS): ReviewResult => {
    const result: ReviewResult = { ok: false, code, message, allowed };
    ledger.set(request.requestId, result);
    return result;
  };

  if (!ctx.reviewerIds.includes(ctx.actorId)) return fail("FORBIDDEN", "You are not designated to review this milestone.");
  if (request.tenantId !== ctx.tenantId || request.projectId !== ctx.projectId || review.tenantId !== ctx.tenantId || review.projectId !== ctx.projectId) {
    return fail("TENANT_MISMATCH", "The review belongs to a different tenant or project.");
  }
  if (request.submissionId !== review.submissionId) return fail("NOT_REVIEWABLE", "The submission was not found in this project.");
  if (ctx.currentState !== "submitted") {
    return fail("NOT_REVIEWABLE", `A ${ctx.currentState} submission cannot be reviewed; ask for a new submission.`);
  }
  if (request.expectedVersion !== ctx.currentVersion || review.submissionVersion !== ctx.currentVersion) {
    return fail("STALE_VERSION", `The submission is at version ${ctx.currentVersion}; reload before deciding.`);
  }

  const errors = validateReview(review, ctx);
  if (errors.length > 0) {
    const code: ReviewErrorCode = errors[0]!.startsWith("decision:") ? "INVALID_DECISION"
      : errors[0]!.startsWith("reason:") ? "INVALID_REASON" : "INVALID_RUBRIC";
    return fail(code, errors[0] as string);
  }

  const result: ReviewResult = {
    ok: true,
    replayed: false,
    review: { ...review, reviewerId: ctx.actorId },
    audit: { reviewId: review.id, decision: review.decision, submissionVersion: review.submissionVersion },
  };
  ledger.set(request.requestId, result);
  return result;
}
