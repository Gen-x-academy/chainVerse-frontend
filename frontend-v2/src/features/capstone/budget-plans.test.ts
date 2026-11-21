import { describe, expect, it } from "vitest";
import {
  applyBudgetPlan,
  lineTotalMinor,
  planAudit,
  planTotals,
  requiresApproval,
  validateLines,
  type BudgetLine,
  type BudgetPlan,
  type PlanLedger,
  type PlanRequest,
} from "./budget-plans";

const line = (over: Partial<BudgetLine> = {}): BudgetLine => ({
  id: "l1",
  category: "personnel",
  justification: "Two researchers for the data collection phase",
  quantity: 2,
  unitAmountMinor: 150000,
  fundingSource: "sponsor-grant",
  ...over,
});
const request = (over: Partial<PlanRequest> = {}): PlanRequest => ({
  requestId: "req-1",
  actorId: "u1",
  actorTenantId: "t1",
  actorRole: "sponsor",
  tenantId: "t1",
  projectId: "p1",
  lines: [line()],
  expectedRevision: 0,
  approvalThresholdMinor: 1_000_000,
  now: "2026-01-01T00:00:00.000Z",
  ...over,
});

describe("budget plan validation and totals", () => {
  it("computes line and plan totals in integer minor units", () => {
    expect(lineTotalMinor(line())).toBe(300000);
    expect(lineTotalMinor(line({ quantity: 0 }))).toBe(0);
    const totals = planTotals([line(), line({ id: "l2", category: "equipment", quantity: 1, unitAmountMinor: 50000, fundingSource: "internal" })]);
    expect(totals.totalMinor).toBe(350000);
    expect(totals.byCategory).toEqual({ personnel: 300000, equipment: 50000 });
    expect(totals.byFundingSource).toEqual({ "sponsor-grant": 300000, internal: 50000 });
  });

  it("rejects invalid lines with actionable paths", () => {
    const issues = validateLines([
      line({ id: "", category: "unknown" as BudgetLine["category"], justification: "  ", quantity: 0, unitAmountMinor: -1, fundingSource: "" }),
      line({ id: "" }),
    ]);
    const paths = issues.map((i) => i.path);
    expect(paths).toContain("lines[0].category");
    expect(paths).toContain("lines[0].justification");
    expect(paths).toContain("lines[0].quantity");
    expect(paths).toContain("lines[0].unitAmountMinor");
    expect(paths).toContain("lines[1].id");
    expect(validateLines([]).map((i) => i.path)).toEqual(["lines"]);
  });

  it("treats totals strictly above the threshold as needing approval", () => {
    expect(requiresApproval(1_000_000, 1_000_000)).toBe(false);
    expect(requiresApproval(1_000_001, 1_000_000)).toBe(true);
  });
});

describe("budget plan lifecycle", () => {
  it("creates a versioned plan and rejects stale revisions", () => {
    const ledger: PlanLedger = new Map();
    const first = applyBudgetPlan(undefined, request(), ledger);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.plan.version).toBe(1);
    expect(first.plan.totalMinor).toBe(300000);
    expect(first.plan.revision).toBe(1);

    const revised = applyBudgetPlan(first.plan, request({ requestId: "req-2", expectedRevision: 1, lines: [line({ quantity: 3 })] }), ledger);
    expect(revised.ok).toBe(true);
    if (!revised.ok) return;
    expect([revised.plan.version, revised.plan.totalMinor, revised.plan.revision]).toEqual([2, 450000, 2]);

    const stale = applyBudgetPlan(first.plan, request({ requestId: "req-3", expectedRevision: 0 }), new Map());
    expect(stale.ok).toBe(false);
    if (stale.ok) return;
    expect(stale.code).toBe("STALE_REVISION");
  });

  it("replays a request without a second version and detects conflicting reuse", () => {
    const ledger: PlanLedger = new Map();
    const first = applyBudgetPlan(undefined, request(), ledger);
    const retry = applyBudgetPlan(undefined, request({ now: "2026-02-01T00:00:00.000Z" }), ledger);
    expect(first.ok && retry.ok && retry.replayed).toBe(true);
    if (first.ok && retry.ok) expect(retry.plan.version).toBe(first.plan.version);

    const conflict = applyBudgetPlan(undefined, request({ lines: [line({ quantity: 9 })] }), ledger);
    expect(conflict.ok).toBe(false);
    if (!conflict.ok) expect(conflict.code).toBe("REPLAY_CONFLICT");
  });

  it("denies by default and enforces tenant boundaries", () => {
    const denied = applyBudgetPlan(undefined, request({ actorRole: "student" }), new Map());
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.code).toBe("FORBIDDEN");
    const crossTenant = applyBudgetPlan(undefined, request({ actorTenantId: "t2" }), new Map());
    expect(crossTenant.ok).toBe(false);
    if (!crossTenant.ok) expect(crossTenant.code).toBe("TENANT_MISMATCH");
    const plan: BudgetPlan = { planId: "x", tenantId: "t2", projectId: "p1", version: 1, lines: [], totalMinor: 0, updatedAt: "", revision: 1 };
    const foreign = applyBudgetPlan(plan, request({ expectedRevision: 1 }), new Map());
    expect(foreign.ok).toBe(false);
    if (!foreign.ok) expect(foreign.code).toBe("TENANT_MISMATCH");
  });

  it("requires an authorised approver above the threshold", () => {
    const over = request({ approvalThresholdMinor: 100 });
    const missing = applyBudgetPlan(undefined, over, new Map());
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.code).toBe("APPROVAL_REQUIRED");
    const approved = applyBudgetPlan(undefined, request({ approvalThresholdMinor: 100, approverId: "fin-1", approverRole: "finance" }), new Map());
    expect(approved.ok).toBe(true);
  });

  it("keeps private justification out of audit records", () => {
    const result = applyBudgetPlan(undefined, request(), new Map());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const audit = planAudit(result.plan);
    expect(audit).toEqual({ planId: "plan-p1", tenantId: "t1", projectId: "p1", version: 1, totalMinor: 300000, lineCount: 1 });
    expect(JSON.stringify(audit)).not.toContain("researchers");
  });
});
