/**
 * Deadline and action reminder types (issue #1141).
 *
 * A reminder points at a *stable subject reference*, carries the recipient's IANA
 * timezone with a local `YYYY-MM-DDTHH:MM` send time, and records why it was
 * cancelled when it is.
 */

import type { Channel, NotificationSubject } from '../notification-events/types';

export type { Channel, NotificationSubject };

export type ReminderKind =
  | 'incomplete-application'
  | 'pending-review'
  | 'award-acceptance'
  | 'missing-evidence'
  | 'payout-setup';

export type ReminderStatus = 'scheduled' | 'sent' | 'cancelled' | 'completed' | 'suppressed';

export type QuietHours = {
  /** Local `HH:MM` inclusive start, e.g. `'22:00'`. */
  startLocalTime: string;
  /** Local `HH:MM` exclusive end, e.g. `'07:00'`. */
  endLocalTime: string;
  timezone: string;
};

export type ReminderSchedule = {
  id: string;
  kind: ReminderKind;
  subject: NotificationSubject;
  programId?: string;
  channel: Channel;
  status: ReminderStatus;
  timezone: string;
  /** Local `YYYY-MM-DDTHH:MM` rendering in the effective timezone. */
  scheduledForLocal: string;
  deliverAfterLocal?: string;
  dedupeKey: string;
  attempts: number;
  lastAttemptAt?: string;
  sentAt?: string;
  cancelledAt?: string;
  cancelledReason?: string;
  completedAt?: string;
  subjectCompletedAt?: string;
};

export type SchedulingPolicy = {
  /** Hours before the deadline at which to fire; earlier offsets first. */
  offsetsHours: number[];
  quietHours?: QuietHours;
  respectRecipientTimezone: boolean;
};

export type SchedulingResultStatus =
  | 'scheduled'
  | 'deferred-to-quiet-hours-end'
  | 'duplicate-suppressed'
  | 'cancelled-subject-complete'
  | 'no-offset-applicable';

export type SchedulingResult = {
  status: SchedulingResultStatus;
  schedule: ReminderSchedule;
  detail: string;
};

export type BuildScheduleInput = {
  now: Date;
  timezone: string;
  policy: SchedulingPolicy;
  existing?: ReminderSchedule[];
  subjectCompletedAt?: string;
  programId?: string;
  channel?: Channel;
};
