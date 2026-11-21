/**
 * Confirmation of project escrow funding (CAPSTONE-085).
 *
 * Pure, deterministic reconciliation of a provider observation against the
 * signed funding agreement before funds may be marked available. Nothing is
 * written to a public ledger or to logs: audit events carry identifiers and
 * stable codes only.
 */
import type { ProjectState } from "./project-lifecycle";

export type ProviderFinality = "pending" | "final" | "failed";

export interface ProviderObservation {
  provider: string;
  /** Provider-side transaction hash; never a private payload. */
  reference: string;
  finality: ProviderFinality;
  asset: string;
  destination: string;
  /** Minor units of the asset (integers only). */
  amount: bigint;
  observedAt: string;
}

export interface FundingAgreement {
  id: string;
  tenantId: string;
  projectId: string;
  asset: string;
  destination: string;
  amount: bigint;
  status: "active" | "superseded" | "cancelled";
  projectState: ProjectState;
}

export type FundingState = "awaiting-funding" | "funding-observed" | "available" | "disputed";

export interface EscrowFunding {
  projectId: string;
  tenantId: string;
  agreementId: string;
  asset: string;
  destination: string;
  expectedAmount: bigint;
  state: FundingState;
  /** Increments on every applied change. */
  revision: number;
  observation?: ProviderObservation;
  /** Private content such as a memo or invoice note: never included in audit events. */
  privateNote?: string;
}

export interface ConfirmFundingRequest {
  /** Client-generated id; a retry with the same id returns the original outcome. */
  requestId: string;
  actorId: string;
  actorTenantId: string;
  actorRoles: readonly string[];
  expectedRevision: number;
  agreement?: FundingAgreement;
  observation?: ProviderObservation;
  now: string;
}

export type FundingErrorCode =
  | "FORBIDDEN"
  | "TENANT_MISMATCH"
  | "STALE_REVISION"
  | "INVALID_STATE"
  | "AGREEMENT_MISSING"
  | "AGREEMENT_INVALID"
  | "OBSERVATION_MISSING"
  | "PROVIDER_NOT_FINAL"
  | "PROVIDER_FAILED"
  | "ASSET_MISMATCH"
  | "DESTINATION_MISMATCH"
  | "UNDERPAYMENT"
  | "OVERPAYMENT"
  | "REFERENCE_CONFLICT";

export interface FundingAuditEvent {
  type: "escrow.confirm.succeeded" | "escrow.confirm.rejected" | "escrow.confirm.replayed";
  requestId: string;
  projectId: string;
  at: string;
  /** Stable code only; no amounts, destinations, memos or private notes. */
  code?: FundingErrorCode;
}

export type ConfirmFundingResult =
  | { ok: true; funding: EscrowFunding; replayed: boolean; audit: FundingAuditEvent }
  | { ok: false; code: FundingErrorCode; message: string; shortfall?: bigint; excess?: bigint; audit: FundingAuditEvent };

export type FundingLedger = Map<string, ConfirmFundingResult>;

/** Shared, in-memory idempotency and reference ledger for one request scope. */
export interface FundingContext {
  requests: FundingLedger;
  /** Provider reference -> project id, so one transfer cannot fund two projects. */
  usedReferences: Map<string, string>;
}

export function newFundingContext(): FundingContext {
  return { requests: new Map(), usedReferences: new Map() };
}

const CONFIRMER_ROLES = new Set(["funding-officer", "project-admin"]);
const FUNDABLE_PROJECT_STATES = new Set<ProjectState>(["approved", "recruiting", "active"]);

/** Which UI state a typed API response should render. */
export type FundingViewState = "loading" | "empty" | "error" | "conflict" | "success";

export function viewStateForResult(result: ConfirmFundingResult | undefined, pending = false): FundingViewState {
  if (pending) return "loading";
  if (!result) return "empty";
  if (!result.ok) return result.code === "REFERENCE_CONFLICT" || result.code === "STALE_REVISION" ? "conflict" : "error";
  return "success";
}

export function reconcile(
  funding: EscrowFunding,
  agreement: FundingAgreement | undefined,
  observation: ProviderObservation | undefined,
): { code: FundingErrorCode; message: string; shortfall?: bigint; excess?: bigint } | null {
  if (!agreement) return { code: "AGREEMENT_MISSING", message: "The signed funding agreement was not found. Refresh and retry." };
  if (
    agreement.id !== funding.agreementId ||
    agreement.tenantId !== funding.tenantId ||
    agreement.projectId !== funding.projectId ||
    agreement.status !== "active" ||
    !FUNDABLE_PROJECT_STATES.has(agreement.projectState)
  ) {
    return { code: "AGREEMENT_INVALID", message: "The agreement no longer authorises this project's funding. Review the current agreement." };
  }
  if (
    agreement.asset !== funding.asset ||
    agreement.destination !== funding.destination ||
    agreement.amount !== funding.expectedAmount
  ) {
    return { code: "AGREEMENT_INVALID", message: "The escrow record and the signed agreement disagree. Escalate for review." };
  }
  if (!observation) return { code: "OBSERVATION_MISSING", message: "No provider observation is available yet. Refresh and retry." };
  if (observation.finality === "failed") return { code: "PROVIDER_FAILED", message: "The provider reported a failed transfer. Ask finance to start a new transfer." };
  if (observation.finality !== "final") return { code: "PROVIDER_NOT_FINAL", message: "The transfer is not final yet. Wait for provider finality and retry." };
  if (observation.asset !== agreement.asset) return { code: "ASSET_MISMATCH", message: `The transfer asset does not match the agreement (expected ${agreement.asset}).` };
  if (observation.destination !== agreement.destination) return { code: "DESTINATION_MISMATCH", message: "The transfer destination does not match the signed agreement." };
  if (observation.amount < agreement.amount) {
    return { code: "UNDERPAYMENT", message: "The transfer is short of the agreed amount.", shortfall: agreement.amount - observation.amount };
  }
  if (observation.amount > agreement.amount) {
    return { code: "OVERPAYMENT", message: "The transfer exceeds the agreed amount.", excess: observation.amount - agreement.amount };
  }
  return null;
}

/**
 * Confirm funding. Authorization is deny-by-default, tenant boundaries are
 * enforced, and a request id or provider reference is never applied twice.
 */
export function confirmFunding(
  funding: EscrowFunding,
  request: ConfirmFundingRequest,
  context: FundingContext = newFundingContext(),
): ConfirmFundingResult {
  const audit = (type: FundingAuditEvent["type"], code?: FundingErrorCode): FundingAuditEvent => ({
    type,
    requestId: request.requestId,
    projectId: funding.projectId,
    at: request.now,
    ...(code ? { code } : {}),
  });

  const earlier = context.requests.get(request.requestId);
  if (earlier) {
    return earlier.ok ? { ...earlier, replayed: true, audit: audit("escrow.confirm.replayed") } : earlier;
  }

  const fail = (code: FundingErrorCode, message: string, extra: { shortfall?: bigint; excess?: bigint } = {}): ConfirmFundingResult => {
    const result: ConfirmFundingResult = {
      ok: false,
      code,
      message,
      ...extra,
      audit: audit("escrow.confirm.rejected", code),
    };
    context.requests.set(request.requestId, result);
    return result;
  };

  if (!request.actorRoles.some((role) => CONFIRMER_ROLES.has(role))) {
    return fail("FORBIDDEN", "Only a funding officer or project admin can confirm escrow funding.");
  }
  if (request.actorTenantId !== funding.tenantId) {
    return fail("TENANT_MISMATCH", "This funding record belongs to another tenant.");
  }
  if (request.expectedRevision !== funding.revision) {
    return fail("STALE_REVISION", `The funding record changed (revision ${funding.revision}); reload before retrying.`);
  }
  if (funding.state === "available") {
    const result: ConfirmFundingResult = { ok: true, funding, replayed: true, audit: audit("escrow.confirm.replayed") };
    context.requests.set(request.requestId, result);
    return result;
  }
  if (funding.state === "disputed") return fail("INVALID_STATE", "Funding is under dispute and cannot be confirmed.");

  const problem = reconcile(funding, request.agreement, request.observation);
  if (problem) return fail(problem.code, problem.message, { shortfall: problem.shortfall, excess: problem.excess });

  const observation = request.observation!;
  const owner = context.usedReferences.get(observation.reference);
  if (owner && owner !== funding.projectId) {
    return fail("REFERENCE_CONFLICT", "This provider transfer has already been applied to another project.");
  }

  context.usedReferences.set(observation.reference, funding.projectId);
  const result: ConfirmFundingResult = {
    ok: true,
    replayed: false,
    funding: { ...funding, state: "available", revision: funding.revision + 1, observation },
    audit: audit("escrow.confirm.succeeded"),
  };
  context.requests.set(request.requestId, result);
  return result;
}
