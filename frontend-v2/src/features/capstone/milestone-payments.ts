/**
 * Capstone milestone payment release (CAPSTONE-086).
 *
 * A configured milestone amount is released only after every required
 * deliverable has been accepted and the challenge window has closed without a
 * challenge. Fees are computed with integer arithmetic and half-up rounding in
 * basis points, so two clients always agree on the gross, fee and net amounts.
 * Releases are replay-safe on the request id, guarded by the revision the
 * caller saw, and audited without private deliverable or payer payloads.
 */

export type PaymentRole = "finance" | "program-manager" | "admin" | "sponsor" | "student";
const RELEASE_ROLES: readonly PaymentRole[] = ["finance", "program-manager", "admin"];

export interface Milestone {
  id: string;
  title: string;
  /** Amount to release, in integer minor units. */
  amountMinor: number;
  /** Deliverables that must all be accepted before release. */
  requiredDeliverableIds: string[];
  /** Days after acceptance during which the release may be challenged. */
  challengeWindowDays: number;
  acceptedAt?: number;
  challenged?: boolean;
}

export interface FeeConfig {
  /** Fee in basis points (100 bp = 1%); negative values are ignored. */
  feeBps: number;
  /** Floor applied to a positive fee, in minor units. */
  minFeeMinor: number;
}

export interface PaymentRequest {
  /** Client-generated id; a retry with the same id is not applied again. */
  requestId: string;
  actorId: string;
  actorTenantId: string;
  actorRole: PaymentRole;
  tenantId: string;
  projectId: string;
  milestone: Milestone;
  config: FeeConfig;
  /** Ids of deliverables whose acceptance has been recorded. */
  acceptedDeliverableIds: readonly string[];
  expectedRevision: number;
  revision: number;
  now: number;
}

export type PaymentErrorCode =
  | "FORBIDDEN"
  | "TENANT_MISMATCH"
  | "STALE_REVISION"
  | "INVALID_AMOUNT"
  | "INVALID_FEE"
  | "NOT_ACCEPTED"
  | "CHALLENGE_OPEN"
  | "DELIVERABLES_MISSING"
  | "ALREADY_RELEASED"
  | "REPLAY_CONFLICT";

export interface MilestonePayment {
  paymentId: string;
  tenantId: string;
  projectId: string;
  milestoneId: string;
  grossMinor: number;
  feeMinor: number;
  netMinor: number;
  feeBps: number;
  releasedAt: number;
  revision: number;
}

export type PaymentResult =
  | { ok: true; payment: MilestonePayment; replayed: boolean }
  | { ok: false; code: PaymentErrorCode; message: string; replayed: boolean };

export interface PaymentReceipt {
  result: PaymentResult;
  fingerprint: string;
}
export type PaymentLedger = Map<string, PaymentReceipt>;

const DAY_MS = 86_400_000;
const MAX_FEE_BPS = 10_000;

/** Deterministic half-up rounding of gross * bps / 10_000, using integers only. */
export function calculateFeeMinor(grossMinor: number, config: FeeConfig): number {
  if (!Number.isSafeInteger(grossMinor) || grossMinor <= 0) return 0;
  const bps = Number.isSafeInteger(config.feeBps) ? Math.min(Math.max(config.feeBps, 0), MAX_FEE_BPS) : 0;
  const min = Number.isSafeInteger(config.minFeeMinor) && config.minFeeMinor > 0 ? config.minFeeMinor : 0;
  const raw = Math.floor((grossMinor * bps + 5_000) / 10_000);
  return Math.min(grossMinor, Math.max(min, raw));
}

/** Inclusive end of the challenge window, in epoch milliseconds. */
export function challengeWindowEndsAt(milestone: Milestone): number | undefined {
  if (!Number.isFinite(milestone.acceptedAt) || !Number.isFinite(milestone.challengeWindowDays) || milestone.challengeWindowDays < 0) return undefined;
  return (milestone.acceptedAt as number) + milestone.challengeWindowDays * DAY_MS;
}

export function paymentFingerprint(request: PaymentRequest): string {
  return JSON.stringify({
    actorId: request.actorId,
    tenantId: request.tenantId,
    projectId: request.projectId,
    milestoneId: request.milestone.id,
    grossMinor: request.milestone.amountMinor,
    feeBps: request.config.feeBps,
    minFeeMinor: request.config.minFeeMinor,
    expectedRevision: request.expectedRevision,
  });
}

/** Release a milestone payment if - and only if - all gates have passed. */
export function releaseMilestonePayment(request: PaymentRequest, ledger: PaymentLedger = new Map()): PaymentResult {
  const earlier = ledger.get(request.requestId);
  if (earlier) {
    if (earlier.fingerprint !== paymentFingerprint(request)) {
      return { ok: false, code: "REPLAY_CONFLICT", message: "This request id was already used for a different payment.", replayed: false };
    }
    return { ...earlier.result, replayed: true };
  }

  const record = (result: PaymentResult): PaymentResult => {
    ledger.set(request.requestId, { result, fingerprint: paymentFingerprint(request) });
    return result;
  };
  const fail = (code: PaymentErrorCode, message: string): PaymentResult => record({ ok: false, code, message, replayed: false });

  // Deny by default and check the tenant boundary before any other detail.
  if (!RELEASE_ROLES.includes(request.actorRole)) return fail("FORBIDDEN", "You are not allowed to release milestone payments.");
  if (request.actorTenantId !== request.tenantId) return fail("TENANT_MISMATCH", "The milestone belongs to a different tenant.");
  if (request.revision !== request.expectedRevision || request.revision !== 0) {
    return fail("STALE_REVISION", `The milestone changed (revision ${request.revision}); reload before retrying.`);
  }

  const { milestone, config } = request;
  if (!Number.isSafeInteger(milestone.amountMinor) || milestone.amountMinor <= 0) {
    return fail("INVALID_AMOUNT", "The milestone amount must be a positive whole number of minor units.");
  }
  if (!Number.isSafeInteger(config.feeBps) || config.feeBps < 0 || config.feeBps > MAX_FEE_BPS || !Number.isSafeInteger(config.minFeeMinor) || config.minFeeMinor < 0) {
    return fail("INVALID_FEE", "The fee configuration is out of range.");
  }
  if (milestone.acceptedAt === undefined) return fail("NOT_ACCEPTED", "The milestone has not been accepted.");
  const accepted = new Set(request.acceptedDeliverableIds);
  const missing = milestone.requiredDeliverableIds.filter((id) => !accepted.has(id));
  if (missing.length > 0) return fail("DELIVERABLES_MISSING", `Accepted deliverables are missing: ${missing.length}.`);
  if (milestone.challenged) return fail("CHALLENGE_OPEN", "The milestone is under challenge and cannot be paid yet.");
  const end = challengeWindowEndsAt(milestone);
  if (end === undefined || !Number.isFinite(request.now) || request.now < end) {
    return fail("CHALLENGE_OPEN", "The challenge window has not closed yet.");
  }

  const feeMinor = calculateFeeMinor(milestone.amountMinor, config);
  const payment: MilestonePayment = {
    paymentId: `pay-${request.requestId}`,
    tenantId: request.tenantId,
    projectId: request.projectId,
    milestoneId: milestone.id,
    grossMinor: milestone.amountMinor,
    feeMinor,
    netMinor: milestone.amountMinor - feeMinor,
    feeBps: config.feeBps,
    releasedAt: request.now,
    revision: 1,
  };
  return record({ ok: true, payment, replayed: false });
}

/** A second release for the same milestone is a no-op, never a new transfer. */
export function alreadyReleased(payments: readonly MilestonePayment[], milestoneId: string): boolean {
  return payments.some((p) => p.milestoneId === milestoneId);
}

/** Privacy-safe audit record: ids and amounts only. */
export function paymentAudit(payment: MilestonePayment): Record<string, string | number> {
  return {
    paymentId: payment.paymentId,
    tenantId: payment.tenantId,
    projectId: payment.projectId,
    milestoneId: payment.milestoneId,
    grossMinor: payment.grossMinor,
    feeMinor: payment.feeMinor,
    netMinor: payment.netMinor,
    feeBps: payment.feeBps,
  };
}
