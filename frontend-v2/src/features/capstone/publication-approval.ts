/**
 * Capstone publication approval workflow (CAPSTONE-092).
 *
 * Coordinates author, supervisor, sponsor, ethics and organization approval
 * before a project can be released publicly or submitted externally. Steps
 * are sequential, authorization is deny-by-default (the actor must be the
 * assigned approver inside the same tenant), every decision checks the
 * revision the caller saw, and a retried request id returns the original
 * outcome instead of recording a second decision. Audit records carry
 * identifiers only, never the publication content or reviewer comments.
 */

export const APPROVAL_STEPS = ["author", "supervisor", "sponsor", "ethics", "organization"] as const;
export type ApprovalStep = (typeof APPROVAL_STEPS)[number];

export const WORKFLOW_STATUSES = ["collecting", "approved", "rejected", "revoked"] as const;
export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];

export interface ApprovalDecision {
  actorId: string;
  decision: "approved" | "rejected";
  at: string;
}

export interface ApprovalWorkflow {
  id: string;
  projectId: string;
  organizationId: string;
  /** Increments by one on every applied decision. */
  revision: number;
  status: WorkflowStatus;
  decisions: Partial<Record<ApprovalStep, ApprovalDecision>>;
}

export interface ApprovalContext {
  organizationId: string;
  requiresSponsor: boolean;
  requiresEthics: boolean;
  /** Assigned approver ids per step; a step with no ids cannot be decided. */
  assignedByRole: Partial<Record<ApprovalStep, readonly string[]>>;
}

export interface ApprovalRequest {
  requestId: string;
  step: ApprovalStep;
  actorId: string;
  decision: "approved" | "rejected";
  /** The revision the caller based the decision on. */
  expectedRevision: number;
  at: string;
}

export type ApprovalErrorCode =
  | "UNKNOWN_STEP"
  | "NOT_REQUIRED"
  | "WORKFLOW_CLOSED"
  | "STALE_REVISION"
  | "TENANT_MISMATCH"
  | "NOT_ASSIGNED"
  | "ALREADY_DECIDED"
  | "UNSATISFIED_PREREQUISITE";

export type ApprovalResult =
  | { ok: true; workflow: ApprovalWorkflow; replayed: boolean }
  | { ok: false; code: ApprovalErrorCode; message: string };

export type ApprovalLedger = Map<string, ApprovalResult>;

/** Required steps in the order they must be decided. */
export function requiredSteps(ctx: ApprovalContext): ApprovalStep[] {
  return APPROVAL_STEPS.filter(
    (step) => step === "author" || step === "supervisor" || step === "organization" || (step === "sponsor" && ctx.requiresSponsor) || (step === "ethics" && ctx.requiresEthics),
  );
}

/** Record one step's decision. Replays never apply a decision twice. */
export function submitDecision(
  workflow: ApprovalWorkflow,
  ctx: ApprovalContext,
  request: ApprovalRequest,
  ledger: ApprovalLedger = new Map(),
): ApprovalResult {
  const earlier = ledger.get(request.requestId);
  if (earlier) return earlier.ok ? { ...earlier, replayed: true } : earlier;

  const fail = (code: ApprovalErrorCode, message: string): ApprovalResult => {
    const result: ApprovalResult = { ok: false, code, message };
    ledger.set(request.requestId, result);
    return result;
  };

  const steps = requiredSteps(ctx);
  if (!(APPROVAL_STEPS as readonly string[]).includes(request.step)) return fail("UNKNOWN_STEP", `"${String(request.step)}" is not an approval step`);
  if (!steps.includes(request.step)) return fail("NOT_REQUIRED", "This approval is not required for the project.");
  if (workflow.status !== "collecting") return fail("WORKFLOW_CLOSED", `The workflow is ${workflow.status} and cannot take more decisions.`);
  if (request.expectedRevision !== workflow.revision) return fail("STALE_REVISION", `Approvals changed (revision ${workflow.revision}); reload before deciding.`);
  if (ctx.organizationId !== workflow.organizationId) return fail("TENANT_MISMATCH", "The approval belongs to a different organization.");
  if (!ctx.assignedByRole[request.step]?.includes(request.actorId)) return fail("NOT_ASSIGNED", "You are not the assigned approver for this step.");
  if (workflow.decisions[request.step]) return fail("ALREADY_DECIDED", "This step has already been decided.");
  if (request.decision !== "approved" && request.decision !== "rejected") return fail("UNKNOWN_STEP", "Decision must be approved or rejected.");

  const earlierSteps = steps.slice(0, steps.indexOf(request.step));
  if (!earlierSteps.every((step) => workflow.decisions[step]?.decision === "approved")) {
    return fail("UNSATISFIED_PREREQUISITE", `Wait for ${earlierSteps.join(", ")} before ${request.step} approval.`);
  }

  const decisions = { ...workflow.decisions, [request.step]: { actorId: request.actorId, decision: request.decision, at: request.at } };
  const status: WorkflowStatus = request.decision === "rejected" ? "rejected" : steps.every((step) => decisions[step]?.decision === "approved") ? "approved" : "collecting";
  const result: ApprovalResult = { ok: true, workflow: { ...workflow, decisions, status, revision: workflow.revision + 1 }, replayed: false };
  ledger.set(request.requestId, result);
  return result;
}

export interface ReleaseContext {
  expectedRevision: number;
  ipTermsAccepted: boolean;
  embargoed: boolean;
  publicShowcaseEnabled: boolean;
}

export type ReleaseCheck = { ok: true } | { ok: false; code: "NOT_APPROVED" | "STALE_REVISION" | "IP_TERMS_PENDING" | "EMBARGOED" | "FEATURE_DISABLED"; message: string };

/** Everything must hold at the same revision before public release is allowed. */
export function canRelease(workflow: ApprovalWorkflow, ctx: ApprovalContext, release: ReleaseContext): ReleaseCheck {
  const fail = (code: Exclude<ReleaseCheck, { ok: true }>["code"], message: string): ReleaseCheck => ({ ok: false, code, message });
  if (!release.publicShowcaseEnabled) return fail("FEATURE_DISABLED", "Public showcase is disabled in this environment.");
  if (release.expectedRevision !== workflow.revision) return fail("STALE_REVISION", `Approvals changed (revision ${workflow.revision}); reload before releasing.`);
  if (workflow.status !== "approved" || !requiredSteps(ctx).every((step) => workflow.decisions[step]?.decision === "approved")) {
    return fail("NOT_APPROVED", "All required approvals must be collected before release.");
  }
  if (!release.ipTermsAccepted) return fail("IP_TERMS_PENDING", "Intellectual property terms are not fully accepted.");
  if (release.embargoed) return fail("EMBARGOED", "An active embargo prevents release.");
  return { ok: true };
}

export type ApprovalAuditAction = "approval.submitted" | "approval.workflow_approved" | "approval.workflow_rejected" | "approval.revoked";

/** Identifiers and status only — no comments, abstracts or other private payloads. */
export function approvalAuditEvent(action: ApprovalAuditAction, workflow: ApprovalWorkflow, actorId: string, at: string): Readonly<Record<string, string | number>> {
  return Object.freeze({
    type: `publication.${action}`,
    organizationId: workflow.organizationId,
    projectId: workflow.projectId,
    workflowId: workflow.id,
    revision: workflow.revision,
    status: workflow.status,
    actorId,
    at,
  });
}
