import { describe, expect, it } from 'vitest';
import type { MentorshipPrincipal } from '../rbac';
import {
  MAX_DELIVERY_ATTEMPTS,
  applyScheduleUpdate,
  buildDedupeKey,
  cancelReminder,
  computeReminderTimes,
  isEligibleForReminder,
  isWithinQuietHours,
  retryDelayMs,
  shouldRetry,
} from '../engine';
import { ReminderAccessError, ReminderService } from '../service';
import type { Reminder, ScheduleReminderInput } from '../types';

const NOW = new Date('2026-03-10T12:00:00.000Z');
const ISO = (value: string) => new Date(value).toISOString();

const ADMIN: MentorshipPrincipal = {
  userId: 'admin-1',
  role: 'administrator',
  tenantId: 'tenant-a',
};
const STUDENT: MentorshipPrincipal = {
  userId: 'student-1',
  role: 'student',
  tenantId: 'tenant-a',
};
const FOREIGN_ADMIN: MentorshipPrincipal = {
  userId: 'admin-2',
  role: 'administrator',
  tenantId: 'tenant-b',
};

function reminder(overrides: Partial<Reminder> = {}): Reminder {
  const scheduledFor = overrides.scheduledFor ?? ISO('2026-03-10T11:59:00.000Z');
  const base: Reminder = {
    id: 'rem-1',
    kind: 'session',
    subjectId: 'session-1',
    subjectType: 'session',
    tenantId: 'tenant-a',
    recipientId: 'student-1',
    scheduledFor,
    status: 'scheduled',
    dedupeKey: buildDedupeKey('session', 'session', 'session-1', 'student-1', scheduledFor),
    deliveryAttempts: 0,
    updatedAt: ISO('2026-03-10T09:00:00.000Z'),
  };
  return { ...base, ...overrides };
}

const baseInput: ScheduleReminderInput = {
  kind: 'session',
  subjectId: 'session-1',
  subjectType: 'session',
  tenantId: 'tenant-a',
  recipientId: 'student-1',
  scheduledFor: ISO('2026-03-11T09:00:00.000Z'),
};

describe('buildDedupeKey', () => {
  it('is stable for identical inputs and changes when any part changes', () => {
    const key = buildDedupeKey('task', 'engagement', 'task-1', 'student-1', '2026-03-11T09:00:00.000Z');
    expect(key).toBe('task:engagement:task-1:student-1:2026-03-11T09:00:00.000Z');
    expect(buildDedupeKey('task', 'engagement', 'task-1', 'student-1', '2026-03-11T09:00:00.000Z')).toBe(key);
    expect(buildDedupeKey('review', 'engagement', 'task-1', 'student-1', '2026-03-11T09:00:00.000Z')).not.toBe(key);
    expect(buildDedupeKey('task', 'engagement', 'task-1', 'student-2', '2026-03-11T09:00:00.000Z')).not.toBe(key);
    expect(buildDedupeKey('task', 'engagement', 'task-1', 'student-1', '2026-03-12T09:00:00.000Z')).not.toBe(key);
  });
});

describe('computeReminderTimes', () => {
  it('counts offsets back from the base, earliest first', () => {
    const times = computeReminderTimes(new Date('2026-03-12T00:00:00.000Z'), [72, 24, 2]);
    expect(times.map((time) => time.toISOString())).toEqual([
      '2026-03-09T00:00:00.000Z',
      '2026-03-11T00:00:00.000Z',
      '2026-03-11T22:00:00.000Z',
    ]);
  });

  it('handles an empty ladder', () => {
    expect(computeReminderTimes(new Date('2026-03-12T00:00:00.000Z'), [])).toEqual([]);
  });
});

describe('isWithinQuietHours', () => {
  it('honors a plain window and a window wrapping past midnight', () => {
    expect(isWithinQuietHours(new Date('2026-03-10T12:00:00.000Z'), { startHour: 11, endHour: 14 })).toBe(true);
    expect(isWithinQuietHours(new Date('2026-03-10T14:00:00.000Z'), { startHour: 11, endHour: 14 })).toBe(false);
    expect(isWithinQuietHours(new Date('2026-03-10T23:00:00.000Z'), { startHour: 22, endHour: 7 })).toBe(true);
    expect(isWithinQuietHours(new Date('2026-03-10T06:00:00.000Z'), { startHour: 22, endHour: 7 })).toBe(true);
    expect(isWithinQuietHours(new Date('2026-03-10T08:00:00.000Z'), { startHour: 22, endHour: 7 })).toBe(false);
    expect(isWithinQuietHours(new Date('2026-03-10T12:00:00.000Z'), { startHour: 9, endHour: 9 })).toBe(false);
    expect(isWithinQuietHours(new Date('2026-03-10T12:00:00.000Z'), undefined)).toBe(false);
  });
});

describe('isEligibleForReminder', () => {
  it('skips cancelled and delivered reminders', () => {
    expect(isEligibleForReminder(reminder({ status: 'cancelled' }), NOW)).toEqual({
      eligible: false,
      reason: 'cancelled',
    });
    expect(isEligibleForReminder(reminder({ status: 'delivered' }), NOW)).toEqual({
      eligible: false,
      reason: 'delivered',
    });
  });

  it('skips reminders that are not due yet and reminders that went stale', () => {
    expect(isEligibleForReminder(reminder({ scheduledFor: ISO('2026-03-10T13:00:00.000Z') }), NOW)).toEqual({
      eligible: false,
      reason: 'not_yet',
    });
    expect(isEligibleForReminder(reminder({ scheduledFor: ISO('2026-03-10T10:00:00.000Z') }), NOW)).toEqual({
      eligible: false,
      reason: 'stale',
    });
  });

  it('skips delivery during quiet hours', () => {
    expect(
      isEligibleForReminder(reminder({ scheduledFor: ISO('2026-03-10T11:59:00.000Z') }), NOW, {
        startHour: 11,
        endHour: 14,
      }),
    ).toEqual({ eligible: false, reason: 'quiet_hours' });
  });

  it('is eligible for a due reminder inside the grace window', () => {
    expect(isEligibleForReminder(reminder(), NOW, { startHour: 22, endHour: 7 })).toEqual({
      eligible: true,
    });
  });
});

describe('applyScheduleUpdate', () => {
  it('bumps the dedupe key and updatedAt so the new time is honored', () => {
    const original = reminder();
    const rescheduledAt = new Date('2026-03-11T18:00:00.000Z');
    const updated = applyScheduleUpdate(original, rescheduledAt, NOW);

    expect(updated.scheduledFor).toBe('2026-03-11T18:00:00.000Z');
    expect(updated.dedupeKey).not.toBe(original.dedupeKey);
    expect(updated.dedupeKey).toBe(
      buildDedupeKey('session', 'session', 'session-1', 'student-1', '2026-03-11T18:00:00.000Z'),
    );
    expect(updated.updatedAt).toBe('2026-03-10T12:00:00.000Z');
    expect(updated.status).toBe('scheduled');
    // The old occurrence no longer matches, so the new time wins.
    expect(isEligibleForReminder(updated, NOW).reason).toBe('not_yet');
  });

  it('keeps terminal statuses terminal', () => {
    expect(applyScheduleUpdate(reminder({ status: 'cancelled' }), new Date('2026-03-12T00:00:00.000Z'), NOW).status).toBe(
      'cancelled',
    );
  });
});

describe('cancelReminder', () => {
  it('cancels terminally and stamps updatedAt', () => {
    const cancelled = cancelReminder(reminder(), NOW);
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.updatedAt).toBe('2026-03-10T12:00:00.000Z');
    expect(isEligibleForReminder(cancelled, NOW)).toEqual({ eligible: false, reason: 'cancelled' });
  });
});

describe('shouldRetry', () => {
  it('allows retries only within the budget', () => {
    expect(shouldRetry(0)).toBe(true);
    expect(shouldRetry(1)).toBe(true);
    expect(shouldRetry(2)).toBe(true);
    expect(shouldRetry(MAX_DELIVERY_ATTEMPTS)).toBe(false);
    expect(shouldRetry(4)).toBe(false);
    expect(shouldRetry(-1)).toBe(false);
  });

  it('backs off exponentially while retries remain', () => {
    expect(retryDelayMs(0)).toBe(60_000);
    expect(retryDelayMs(1)).toBe(120_000);
    expect(retryDelayMs(2)).toBe(240_000);
    expect(retryDelayMs(3)).toBe(0);
  });
});

describe('ReminderService', () => {
  it('schedules, dedupes, lists, and records delivery outcomes', () => {
    const service = new ReminderService(() => NOW);

    const first = service.schedule(ADMIN, baseInput);
    const duplicate = service.schedule(ADMIN, baseInput);
    expect(duplicate.id).toBe(first.id);
    expect(service.listForRecipient('student-1')).toHaveLength(1);

    const outcome = service.recordDeliveryOutcome(first.id, {
      reminderId: first.id,
      status: 'delivered',
      attemptedAt: '2026-03-11T09:00:00.000Z',
      channel: 'in_app',
    });
    expect(outcome.status).toBe('delivered');
    expect(outcome.deliveryAttempts).toBe(1);
    expect(isEligibleForReminder(outcome, NOW).reason).toBe('delivered');
  });

  it('honors the updated time after a reschedule', () => {
    const service = new ReminderService(() => NOW);
    const created = service.schedule(ADMIN, baseInput);
    const moved = service.reschedule(ADMIN, created.id, new Date('2026-03-12T09:00:00.000Z'));

    expect(moved.scheduledFor).toBe('2026-03-12T09:00:00.000Z');
    expect(moved.dedupeKey).not.toBe(created.dedupeKey);
    expect(service.listForRecipient('student-1')).toEqual([moved]);
    // A fresh schedule at the old time is a different occurrence again.
    const rescheduledAgain = service.schedule(ADMIN, baseInput);
    expect(rescheduledAgain.id).not.toBe(created.id);
  });

  it('cancels through RBAC and skips cancelled reminders', () => {
    const service = new ReminderService(() => NOW);
    const created = service.schedule(ADMIN, baseInput);
    const cancelled = service.cancel(ADMIN, created.id);

    expect(cancelled.status).toBe('cancelled');
    expect(isEligibleForReminder(cancelled, NOW).reason).toBe('cancelled');
    expect(service.cancel(ADMIN, created.id).status).toBe('cancelled');
  });

  it('is deny-by-default: no create grant, cross-tenant, and unknown reminder', () => {
    const service = new ReminderService(() => NOW);

    expect(() => service.schedule(STUDENT, baseInput)).toThrow(ReminderAccessError);
    expect(() => service.schedule(FOREIGN_ADMIN, baseInput)).toThrow(/different organization/i);
    expect(service.listForRecipient('student-1')).toHaveLength(0);
    expect(() => service.cancel(ADMIN, 'missing')).toThrow(/not found/i);
    expect(() => service.recordDeliveryOutcome('missing', {
      reminderId: 'missing',
      status: 'delivered',
      attemptedAt: NOW.toISOString(),
      channel: 'email',
    })).toThrow(/not found/i);
  });

  it('schedules from a deadline + policy ladder when no explicit time is given', () => {
    const service = new ReminderService(() => NOW);
    const created = service.schedule(ADMIN, {
      ...baseInput,
      scheduledFor: undefined,
      deadline: ISO('2026-03-13T00:00:00.000Z'),
      policy: { offsetsHours: [96, 24, 2], respectRecipientTimezone: true },
    });
    // 96h before the deadline is already past, so the first future offset wins.
    expect(created.scheduledFor).toBe('2026-03-12T00:00:00.000Z');
  });
});
