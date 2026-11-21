/**
 * Capstone escrow funding intents (CAPSTONE-084).
 *
 * An intent is a replay-safe instruction to fund escrow for an accepted
 * project charter. It captures the payer, an integer minor-unit amount, an
 * asset, an expiry and the explicit conditions under which the funds may be
 * released. Private charter, payer and proposal details are never copied into
 * audit records. All time and identifiers are supplied by the caller so the
 * behaviour is fully deterministic.
 */

export const SUPPORTED_ESCROW_ASSETS = ["USD", "USDC", "XLM"] as const;
export type EscrowAsset = (typeof SUPPORTED_ESCROW_ASSETS)[number];

export type ConditionType = "deliverable_accepted" | "challenge_window_closed" | "milestone_approved" | "attestation";
export interface ReleaseCondition {
  type: ConditionType;
  /** Opaque identifier of the deliverable or gate; no private payload. */
  ref: string;
}

export interface AcceptedCharter {
  charterId: string;
  tenantId: string;
  state: "accepted" | "active";
  currency: string;
  revision: number;
}

export interface EscrowIntent {
  intentId: string;
  tenantId: string;
  charterId: string;
  payerId: string;
  amountMinor: number;
  asset: EscrowAsset;
  currency: string;
  createdAt: number;
  expiresAt: number;
  conditions: ReleaseCondition[];
  revision: number;
}

export interface IntentRequest {
  /** Client-generated id; a retry with the same id is not applied again. */
  requestId: string;
  actorId: string;
  actorTenantId: string;
  actorRole: IntentRole;
  charter: AcceptedCharter;
  payerId: string;
  amountMinor: number;
  asset: EscrowAsset;
  currency: string;
  expiresAt: number;
  conditions: ReleaseCondition[];
  expectedCharterRevision: number;
  now: number;
}

export type IntentRole = "sponsor" | "finance" | "program-manager" | "admin" | "student";
const WRITE_ROLES: readonly IntentRole[] = ["sponsor", "finance", "program-manager", "admin"];
const CONDITION_TYPES: readonly ConditionType[] = ["deliverable_accepted", "challenge_window_closed", "milestone_approved", "attestation"];

export type IntentErrorCode =
  | "FORBIDDEN"
  | "TENANT_MISMATCH"
  | "CHARTER_NOT_ACCEPTED"
  | "STALE_REVISION"
  | "INVALID_AMOUNT"
  | "INVALID_ASSET"
  | "INVALID_CURRENCY"
  | "INVALID_EXPIRY"
  | "NO_RELEASE_CONDITIONS"
  | "REPLAY_CONFLICT";

export type IntentResult =
  | { ok: true; intent: EscrowIntent; replayed: boolean }
  | { ok: false; code: IntentErrorCode; message: string; replayed: boolean };

export interface IntentReceipt {
  result: IntentResult;
  fingerprint: string;
}
export type IntentLedger = Map<string, IntentReceipt>;

/** Stable replay key derived only from the economic terms of the request. */
export function intentFingerprint(request: IntentRequest): string {
  return JSON.stringify({
    actorId: request.actorId,
    tenantId: request.charter.tenantId,
    charterId: request.charter.charterId,
    payerId: request.payerId,
    amountMinor: request.amountMinor,
    asset: request.asset,
    currency: request.currency.trim().toUpperCase(),
    expiresAt: request.expiresAt,
    conditions: request.conditions,
  });
}

export function validateConditions(conditions: readonly ReleaseCondition[]): boolean {
  if (conditions.length === 0) return false;
  const seen = new Set<string>();
  for (const condition of conditions) {
    if (!CONDITION_TYPES.includes(condition.type) || !condition.ref || condition.ref.trim().length === 0) return false;
    const key = `${condition.type}:${condition.ref}`;
    if (seen.has(key)) return false;
    seen.add(key);
  }
  return true;
}

/** Create an intent. The ledger is the only thing mutated; retries are inert. */
export function createEscrowIntent(request: IntentRequest, ledger: IntentLedger = new Map()): IntentResult {
  const earlier = ledger.get(request.requestId);
  if (earlier) {
    if (earlier.fingerprint !== intentFingerprint(request)) {
      return { ok: false, code: "REPLAY_CONFLICT", message: "This request id was already used for a different intent.", replayed: false };
    }
    return { ...earlier.result, replayed: true };
  }

  const record = (result: IntentResult): IntentResult => {
    ledger.set(request.requestId, { result, fingerprint: intentFingerprint(request) });
    return result;
  };
  const fail = (code: IntentErrorCode, message: string): IntentResult => record({ ok: false, code, message, replayed: false });

  // Deny by default; check the tenant boundary before revealing any detail.
  if (!WRITE_ROLES.includes(request.actorRole)) return fail("FORBIDDEN", "You are not allowed to create escrow intents.");
  if (request.actorTenantId !== request.charter.tenantId) {
    return fail("TENANT_MISMATCH", "The charter belongs to a different tenant.");
  }
  if (request.charter.state !== "accepted" && request.charter.state !== "active") {
    return fail("CHARTER_NOT_ACCEPTED", "Escrow can only be funded for an accepted charter.");
  }
  if (request.expectedCharterRevision !== request.charter.revision) {
    return fail("STALE_REVISION", `The charter changed (revision ${request.charter.revision}); reload before retrying.`);
  }
  if (!Number.isSafeInteger(request.amountMinor) || request.amountMinor <= 0) {
    return fail("INVALID_AMOUNT", "The amount must be a positive whole number of minor units.");
  }
  if (!SUPPORTED_ESCROW_ASSETS.includes(request.asset)) return fail("INVALID_ASSET", "Choose a supported escrow asset.");
  const currency = request.currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency) || currency !== request.charter.currency.trim().toUpperCase()) {
    return fail("INVALID_CURRENCY", "The currency must match the accepted charter.");
  }
  if (!Number.isFinite(request.now) || !Number.isFinite(request.expiresAt) || request.expiresAt <= request.now) {
    return fail("INVALID_EXPIRY", "The intent must expire at a future time.");
  }
  if (!validateConditions(request.conditions)) {
    return fail("NO_RELEASE_CONDITIONS", "Give at least one unique, named release condition.");
  }

  const intent: EscrowIntent = {
    intentId: `intent-${request.requestId}`,
    tenantId: request.charter.tenantId,
    charterId: request.charter.charterId,
    payerId: request.payerId,
    amountMinor: request.amountMinor,
    asset: request.asset,
    currency,
    createdAt: request.now,
    expiresAt: request.expiresAt,
    conditions: request.conditions.map((c) => ({ ...c })),
    revision: 1,
  };
  return record({ ok: true, intent, replayed: false });
}

/** Whether an intent is still within its window and has all its gates named. */
export function isIntentActive(intent: EscrowIntent, now: number): boolean {
  return Number.isFinite(now) && now < intent.expiresAt && validateConditions(intent.conditions);
}

/** Privacy-safe audit record: ids and amounts only, never payer or charter details. */
export function intentAudit(intent: EscrowIntent): Record<string, string | number> {
  return {
    intentId: intent.intentId,
    tenantId: intent.tenantId,
    charterId: intent.charterId,
    amountMinor: intent.amountMinor,
    asset: intent.asset,
    currency: intent.currency,
    conditionCount: intent.conditions.length,
  };
}
