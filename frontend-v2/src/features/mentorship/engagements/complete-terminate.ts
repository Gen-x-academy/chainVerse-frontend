/** MENTOR-050: complete or terminate an engagement, with an explicit, immutable outcome record. */
export type EngagementStatus = 'active' | 'paused' | 'completed' | 'terminated';
export type TerminationReason = 'mentor_request' | 'mentee_request' | 'no_response' | 'conduct' | 'program_closed' | 'other';

export interface ClosableEngagement {
  id: string;
  status: EngagementStatus;
  closedAt?: string;
  closedBy?: string;
  outcome?: { type: 'completed' } | { type: 'terminated'; reason: TerminationReason; note?: string };
}

const OPEN: EngagementStatus[] = ['active', 'paused'];

export function completeEngagement(e: ClosableEngagement, actorId: string, now: Date = new Date()): ClosableEngagement {
  if (e.status === 'completed') return e;
  if (!OPEN.includes(e.status)) throw new Error('This engagement is already closed');
  return { ...e, status: 'completed', closedAt: now.toISOString(), closedBy: actorId, outcome: { type: 'completed' } };
}

export function terminateEngagement(
  e: ClosableEngagement,
  actorId: string,
  reason: TerminationReason,
  note?: string,
  now: Date = new Date(),
): ClosableEngagement {
  if (e.status === 'terminated') return e;
  if (!OPEN.includes(e.status)) throw new Error('This engagement is already closed');
  if ((reason === 'other' || reason === 'conduct') && !note?.trim()) throw new Error('A note is required for this reason');
  return {
    ...e,
    status: 'terminated',
    closedAt: now.toISOString(),
    closedBy: actorId,
    outcome: { type: 'terminated', reason, note: note?.trim() },
  };
}

/** Closed engagements are read-only: no new sessions, messages or edits. */
export const isReadOnly = (e: ClosableEngagement): boolean => !OPEN.includes(e.status);

/** After closing, participants may be rematched or leave feedback. */
export const canLeaveFeedback = (e: ClosableEngagement): boolean => e.status === 'completed' || e.status === 'terminated';
