import { describe, expect, it } from "vitest";
import {
  issueAccess,
  revokeAccess,
  sweepAccess,
  verifyAccess,
  type AuditEvent,
  type ByteSource,
  type MeetingAccess,
  type MeetingSession,
} from "./meeting-access";

const session: MeetingSession = {
  id: "s1",
  mentorId: "mentor",
  menteeId: "mentee",
  startsAt: "2026-03-01T10:00:00.000Z",
  endsAt: "2026-03-01T11:00:00.000Z",
  kind: "video",
  cancelled: false,
};
const at = (m: number) => new Date(Date.parse(session.startsAt) + m * 60_000);
const seeded: ByteSource = (n) => new Uint8Array(n).map((_, i) => (i * 7 + 3) & 255);

function issue(over: Partial<MeetingSession> = {}, minutesFromStart = -10, user = "mentee", audit: AuditEvent[] = []): MeetingAccess {
  const r = issueAccess({ ...session, ...over }, user, at(minutesFromStart), audit, seeded);
  if (!r.ok) throw new Error(r.error);
  return r.access;
}

describe("secure meeting access", () => {
  it("issues a time-bound access shortly before the session", () => {
    const access = issue();
    expect(access).toMatchObject({ sessionId: "s1", kind: "video", validFrom: "2026-03-01T09:45:00.000Z", expiresAt: "2026-03-01T11:15:00.000Z" });
    expect(access.reference).toMatch(/^[0-9a-f]{48}$/);
    expect(access.id).toMatch(/^acc_[0-9a-f]{12}$/);
  });

  it("only issues inside the policy window and to participants of live sessions", () => {
    const audit: AuditEvent[] = [];
    const attempt = (over: Partial<MeetingSession>, minutes: number, user: string) => {
      const r = issueAccess({ ...session, ...over }, user, at(minutes), audit, seeded);
      return r.ok ? "ok" : r.error;
    };
    expect(attempt({}, -16, "mentee")).toBe("TOO_EARLY");
    expect(attempt({}, -15, "mentee")).toBe("ok");
    expect(attempt({}, 74, "mentee")).toBe("ok");
    expect(attempt({}, 75, "mentee")).toBe("SESSION_ENDED");
    expect(attempt({}, -10, "stranger")).toBe("NOT_PARTICIPANT");
    expect(attempt({ cancelled: true }, -10, "mentee")).toBe("SESSION_CANCELLED");
  });

  it("lets participants in with the right reference and nobody else", () => {
    const access = issue();
    const audit: AuditEvent[] = [];
    const ok = verifyAccess(access, session, "mentor", access.reference, at(0), audit);
    expect(ok).toMatchObject({ ok: true, view: { kind: "video", joinHandle: access.reference, checkInInstructions: null, early: false, lobbyOnly: false } });
    expect(verifyAccess(access, session, "stranger", access.reference, at(0), audit)).toEqual({ ok: false, error: "NOT_PARTICIPANT" });
    expect(verifyAccess(access, session, "mentee", "f".repeat(48), at(0), audit)).toEqual({ ok: false, error: "WRONG_REFERENCE" });
    expect(verifyAccess(access, session, "mentee", access.reference.slice(1), at(0), audit)).toEqual({ ok: false, error: "WRONG_REFERENCE" });
  });

  it("follows the early-access policy", () => {
    const access = issue();
    const view = (m: number) => {
      const r = verifyAccess(access, session, "mentee", access.reference, at(m), []);
      return r.ok ? r.view : r.error;
    };
    expect(view(-16)).toBe("NOT_YET_VALID");
    expect(view(-10)).toMatchObject({ early: true, lobbyOnly: true });
    expect(view(-5)).toMatchObject({ early: true, lobbyOnly: false });
    expect(view(0)).toMatchObject({ early: false });
    expect(view(75)).toBe("EXPIRED");
  });

  it("revokes after cancellation or expiry so revoked sessions cannot join", () => {
    const access = issue();
    const audit: AuditEvent[] = [];
    const revoked = revokeAccess(access, "cancelled", "system", at(-5), audit);
    expect(revoked).toMatchObject({ revokedAt: at(-5).toISOString(), revokedReason: "cancelled" });
    expect(verifyAccess(revoked, session, "mentee", access.reference, at(0), audit)).toEqual({ ok: false, error: "REVOKED" });
    expect(revokeAccess(revoked, "manual", "admin", at(1), audit)).toBe(revoked); // idempotent, first reason kept
    expect(access.revokedAt).toBeUndefined(); // original untouched

    const cancelled = { ...session, cancelled: true };
    expect(verifyAccess(access, cancelled, "mentee", access.reference, at(0), audit)).toEqual({ ok: false, error: "SESSION_CANCELLED" });
  });

  it("sweeps cancelled and expired accesses", () => {
    const a = issue();
    const b = issue({ id: "s2" });
    const sessions = new Map<string, MeetingSession>([["s1", session], ["s2", { ...session, id: "s2", cancelled: true }]]);
    const audit: AuditEvent[] = [];
    const swept = sweepAccess([a, b], sessions, at(0), audit);
    expect(swept[0].revokedAt).toBeUndefined();
    expect(swept[1]).toMatchObject({ revokedReason: "cancelled" });
    const later = sweepAccess(swept, sessions, at(80), audit);
    expect(later[0]).toMatchObject({ revokedReason: "expired" });
    expect(later[1].revokedReason).toBe("cancelled");
    expect(audit.filter((e) => e.action === "revoke")).toHaveLength(2);
  });

  it("gives in-person sessions check-in instructions and no join handle", () => {
    const inPerson = { ...session, kind: "in_person" as const, checkInInstructions: "Ask for the lab desk." };
    const access = issue({ kind: "in_person" });
    const r = verifyAccess(access, inPerson, "mentor", access.reference, at(0), []);
    expect(r).toMatchObject({ ok: true, view: { kind: "in_person", joinHandle: null, checkInInstructions: "Ask for the lab desk." } });
  });

  it("audits every attempt without recording secret material", () => {
    const audit: AuditEvent[] = [];
    const access = issue({}, -10, "mentee", audit);
    verifyAccess(access, session, "mentee", access.reference, at(0), audit);
    verifyAccess(access, session, "stranger", access.reference, at(0), audit);
    verifyAccess(access, session, "mentee", "bad", at(0), audit);
    revokeAccess(access, "manual", "admin", at(1), audit);
    expect(audit.map((e) => `${e.action}:${e.outcome}:${e.reason ?? "-"}`)).toEqual([
      "issue:granted:-",
      "use:granted:-",
      "use:denied:NOT_PARTICIPANT",
      "use:denied:WRONG_REFERENCE",
      "revoke:granted:manual",
    ]);
    const text = JSON.stringify(audit);
    expect(text).not.toContain(access.reference);
    expect(text).not.toMatch(/https?:|secret|token/i);
  });
});
