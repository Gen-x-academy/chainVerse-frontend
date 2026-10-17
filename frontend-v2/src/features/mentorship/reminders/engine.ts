/**
 * Reminder scheduling engine (issue #1351).
 *
 * Pure functions only: every function that needs the current instant takes it
 * as a `now: Date` argument. The engine owns the dedupe key format, the offset
 * ladder, quiet-hours evaluation, eligibility (including the stale grace
 * window), rescheduling, cancellation, and the retry budget.
 */

import type {
  Reminder,
  ReminderKind,
  ReminderQuietHours,
} from './types';

/** Delivery is attempted at most this many times before it stays `failed`. */
export const MAX_DELIVERY_ATTEMPTS = 3;

/**
 * A scheduled reminder still inside this window past `scheduledFor` may fire;
 * beyond it the moment is gone and the reminder is skipped as stale.
 */
export const STALE_GRACE_MS = 30 * 60 * 1000;

/** First retry waits this long; each subsequent retry doubles it. */
export const RETRY_BASE_DELAY_MS = 60 * 1000;

/**
 * Stable identity of a reminder occurrence. Two schedulers computing the same
 * occurrence independently must produce the same key so the duplicate is
 * suppressed rather than delivered twice.
 */
export function buildDedupeKey(
  kind: ReminderKind,
  subjectType: string,
  subjectId: string,
  recipientId: string,
  scheduledForIso: string,
): string {
  return `${kind}:${subjectType}:${subjectId}:${recipientId}:${scheduledForIso}`;
}

/**
 * Offset ladder for a deadline: each offset is a number of hours *before*
 * `base`, returned in chronological order (earliest first), so a policy of
 * `[72, 24, 2]` yields base-72h, base-24h, base-2h.
 */
export function computeReminderTimes(base: Date, offsetsHours: number[]): Date[] {
  return [...offsetsHours]
    .sort((a, b) => b - a)
    .map((hours) => new Date(base.getTime() - hours * 60 * 60 * 1000));
}

/**
 * True when an instant falls inside the quiet window. Hours are UTC hours of
 * the instant so the check is deterministic; a window that wraps past midnight
 * (22 -> 7) is honored, and a degenerate window (start === end) is never quiet.
 */
export function isWithinQuietHours(
  date: Date,
  quietHours?: ReminderQuietHours,
): boolean {
  if (!quietHours) return false;
  const { startHour, endHour } = quietHours;
  if (!Number.isInteger(startHour) || !Number.isInteger(endHour)) return false;
  if (startHour < 0 || startHour > 23 || endHour < 0 || endHour > 23) return false;
  if (startHour === endHour) return false;
  const hour = date.getUTCHours();
  if (startHour < endHour) return hour >= startHour && hour < endHour;
  return hour >= startHour || hour < endHour;
}

export type ReminderEligibilityReason =
  | 'cancelled'
  | 'delivered'
  | 'not_yet'
  | 'quiet_hours'
  | 'stale';

export type ReminderEligibility = {
  eligible: boolean;
  reason?: ReminderEligibilityReason;
};

/**
 * Whether a reminder may be delivered at `now`. Terminal states are skipped
 * outright, a future `scheduledFor` is not due yet, a `scheduledFor` older
 * than the grace window is stale, and quiet hours defer delivery.
 */
export function isEligibleForReminder(
  reminder: Reminder,
  now: Date,
  quietHours?: ReminderQuietHours,
): ReminderEligibility {
  if (reminder.status === 'cancelled') return { eligible: false, reason: 'cancelled' };
  if (reminder.status === 'delivered') return { eligible: false, reason: 'delivered' };

  const scheduledFor = Date.parse(reminder.scheduledFor);
  if (Number.isNaN(scheduledFor)) return { eligible: false, reason: 'stale' };
  if (scheduledFor > now.getTime()) return { eligible: false, reason: 'not_yet' };
  if (now.getTime() - scheduledFor > STALE_GRACE_MS) return { eligible: false, reason: 'stale' };
  if (isWithinQuietHours(now, quietHours)) return { eligible: false, reason: 'quiet_hours' };

  return { eligible: true };
}

/**
 * Reschedules a reminder to a new instant. The dedupe key and `updatedAt` are
 * both bumped, so a scheduler looking for the *old* time will not resurrect it
 * and one looking for the *new* time finds a fresh occurrence. Terminal
 * reminders (`cancelled`, `delivered`) keep their status.
 */
export function applyScheduleUpdate(
  reminder: Reminder,
  newScheduledFor: Date,
  now: Date = new Date(),
): Reminder {
  const scheduledFor = newScheduledFor.toISOString();
  return {
    ...reminder,
    scheduledFor,
    status:
      reminder.status === 'cancelled' || reminder.status === 'delivered'
        ? reminder.status
        : 'scheduled',
    dedupeKey: buildDedupeKey(
      reminder.kind,
      reminder.subjectType,
      reminder.subjectId,
      reminder.recipientId,
      scheduledFor,
    ),
    updatedAt: now.toISOString(),
  };
}

/** Cancels a reminder. Cancellation is terminal: eligibility skips it forever. */
export function cancelReminder(reminder: Reminder, now: Date): Reminder {
  return {
    ...reminder,
    status: 'cancelled',
    updatedAt: now.toISOString(),
  };
}

/**
 * Retry budget: `attempt` is the number of attempts already consumed, so
 * attempts 1 and 2 may retry and attempt 3 is final (`exponential-ish`
 * backoff lives in `retryDelayMs`).
 */
export function shouldRetry(attempt: number): boolean {
  if (!Number.isInteger(attempt) || attempt < 0) return false;
  return attempt < MAX_DELIVERY_ATTEMPTS;
}

/** Backoff before retry number `attempt + 1`: 1 min, 2 min, 4 min, ... */
export function retryDelayMs(attempt: number): number {
  if (!shouldRetry(attempt)) return 0;
  return RETRY_BASE_DELAY_MS * 2 ** attempt;
}
