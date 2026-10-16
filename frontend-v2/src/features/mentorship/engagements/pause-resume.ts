/** MENTOR-049: pause and resume engagements, extending the end date by the time paused. */
export interface PausableEngagement {
  id: string;
  status: 'active' | 'paused' | 'completed' | 'terminated';
  endDate: string;
  pausedAt?: string;
  pauseReason?: string;
  /** Total milliseconds already spent paused. */
  totalPausedMs: number;
}

export const MAX_PAUSE_DAYS = 60;
const DAY = 86_400_000;

export function pauseEngagement(e: PausableEngagement, reason: string, now: Date = new Date()): PausableEngagement {
  if (e.status === 'paused') return e;
  if (e.status !== 'active') throw new Error('Only active engagements can be paused');
  if (!reason.trim()) throw new Error('A reason is required to pause');
  return { ...e, status: 'paused', pausedAt: now.toISOString(), pauseReason: reason.trim() };
}

export function isPauseExpired(e: PausableEngagement, now: Date = new Date()): boolean {
  return e.status === 'paused' && !!e.pausedAt && now.getTime() - Date.parse(e.pausedAt) > MAX_PAUSE_DAYS * DAY;
}

/** Resuming pushes the end date out by the length of this pause so no session time is lost. */
export function resumeEngagement(e: PausableEngagement, now: Date = new Date()): PausableEngagement {
  if (e.status === 'active') return e;
  if (e.status !== 'paused' || !e.pausedAt) throw new Error('Only paused engagements can be resumed');
  const pausedMs = Math.max(0, now.getTime() - Date.parse(e.pausedAt));
  return {
    ...e,
    status: 'active',
    pausedAt: undefined,
    pauseReason: undefined,
    totalPausedMs: e.totalPausedMs + pausedMs,
    endDate: new Date(Date.parse(e.endDate) + pausedMs).toISOString(),
  };
}
