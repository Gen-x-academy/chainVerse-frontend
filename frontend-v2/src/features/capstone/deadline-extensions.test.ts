import { describe, expect, it } from "vitest";
import {
  decideExtension,
  extensionAudit,
  requestExtension,
  revisedSchedule,
  validateExtension,
  type DeadlineExtension,
  type ExtensionContext,
} from "./deadline-extensions";

const extension = (): DeadlineExtension => ({
  id: "ext-1", tenantId: "t1", projectId: "p1", version: 1, state: "requested", requestedBy: "student-1",
  currentSchedule: [{ milestoneId: "m1", dueOn: "2026-03-01" }, { milestoneId: "m2", dueOn: "2026-04-01" }],
  impact: { affectedMilestoneIds: ["m1"], days: 14, fundingDelta: 50000, rationale: "The research partner needs more time to release the dataset." },
});
const ctx: ExtensionContext = {
  tenantId: "t1", projectId: "p1", actorId: "student-1", requesterIds: ["student-1"],
  approverIds: ["supervisor-1"], scheduleRevision: 1, projectState: "active",
};
const request = { requestId: "req-1", tenantId: "t1", projectId: "p1", expectedVersion: 1, decidedAt: "2026-02-01T00:00:00Z" };

describe("deadline extension requests", () => {
  it("requires a reason, known milestones and bounded impact", () => {
    expect(validateExtension(extension(), ctx)).toEqual([]);
    const invalid = extension();
    invalid.impact = { ...invalid.impact, rationale: "late", days: 0, affectedMilestoneIds: ["ghost"] };
    expect(validateExtension(invalid, ctx)).toContain("impact.days: the extension must be between 1 and 365 days");
    expect(validateExtension(invalid, ctx)).toContain("impact.affectedMilestoneIds: ghost is not in the project schedule");
  });

  it("denies unauthorized requesters and inactive projects", () => {
    expect(requestExtension(extension(), request, { ...ctx, actorId: "outsider" })).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(requestExtension(extension(), request, { ...ctx, projectState: "completed" })).toMatchObject({ ok: false, code: "INVALID_TRANSITION" });
  });

  it("rejects stale schedule revisions and tenant mismatches", () => {
    expect(requestExtension(extension(), { ...request, expectedVersion: 2 }, ctx)).toMatchObject({ ok: false, code: "STALE_REQUEST" });
    expect(requestExtension(extension(), { ...request, tenantId: "t2" }, ctx)).toMatchObject({ ok: false, code: "TENANT_MISMATCH" });
  });

  it("previews the revised schedule and funding consequence", () => {
    expect(revisedSchedule(extension())).toEqual([{ milestoneId: "m1", dueOn: "2026-03-15" }, { milestoneId: "m2", dueOn: "2026-04-01" }]);
    expect(extension().impact.fundingDelta).toBe(50000);
    expect(requestExtension(extension(), request, ctx).ok).toBe(true);
  });

  it("records immutable approvals and denials with replayed retries", () => {
    const ledger = new Map();
    const approveCtx = { ...ctx, actorId: "supervisor-1" };
    const first = decideExtension(extension(), request, approveCtx, "approved", ledger);
    const retry = decideExtension(extension(), request, approveCtx, "approved", ledger);
    expect(first).toMatchObject({ ok: true, extension: { state: "approved", version: 2, decidedAt: "2026-02-01T00:00:00Z" } });
    expect(retry).toMatchObject({ ok: true, replayed: true });
    expect(ledger.size).toBe(1);
    expect(decideExtension(extension(), request, approveCtx, "denied")).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(decideExtension({ ...extension(), state: "approved" }, request, approveCtx, "denied")).toMatchObject({ ok: false, code: "INVALID_TRANSITION" });
  });

  it("omits rationale and funding details from audit records", () => {
    const audit = extensionAudit(extension(), "requested");
    expect(audit).not.toHaveProperty("rationale");
    expect(JSON.stringify(audit)).not.toContain("research partner");
    expect(JSON.stringify(audit)).not.toContain("50000");
  });
});
