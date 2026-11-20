/**
 * Complete or terminate projects (CAPSTONE-054).
 *
 * A project closes by successful completion, mutual termination, inactivity,
 * policy action or sponsor withdrawal. Each way has its own requirements and
 * every closure records a structured outcome. Closure is final: a closed
 * project cannot be closed again with a different outcome.
 */

export type ClosureKind = "completed" | "mutual_termination" | "inactivity" | "policy_action" | "sponsor_withdrawal";

export type OutcomeStatus = "all_objectives_met" | "partly_met" | "not_met";

export interface ClosureOutcome {
  status: OutcomeStatus;
  objectivesMet: number;
  objectivesTotal: number;
  /** Deliverables handed over, by id. */
  deliverablesHandedOver: string[];
  /** Short plain-language summary. No private detail. */
  summary: string;
  lessonsLearned?: string;
}

export interface ProjectClosure {
  projectId: string;
  kind: ClosureKind;
  closedOn: string;
  closedBy: string;
  outcome: ClosureOutcome;
  /** Who agreed, for mutual termination. */
  agreedBy: string[];
  /** Reference to the policy decision or sponsor notice, for those kinds. */
  authorityRef?: string;
}

export interface ClosureInput {
  projectId: string;
  kind: ClosureKind;
  closedOn: string;
  closedBy: string;
  outcome: ClosureOutcome;
  agreedBy?: string[];
  authorityRef?: string;
}

export interface ClosureContext {
  participantIds: string[];
  /** Days since the last recorded activity. */
  daysInactive: number;
  alreadyClosed: boolean;
  openObligations: string[];
}

export type ClosureErrorCode = "already_closed" | "bad_outcome" | "open_obligations" | "needs_unanimous_agreement" | "needs_authority" | "not_inactive" | "needs_summary";

export type ClosureResult = { ok: true; closure: ProjectClosure } | { ok: false; code: ClosureErrorCode; message: string; details?: string[] };

const MESSAGES: Record<ClosureErrorCode, string> = {
  already_closed: "This project is already closed.",
  bad_outcome: "The outcome does not match the objectives and deliverables recorded.",
  open_obligations: "Some obligations are still open.",
  needs_unanimous_agreement: "Every participant must agree to end the project.",
  needs_authority: "Add the reference for the decision or notice.",
  not_inactive: "The project has not been inactive for long enough.",
  needs_summary: "Write a short summary of the outcome.",
};

const fail = (code: ClosureErrorCode, details?: string[]): ClosureResult => ({ ok: false, code, message: MESSAGES[code], ...(details ? { details } : {}) });

export const INACTIVITY_DAYS = 60;

/** The outcome status the numbers imply. */
export function impliedStatus(met: number, total: number): OutcomeStatus {
  if (total <= 0 || met <= 0) return "not_met";
  return met >= total ? "all_objectives_met" : "partly_met";
}

export function closeProject(input: ClosureInput, ctx: ClosureContext): ClosureResult {
  if (ctx.alreadyClosed) return fail("already_closed");
  const o = input.outcome;
  if (o.summary.trim().length === 0) return fail("needs_summary");
  if (!Number.isInteger(o.objectivesMet) || !Number.isInteger(o.objectivesTotal) || o.objectivesMet < 0 || o.objectivesMet > o.objectivesTotal || o.status !== impliedStatus(o.objectivesMet, o.objectivesTotal)) {
    return fail("bad_outcome");
  }

  switch (input.kind) {
    case "completed":
      // A successful completion must meet its objectives and leave nothing open.
      if (o.status === "not_met") return fail("bad_outcome");
      if (ctx.openObligations.length > 0) return fail("open_obligations", ctx.openObligations);
      break;
    case "mutual_termination": {
      const agreed = new Set(input.agreedBy ?? []);
      if (!ctx.participantIds.every((id) => agreed.has(id))) return fail("needs_unanimous_agreement");
      break;
    }
    case "inactivity":
      if (ctx.daysInactive < INACTIVITY_DAYS) return fail("not_inactive");
      break;
    case "policy_action":
    case "sponsor_withdrawal":
      if (!input.authorityRef || input.authorityRef.trim().length === 0) return fail("needs_authority");
      break;
  }

  return {
    ok: true,
    closure: {
      projectId: input.projectId,
      kind: input.kind,
      closedOn: input.closedOn,
      closedBy: input.closedBy,
      outcome: { ...o, deliverablesHandedOver: [...new Set(o.deliverablesHandedOver)] },
      agreedBy: input.kind === "mutual_termination" ? [...new Set(input.agreedBy ?? [])] : [],
      ...(input.authorityRef ? { authorityRef: input.authorityRef.trim() } : {}),
    },
  };
}

/** What a closed project keeps: it is read-only, but credentials and exports stay available. */
export function afterClosure(kind: ClosureKind): { readOnly: true; credentialsEligible: boolean; exportAllowed: true } {
  return { readOnly: true, credentialsEligible: kind === "completed", exportAllowed: true };
}

export const CLOSURE_LABELS: Readonly<Record<ClosureKind, string>> = {
  completed: "Completed successfully",
  mutual_termination: "Ended by agreement",
  inactivity: "Closed for inactivity",
  policy_action: "Closed by policy action",
  sponsor_withdrawal: "Sponsor withdrew",
};
