/**
 * Team membership changes (CAPSTONE-047).
 *
 * Handles join, leave, removal, role change and substitution with effective
 * dates. Changes never edit history: each applied change is appended to a log,
 * and a member who has left stays on record for ownership, funding and review
 * purposes. The team keeps exactly one lead at all times.
 */

export interface TeamMember {
  userId: string;
  roleKeys: string[];
  joinedOn: string;
  /** Set when the member has left or been removed. Never cleared. */
  leftOn?: string;
}

export type MembershipChange =
  | { id: string; type: "join"; userId: string; roleKeys: string[]; effectiveOn: string }
  | { id: string; type: "leave"; userId: string; effectiveOn: string }
  | { id: string; type: "removal"; userId: string; reason: string; effectiveOn: string }
  | { id: string; type: "role_change"; userId: string; roleKeys: string[]; effectiveOn: string }
  | { id: string; type: "substitution"; outgoingUserId: string; incomingUserId: string; effectiveOn: string };

export interface TeamRoster {
  teamId: string;
  maxSize: number;
  members: TeamMember[];
  /** Applied changes, oldest first. Append only. */
  log: MembershipChange[];
}

export type ChangeErrorCode = "duplicate_change" | "already_member" | "not_a_member" | "would_leave_no_lead" | "team_full" | "needs_reason" | "bad_date" | "needs_roles" | "second_lead";

export type ChangeResult = { ok: true; roster: TeamRoster } | { ok: false; code: ChangeErrorCode; message: string };

const MESSAGES: Record<ChangeErrorCode, string> = {
  duplicate_change: "This change was already applied.",
  already_member: "This person is already on the team.",
  not_a_member: "This person is not an active member of the team.",
  would_leave_no_lead: "The team needs a lead. Hand the lead role to someone first.",
  team_full: "The team is already at its maximum size.",
  needs_reason: "A removal needs a reason.",
  bad_date: "The effective date is not valid or is before the person joined.",
  needs_roles: "Choose at least one role.",
  second_lead: "The team can have only one lead.",
};

const fail = (code: ChangeErrorCode): ChangeResult => ({ ok: false, code, message: MESSAGES[code] });

export function activeMembers(roster: TeamRoster): TeamMember[] {
  return roster.members.filter((m) => m.leftOn === undefined);
}

const isLead = (m: TeamMember) => m.roleKeys.includes("lead");
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));

function withLog(roster: TeamRoster, members: TeamMember[], change: MembershipChange): ChangeResult {
  return { ok: true, roster: { ...roster, members, log: [...roster.log, change] } };
}

/** Apply one change. Returns a new roster, or a stable error code. */
export function applyChange(roster: TeamRoster, change: MembershipChange): ChangeResult {
  if (roster.log.some((c) => c.id === change.id)) return fail("duplicate_change");
  if (!validDate(change.effectiveOn)) return fail("bad_date");
  const active = activeMembers(roster);
  const find = (id: string) => active.find((m) => m.userId === id);

  switch (change.type) {
    case "join": {
      if (find(change.userId)) return fail("already_member");
      if (change.roleKeys.length === 0) return fail("needs_roles");
      if (active.length >= roster.maxSize) return fail("team_full");
      if (change.roleKeys.includes("lead") && active.some(isLead)) return fail("second_lead");
      const member: TeamMember = { userId: change.userId, roleKeys: change.roleKeys, joinedOn: change.effectiveOn };
      return withLog(roster, [...roster.members.filter((m) => m.userId !== change.userId), member], change);
    }
    case "leave":
    case "removal": {
      const member = find(change.userId);
      if (!member) return fail("not_a_member");
      if (change.type === "removal" && change.reason.trim().length === 0) return fail("needs_reason");
      if (Date.parse(change.effectiveOn) < Date.parse(member.joinedOn)) return fail("bad_date");
      if (isLead(member)) return fail("would_leave_no_lead");
      return withLog(roster, roster.members.map((m) => (m === member ? { ...m, leftOn: change.effectiveOn } : m)), change);
    }
    case "role_change": {
      const member = find(change.userId);
      if (!member) return fail("not_a_member");
      if (change.roleKeys.length === 0) return fail("needs_roles");
      const gainsLead = change.roleKeys.includes("lead") && !isLead(member);
      if (gainsLead && active.some(isLead)) return fail("second_lead");
      if (isLead(member) && !change.roleKeys.includes("lead")) return fail("would_leave_no_lead");
      return withLog(roster, roster.members.map((m) => (m === member ? { ...m, roleKeys: change.roleKeys } : m)), change);
    }
    case "substitution": {
      const outgoing = find(change.outgoingUserId);
      if (!outgoing) return fail("not_a_member");
      if (find(change.incomingUserId)) return fail("already_member");
      if (Date.parse(change.effectiveOn) < Date.parse(outgoing.joinedOn)) return fail("bad_date");
      // The newcomer takes over the leaver's roles, including lead, so the lead rule still holds.
      const incoming: TeamMember = { userId: change.incomingUserId, roleKeys: outgoing.roleKeys, joinedOn: change.effectiveOn };
      const members = roster.members.map((m) => (m === outgoing ? { ...m, leftOn: change.effectiveOn } : m)).filter((m) => m.userId !== change.incomingUserId);
      return withLog(roster, [...members, incoming], change);
    }
  }
}

/** Whether a person was on the team on a date, for ownership and review history. */
export function wasMemberOn(roster: TeamRoster, userId: string, date: string): boolean {
  const t = Date.parse(date);
  return roster.members.some((m) => m.userId === userId && Date.parse(m.joinedOn) <= t && (m.leftOn === undefined || t < Date.parse(m.leftOn)));
}

/** Everyone who ever belonged: departed members are never dropped from history. */
export function everMembers(roster: TeamRoster): string[] {
  return [...new Set(roster.members.map((m) => m.userId))];
}

/** Changes that take effect after `today`, which are applied to the log now but shown as upcoming. */
export function upcomingChanges(roster: TeamRoster, today: string): MembershipChange[] {
  return roster.log.filter((c) => Date.parse(c.effectiveOn) > Date.parse(today));
}
