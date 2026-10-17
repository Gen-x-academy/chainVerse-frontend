/**
 * Reminder scheduling service (issue #1351).
 *
 * An in-memory store that survives within the session only — persistence is
 * server-side; this class is the frontend's scheduling model and the seam the
 * UI tests drive. Authorization is deny-by-default through the mentorship RBAC
 * matrix: `schedule` needs `create` and `cancel` needs `delete` on the resource
 * the reminder kind maps to, in the reminder's own tenant, or the call throws
 * `ReminderAccessError`.
 */

import {
  canPerformMentorshipAction,
  describeMentorshipDenial,
  type MentorshipDenialReason,
  type MentorshipAction,
  type MentorshipPrincipal,
} from '../rbac';
import {
  applyScheduleUpdate,
  buildDedupeKey,
  cancelReminder,
  computeReminderTimes,
} from './engine';
import {
  REMINDER_KIND_RESOURCES,
  type DeliveryOutcome,
  type Reminder,
  type ScheduleReminderInput,
} from './types';

/** Raised when the RBAC matrix denies a scheduling operation. */
export class ReminderAccessError extends Error {
  readonly reason: MentorshipDenialReason;

  constructor(reason: MentorshipDenialReason) {
    super(describeMentorshipDenial({ allowed: false, reason }));
    this.name = 'ReminderAccessError';
    this.reason = reason;
  }
}

/** Raised when neither an explicit time nor a deadline + policy was given. */
export class ReminderScheduleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReminderScheduleError';
  }
}

function toInstant(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

export class ReminderService {
  /** Survives within the session only; the server owns durable reminders. */
  private readonly store = new Map<string, Reminder>();
  private readonly clock: () => Date;

  constructor(clock: () => Date = () => new Date()) {
    this.clock = clock;
  }

  private authorize(
    principal: MentorshipPrincipal,
    reminder: { kind: Reminder['kind']; tenantId: string },
    action: MentorshipAction,
  ): void {
    const decision = canPerformMentorshipAction(principal, {
      resource: REMINDER_KIND_RESOURCES[reminder.kind],
      tenantId: reminder.tenantId,
    }, action);
    if (!decision.allowed) throw new ReminderAccessError(decision.reason);
  }

  private resolveScheduledFor(input: ScheduleReminderInput): Date {
    if (input.scheduledFor !== undefined) return toInstant(input.scheduledFor);
    if (input.deadline !== undefined && input.policy) {
      const now = this.clock();
      const upcoming = computeReminderTimes(
        toInstant(input.deadline),
        input.policy.offsetsHours,
      ).filter((time) => time.getTime() > now.getTime());
      if (upcoming.length > 0) return upcoming[0];
      throw new ReminderScheduleError('No policy offset falls after the current time.');
    }
    throw new ReminderScheduleError('Provide `scheduledFor`, or `deadline` with a policy.');
  }

  private nextId(input: ScheduleReminderInput, scheduledForIso: string): string {
    const base = `rem-${input.tenantId}-${input.kind}-${input.subjectType}-${input.subjectId}-${input.recipientId}-${scheduledForIso}`;
    let id = base;
    let suffix = 1;
    while (this.store.has(id)) id = `${base}-${suffix++}`;
    return id;
  }

  /**
   * Schedules a reminder. An identical occurrence (same dedupe key) already in
   * `scheduled` state is returned instead of stored twice.
   */
  schedule(principal: MentorshipPrincipal, input: ScheduleReminderInput): Reminder {
    this.authorize(principal, { kind: input.kind, tenantId: input.tenantId }, 'create');

    const scheduledFor = this.resolveScheduledFor(input).toISOString();
    const dedupeKey = buildDedupeKey(
      input.kind,
      input.subjectType,
      input.subjectId,
      input.recipientId,
      scheduledFor,
    );

    const existing = [...this.store.values()].find(
      (reminder) => reminder.dedupeKey === dedupeKey && reminder.status === 'scheduled',
    );
    if (existing) return existing;

    const now = this.clock().toISOString();
    const reminder: Reminder = {
      id: this.nextId(input, scheduledFor),
      kind: input.kind,
      subjectId: input.subjectId,
      subjectType: input.subjectType,
      tenantId: input.tenantId,
      recipientId: input.recipientId,
      scheduledFor,
      timezone: input.timezone,
      status: 'scheduled',
      dedupeKey,
      deliveryAttempts: 0,
      updatedAt: now,
    };

    this.store.set(reminder.id, reminder);
    return reminder;
  }

  cancel(principal: MentorshipPrincipal, reminderId: string): Reminder {
    const existing = this.store.get(reminderId);
    if (!existing) throw new Error(`Reminder not found: ${reminderId}`);
    this.authorize(principal, existing, 'delete');
    const cancelled = cancelReminder(existing, this.clock());
    this.store.set(cancelled.id, cancelled);
    return cancelled;
  }

  /** Reschedules an existing reminder; bumps dedupe key + `updatedAt`. */
  reschedule(
    principal: MentorshipPrincipal,
    reminderId: string,
    newScheduledFor: Date,
  ): Reminder {
    const existing = this.store.get(reminderId);
    if (!existing) throw new Error(`Reminder not found: ${reminderId}`);
    this.authorize(principal, existing, 'update');
    const updated = applyScheduleUpdate(existing, newScheduledFor, this.clock());
    this.store.set(updated.id, updated);
    return updated;
  }

  listForRecipient(recipientId: string): Reminder[] {
    return [...this.store.values()]
      .filter((reminder) => reminder.recipientId === recipientId)
      .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
  }

  get(reminderId: string): Reminder | undefined {
    return this.store.get(reminderId);
  }

  /**
   * Records a delivery attempt. `delivered` and `skipped` are terminal;
   * `failed` stays `failed` once the retry budget from `shouldRetry` is spent.
   */
  recordDeliveryOutcome(reminderId: string, outcome: DeliveryOutcome): Reminder {
    const existing = this.store.get(reminderId);
    if (!existing) throw new Error(`Reminder not found: ${reminderId}`);

    const updated: Reminder = {
      ...existing,
      status: outcome.status,
      deliveryAttempts: existing.deliveryAttempts + 1,
      lastError: outcome.error,
      updatedAt: outcome.attemptedAt,
    };
    this.store.set(updated.id, updated);
    return updated;
  }
}
