/**
 * Capstone project budget plans (CAPSTONE-082).
 *
 * Plans are made of categorised line items whose totals are computed in
 * integer minor units (no floating-point money). Every change carries the
 * version/revision the caller last saw, so stale edits are rejected, and every
 * request id is replay-safe: a retry returns the original outcome instead of
 * creating a second version. Approval thresholds are enforced before a plan is
 * accepted, and audit records contain ids and amounts only - never the private
 * justification text.
 */

export const BUDGET_CATEGORIES = [
  "personnel",
  "equipment",
  "software",
  "travel",
  "research",
  "contingency",
  "other",
] as const;
export type BudgetCategory = (typeof BUDGET_CATEGORIES)[number];

export type BudgetRole = "sponsor" | "finance" | "program-manager" | "admin" | "student";
const WRITE_ROLES: readonly BudgetRole[] = ["sponsor", "finance", "program-manager", "admin"];
const APPROVER_ROLES: readonly BudgetRole[] = ["finance", "program-manager", "admin"];

export interface BudgetLine {
  id: string;
  category: BudgetCategory;
  /** Private to the project; never copied into logs or audit records. */
  justification: string;
  /** Positive integer count of units. */
  quantity: number;
  /** Non-negative integer amount for one unit, in minor currency units. */
  unitAmountMinor: number;
  fundingSource: string;
}

export interface BudgetPlan {
  planId: string;
  tenantId: string;
  projectId: string;
  /** 1 for the first version; increases by one on each accepted change. */
  version: number;
  lines: BudgetLine[];
  /** Total of all lines in integer minor units, versioned with the plan. */
  totalMinor: number;
  updatedAt: string;
  revision: number;
}

export interface PlanRequest {
  /** Client-generated id; a retry with the same id is not applied again. */
  requestId: string;
  actorId: string;
  actorTenantId: string;
  actorRole: BudgetRole;
  tenantId: string;
  projectId: string;
  lines: BudgetLine[];
  /** 0 to create a plan, otherwise the revision the caller last saw. */
  expectedRevision: number;
  approvalThresholdMinor: number;
  approverId?: string;
  approverRole?: BudgetRole;
  now: string;
}

export type PlanErrorCode =
  | "FORBIDDEN"
  | "TENANT_MISMATCH"
  | "INVALID_LINE"
  | "INVALID_AMOUNT"
  | "STALE_REVISION"
  | "APPROVAL_REQUIRED"
  | "REPLAY_CONFLICT";

export type PlanResult =
  | { ok: true; plan: BudgetPlan; replayed: boolean }
  | { ok: false; code: PlanErrorCode; message: string; replayed: boolean };

export interface PlanReceipt {
  result: PlanResult;
  fingerprint: string;
}
export type PlanLedger = Map<string, PlanReceipt>;

export interface BudgetIssue {
  path: string;
  message: string;
}

/** Replay fingerprint. `now` is excluded so retries are stable over time. */
export function planFingerprint(request: PlanRequest): string {
  return JSON.stringify({
    actorId: request.actorId,
    tenantId: request.tenantId,
    projectId: request.projectId,
    lines: request.lines,
    expectedRevision: request.expectedRevision,
    approvalThresholdMinor: request.approvalThresholdMinor,
  });
}

/** A single line total, or 0 when the inputs are not valid integer money. */
export function lineTotalMinor(line: BudgetLine): number {
  const product = (line.quantity || 0) * (line.unitAmountMinor || 0);
  return Number.isSafeInteger(product) && product > 0 ? product : 0;
}

export function validateLines(lines: readonly BudgetLine[]): BudgetIssue[] {
  const issues: BudgetIssue[] = [];
  if (lines.length === 0) issues.push({ path: "lines", message: "add at least one budget line" });
  const seen = new Set<string>();
  lines.forEach((line, i) => {
    const at = `lines[${i}]`;
    if (!line.id || seen.has(line.id)) issues.push({ path: `${at}.id`, message: "budget line ids must be unique" });
    seen.add(line.id);
    if (!BUDGET_CATEGORIES.includes(line.category)) issues.push({ path: `${at}.category`, message: "choose a supported cost category" });
    if (!line.justification || line.justification.trim().length === 0) issues.push({ path: `${at}.justification`, message: "state why this cost is needed" });
    if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0) issues.push({ path: `${at}.quantity`, message: "quantity must be a positive whole number" });
    if (!Number.isSafeInteger(line.unitAmountMinor) || line.unitAmountMinor < 0) issues.push({ path: `${at}.unitAmountMinor`, message: "the unit amount must be a non-negative whole number of minor units" });
    if (!line.fundingSource || line.fundingSource.trim().length === 0) issues.push({ path: `${at}.fundingSource`, message: "name the funding source" });
    if (!Number.isSafeInteger(lineTotalMinor(line))) issues.push({ path: `${at}.unitAmountMinor`, message: "the line total is too large" });
  });
  return issues;
}

export function planTotals(lines: readonly BudgetLine[]): {
  totalMinor: number;
  byCategory: Record<string, number>;
  byFundingSource: Record<string, number>;
} {
  const byCategory: Record<string, number> = {};
  const byFundingSource: Record<string, number> = {};
  let totalMinor = 0;
  for (const line of lines) {
    const amount = lineTotalMinor(line);
    totalMinor += amount;
    byCategory[line.category] = (byCategory[line.category] ?? 0) + amount;
    byFundingSource[line.fundingSource] = (byFundingSource[line.fundingSource] ?? 0) + amount;
  }
  return { totalMinor, byCategory, byFundingSource };
}

/** Whether a plan of this size needs an explicit approval before it is saved. */
export function requiresApproval(totalMinor: number, approvalThresholdMinor: number): boolean {
  return Number.isSafeInteger(totalMinor) && Number.isSafeInteger(approvalThresholdMinor) && totalMinor > approvalThresholdMinor;
}

/**
 * Create or revise a plan. The caller supplies the current plan and a ledger;
 * the function is deterministic and mutates nothing except the ledger receipt.
 */
export function applyBudgetPlan(
  current: BudgetPlan | undefined,
  request: PlanRequest,
  ledger: PlanLedger = new Map(),
): PlanResult {
  const earlier = ledger.get(request.requestId);
  if (earlier) {
    if (earlier.fingerprint !== planFingerprint(request)) {
      return { ok: false, code: "REPLAY_CONFLICT", message: "This request id was already used for a different plan.", replayed: false };
    }
    const replayed: PlanResult = { ...earlier.result, replayed: true };
    return replayed;
  }

  const record = (result: PlanResult): PlanResult => {
    ledger.set(request.requestId, { result, fingerprint: planFingerprint(request) });
    return result;
  };
  const fail = (code: PlanErrorCode, message: string): PlanResult => record({ ok: false, code, message, replayed: false });

  // Deny by default, then check the tenant boundary before any other detail.
  if (!WRITE_ROLES.includes(request.actorRole)) return fail("FORBIDDEN", "You are not allowed to change a budget plan.");
  if (request.actorTenantId !== request.tenantId || (current && current.tenantId !== request.tenantId)) {
    return fail("TENANT_MISMATCH", "The plan belongs to a different tenant.");
  }
  if (validateLines(request.lines).length > 0) return fail("INVALID_LINE", "Fix the invalid budget lines before saving.");

  const { totalMinor } = planTotals(request.lines);
  if (!Number.isSafeInteger(totalMinor)) return fail("INVALID_AMOUNT", "The plan total is too large.");

  const expected = current ? current.revision : 0;
  if (request.expectedRevision !== expected) {
    return fail("STALE_REVISION", `The plan changed (revision ${expected}); reload before retrying.`);
  }

  if (requiresApproval(totalMinor, request.approvalThresholdMinor)) {
    const approved = request.approverId !== undefined && request.approverRole !== undefined && APPROVER_ROLES.includes(request.approverRole);
    if (!approved) return fail("APPROVAL_REQUIRED", "This plan is above the approval threshold and needs an authorised approver.");
  }

  const plan: BudgetPlan = {
    planId: current?.planId ?? `plan-${request.projectId}`,
    tenantId: request.tenantId,
    projectId: request.projectId,
    version: (current?.version ?? 0) + 1,
    lines: request.lines.map((line) => ({ ...line })),
    totalMinor,
    updatedAt: request.now,
    revision: expected + 1,
  };
  return record({ ok: true, plan, replayed: false });
}

/** Privacy-safe audit record: identifiers and amounts, no private justification. */
export function planAudit(plan: BudgetPlan): Record<string, string | number> {
  return {
    planId: plan.planId,
    tenantId: plan.tenantId,
    projectId: plan.projectId,
    version: plan.version,
    totalMinor: plan.totalMinor,
    lineCount: plan.lines.length,
  };
}
