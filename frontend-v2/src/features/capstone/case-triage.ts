/**
 * Capstone integrity and safety case triage (CAPSTONE-100).
 *
 * Routes cases by severity, age policy, conflict, funding impact and responder
 * scope. Every case has a severity-based timer and an escalation path. Access
 * is deny-by-default and tenant-scoped, transitions are documented and check
 * the revision the caller saw, and a retried request id returns its original
 * outcome so a retry cannot assign two responders or apply a decision twice.
 * Audit records contain identifiers and metadata only, never case details.
 */

export const SEVERITIES = ["critical", "high", "medium", "low"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const RESPONDER_SCOPES = ["safety", "ethics", "finance", "organization"] as const;
export type ResponderScope = (typeof RESPONDER_SCOPES)[number];

export const CASE_STATES = ["new", "triaged", "escalated", "resolved", "closed"] as const;
export type CaseState = (typeof CASE_STATES)[number];

export const CASE_TRANSITIONS: Readonly<Record<CaseState, readonly CaseState[]>> = {
  new: ["triaged", "escalated", "closed"],
  triaged: ["escalated", "resolved", "closed"],
  escalated: ["resolved", "closed"],
  resolved: ["closed", "escalated"],
  closed: [],
};

/** Hours allowed before a case must be escalated. */
export const SLA_HOURS: Readonly<Record<Severity, number>> = { critical: 4, high: 24, medium: 72, low: 168 };

export interface SafetyCase {
  id: string;
  projectId: string;
  organizationId: string;
  severity: Severity;
  reportedAt: string;
  state: CaseState;
  /** Increments on every applied triage decision. */
  revision: number;
  requiresAgePolicy: boolean;
  hasConflict: boolean;
  hasFundingImpact: boolean;
  responderScope: ResponderScope;
  assigneeId: string | null;
}

export interface TriageContext {
  organizationId: string;
  /** Responder ids allowed to act for each scope. */
  responders: Partial<Record<ResponderScope, readonly string[]>>;
  now: string;
}

export interface TriageRequest {
  requestId: string;
  actorId: string;
  expectedRevision: number;
  to: CaseState;
  at: string;
}

export type TriageErrorCode =
  | "UNKNOWN_SEVERITY"
  | "INVALID_TRANSITION"
  | "STALE_REVISION"
  | "TENANT_MISMATCH"
  | "NOT_AUTHORIZED"
  | "CASE_CLOSED"
  | "ALREADY_ASSIGNED";

export type TriageResult = { ok: true; safetyCase: SafetyCase; replayed: boolean } | { ok: false; code: TriageErrorCode; message: string };

export type TriageLedger = Map<string, TriageResult>;

export function isSeverity(value: unknown): value is Severity {
  return typeof value === "string" && (SEVERITIES as readonly string[]).includes(value);
}

/** The most specific queue that must handle the case, in a fixed priority order. */
export function routingTarget(safetyCase: SafetyCase): ResponderScope {
  if (safetyCase.severity === "critical") return "safety";
  if (safetyCase.hasConflict) return "ethics";
  if (safetyCase.hasFundingImpact) return "finance";
  if (safetyCase.requiresAgePolicy) return "organization";
  return safetyCase.responderScope;
}

/** Timer for a case. `dueAt` is derived from severity; no mutable clock is stored. */
export function caseTimer(safetyCase: SafetyCase, now: string): { dueAt: string; remainingMs: number; overdue: boolean; escalationTarget: ResponderScope } {
  const due = Date.parse(safetyCase.reportedAt) + SLA_HOURS[safetyCase.severity] * 3_600_000;
  const current = Date.parse(now);
  const remainingMs = due - current;
  return {
    dueAt: new Date(due).toISOString(),
    remainingMs,
    overdue: Number.isFinite(current) && remainingMs < 0,
    escalationTarget: safetyCase.severity === "critical" ? "safety" : "organization",
  };
}

/** Apply one triage decision. Replays never apply a decision twice. */
export function triageCase(
  safetyCase: SafetyCase,
  ctx: TriageContext,
  request: TriageRequest,
  ledger: TriageLedger = new Map(),
): TriageResult {
  const earlier = ledger.get(request.requestId);
  if (earlier) return earlier.ok ? { ...earlier, replayed: true } : earlier;

  const fail = (code: TriageErrorCode, message: string): TriageResult => {
    const result: TriageResult = { ok: false, code, message };
    ledger.set(request.requestId, result);
    return result;
  };

  if (!isSeverity(safetyCase.severity)) return fail("UNKNOWN_SEVERITY", "The case has an unknown severity and cannot be triaged.");
  if (ctx.organizationId !== safetyCase.organizationId) return fail("TENANT_MISMATCH", "The case belongs to a different organization.");
  const target = routingTarget(safetyCase);
  if (!ctx.responders[target]?.includes(request.actorId)) return fail("NOT_AUTHORIZED", `Only assigned ${target} responders can triage this case.`);
  if (safetyCase.state === "closed") return fail("CASE_CLOSED", "The case is closed.");
  if (request.expectedRevision !== safetyCase.revision) return fail("STALE_REVISION", `The case changed (revision ${safetyCase.revision}); reload before acting.`);
  if (!(CASE_STATES as readonly string[]).includes(request.to)) return fail("INVALID_TRANSITION", `"${String(request.to)}" is not a case state.`);
  if (!CASE_TRANSITIONS[safetyCase.state].includes(request.to)) {
    return fail("INVALID_TRANSITION", `A ${safetyCase.state} case cannot become ${request.to}. Allowed: ${CASE_TRANSITIONS[safetyCase.state].join(", ")}.`);
  }
  if (safetyCase.assigneeId !== null && safetyCase.assigneeId !== request.actorId && request.to !== "closed") {
    return fail("ALREADY_ASSIGNED", "This case already has an assigned responder.");
  }

  const overdue = caseTimer(safetyCase, ctx.now).overdue;
  const nextState: CaseState = overdue && request.to === "triaged" ? "escalated" : request.to;
  const next: SafetyCase = {
    ...safetyCase,
    state: nextState,
    revision: safetyCase.revision + 1,
    assigneeId: safetyCase.assigneeId ?? request.actorId,
  };
  const result: TriageResult = { ok: true, safetyCase: next, replayed: false };
  ledger.set(request.requestId, result);
  return result;
}

/** Audit trail entry: identifiers and metadata, never the case narrative. */
export function caseAuditEvent(action: "case.routed" | "case.escalated" | "case.resolved" | "case.closed" | "case.accessed", safetyCase: SafetyCase, actorId: string, at: string): Readonly<Record<string, string | number>> {
  return Object.freeze({
    type: `integrity.${action}`,
    organizationId: safetyCase.organizationId,
    projectId: safetyCase.projectId,
    caseId: safetyCase.id,
    severity: safetyCase.severity,
    state: safetyCase.state,
    revision: safetyCase.revision,
    actorId,
    at,
  });
}
