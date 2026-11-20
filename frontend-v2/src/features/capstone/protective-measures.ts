/**
 * Protective project measures (CAPSTONE-101 / issue #1527).
 *
 * Authorized responders can temporarily restrict publishing, messaging, file
 * access, funding, review or participation for a scoped target with an explicit
 * expiry. Deny by default; stable reason codes, no free-text reasons in logs,
 * and idempotency on request id prevent duplicate measures on retry.
 */
import { canonicalize, sha256Hex } from "./portfolio-export";

export const RESTRICTION_KINDS = ["publishing", "messaging", "file_access", "funding", "review", "participation"] as const;
export type RestrictionKind = (typeof RESTRICTION_KINDS)[number];
export const REASON_CODES = ["SAFETY_CONCERN", "PRIVACY_BREACH", "FRAUD_INVESTIGATION", "CONFLICT_OF_INTEREST", "LEGAL_HOLD"] as const;
export type ReasonCode = (typeof REASON_CODES)[number];
const RESPONDER_ROLES = ["ethics_officer", "administrator"];

export interface Responder {
  id: string;
  role: string;
  organizationId: string;
}

export interface ProtectedResource {
  projectId: string;
  organizationId: string;
  revision: number;
  assignedIds?: readonly string[];
  /** Sensitive context is never copied into a measure or an audit record. */
  privatePayloads?: unknown;
}

export interface MeasureScope {
  type: "project" | "team" | "participant";
  targetId: string;
}

export interface ProtectiveMeasure {
  id: string;
  projectId: string;
  kind: RestrictionKind;
  scope: MeasureScope;
  reasonCode: ReasonCode;
  createdAt: string;
  createdBy: string;
  expiresAt: string;
  liftedAt?: string;
  integrity: { algorithm: "SHA-256"; digest: string };
}

export interface ApplyMeasureRequest {
  requestId: string;
  actor: Responder;
  resource: ProtectedResource;
  kind: RestrictionKind | string;
  scope: MeasureScope;
  reasonCode: ReasonCode | string;
  expiresAt: string;
  now: string;
}

export type MeasureErrorCode =
  | "UNKNOWN_ROLE"
  | "NOT_PERMITTED"
  | "TENANT_MISMATCH"
  | "STALE_REVISION"
  | "INVALID_KIND"
  | "INVALID_REASON"
  | "INVALID_SCOPE"
  | "INVALID_EXPIRY"
  | "ALREADY_ACTIVE";

export type MeasureResult =
  | { ok: true; measure: ProtectiveMeasure; replayed: boolean }
  | { ok: false; code: MeasureErrorCode; message: string };

export type MeasureLedger = Map<string, MeasureResult>;

export function isRestrictionActive(measure: ProtectiveMeasure, now: string): boolean {
  const at = Date.parse(now);
  return !measure.liftedAt && Number.isFinite(at) && Date.parse(measure.expiresAt) > at;
}

export async function applyProtectiveMeasure(
  request: ApplyMeasureRequest,
  existing: readonly ProtectiveMeasure[] = [],
  ledger: MeasureLedger = new Map(),
): Promise<MeasureResult> {
  const earlier = ledger.get(request.requestId);
  if (earlier) return earlier.ok ? { ...earlier, replayed: true } : earlier;
  const record = (result: MeasureResult): MeasureResult => {
    ledger.set(request.requestId, result);
    return result;
  };
  const fail = (code: MeasureErrorCode, message: string) => record({ ok: false, code, message });

  if (!(RESPONDER_ROLES as readonly string[]).includes(request.actor.role)) return fail("UNKNOWN_ROLE", "This role cannot apply protective measures.");
  if (request.actor.organizationId !== request.resource.organizationId) return fail("TENANT_MISMATCH", "The project belongs to another organization.");
  if (request.actor.role === "ethics_officer" && !request.resource.assignedIds?.includes(request.actor.id)) {
    return fail("NOT_PERMITTED", "You are not assigned to this project.");
  }
  if (request.resource.revision <= 0) return fail("STALE_REVISION", "Reload the project before applying a measure.");
  if (!(RESTRICTION_KINDS as readonly string[]).includes(request.kind)) return fail("INVALID_KIND", "Unknown restriction kind.");
  if (!(REASON_CODES as readonly string[]).includes(request.reasonCode)) return fail("INVALID_REASON", "Unknown reason code.");
  if (!request.scope?.targetId?.trim() || !["project", "team", "participant"].includes(request.scope.type)) {
    return fail("INVALID_SCOPE", "A measure needs a valid scope and target.");
  }
  const expires = Date.parse(request.expiresAt);
  if (!Number.isFinite(expires) || expires <= Date.parse(request.now)) return fail("INVALID_EXPIRY", "A measure must expire in the future.");

  const duplicate = existing.some((m) => m.projectId === request.resource.projectId && m.kind === request.kind &&
    m.scope.type === request.scope.type && m.scope.targetId === request.scope.targetId && isRestrictionActive(m, request.now));
  if (duplicate) return fail("ALREADY_ACTIVE", "An active measure already covers this scope.");

  const body = {
    id: `msr_${request.requestId.replace(/[^0-9A-Za-z]/g, "").slice(0, 16).padEnd(16, "0")}`,
    projectId: request.resource.projectId,
    kind: request.kind as RestrictionKind,
    scope: request.scope,
    reasonCode: request.reasonCode as ReasonCode,
    createdAt: request.now,
    createdBy: request.actor.id,
    expiresAt: request.expiresAt,
  };
  const digest = await sha256Hex(canonicalize(body));
  return record({ ok: true, measure: { ...body, integrity: { algorithm: "SHA-256", digest } }, replayed: false });
}

/** Access checks deny by default for a restricted kind, scope and project. */
export function evaluateRestriction(
  measures: readonly ProtectiveMeasure[],
  request: { projectId: string; kind: RestrictionKind; scope: MeasureScope; actorId: string; teamId?: string; now: string },
): { allowed: boolean; code: MeasureErrorCode | "RESTRICTED" | "ALLOWED" } {
  const match = measures.find((m) => m.projectId === request.projectId && m.kind === request.kind && isRestrictionActive(m, request.now) &&
    (m.scope.type === "project" || (m.scope.type === "team" && m.scope.targetId === request.teamId) ||
      (m.scope.type === "participant" && m.scope.targetId === request.actorId)));
  return match ? { allowed: false, code: "RESTRICTED" } : { allowed: true, code: "ALLOWED" };
}

/** Lifting a measure is idempotent; only its creator or an administrator may do it. */
export function liftProtectiveMeasure(
  measure: ProtectiveMeasure,
  request: { requestId: string; actor: Responder; organizationId: string; now: string },
  ledger: MeasureLedger = new Map(),
): MeasureResult {
  const earlier = ledger.get(request.requestId);
  if (earlier) return earlier.ok ? { ...earlier, replayed: true } : earlier;
  const fail = (code: MeasureErrorCode, message: string) => {
    const result: MeasureResult = { ok: false, code, message };
    ledger.set(request.requestId, result);
    return result;
  };
  if (request.actor.organizationId !== request.organizationId) return fail("TENANT_MISMATCH", "Wrong tenant.");
  if (request.actor.role !== "administrator" && request.actor.id !== measure.createdBy) {
    return fail("NOT_PERMITTED", "Only the responder who applied the measure can lift it.");
  }
  const result: MeasureResult = {
    ok: true,
    measure: { ...measure, ...(measure.liftedAt ? {} : { liftedAt: request.now }) },
    replayed: Boolean(measure.liftedAt),
  };
  ledger.set(request.requestId, result);
  return result;
}

/** Audit entries carry codes and public ids only — no reason text or payloads. */
export function measureAudit(result: MeasureResult): Record<string, string | boolean> {
  if (!result.ok) return { outcome: "denied", code: result.code };
  return {
    outcome: "measure",
    projectId: result.measure.projectId,
    kind: result.measure.kind,
    reasonCode: result.measure.reasonCode,
    expiresAt: result.measure.expiresAt,
    replayed: result.replayed,
  };
}
