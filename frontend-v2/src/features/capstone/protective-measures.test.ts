import { describe, expect, it } from "vitest";
import {
  applyProtectiveMeasure,
  evaluateRestriction,
  isRestrictionActive,
  liftProtectiveMeasure,
  measureAudit,
  type ApplyMeasureRequest,
  type ProtectiveMeasure,
} from "./protective-measures";

const request = (over: Partial<ApplyMeasureRequest> = {}): ApplyMeasureRequest => ({
  requestId: "req-1",
  actor: { id: "ethics-1", role: "ethics_officer", organizationId: "org-1" },
  resource: { projectId: "prj_1", organizationId: "org-1", revision: 4, assignedIds: ["ethics-1"], privatePayloads: { secret: true } },
  kind: "publishing",
  scope: { type: "project", targetId: "prj_1" },
  reasonCode: "SAFETY_CONCERN",
  expiresAt: "2026-12-01T00:00:00.000Z",
  now: "2026-11-20T00:00:00.000Z",
  ...over,
});

describe("protective measures (CAPSTONE-101)", () => {
  it("applies a scoped, expiring measure with a checksum and safe audit", async () => {
    const result = await applyProtectiveMeasure(request());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.measure).toMatchObject({ kind: "publishing", reasonCode: "SAFETY_CONCERN", scope: { type: "project", targetId: "prj_1" } });
    expect(result.measure.integrity.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(result.measure)).not.toContain("secret");
    expect(measureAudit(result)).toMatchObject({ outcome: "measure", kind: "publishing", reasonCode: "SAFETY_CONCERN" });
  });

  it("replays retries without duplicating the measure", async () => {
    const ledger = new Map();
    const first = await applyProtectiveMeasure(request(), [], ledger);
    const retry = await applyProtectiveMeasure(request(), [], ledger);
    expect(first.ok && retry.ok && retry.replayed).toBe(true);
    expect(first.ok && retry.ok && first.measure === retry.measure).toBe(true);
    const second = await applyProtectiveMeasure(request({ requestId: "req-2" }), first.ok ? [first.measure] : []);
    expect(second).toMatchObject({ ok: false, code: "ALREADY_ACTIVE" });
  });

  it("denies unauthorized, cross-tenant, stale and malformed requests", async () => {
    const r = request();
    expect(await applyProtectiveMeasure(request({ actor: { ...r.actor, role: "student" } }))).toMatchObject({ ok: false, code: "UNKNOWN_ROLE" });
    expect(await applyProtectiveMeasure(request({ actor: { ...r.actor, organizationId: "org-2" } }))).toMatchObject({ ok: false, code: "TENANT_MISMATCH" });
    expect(await applyProtectiveMeasure(request({ resource: { ...r.resource, assignedIds: [] } }))).toMatchObject({ ok: false, code: "NOT_PERMITTED" });
    expect(await applyProtectiveMeasure(request({ resource: { ...r.resource, revision: 0 } }))).toMatchObject({ ok: false, code: "STALE_REVISION" });
    expect(await applyProtectiveMeasure(request({ kind: "transfer" }))).toMatchObject({ ok: false, code: "INVALID_KIND" });
    expect(await applyProtectiveMeasure(request({ reasonCode: "because" }))).toMatchObject({ ok: false, code: "INVALID_REASON" });
    expect(await applyProtectiveMeasure(request({ scope: { type: "world", targetId: "" } as never }))).toMatchObject({ ok: false, code: "INVALID_SCOPE" });
    expect(await applyProtectiveMeasure(request({ expiresAt: "2026-11-01T00:00:00.000Z" }))).toMatchObject({ ok: false, code: "INVALID_EXPIRY" });
  });

  it("restricts only the matching kind and scope, and stops at expiry", async () => {
    const result = await applyProtectiveMeasure(request({ scope: { type: "team", targetId: "tem_1" } }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const base = { projectId: "prj_1", kind: "publishing" as const, actorId: "u1", teamId: "tem_1", now: "2026-11-21T00:00:00.000Z" };
    expect(evaluateRestriction([result.measure], base)).toEqual({ allowed: false, code: "RESTRICTED" });
    expect(evaluateRestriction([result.measure], { ...base, kind: "messaging" })).toEqual({ allowed: true, code: "ALLOWED" });
    expect(evaluateRestriction([result.measure], { ...base, teamId: "tem_2" })).toEqual({ allowed: true, code: "ALLOWED" });
    expect(evaluateRestriction([result.measure], { ...base, now: "2026-12-02T00:00:00.000Z" })).toEqual({ allowed: true, code: "ALLOWED" });
    expect(isRestrictionActive(result.measure, "2026-12-02T00:00:00.000Z")).toBe(false);
  });

  it("lifts measures idempotently, restricted to the creator or an administrator", async () => {
    const applied = await applyProtectiveMeasure(request());
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    const lift = { requestId: "lift-1", actor: request().actor, organizationId: "org-1", now: "2026-11-21T00:00:00.000Z" };
    expect(liftProtectiveMeasure(applied.measure, { ...lift, actor: { ...lift.actor, id: "other" } })).toMatchObject({ ok: false, code: "NOT_PERMITTED" });
    const ledger = new Map();
    const first = liftProtectiveMeasure(applied.measure, lift, ledger);
    const retry = liftProtectiveMeasure(applied.measure, lift, ledger);
    expect(first.ok && retry.ok && first.measure.liftedAt === lift.now && retry.replayed).toBe(true);
    expect(evaluateRestriction([first.ok ? first.measure : applied.measure], { projectId: "prj_1", kind: "publishing", scope: { type: "project", targetId: "prj_1" }, actorId: "u1", now: lift.now })).toEqual({ allowed: true, code: "ALLOWED" });
  });
});
