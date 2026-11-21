import { describe, expect, it } from "vitest";
import { ageOn, consentState, consentsNeedingAttention, grantConsent, mayParticipate, requiresGuardianConsent, revokeConsent, type GuardianConsent, type GuardianLink } from "./guardian-consent";

const link: GuardianLink = { relationshipRef: "rel-1", participantId: "u1", verifiedAt: "2026-01-01T00:00:00.000Z" };
const input = { id: "c1", participantId: "u1", scopes: ["participation" as const, "data_sharing" as const], projectVersion: 3, grantedAt: "2026-03-01T00:00:00.000Z", expiresAt: "2026-09-01T00:00:00.000Z" };
const granted = (): GuardianConsent => {
  const r = grantConsent(input, link, 3, true);
  if (!r.ok) throw new Error(r.code);
  return r.value;
};

describe("when consent is needed", () => {
  it("counts whole years and the day of the birthday", () => {
    expect(ageOn("2008-06-15", "2026-06-14")).toBe(17);
    expect(ageOn("2008-06-15", "2026-06-15")).toBe(18);
    expect(requiresGuardianConsent("2008-06-15", "2026-06-14")).toBe(true);
    expect(requiresGuardianConsent("2008-06-15", "2026-06-15")).toBe(false);
  });
});

describe("granting", () => {
  it("stores only the relationship reference", () => {
    const c = granted();
    expect(c.relationshipRef).toBe("rel-1");
    expect(Object.keys(c)).not.toContain("guardianName");
  });

  it("refuses when consent is not required, the link is missing or for someone else", () => {
    expect(grantConsent(input, link, 3, false)).toMatchObject({ ok: false, code: "not_required" });
    expect(grantConsent(input, undefined, 3, true)).toMatchObject({ ok: false, code: "unverified_guardian" });
    expect(grantConsent(input, { ...link, participantId: "u9" }, 3, true)).toMatchObject({ ok: false, code: "unverified_guardian" });
  });

  it("needs scopes, a sensible expiry and the current project version", () => {
    expect(grantConsent({ ...input, scopes: [] }, link, 3, true)).toMatchObject({ code: "no_scopes" });
    expect(grantConsent({ ...input, expiresAt: input.grantedAt }, link, 3, true)).toMatchObject({ code: "bad_expiry" });
    expect(grantConsent({ ...input, expiresAt: "2028-01-01T00:00:00.000Z" }, link, 3, true)).toMatchObject({ code: "bad_expiry" });
    expect(grantConsent(input, link, 4, true)).toMatchObject({ code: "stale_project_version" });
  });

  it("drops repeated scopes", () => {
    const r = grantConsent({ ...input, scopes: ["participation", "participation"] }, link, 3, true);
    expect(r.ok && r.value.scopes).toEqual(["participation"]);
  });
});

describe("state over time", () => {
  it("is valid, then expires", () => {
    const c = granted();
    expect(consentState(c, "2026-05-01T00:00:00.000Z", 3)).toBe("valid");
    expect(consentState(c, "2026-09-01T00:00:00.000Z", 3)).toBe("expired");
  });

  it("needs consent again after a material change", () => {
    expect(consentState(granted(), "2026-05-01T00:00:00.000Z", 4)).toBe("needs_reconsent");
  });

  it("can be revoked once", () => {
    const list = [granted()];
    const revoked = revokeConsent(list, "c1", "2026-04-01T00:00:00.000Z");
    expect(revoked.ok && consentState(revoked.value[0] as GuardianConsent, "2026-04-02T00:00:00.000Z", 3)).toBe("revoked");
    expect(revoked.ok && revokeConsent(revoked.value, "c1", "2026-04-03T00:00:00.000Z")).toMatchObject({ code: "already_revoked" });
    expect(revokeConsent(list, "nope", "2026-04-01T00:00:00.000Z")).toMatchObject({ code: "not_found" });
  });
});

describe("participation", () => {
  it("denies by default and only allows scopes that were granted", () => {
    const list = [granted()];
    expect(mayParticipate([], "u1", "participation", "2026-05-01T00:00:00.000Z", 3)).toBe(false);
    expect(mayParticipate(list, "u1", "participation", "2026-05-01T00:00:00.000Z", 3)).toBe(true);
    expect(mayParticipate(list, "u1", "publication", "2026-05-01T00:00:00.000Z", 3)).toBe(false);
    expect(mayParticipate(list, "u1", "participation", "2026-05-01T00:00:00.000Z", 4)).toBe(false);
  });

  it("reports what needs attention", () => {
    const list = [granted()];
    expect(consentsNeedingAttention(list, "2026-05-01T00:00:00.000Z", 3)).toEqual([]);
    expect(consentsNeedingAttention(list, "2026-08-15T00:00:00.000Z", 3)).toEqual([{ id: "c1", reason: "expiring" }]);
    expect(consentsNeedingAttention(list, "2026-05-01T00:00:00.000Z", 4)).toEqual([{ id: "c1", reason: "needs_reconsent" }]);
  });
});
