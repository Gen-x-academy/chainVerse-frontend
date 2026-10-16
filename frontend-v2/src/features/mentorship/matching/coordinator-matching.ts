/** MENTOR-039: coordinator-assisted matching - coordinators assign, override and audit matches. */
export type CoordinatorAction = 'assign' | 'reassign' | 'unassign';

export interface CoordinatorAuditEntry {
  at: string;
  coordinatorId: string;
  action: CoordinatorAction;
  menteeId: string;
  fromMentorId?: string;
  toMentorId?: string;
  justification: string;
}

export interface Assignments {
  /** menteeId -> mentorId */
  byMentee: Record<string, string>;
  audit: CoordinatorAuditEntry[];
}

export interface CoordinatorContext {
  coordinatorId: string;
  /** Roles of the acting user; only coordinators may act. */
  roles: string[];
  mentorHasCapacity: (mentorId: string) => boolean;
  isBlocked: (mentorId: string, menteeId: string) => boolean;
}

function guard(ctx: CoordinatorContext, justification: string) {
  if (!ctx.roles.includes('coordinator')) throw new Error('Only coordinators can assign matches');
  if (justification.trim().length < 10) throw new Error('Provide a justification (at least 10 characters)');
}

export function assign(a: Assignments, ctx: CoordinatorContext, menteeId: string, mentorId: string, justification: string, now: Date = new Date()): Assignments {
  guard(ctx, justification);
  const from = a.byMentee[menteeId];
  if (from === mentorId) return a;
  if (ctx.isBlocked(mentorId, menteeId)) throw new Error('This match is not available');
  if (!ctx.mentorHasCapacity(mentorId)) throw new Error('Mentor has no remaining capacity');
  const entry: CoordinatorAuditEntry = {
    at: now.toISOString(),
    coordinatorId: ctx.coordinatorId,
    action: from ? 'reassign' : 'assign',
    menteeId,
    fromMentorId: from,
    toMentorId: mentorId,
    justification: justification.trim(),
  };
  return { byMentee: { ...a.byMentee, [menteeId]: mentorId }, audit: [...a.audit, entry] };
}

export function unassign(a: Assignments, ctx: CoordinatorContext, menteeId: string, justification: string, now: Date = new Date()): Assignments {
  guard(ctx, justification);
  const from = a.byMentee[menteeId];
  if (!from) return a;
  const { [menteeId]: _removed, ...rest } = a.byMentee;
  const entry: CoordinatorAuditEntry = {
    at: now.toISOString(),
    coordinatorId: ctx.coordinatorId,
    action: 'unassign',
    menteeId,
    fromMentorId: from,
    justification: justification.trim(),
  };
  return { byMentee: rest, audit: [...a.audit, entry] };
}

/** Mentees without a mentor, in stable order. */
export const unmatched = (a: Assignments, menteeIds: string[]): string[] => menteeIds.filter((id) => !a.byMentee[id]).sort();
