/**
 * Immutable milestone deliverable submissions (CAPSTONE-079).
 *
 * A submission version is sealed: accepting, reviewing or retrying never
 * mutates its contents. Only designated submitters in the project tenant may
 * create a new version, and retries with the same request id replay the
 * original result. Audit metadata deliberately excludes file contents, links
 * and free text so private research never reaches logs or public ledgers.
 */

export const DELIVERABLE_KINDS = ["file", "link", "dataset", "commit", "demonstration", "text"] as const;
export type DeliverableKind = (typeof DELIVERABLE_KINDS)[number];

export const SUBMISSION_STATES = ["draft", "submitted", "superseded"] as const;
export type SubmissionState = (typeof SUBMISSION_STATES)[number];

export interface DeliverableRequirement {
  id: string;
  kind: DeliverableKind;
  /** Minimum number of versions of this kind that must be submitted. */
  minimum: number;
}

export interface Deliverable {
  id: string;
  requirementId: string;
  kind: DeliverableKind;
  /** Content-addressed digest or opaque identifier — never the private payload. */
  reference: string;
  submittedBy: string;
}

export interface MilestoneSubmission {
  id: string;
  tenantId: string;
  projectId: string;
  milestoneId: string;
  version: number;
  state: SubmissionState;
  createdAt: string;
  deliverables: readonly Deliverable[];
}

export interface SubmissionContext {
  tenantId: string;
  projectId: string;
  actorId: string;
  /** Deny by default: only these member ids may submit for the milestone. */
  submitterIds: readonly string[];
  requirements: readonly DeliverableRequirement[];
  /** Current project lifecycle state. */
  projectState: string;
}

export type SubmissionErrorCode =
  | "FORBIDDEN"
  | "TENANT_MISMATCH"
  | "INVALID_MILESTONE"
  | "INVALID_TRANSITION"
  | "STALE_VERSION"
  | "INVALID_DELIVERABLE";

export type SubmissionResult =
  | { ok: true; submission: MilestoneSubmission; replayed: boolean; audit: { submissionId: string; version: number; actorId: string } }
  | { ok: false; code: SubmissionErrorCode; message: string; allowed: readonly string[] };

export interface SubmitRequest {
  requestId: string;
  tenantId: string;
  projectId: string;
  milestoneId: string;
  expectedVersion: number;
}

export type SubmissionLedger = Map<string, SubmissionResult>;

const isNonEmpty = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

/** Problems with the deliverables of a submission (stable messages). */
export function validateDeliverables(submission: MilestoneSubmission, ctx: Pick<SubmissionContext, "requirements">): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const counts = new Map<string, number>();
  for (const deliverable of submission.deliverables) {
    if (!isNonEmpty(deliverable.reference)) errors.push(`${deliverable.id}: a deliverable needs a reference`);
    if (ids.has(deliverable.id)) errors.push(`${deliverable.id}: deliverable ids must be unique`);
    ids.add(deliverable.id);
    const requirement = ctx.requirements.find((r) => r.id === deliverable.requirementId);
    if (!requirement) errors.push(`${deliverable.id}: requirement was not found`);
    else if (requirement.kind !== deliverable.kind) errors.push(`${deliverable.id}: kind must be ${requirement.kind}`);
    else counts.set(requirement.id, (counts.get(requirement.id) ?? 0) + 1);
  }
  for (const requirement of ctx.requirements) {
    if ((counts.get(requirement.id) ?? 0) < requirement.minimum) {
      errors.push(`${requirement.id}: at least ${requirement.minimum} ${requirement.kind} deliverable(s) required`);
    }
  }
  return errors;
}

/** Audit event contains identifiers only, never deliverable content. */
export function submissionAudit(submission: MilestoneSubmission) {
  return {
    submissionId: submission.id,
    tenantId: submission.tenantId,
    projectId: submission.projectId,
    milestoneId: submission.milestoneId,
    version: submission.version,
    deliverableIds: submission.deliverables.map((d) => d.id),
  };
}

/** Seal a new immutable version of a milestone submission. */
export function submitDeliverables(
  submission: MilestoneSubmission,
  request: SubmitRequest,
  ctx: SubmissionContext,
  deliverables: readonly Deliverable[],
  ledger: SubmissionLedger = new Map(),
): SubmissionResult {
  const earlier = ledger.get(request.requestId);
  if (earlier) return earlier.ok ? { ...earlier, replayed: true } : earlier;

  const fail = (code: SubmissionErrorCode, message: string, allowed: readonly string[] = []): SubmissionResult => {
    const result: SubmissionResult = { ok: false, code, message, allowed };
    ledger.set(request.requestId, result);
    return result;
  };

  if (!ctx.submitterIds.includes(ctx.actorId)) return fail("FORBIDDEN", "You are not designated to submit this milestone.");
  if (request.tenantId !== ctx.tenantId || request.projectId !== ctx.projectId || submission.tenantId !== ctx.tenantId || submission.projectId !== ctx.projectId) {
    return fail("TENANT_MISMATCH", "The submission belongs to a different tenant or project.");
  }
  if (!isNonEmpty(request.milestoneId) || submission.milestoneId !== request.milestoneId) {
    return fail("INVALID_MILESTONE", "The milestone was not found in this project.");
  }
  if (ctx.projectState !== "active") {
    return fail("INVALID_TRANSITION", `Deliverables cannot be submitted while the project is ${ctx.projectState}.`, ["active"]);
  }
  if (request.expectedVersion !== submission.version) {
    return fail("STALE_VERSION", `The submission is at version ${submission.version}; reload before retrying.`);
  }

  const next: MilestoneSubmission = {
    ...submission,
    version: submission.version + 1,
    state: "submitted",
    deliverables: deliverables.map((d) => ({ ...d, submittedBy: ctx.actorId })),
  };
  const errors = validateDeliverables(next, ctx);
  if (errors.length > 0) return fail("INVALID_DELIVERABLE", errors[0] as string, [...new Set(deliverables.map((d) => d.requirementId))]);

  const result: SubmissionResult = {
    ok: true,
    replayed: false,
    submission: next,
    audit: { submissionId: next.id, version: next.version, actorId: ctx.actorId },
  };
  ledger.set(request.requestId, result);
  return result;
}

/** Pending milestones need a submitted, non-superseded version. */
export function isAwaitingReview(versions: readonly MilestoneSubmission[]): boolean {
  return versions.length === 0 || !versions.some((v) => v.state === "submitted");
}
