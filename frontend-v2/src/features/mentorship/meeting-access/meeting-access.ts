/**
 * Secure meeting access (MENTOR-060).
 *
 * Time-bound meeting references (or in-person check-in instructions) are issued
 * shortly before an eligible session and revoked after cancellation or expiry.
 * Only the session's participants can obtain or use them, early access follows
 * policy, raw provider secrets are never exposed (only an opaque reference and
 * the provider-side join URL held server-side), and every access attempt
 * produces an audit event without secret material.
 */

export type MeetingKind = "video" | "in_person";

export interface MeetingSession {
  id: string;
  mentorId: string;
  menteeId: string;
  startsAt: string;
  endsAt: string;
  kind: MeetingKind;
  cancelled: boolean;
  /** In-person only: instructions shown instead of a link. */
  checkInInstructions?: string;
}

export interface AccessPolicy {
  /** Access opens this many minutes before the session starts. */
  opensMinutesBefore: number;
  /** Access stays valid this many minutes after the session ends. */
  graceMinutesAfter: number;
  /** Participants may join this many minutes early without it counting as early access. */
  earlyJoinMinutes: number;
}

export const DEFAULT_ACCESS_POLICY: AccessPolicy = { opensMinutesBefore: 15, graceMinutesAfter: 15, earlyJoinMinutes: 5 };

export interface MeetingAccess {
  id: string;
  sessionId: string;
  kind: MeetingKind;
  /** Opaque reference the client presents; the provider URL/secret stays on the server. */
  reference: string;
  issuedAt: string;
  validFrom: string;
  expiresAt: string;
  revokedAt?: string;
  revokedReason?: "cancelled" | "expired" | "manual";
}

export interface AuditEvent {
  at: string;
  sessionId: string;
  userId: string;
  action: "issue" | "use" | "revoke";
  outcome: "granted" | "denied";
  /** Stable code only; never a reference, token or provider URL. */
  reason?: string;
}

export type ByteSource = (length: number) => Uint8Array;

export const cryptoBytes: ByteSource = (length) => {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
};

const toHex = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
const minutes = (iso: string, delta: number) => new Date(Date.parse(iso) + delta * 60_000).toISOString();
const isParticipant = (s: MeetingSession, userId: string) => userId === s.mentorId || userId === s.menteeId;

export type IssueError = "NOT_PARTICIPANT" | "SESSION_CANCELLED" | "TOO_EARLY" | "SESSION_ENDED";
export type UseError = "NOT_PARTICIPANT" | "REVOKED" | "SESSION_CANCELLED" | "NOT_YET_VALID" | "EXPIRED" | "WRONG_REFERENCE";

export function issueAccess(
  session: MeetingSession,
  userId: string,
  now: Date,
  audit: AuditEvent[],
  bytes: ByteSource = cryptoBytes,
  policy: AccessPolicy = DEFAULT_ACCESS_POLICY,
): { ok: true; access: MeetingAccess } | { ok: false; error: IssueError } {
  const nowIso = now.toISOString();
  const deny = (error: IssueError) => {
    audit.push({ at: nowIso, sessionId: session.id, userId, action: "issue", outcome: "denied", reason: error });
    return { ok: false as const, error };
  };
  if (!isParticipant(session, userId)) return deny("NOT_PARTICIPANT");
  if (session.cancelled) return deny("SESSION_CANCELLED");
  const validFrom = minutes(session.startsAt, -policy.opensMinutesBefore);
  const expiresAt = minutes(session.endsAt, policy.graceMinutesAfter);
  if (nowIso < validFrom) return deny("TOO_EARLY");
  if (nowIso >= expiresAt) return deny("SESSION_ENDED");

  const access: MeetingAccess = {
    id: `acc_${toHex(bytes(6))}`,
    sessionId: session.id,
    kind: session.kind,
    reference: toHex(bytes(24)),
    issuedAt: nowIso,
    validFrom,
    expiresAt,
  };
  audit.push({ at: nowIso, sessionId: session.id, userId, action: "issue", outcome: "granted" });
  return { ok: true, access };
}

/** Check an access attempt. Every outcome is audited. */
export function verifyAccess(
  access: MeetingAccess,
  session: MeetingSession,
  userId: string,
  presentedReference: string,
  now: Date,
  audit: AuditEvent[],
  policy: AccessPolicy = DEFAULT_ACCESS_POLICY,
): { ok: true; view: AccessView } | { ok: false; error: UseError } {
  const nowIso = now.toISOString();
  const deny = (error: UseError) => {
    audit.push({ at: nowIso, sessionId: session.id, userId, action: "use", outcome: "denied", reason: error });
    return { ok: false as const, error };
  };
  if (!isParticipant(session, userId)) return deny("NOT_PARTICIPANT");
  if (access.revokedAt !== undefined) return deny("REVOKED");
  if (session.cancelled) return deny("SESSION_CANCELLED");
  if (!constantTimeEqual(access.reference, presentedReference)) return deny("WRONG_REFERENCE");
  if (nowIso < access.validFrom) return deny("NOT_YET_VALID");
  if (nowIso >= access.expiresAt) return deny("EXPIRED");
  audit.push({ at: nowIso, sessionId: session.id, userId, action: "use", outcome: "granted" });
  return { ok: true, view: toAccessView(access, session, nowIso, policy) };
}

/** Revoke after cancellation, expiry or by an operator. Idempotent; keeps the first reason. */
export function revokeAccess(access: MeetingAccess, reason: NonNullable<MeetingAccess["revokedReason"]>, userId: string, now: Date, audit: AuditEvent[]): MeetingAccess {
  if (access.revokedAt !== undefined) return access;
  audit.push({ at: now.toISOString(), sessionId: access.sessionId, userId, action: "revoke", outcome: "granted", reason });
  return { ...access, revokedAt: now.toISOString(), revokedReason: reason };
}

/** Revoke every still-active access for sessions that were cancelled or have ended. */
export function sweepAccess(accesses: readonly MeetingAccess[], sessions: ReadonlyMap<string, MeetingSession>, now: Date, audit: AuditEvent[]): MeetingAccess[] {
  const nowIso = now.toISOString();
  return accesses.map((a) => {
    if (a.revokedAt !== undefined) return a;
    if (sessions.get(a.sessionId)?.cancelled) return revokeAccess(a, "cancelled", "system", now, audit);
    if (nowIso >= a.expiresAt) return revokeAccess(a, "expired", "system", now, audit);
    return a;
  });
}

export interface AccessView {
  kind: MeetingKind;
  /** Opaque join handle the client sends to the join endpoint; never the provider URL or secret. */
  joinHandle: string | null;
  checkInInstructions: string | null;
  expiresAt: string;
  /** True when joining before the session start. */
  early: boolean;
  /** True when it is earlier than the early-join allowance: the person can wait in the lobby only. */
  lobbyOnly: boolean;
}

function toAccessView(access: MeetingAccess, session: MeetingSession, nowIso: string, policy: AccessPolicy): AccessView {
  return {
    kind: access.kind,
    joinHandle: access.kind === "video" ? access.reference : null,
    checkInInstructions: access.kind === "in_person" ? (session.checkInInstructions ?? null) : null,
    expiresAt: access.expiresAt,
    early: nowIso < session.startsAt,
    lobbyOnly: nowIso < minutes(session.startsAt, -policy.earlyJoinMinutes),
  };
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
