/** MENTOR-051: enforce the mentorship code of conduct (acknowledgement, reports, graduated actions). */
export const CODE_OF_CONDUCT_VERSION = 1;

export interface ConductAcknowledgement {
  userId: string;
  version: number;
  acknowledgedAt: string;
}

export type ConductCategory = 'harassment' | 'discrimination' | 'off_platform_payment' | 'impersonation' | 'privacy' | 'other';
export type ConductAction = 'none' | 'warning' | 'suspension' | 'removal';

export interface ConductReport {
  id: string;
  reporterId: string;
  subjectId: string;
  category: ConductCategory;
  description: string;
  status: 'open' | 'actioned' | 'dismissed';
  action?: ConductAction;
}

export const hasAcknowledgedCurrent = (acks: ConductAcknowledgement[], userId: string): boolean =>
  acks.some((a) => a.userId === userId && a.version >= CODE_OF_CONDUCT_VERSION);

/** Participation requires acknowledging the current version. */
export function assertCanParticipate(acks: ConductAcknowledgement[], userId: string, suspendedUserIds: Set<string>): void {
  if (suspendedUserIds.has(userId)) throw new Error('Your participation is suspended');
  if (!hasAcknowledgedCurrent(acks, userId)) throw new Error('Accept the code of conduct to continue');
}

export function acknowledge(acks: ConductAcknowledgement[], userId: string, now: Date = new Date()): ConductAcknowledgement[] {
  if (hasAcknowledgedCurrent(acks, userId)) return acks;
  return [...acks, { userId, version: CODE_OF_CONDUCT_VERSION, acknowledgedAt: now.toISOString() }];
}

export function fileReport(id: string, input: Omit<ConductReport, 'id' | 'status' | 'action'>): ConductReport {
  if (input.reporterId === input.subjectId) throw new Error('You cannot report yourself');
  if (input.description.trim().length < 20) throw new Error('Describe what happened (at least 20 characters)');
  return { ...input, id, description: input.description.trim(), status: 'open' };
}

/** Suggests the next action from prior confirmed actions against the subject; a moderator still decides. */
export function suggestAction(category: ConductCategory, priorActions: ConductAction[]): ConductAction {
  const severe = category === 'harassment' || category === 'discrimination' || category === 'impersonation';
  const prior = priorActions.filter((a) => a !== 'none').length;
  if (severe && prior >= 1) return 'removal';
  if (severe || prior >= 2) return 'suspension';
  return prior === 1 ? 'suspension' : 'warning';
}

export function resolveReport(r: ConductReport, action: ConductAction): ConductReport {
  if (r.status !== 'open') throw new Error('Report is already resolved');
  return { ...r, status: action === 'none' ? 'dismissed' : 'actioned', action };
}
