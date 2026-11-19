/**
 * Call reviewer and coordinator assignments (CAPSTONE-023).
 *
 * Grants are scoped to one call and one role, and bounded in time. Access is
 * deny-by-default: an action is allowed only when an active grant for that
 * exact user, role and call covers the current instant. Reviewers may not be
 * assigned to calls they have a declared conflict with.
 */

export const REVIEW_ROLES = ["screening", "technical_review", "ethics_review", "finance_approval", "program_coordination"] as const;
export type ReviewRole = (typeof REVIEW_ROLES)[number];

export interface Assignment {
  id: string;
  userId: string;
  role: ReviewRole;
  callId: string;
  /** ISO instants. The grant is active from startsAt (inclusive) to endsAt (exclusive). */
  startsAt: string;
  endsAt: string;
  grantedBy: string;
  revokedAt?: string;
}

export interface GrantRequest {
  id: string;
  userId: string;
  role: ReviewRole;
  callId: string;
  startsAt: string;
  endsAt: string;
  grantedBy: string;
}

export type GrantError = "UNKNOWN_ROLE" | "INVALID_WINDOW" | "WINDOW_TOO_LONG" | "ALREADY_ASSIGNED" | "CONFLICT_OF_INTEREST" | "SELF_APPROVAL" | "DUPLICATE_ID";

export const MAX_ASSIGNMENT_DAYS = 180;

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

/** Roles whose holders must not also hold finance approval on the same call (separation of duties). */
const INCOMPATIBLE: Readonly<Record<ReviewRole, readonly ReviewRole[]>> = {
  screening: [],
  technical_review: [],
  ethics_review: [],
  finance_approval: ["technical_review", "program_coordination"],
  program_coordination: ["finance_approval"],
};

export function isActive(a: Assignment, at: Date): boolean {
  const t = at.toISOString();
  return a.revokedAt === undefined && a.startsAt <= t && t < a.endsAt;
}

export function grant(
  existing: readonly Assignment[],
  request: GrantRequest,
  conflicts: ReadonlyMap<string, readonly string[]> = new Map(),
): { ok: true; assignments: Assignment[]; assignment: Assignment } | { ok: false; error: GrantError } {
  const fail = (error: GrantError) => ({ ok: false as const, error });
  if (!(REVIEW_ROLES as readonly string[]).includes(request.role)) return fail("UNKNOWN_ROLE");
  if (!ISO.test(request.startsAt) || !ISO.test(request.endsAt) || !(request.startsAt < request.endsAt)) return fail("INVALID_WINDOW");
  const days = (Date.parse(request.endsAt) - Date.parse(request.startsAt)) / 86_400_000;
  if (days > MAX_ASSIGNMENT_DAYS) return fail("WINDOW_TOO_LONG");
  if (existing.some((a) => a.id === request.id)) return fail("DUPLICATE_ID");
  if (request.grantedBy === request.userId) return fail("SELF_APPROVAL");
  if ((conflicts.get(request.userId) ?? []).includes(request.callId)) return fail("CONFLICT_OF_INTEREST");

  const overlapping = existing.filter((a) => a.userId === request.userId && a.callId === request.callId && a.revokedAt === undefined && a.startsAt < request.endsAt && request.startsAt < a.endsAt);
  if (overlapping.some((a) => a.role === request.role)) return fail("ALREADY_ASSIGNED");
  if (overlapping.some((a) => INCOMPATIBLE[request.role].includes(a.role))) return fail("CONFLICT_OF_INTEREST");

  const assignment: Assignment = { ...request };
  return { ok: true, assignments: [...existing, assignment], assignment };
}

/** Revoke a grant now. Idempotent: revoking twice keeps the first revocation time. */
export function revoke(existing: readonly Assignment[], id: string, at: Date): Assignment[] | null {
  if (!existing.some((a) => a.id === id)) return null;
  return existing.map((a) => (a.id === id && a.revokedAt === undefined ? { ...a, revokedAt: at.toISOString() } : a));
}

/** Deny by default: true only for an active grant of exactly this user, role and call. */
export function canAct(assignments: readonly Assignment[], userId: string, role: ReviewRole, callId: string, at: Date): boolean {
  return assignments.some((a) => a.userId === userId && a.role === role && a.callId === callId && isActive(a, at));
}

/** Active roles a user holds on a call. */
export function activeRoles(assignments: readonly Assignment[], userId: string, callId: string, at: Date): ReviewRole[] {
  return [...new Set(assignments.filter((a) => a.userId === userId && a.callId === callId && isActive(a, at)).map((a) => a.role))].sort();
}

/** Grants that end within `withinDays`, so coordinators can renew them. */
export function expiringSoon(assignments: readonly Assignment[], at: Date, withinDays = 7): Assignment[] {
  const limit = new Date(at.getTime() + withinDays * 86_400_000).toISOString();
  return assignments.filter((a) => isActive(a, at) && a.endsAt <= limit).sort((x, y) => x.endsAt.localeCompare(y.endsAt));
}
