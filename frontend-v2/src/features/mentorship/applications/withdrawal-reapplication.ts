/** MENTOR-036: application withdrawal and reapplication with a cooldown. */
export interface WithdrawableApplication {
  id: string;
  programId: string;
  applicantId: string;
  status: 'submitted' | 'in_review' | 'accepted' | 'rejected' | 'withdrawn';
  withdrawnAt?: string;
  withdrawalReason?: string;
}

export const REAPPLY_COOLDOWN_DAYS = 7;
export const MAX_ATTEMPTS_PER_PROGRAM = 3;

/** Applicants may withdraw until a decision is made. Idempotent. */
export function withdraw(app: WithdrawableApplication, reason?: string, now: Date = new Date()): WithdrawableApplication {
  if (app.status === 'withdrawn') return app;
  if (app.status !== 'submitted' && app.status !== 'in_review') throw new Error('A decided application cannot be withdrawn');
  return { ...app, status: 'withdrawn', withdrawnAt: now.toISOString(), withdrawalReason: reason?.trim() || undefined };
}

export type ReapplyCheck = { allowed: true } | { allowed: false; reason: string; retryAt?: string };

export function canReapply(history: WithdrawableApplication[], programId: string, applicantId: string, now: Date = new Date()): ReapplyCheck {
  const mine = history.filter((a) => a.programId === programId && a.applicantId === applicantId);
  if (mine.some((a) => a.status === 'submitted' || a.status === 'in_review' || a.status === 'accepted')) {
    return { allowed: false, reason: 'You already have an active application for this program' };
  }
  if (mine.length >= MAX_ATTEMPTS_PER_PROGRAM) return { allowed: false, reason: 'Application limit reached for this program' };
  const last = mine
    .filter((a) => a.withdrawnAt)
    .map((a) => Date.parse(a.withdrawnAt as string))
    .sort((a, b) => b - a)[0];
  if (last !== undefined) {
    const retryAt = last + REAPPLY_COOLDOWN_DAYS * 86_400_000;
    if (now.getTime() < retryAt) return { allowed: false, reason: 'Please wait before reapplying', retryAt: new Date(retryAt).toISOString() };
  }
  return { allowed: true };
}
