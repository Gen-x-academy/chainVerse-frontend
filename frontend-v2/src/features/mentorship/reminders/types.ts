/**
 * Mentorship reminder scheduling types (issue #1351).
 *
 * A reminder points at a stable subject reference inside a tenant, carries the
 * instant it should fire, and is deduplicated by a key built from its kind,
 * subject, recipient, and scheduled time. Nothing here reads the wall clock;
 * every helper takes `now` explicitly so the engine is deterministic and
 * testable.
 */

import type { MentorshipResource } from '../rbac';

export type ReminderKind =
  | 'application_deadline'
  | 'proposal_expiry'
  | 'session'
  | 'task'
  | 'milestone'
  | 'review'
  | 'payment_action';

export type ReminderStatus = 'scheduled' | 'cancelled' | 'delivered' | 'failed' | 'skipped';

/** Local wall-clock hours `[startHour, endHour)` during which nothing is sent. */
export type ReminderQuietHours = {
  startHour: number;
  endHour: number;
};

export type Reminder = {
  id: string;
  kind: ReminderKind;
  /** Id of the thing being reminded about (application, session, task, ...). */
  subjectId: string;
  subjectType: string;
  tenantId: string;
  recipientId: string;
  /** ISO instant at which the reminder becomes deliverable. */
  scheduledFor: string;
  /** IANA zone of the recipient; informational, quiet hours are evaluated in UTC. */
  timezone?: string;
  status: ReminderStatus;
  dedupeKey: string;
  deliveryAttempts: number;
  lastError?: string;
  updatedAt: string;
};

export type ReminderSchedulePolicy = {
  /** Hours before the base instant at which each reminder fires. */
  offsetsHours: number[];
  quietHours?: ReminderQuietHours;
  respectRecipientTimezone: boolean;
};

export type ScheduleReminderInput = {
  kind: ReminderKind;
  subjectId: string;
  subjectType: string;
  tenantId: string;
  recipientId: string;
  /** Explicit send time. Wins over `deadline` + policy offsets. */
  scheduledFor?: string | Date;
  /** Deadline the policy offsets count back from; used when `scheduledFor` is absent. */
  deadline?: string | Date;
  policy?: ReminderSchedulePolicy;
  timezone?: string;
};

export type DeliveryChannel = 'in_app' | 'email';

export type DeliveryOutcome = {
  reminderId: string;
  status: 'delivered' | 'failed' | 'skipped';
  attemptedAt: string;
  channel: DeliveryChannel;
  error?: string;
};

/** Maps a reminder kind onto the RBAC resource it schedules against. */
export const REMINDER_KIND_RESOURCES: Record<ReminderKind, MentorshipResource> = {
  application_deadline: 'program',
  proposal_expiry: 'engagement',
  session: 'session',
  task: 'deliverable',
  milestone: 'engagement',
  review: 'deliverable',
  payment_action: 'payment',
};
