import { describe, expect, it } from 'vitest';
import {
  assertValidRecurringAvailability,
  expandAvailability,
  findBookingConflicts,
  isValidTimeZone,
  localDateTimeToUtc,
  localDateInTimeZone,
  normalizeWeeklyWindows,
  updateRecurringAvailability,
  validateRecurringAvailability,
  applyBookingPolicy,
  AvailabilityValidationError,
  type ExistingBooking,
  type RecurringAvailability,
  type WeeklyAvailabilityWindow,
} from './recurring-availability';

function schedule(overrides: Partial<RecurringAvailability> = {}): RecurringAvailability {
  return {
    id: 'availability-1',
    mentorId: 'mentor-1',
    timeZone: 'UTC',
    windows: [{ dayOfWeek: 1, start: '09:00', end: '10:00' }],
    exceptions: [],
    effectiveFrom: '2026-01-01',
    effectiveUntil: '2026-12-31',
    leadTimeMinutes: 0,
    bufferBeforeMinutes: 0,
    bufferAfterMinutes: 0,
    bookingHorizonDays: 30,
    version: 1,
    ...overrides,
  };
}

function booking(id: string, startsAt: string, endsAt: string): ExistingBooking {
  return { id, startsAt, endsAt };
}

describe('recurring availability validation', () => {
  it('accepts a valid schedule', () => {
    expect(validateRecurringAvailability(schedule())).toEqual([]);
    expect(() => assertValidRecurringAvailability(schedule())).not.toThrow();
  });

  it('rejects an invalid time zone', () => {
    const issues = validateRecurringAvailability(schedule({ timeZone: 'Mars/Olympus' }));
    expect(issues).toContainEqual(
      expect.objectContaining({ code: 'INVALID_TIME_ZONE', field: 'timeZone' }),
    );
    expect(isValidTimeZone('America/New_York')).toBe(true);
    expect(isValidTimeZone('')).toBe(false);
  });

  it('rejects windows whose end is not after the start with a stable code', () => {
    const issues = validateRecurringAvailability(
      schedule({ windows: [{ dayOfWeek: 1, start: '10:00', end: '10:00' }] }),
    );
    expect(issues).toContainEqual(
      expect.objectContaining({ code: 'INVALID_WINDOW', field: 'windows[0]' }),
    );
    expect(() =>
      normalizeWeeklyWindows([{ dayOfWeek: 1, start: '10:00', end: '09:00' }]),
    ).toThrow(AvailabilityValidationError);
  });

  it('rejects invalid exception and policy ranges clearly', () => {
    const issues = validateRecurringAvailability(
      schedule({
        exceptions: [{ id: 'e1', date: '2026-13-40', kind: 'available' }],
        leadTimeMinutes: -1,
        bookingHorizonDays: 1.5,
      }),
    );
    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['INVALID_EXCEPTION', 'INVALID_POLICY']),
    );
  });

  it('rejects an inverted effective range', () => {
    const issues = validateRecurringAvailability(
      schedule({ effectiveFrom: '2026-06-01', effectiveUntil: '2026-05-01' }),
    );
    expect(issues).toContainEqual(
      expect.objectContaining({ code: 'INVALID_EFFECTIVE_RANGE' }),
    );
  });
});

describe('weekly window normalization', () => {
  it('sorts and merges overlapping and adjacent windows deterministically', () => {
    const normalized = normalizeWeeklyWindows([
      { dayOfWeek: 1, start: '12:00', end: '13:00' },
      { dayOfWeek: 1, start: '09:00', end: '11:00' },
      { dayOfWeek: 1, start: '10:30', end: '12:30' },
      { dayOfWeek: 3, start: '08:00', end: '09:00' },
      { dayOfWeek: 0, start: '18:00', end: '19:00' },
    ]);

    expect(normalized).toEqual([
      { dayOfWeek: 0, start: '18:00', end: '19:00' },
      { dayOfWeek: 1, start: '09:00', end: '13:00' },
      { dayOfWeek: 3, start: '08:00', end: '09:00' },
    ]);
  });

  it('returns the same result regardless of input order', () => {
    const windows: WeeklyAvailabilityWindow[] = [
      { dayOfWeek: 4, start: '15:00', end: '17:00' },
      { dayOfWeek: 2, start: '09:00', end: '10:00' },
      { dayOfWeek: 2, start: '09:30', end: '11:00' },
    ];
    expect(normalizeWeeklyWindows(windows)).toEqual(
      normalizeWeeklyWindows([...windows].reverse()),
    );
  });
});

describe('time zone and DST expansion', () => {
  it('converts local wall-clock times to UTC', () => {
    expect(localDateTimeToUtc('2026-03-02', '09:00', 'UTC')?.toISOString()).toBe(
      '2026-03-02T09:00:00.000Z',
    );
    expect(localDateInTimeZone(new Date('2026-03-02T23:30:00.000Z'), 'America/New_York')).toBe(
      '2026-03-02',
    );
  });

  it('keeps weekly local times across the spring-forward transition', () => {
    const before = expandAvailability(
      schedule({ timeZone: 'America/New_York' }),
      new Date('2026-03-02T00:00:00.000Z'),
      new Date('2026-03-02T23:59:59.000Z'),
    );
    const after = expandAvailability(
      schedule({ timeZone: 'America/New_York' }),
      new Date('2026-03-09T00:00:00.000Z'),
      new Date('2026-03-09T23:59:59.000Z'),
    );

    expect(before).toEqual([
      { startsAt: '2026-03-02T14:00:00.000Z', endsAt: '2026-03-02T15:00:00.000Z' },
    ]);
    expect(after).toEqual([
      { startsAt: '2026-03-09T13:00:00.000Z', endsAt: '2026-03-09T14:00:00.000Z' },
    ]);
  });

  it('keeps weekly local times across the fall-back transition', () => {
    const before = expandAvailability(
      schedule({ timeZone: 'America/New_York' }),
      new Date('2026-10-26T00:00:00.000Z'),
      new Date('2026-10-26T23:59:59.000Z'),
    );
    const after = expandAvailability(
      schedule({ timeZone: 'America/New_York' }),
      new Date('2026-11-02T00:00:00.000Z'),
      new Date('2026-11-02T23:59:59.000Z'),
    );

    expect(before).toEqual([
      { startsAt: '2026-10-26T13:00:00.000Z', endsAt: '2026-10-26T14:00:00.000Z' },
    ]);
    expect(after).toEqual([
      { startsAt: '2026-11-02T14:00:00.000Z', endsAt: '2026-11-02T15:00:00.000Z' },
    ]);
  });

  it('skips a local window that does not exist during the spring-forward gap', () => {
    const slots = expandAvailability(
      schedule({
        timeZone: 'America/New_York',
        windows: [{ dayOfWeek: 0, start: '02:30', end: '03:30' }],
      }),
      new Date('2026-03-08T00:00:00.000Z'),
      new Date('2026-03-08T23:59:59.000Z'),
    );
    expect(slots).toEqual([]);
  });

  it('resolves ambiguous fall-back times deterministically to the first occurrence', () => {
    const slots = expandAvailability(
      schedule({
        timeZone: 'America/New_York',
        windows: [{ dayOfWeek: 0, start: '01:30', end: '02:30' }],
      }),
      new Date('2026-11-01T00:00:00.000Z'),
      new Date('2026-11-01T23:59:59.000Z'),
    );
    expect(slots).toEqual([
      { startsAt: '2026-11-01T05:30:00.000Z', endsAt: '2026-11-01T07:30:00.000Z' },
    ]);
  });
});

describe('exceptions and effective ranges', () => {
  it('subtracts a partial unavailable exception', () => {
    const slots = expandAvailability(
      schedule({
        windows: [{ dayOfWeek: 1, start: '09:00', end: '17:00' }],
        exceptions: [
          { id: 'block', date: '2026-03-02', kind: 'unavailable', start: '10:00', end: '11:00' },
        ],
      }),
      new Date('2026-03-02T00:00:00.000Z'),
      new Date('2026-03-02T23:59:59.000Z'),
    );
    expect(slots).toEqual([
      { startsAt: '2026-03-02T09:00:00.000Z', endsAt: '2026-03-02T10:00:00.000Z' },
      { startsAt: '2026-03-02T11:00:00.000Z', endsAt: '2026-03-02T17:00:00.000Z' },
    ]);
  });

  it('removes the whole day for a full-day unavailable exception', () => {
    const slots = expandAvailability(
      schedule({
        exceptions: [{ id: 'day-off', date: '2026-03-02', kind: 'unavailable' }],
      }),
      new Date('2026-03-02T00:00:00.000Z'),
      new Date('2026-03-02T23:59:59.000Z'),
    );
    expect(slots).toEqual([]);
  });

  it('adds an available exception outside the weekly windows', () => {
    const slots = expandAvailability(
      schedule({
        exceptions: [
          { id: 'extra', date: '2026-03-07', kind: 'available', start: '12:00', end: '14:00' },
        ],
      }),
      new Date('2026-03-07T00:00:00.000Z'),
      new Date('2026-03-07T23:59:59.000Z'),
    );
    expect(slots).toEqual([
      { startsAt: '2026-03-07T12:00:00.000Z', endsAt: '2026-03-07T14:00:00.000Z' },
    ]);
  });

  it('lets unavailable exceptions override added availability on the same day', () => {
    const slots = expandAvailability(
      schedule({
        windows: [],
        exceptions: [
          { id: 'extra', date: '2026-03-07', kind: 'available', start: '12:00', end: '14:00' },
          { id: 'holiday', date: '2026-03-07', kind: 'unavailable' },
        ],
      }),
      new Date('2026-03-07T00:00:00.000Z'),
      new Date('2026-03-07T23:59:59.000Z'),
    );
    expect(slots).toEqual([]);
  });

  it('only expands windows inside the effective range', () => {
    const slots = expandAvailability(
      schedule({ effectiveFrom: '2026-03-10', effectiveUntil: '2026-03-20' }),
      new Date('2026-03-01T00:00:00.000Z'),
      new Date('2026-03-31T23:59:59.000Z'),
    );
    expect(slots).toEqual([
      { startsAt: '2026-03-16T09:00:00.000Z', endsAt: '2026-03-16T10:00:00.000Z' },
    ]);
  });
});

describe('booking policy', () => {
  it('applies lead time, buffers and the booking horizon', () => {
    const slots = applyBookingPolicy(
      schedule({
        windows: [{ dayOfWeek: 1, start: '09:00', end: '17:00' }],
        leadTimeMinutes: 60,
        bufferBeforeMinutes: 15,
        bufferAfterMinutes: 30,
        bookingHorizonDays: 1,
      }),
      [{ startsAt: '2026-03-02T09:00:00.000Z', endsAt: '2026-03-02T17:00:00.000Z' }],
      new Date('2026-03-02T08:00:00.000Z'),
    );

    expect(slots).toEqual([
      { startsAt: '2026-03-02T09:15:00.000Z', endsAt: '2026-03-02T16:30:00.000Z' },
    ]);
  });

  it('drops slots that fall outside the booking horizon', () => {
    const slots = applyBookingPolicy(
      schedule({ bookingHorizonDays: 1 }),
      [{ startsAt: '2026-03-10T09:00:00.000Z', endsAt: '2026-03-10T10:00:00.000Z' }],
      new Date('2026-03-02T08:00:00.000Z'),
    );
    expect(slots).toEqual([]);
  });
});

describe('existing booking protection', () => {
  const current = schedule({ windows: [{ dayOfWeek: 1, start: '09:00', end: '17:00' }] });
  const bookings = [booking('booking-1', '2026-03-02T14:00:00.000Z', '2026-03-02T15:00:00.000Z')];

  it('reports bookings that the new schedule no longer covers', () => {
    const next = schedule({
      version: 2,
      windows: [{ dayOfWeek: 1, start: '09:00', end: '12:00' }],
    });
    expect(findBookingConflicts(next, bookings)).toEqual([
      {
        bookingId: 'booking-1',
        startsAt: '2026-03-02T14:00:00.000Z',
        endsAt: '2026-03-02T15:00:00.000Z',
      },
    ]);
  });

  it('blocks an update when conflicts are not acknowledged and never mutates bookings', () => {
    const next = schedule({
      version: 2,
      windows: [{ dayOfWeek: 1, start: '09:00', end: '12:00' }],
    });
    const snapshot = JSON.parse(JSON.stringify(bookings));
    const result = updateRecurringAvailability({ current, next, bookings });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: 'BOOKING_CONFLICT',
        conflicts: [expect.objectContaining({ bookingId: 'booking-1' })],
      }),
    });
    expect(bookings).toEqual(snapshot);
  });

  it('returns the conflicts when the mentor explicitly acknowledges them', () => {
    const next = schedule({
      version: 2,
      windows: [{ dayOfWeek: 1, start: '09:00', end: '12:00' }],
    });
    const result = updateRecurringAvailability({
      current,
      next,
      bookings,
      acknowledgeConflicts: true,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.schedule.version).toBe(2);
    expect(result.conflicts).toEqual([expect.objectContaining({ bookingId: 'booking-1' })]);
  });

  it('rejects a stale version', () => {
    const result = updateRecurringAvailability({
      current,
      next: schedule({ version: 1 }),
    });
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'INVALID_VERSION' }),
    });
  });
});
