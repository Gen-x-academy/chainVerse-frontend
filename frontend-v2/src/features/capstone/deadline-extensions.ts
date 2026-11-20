/**
 * Deadline extension requests (CAPSTONE-064).
 *
 * A reasoned request is reviewed against its impact preview (affected
 * milestones, revised schedule and funding consequences), then approved or
 * denied by an authorized decision maker. Requests and decisions are
 * immutable; retries with the same request id replay the original outcome.
 * Audit metadata excludes the private rationale and financial details.
 */

export const EXTENSION_STATES = ["requested", "approved", "denied", "superseded"] as const;
export type ExtensionState = (typeof EXTENSION_STATES)[number];

export interface MilestoneDate {
  milestoneId: string;
  /** ISO date (YYYY-MM-DD). */
  dueOn: string;
}

export interface ExtensionImpact {
  affectedMilestoneIds: readonly string[];
  /** Extended days for the impacted milestones (must be positive). */
  days: number;
  /** Funding consequence in smallest asset units: positive adds budget. */
  fundingDelta: number;
  /** Reasoned, private request rationale (never logged). */
  rationale: string;
}

export interface DeadlineExtension {
  id: string;
  tenantId: string;
  projectId: string;
  version: number;
  state: ExtensionState;
  requestedBy: string;
  currentSchedule: readonly MilestoneDate[];
  impact: ExtensionImpact;
  /** Decision metadata, set only once by approve/deny. */
  decidedBy?: string;
  decidedAt?: string;
}

export interface ExtensionContext {
  tenantId: string;
  projectId: string;
  actorId: string;
  /** Deny by default: only these members may request. */
  requesterIds: readonly string[];
  /** Deny by default: only these members may approve or deny. */
  approverIds: readonly string[];
  /** Schedule revision the requester last saw. */
  scheduleRevision: number;
  projectState: string;
}

export type ExtensionErrorCode =
  | "FORBIDDEN"
  | "TENANT_MISMATCH"
  | "STALE_REQUEST"
  | "INVALID_TRANSITION"
  | "INVALID_IMPACT"
  | "INVALID_REASON";

export type ExtensionResult =
  | { ok: true; extension: DeadlineExtension; replayed: boolean; audit: { extensionId: string; version: number; action: "requested" | "approved" | "denied"; actorId: string } }
  | { ok: false; code: ExtensionErrorCode; message: string; allowed: readonly string[] };

export interface ExtensionRequest {
  requestId: string;
  tenantId: string;
  projectId: string;
  expectedVersion: number;
  /** Deterministic timestamp supplied by the caller (ISO). */
  decidedAt?: string;
}

export type ExtensionLedger = Map<string, ExtensionResult>;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isDate = (value: string) => DATE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);

/** Problems with an extension request (rationale, impact, schedule). */
export function validateExtension(extension: DeadlineExtension, ctx: Pick<ExtensionContext, "requesterIds">): string[] {
  const errors: string[] = [];
  if (!ctx.requesterIds.includes(extension.requestedBy)) errors.push("requestedBy: you are not allowed to request an extension");
  if (extension.impact.rationale.trim().length < 20 || extension.impact.rationale.length > 2000) {
    errors.push("impact.rationale: give a reasoned request of 20 to 2000 characters");
  }
  if (!Number.isSafeInteger(extension.impact.days) || extension.impact.days <= 0 || extension.impact.days > 365) {
    errors.push("impact.days: the extension must be between 1 and 365 days");
  }
  if (!Number.isSafeInteger(extension.impact.fundingDelta) || Math.abs(extension.impact.fundingDelta) > 1_000_000_000) {
    errors.push("impact.fundingDelta: give a funding consequence in smallest asset units");
  }
  if (extension.impact.affectedMilestoneIds.length === 0) errors.push("impact.affectedMilestoneIds: select at least one milestone");
  const known = new Set(extension.currentSchedule.map((m) => m.milestoneId));
  for (const id of extension.impact.affectedMilestoneIds) {
    if (!known.has(id)) errors.push(`impact.affectedMilestoneIds: ${id} is not in the project schedule`);
  }
  if (extension.currentSchedule.some((m) => !isDate(m.dueOn))) errors.push("currentSchedule: dates must use YYYY-MM-DD");
  return errors;
}

/** Deterministic revised schedule with the extension applied to named milestones. */
export function revisedSchedule(extension: DeadlineExtension): MilestoneDate[] {
  return extension.currentSchedule.map((milestone) =>
    extension.impact.affectedMilestoneIds.includes(milestone.milestoneId)
      ? { ...milestone, dueOn: addDays(milestone.dueOn, extension.impact.days) }
      : { ...milestone },
  );
}

/** Audit metadata: identifiers and outcome only, no rationale or funding data. */
export function extensionAudit(extension: DeadlineExtension, action: "requested" | "approved" | "denied") {
  return { extensionId: extension.id, version: extension.version, action, actorId: extension.decidedBy ?? extension.requestedBy };
}

function record(extension: DeadlineExtension, action: "requested" | "approved" | "denied", ledger: ExtensionLedger, key: string): ExtensionResult {
  const result: ExtensionResult = {
    ok: true,
    replayed: false,
    extension,
    audit: extensionAudit(extension, action),
  };
  ledger.set(key, result);
  return result;
}

/** Create a new extension request for the current project schedule. */
export function requestExtension(
  extension: DeadlineExtension,
  request: ExtensionRequest,
  ctx: ExtensionContext,
  ledger: ExtensionLedger = new Map(),
): ExtensionResult {
  const key = `request:${request.requestId}`;
  const earlier = ledger.get(key);
  if (earlier) return earlier.ok ? { ...earlier, replayed: true } : earlier;

  const fail = (code: ExtensionErrorCode, message: string, allowed: readonly string[] = []): ExtensionResult => {
    const result: ExtensionResult = { ok: false, code, message, allowed };
    ledger.set(key, result);
    return result;
  };

  if (!ctx.requesterIds.includes(ctx.actorId) || extension.requestedBy !== ctx.actorId) {
    return fail("FORBIDDEN", "You are not allowed to request an extension for this project.");
  }
  if (request.tenantId !== ctx.tenantId || request.projectId !== ctx.projectId || extension.tenantId !== ctx.tenantId || extension.projectId !== ctx.projectId) {
    return fail("TENANT_MISMATCH", "The request belongs to a different tenant or project.");
  }
  if (ctx.projectState !== "active") {
    return fail("INVALID_TRANSITION", `Extensions can only be requested for active projects (currently ${ctx.projectState}).`, ["active"]);
  }
  if (request.expectedVersion !== ctx.scheduleRevision) {
    return fail("STALE_REQUEST", `The schedule is at revision ${ctx.scheduleRevision}; reload before requesting.`);
  }
  if (extension.state !== "requested") return fail("INVALID_TRANSITION", `A ${extension.state} request cannot be re-submitted.`);

  const errors = validateExtension(extension, ctx);
  if (errors.length > 0) return fail(errors[0]!.startsWith("impact.rationale") ? "INVALID_REASON" : "INVALID_IMPACT", errors[0] as string);
  return record(extension, "requested", ledger, key);
}

/** Approve or deny a requested extension exactly once. */
export function decideExtension(
  extension: DeadlineExtension,
  request: ExtensionRequest,
  ctx: ExtensionContext,
  decision: "approved" | "denied",
  ledger: ExtensionLedger = new Map(),
): ExtensionResult {
  const key = `decision:${request.requestId}`;
  const earlier = ledger.get(key);
  if (earlier) return earlier.ok ? { ...earlier, replayed: true } : earlier;

  const fail = (code: ExtensionErrorCode, message: string, allowed: readonly string[] = []): ExtensionResult => {
    const result: ExtensionResult = { ok: false, code, message, allowed };
    ledger.set(key, result);
    return result;
  };

  if (!ctx.approverIds.includes(ctx.actorId)) return fail("FORBIDDEN", "You are not allowed to decide on this extension.");
  if (request.tenantId !== ctx.tenantId || request.projectId !== ctx.projectId || extension.tenantId !== ctx.tenantId || extension.projectId !== ctx.projectId) {
    return fail("TENANT_MISMATCH", "The request belongs to a different tenant or project.");
  }
  if (request.expectedVersion !== extension.version) {
    return fail("STALE_REQUEST", `The request is at version ${extension.version}; reload before deciding.`);
  }
  if (extension.state !== "requested") return fail("INVALID_TRANSITION", `A ${extension.state} request has already been decided.`);

  const decided: DeadlineExtension = {
    ...extension,
    state: decision,
    version: extension.version + 1,
    decidedBy: ctx.actorId,
    decidedAt: request.decidedAt ?? new Date(0).toISOString(),
  };
  return record(decided, decision, ledger, key);
}
