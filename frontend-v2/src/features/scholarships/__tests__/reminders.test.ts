import { describe, expect, it, vi } from 'vitest';
import {
  buildSchedule,
  cancelSchedule,
  isWithinQuietHours,
  localDateTimeInZone,
  localTimeInZone,
  nextQuietHoursEnd,
  previewSchedule,
  schedulingPolicy,
  reminderService,
  SCHEDULER_TIMEZONE,
} from '@/src/features/scholarships/reminders/service';
import type {
  QuietHours,
  ReminderKind,
  ReminderSchedule,
  SchedulingPolicy,
} from '@/src/features/scholarships/reminders/types';

vi.mock('@/src/lib/api-client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const NOW = new Date('2026-05-04T10:00:00.000Z');
const SUBJECT = { kind: 'application' as const, id: 'app-42' };
const QUIET: QuietHours = {
  startLocalTime: '22:00',
  endLocalTime: '07:00',
  timezone: 'Europe/London',
};

describe('scheduling policy', () => {
  it('offers sensible default offsets per reminder kind', () => {
    const policy = schedulingPolicy('incomplete-application');
    expect(policy.offsetsHours).toEqual([72, 24, 2]);
    expect(policy.respectRecipientTimezone).toBe(true);
    expect(schedulingPolicy('pending-review').offsetsHours).toContain(4);
    expect(schedulingPolicy('payout-setup').offsetsHours.length).toBeGreaterThan(0);
  });
});

describe('quiet hours', () => {
  it('handles a window that wraps past midnight', () => {
    expect(isWithinQuietHours('23:30', QUIET)).toBe(true);
    expect(isWithinQuietHours('02:00', QUIET)).toBe(true);
    expect(isWithinQuietHours('06:59', QUIET)).toBe(true);
    expect(isWithinQuietHours('07:00', QUIET)).toBe(false);
    expect(isWithinQuietHours('12:00', QUIET)).toBe(false);
    expect(isWithinQuietHours('21:59', QUIET)).toBe(false);
    expect(isWithinQuietHours('22:00', QUIET)).toBe(true);
  });

  it('handles a same-day window and a zero-length window', () => {
    const dayWindow: QuietHours = { startLocalTime: '09:00', endLocalTime: '17:00', timezone: 'UTC' };
    expect(isWithinQuietHours('12:00', dayWindow)).toBe(true);
    expect(isWithinQuietHours('18:00', dayWindow)).toBe(false);
    expect(isWithinQuietHours('12:00', { ...dayWindow, startLocalTime: '12:00', endLocalTime: '12:00' })).toBe(
      false
    );
    expect(isWithinQuietHours('12:00', undefined)).toBe(false);
  });

  it('resolves the end of a quiet window to the right local date', () => {
    expect(nextQuietHoursEnd('2026-05-04T23:00', QUIET)).toBe('2026-05-05T07:00');
    expect(nextQuietHoursEnd('2026-05-04T02:00', QUIET)).toBe('2026-05-04T07:00');
  });
});

describe('timezone conversion', () => {
  it('renders the same instant differently per IANA zone', () => {
    expect(localTimeInZone(NOW, 'UTC')).toBe('10:00');
    expect(localDateTimeInZone(NOW, 'UTC')).toBe('2026-05-04T10:00');
    expect(localTimeInZone(NOW, 'America/New_York')).toBe('06:00');
    expect(localTimeInZone(NOW, 'Asia/Tokyo')).toBe('19:00');
    expect(localDateTimeInZone(NOW, 'Europe/London')).toBe('2026-05-04T11:00');
  });

  it('schedules into the recipient zone and falls back to the scheduler zone', () => {
    const recipient = buildSchedule('incomplete-application', SUBJECT, {
      now: NOW,
      timezone: 'America/New_York',
      policy: { offsetsHours: [2], quietHours: undefined, respectRecipientTimezone: true },
    });
    expect(recipient.schedule.timezone).toBe('America/New_York');
    expect(recipient.schedule.scheduledForLocal).toBe('2026-05-04T08:00');

    const platform = buildSchedule('incomplete-application', SUBJECT, {
      now: NOW,
      timezone: 'Asia/Tokyo',
      policy: { offsetsHours: [2], quietHours: undefined, respectRecipientTimezone: false },
    });
    expect(platform.schedule.timezone).toBe(SCHEDULER_TIMEZONE);
    expect(platform.schedule.scheduledForLocal).toBe('2026-05-04T12:00');
  });

  it('applies the offset in absolute hours regardless of the zone', () => {
    const policy: SchedulingPolicy = { offsetsHours: [6], quietHours: undefined, respectRecipientTimezone: true };
    const newYork = buildSchedule('pending-review', SUBJECT, { now: NOW, timezone: 'America/New_York', policy });
    const tokyo = buildSchedule('pending-review', SUBJECT, { now: NOW, timezone: 'Asia/Tokyo', policy });
    expect(newYork.schedule.scheduledForLocal).toBe('2026-05-04T12:00');
    expect(tokyo.schedule.scheduledForLocal).toBe('2026-05-05T01:00');
  });
});

describe('buildSchedule', () => {
  const basePolicy: SchedulingPolicy = {
    offsetsHours: [2],
    quietHours: QUIET,
    respectRecipientTimezone: true,
  };

  it('defers an occurrence that lands inside quiet hours', () => {
    const result = buildSchedule('incomplete-application', SUBJECT, {
      now: NOW,
      timezone: 'UTC',
      policy: basePolicy,
    });
    // 12:00 UTC is outside 22:00-07:00, so this one is simply scheduled.
    expect(result.status).toBe('scheduled');

    const night = buildSchedule('incomplete-application', SUBJECT, {
      now: new Date('2026-05-04T21:00:00.000Z'),
      timezone: 'UTC',
      policy: { ...basePolicy, offsetsHours: [2] },
    });
    expect(night.status).toBe('deferred-to-quiet-hours-end');
    expect(night.schedule.scheduledForLocal).toBe('2026-05-04T23:00');
    expect(night.schedule.deliverAfterLocal).toBe('2026-05-05T07:00');
    expect(night.detail).toMatch(/quiet hours/);
  });

  it('suppresses a duplicate dedupe key', () => {
    const first = buildSchedule('award-acceptance', SUBJECT, {
      now: NOW,
      timezone: 'UTC',
      policy: basePolicy,
    });
    expect(first.status).toBe('scheduled');
    const second = buildSchedule('award-acceptance', SUBJECT, {
      now: NOW,
      timezone: 'UTC',
      policy: basePolicy,
      existing: [first.schedule],
    });
    expect(second.status).toBe('duplicate-suppressed');
    expect(second.schedule.dedupeKey).toBe(first.schedule.dedupeKey);
  });

  it('cancels automatically once the subject is complete', () => {
    const result = buildSchedule('incomplete-application', SUBJECT, {
      now: NOW,
      timezone: 'UTC',
      policy: basePolicy,
      subjectCompletedAt: '2026-05-04T10:30:00.000Z',
    });
    expect(result.status).toBe('cancelled-subject-complete');
    expect(result.schedule.status).toBe('cancelled');
    expect(result.schedule.cancelledReason).toMatch(/subject was completed/);
    expect(result.detail).toMatch(/no longer outstanding/);
  });

  it('reports when no offset applies', () => {
    const result = buildSchedule('pending-review', SUBJECT, {
      now: NOW,
      timezone: 'UTC',
      policy: { ...basePolicy, offsetsHours: [] },
    });
    expect(result.status).toBe('no-offset-applicable');
    expect(result.schedule.status).toBe('cancelled');
  });

  it('previews every applicable occurrence with its own reason', () => {
    const occurrences = previewSchedule('incomplete-application', SUBJECT, {
      now: NOW,
      timezone: 'Europe/London',
      policy: { offsetsHours: [72, 24, 12], quietHours: QUIET, respectRecipientTimezone: true },
    });
    expect(occurrences).toHaveLength(3);
    expect(occurrences.map((o) => o.schedule.scheduledForLocal)).toEqual([
      '2026-05-04T23:00',
      '2026-05-05T11:00',
      '2026-05-07T11:00',
    ]);
    expect(occurrences[0].status).toBe('deferred-to-quiet-hours-end');
    expect(occurrences[0].schedule.deliverAfterLocal).toBe('2026-05-05T07:00');
    expect(occurrences[1].status).toBe('scheduled');
    for (const occurrence of occurrences) {
      expect(occurrence.detail.length).toBeGreaterThan(0);
    }
  });

  it('cancels a schedule with a recorded reason', () => {
    const schedule = buildSchedule('payout-setup', SUBJECT, {
      now: NOW,
      timezone: 'UTC',
      policy: { offsetsHours: [1], quietHours: undefined, respectRecipientTimezone: true },
    }).schedule as ReminderSchedule;
    const cancelled = cancelSchedule(schedule, 'Cancelled by an administrator.', NOW);
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.cancelledAt).toBe(NOW.toISOString());
    expect(cancelled.cancelledReason).toBe('Cancelled by an administrator.');
  });

  it('never reads the wall clock: the same inputs always give the same result', () => {
    const kind: ReminderKind = 'missing-evidence';
    const input = {
      now: NOW,
      timezone: 'America/Chicago',
      policy: schedulingPolicy(kind, { quietHours: QUIET }),
      existing: [] as ReminderSchedule[],
    };
    expect(buildSchedule(kind, SUBJECT, input)).toEqual(buildSchedule(kind, SUBJECT, input));
  });
});

describe('reminderService', () => {
  it('cancels with an idempotency key through the api client', async () => {
    const { apiClient } = await import('@/src/lib/api-client');
    const mocked = apiClient as unknown as { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> };
    mocked.get.mockResolvedValue([]);
    mocked.post.mockResolvedValue({});

    await reminderService.list();
    expect(mocked.get).toHaveBeenCalledWith('/scholarships/reminders');

    await reminderService.cancel({
      scheduleId: 'rem-1',
      reason: 'No longer required.',
      expectedAttempts: 0,
      idempotencyKey: 'rem-cancel-1',
    });
    expect(mocked.post).toHaveBeenCalledWith(
      '/scholarships/reminders/rem-1/cancel',
      expect.objectContaining({ idempotencyKey: 'rem-cancel-1' })
    );
  });
});
