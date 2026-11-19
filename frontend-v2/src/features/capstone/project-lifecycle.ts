/**
 * Capstone project lifecycle state machine (CAPSTONE-003).
 *
 * Pure and deterministic. Every transition is guarded: it must be a documented
 * edge, must name the revision the caller last saw (stale revisions are
 * rejected), and a retried request id returns the original outcome instead of
 * applying twice.
 */

export const PROJECT_STATES = [
  "draft",
  "proposed",
  "screening",
  "approved",
  "recruiting",
  "active",
  "paused",
  "under-review",
  "completed",
  "published",
  "cancelled",
  "disputed",
  "archived",
] as const;

export type ProjectState = (typeof PROJECT_STATES)[number];

export const PROJECT_TRANSITIONS: Readonly<Record<ProjectState, readonly ProjectState[]>> = {
  draft: ["proposed", "cancelled"],
  proposed: ["screening", "draft", "cancelled"],
  screening: ["approved", "proposed", "cancelled"],
  approved: ["recruiting", "cancelled"],
  recruiting: ["active", "cancelled"],
  active: ["paused", "under-review", "disputed", "cancelled"],
  paused: ["active", "cancelled"],
  "under-review": ["active", "completed", "disputed"],
  completed: ["published", "disputed", "archived"],
  published: ["archived", "disputed"],
  cancelled: ["archived"],
  disputed: ["active", "under-review", "cancelled", "archived"],
  archived: [],
};

export interface LifecycleProject {
  id: string;
  state: ProjectState;
  /** Increases by one on every applied transition. */
  revision: number;
}

export interface TransitionRequest {
  /** Client-generated id; a retry with the same id is not applied again. */
  requestId: string;
  to: ProjectState;
  /** The revision the caller based the request on. */
  expectedRevision: number;
}

export type TransitionErrorCode = "UNKNOWN_STATE" | "INVALID_TRANSITION" | "STALE_REVISION" | "ALREADY_IN_STATE";

export type TransitionResult =
  | { ok: true; project: LifecycleProject; replayed: boolean }
  | { ok: false; code: TransitionErrorCode; message: string; allowed: readonly ProjectState[] };

export function isProjectState(value: unknown): value is ProjectState {
  return typeof value === "string" && (PROJECT_STATES as readonly string[]).includes(value);
}

export function allowedTransitions(state: ProjectState): readonly ProjectState[] {
  return PROJECT_TRANSITIONS[state];
}

export function canTransition(from: ProjectState, to: ProjectState): boolean {
  return PROJECT_TRANSITIONS[from].includes(to);
}

/** Outcomes of earlier requests, keyed by request id (idempotency). */
export type TransitionLedger = Map<string, TransitionResult>;

export function applyTransition(
  project: LifecycleProject,
  request: TransitionRequest,
  ledger: TransitionLedger = new Map(),
): TransitionResult {
  const earlier = ledger.get(request.requestId);
  if (earlier) {
    return earlier.ok ? { ...earlier, replayed: true } : earlier;
  }

  const allowed = allowedTransitions(project.state);
  const fail = (code: TransitionErrorCode, message: string): TransitionResult => {
    const result: TransitionResult = { ok: false, code, message, allowed };
    ledger.set(request.requestId, result);
    return result;
  };

  if (!isProjectState(request.to)) return fail("UNKNOWN_STATE", `"${String(request.to)}" is not a project state`);
  if (request.expectedRevision !== project.revision) {
    return fail("STALE_REVISION", `The project changed (revision ${project.revision}); reload before retrying.`);
  }
  if (request.to === project.state) return fail("ALREADY_IN_STATE", `The project is already ${project.state}.`);
  if (!canTransition(project.state, request.to)) {
    return fail(
      "INVALID_TRANSITION",
      `A ${project.state} project cannot become ${request.to}. Allowed: ${allowed.join(", ") || "none"}.`,
    );
  }

  const result: TransitionResult = {
    ok: true,
    replayed: false,
    project: { ...project, state: request.to, revision: project.revision + 1 },
  };
  ledger.set(request.requestId, result);
  return result;
}
