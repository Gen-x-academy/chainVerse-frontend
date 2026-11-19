import { describe, expect, it } from "vitest";
import { MAX_ASSIGNMENT_DAYS, activeRoles, canAct, expiringSoon, grant, revoke, type Assignment, type GrantRequest } from "./reviewer-assignments";

const req = (over: Partial<GrantRequest> = {}): GrantRequest => ({
  id: "as1",
  userId: "rev1",
  role: "technical_review",
  callId: "cal1",
  startsAt: "2026-03-01T00:00:00Z",
  endsAt: "2026-04-01T00:00:00Z",
  grantedBy: "coord1",
  ...over,
});
const mustGrant = (existing: Assignment[], r: GrantRequest) => {
  const g = grant(existing, r);
  if (!g.ok) throw new Error(g.error);
  return g.assignments;
};
const at = (s: string) => new Date(s);

describe("reviewer assignments", () => {
  it("grants a scoped, time-bounded assignment", () => {
    const list = mustGrant([], req());
    expect(list).toHaveLength(1);
    expect(canAct(list, "rev1", "technical_review", "cal1", at("2026-03-15T00:00:00Z"))).toBe(true);
  });

  it("is active from the start (inclusive) to the end (exclusive) only", () => {
    const list = mustGrant([], req());
    expect(canAct(list, "rev1", "technical_review", "cal1", at("2026-02-28T23:59:59Z"))).toBe(false);
    expect(canAct(list, "rev1", "technical_review", "cal1", at("2026-03-01T00:00:00Z"))).toBe(true);
    expect(canAct(list, "rev1", "technical_review", "cal1", at("2026-04-01T00:00:00Z"))).toBe(false);
  });

  it("denies by default for another user, role or call", () => {
    const list = mustGrant([], req());
    const now = at("2026-03-15T00:00:00Z");
    expect(canAct(list, "other", "technical_review", "cal1", now)).toBe(false);
    expect(canAct(list, "rev1", "screening", "cal1", now)).toBe(false);
    expect(canAct(list, "rev1", "technical_review", "cal2", now)).toBe(false);
    expect(canAct([], "rev1", "technical_review", "cal1", now)).toBe(false);
  });

  it("validates role, window and length", () => {
    const err = (r: GrantRequest) => {
      const g = grant([], r);
      return g.ok ? "ok" : g.error;
    };
    expect(err(req({ role: "janitor" as never }))).toBe("UNKNOWN_ROLE");
    expect(err(req({ endsAt: "2026-03-01T00:00:00Z" }))).toBe("INVALID_WINDOW");
    expect(err(req({ startsAt: "tomorrow" }))).toBe("INVALID_WINDOW");
    expect(err(req({ endsAt: `2026-12-31T00:00:00Z` }))).toBe("WINDOW_TOO_LONG");
    expect(MAX_ASSIGNMENT_DAYS).toBe(180);
  });

  it("rejects duplicate ids, overlapping duplicates and self-approval", () => {
    const list = mustGrant([], req());
    expect(grant(list, req())).toEqual({ ok: false, error: "DUPLICATE_ID" });
    expect(grant(list, req({ id: "as2", startsAt: "2026-03-20T00:00:00Z", endsAt: "2026-05-01T00:00:00Z" }))).toEqual({ ok: false, error: "ALREADY_ASSIGNED" });
    expect(grant(list, req({ id: "as3", startsAt: "2026-04-01T00:00:00Z", endsAt: "2026-05-01T00:00:00Z" }))).toMatchObject({ ok: true });
    expect(grant([], req({ grantedBy: "rev1" }))).toEqual({ ok: false, error: "SELF_APPROVAL" });
  });

  it("blocks declared conflicts and incompatible role combinations", () => {
    expect(grant([], req(), new Map([["rev1", ["cal1"]]]))).toEqual({ ok: false, error: "CONFLICT_OF_INTEREST" });
    expect(grant([], req(), new Map([["rev1", ["cal9"]]]))).toMatchObject({ ok: true });
    const tech = mustGrant([], req());
    expect(grant(tech, req({ id: "as2", role: "finance_approval" }))).toEqual({ ok: false, error: "CONFLICT_OF_INTEREST" });
    expect(grant(tech, req({ id: "as3", role: "screening" }))).toMatchObject({ ok: true });
  });

  it("revokes immediately and idempotently", () => {
    const list = mustGrant([], req());
    const revoked = revoke(list, "as1", at("2026-03-10T00:00:00Z"));
    expect(revoked).not.toBeNull();
    if (!revoked) return;
    expect(canAct(revoked, "rev1", "technical_review", "cal1", at("2026-03-10T00:00:01Z"))).toBe(false);
    const again = revoke(revoked, "as1", at("2026-03-20T00:00:00Z"));
    expect(again?.[0].revokedAt).toBe("2026-03-10T00:00:00.000Z");
    expect(revoke(list, "missing", at("2026-03-10T00:00:00Z"))).toBeNull();
    expect(list[0].revokedAt).toBeUndefined(); // input untouched
  });

  it("lists active roles and soon-to-expire grants", () => {
    let list = mustGrant([], req());
    list = mustGrant(list, req({ id: "as2", role: "screening", endsAt: "2026-03-10T00:00:00Z" }));
    expect(activeRoles(list, "rev1", "cal1", at("2026-03-05T00:00:00Z"))).toEqual(["screening", "technical_review"]);
    expect(expiringSoon(list, at("2026-03-05T00:00:00Z"), 7).map((a) => a.id)).toEqual(["as2"]);
    expect(expiringSoon(list, at("2026-03-05T00:00:00Z"), 60).map((a) => a.id)).toEqual(["as2", "as1"]);
  });
});
