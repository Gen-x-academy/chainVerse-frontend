/** MENTOR-053: recurring weekly mentor availability with exceptions and booking policy. */

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface WeeklyAvailabilityWindow {
  dayOfWeek: Weekday;
  /** Local wall-clock time (HH:mm) in the schedule's time zone. */
  start: string;
  /** Local wall-clock time (HH:mm); must be later than `start`. */
  end: string;
}

export type AvailabilityExceptionKind = 'available' | 'unavailable';

export interface AvailabilityException {
  id: string;
  /** Local calendar date (YYYY-MM-DD) in the schedule's time zone. */
  date: string;
  kind: AvailabilityExceptionKind;
  /** Local wall-clock time; omit the pair to block the whole day. */
  start?: string;
  end?: string;
  reason?: string;
}

export interface RecurringAvailability {
  id: string;
  mentorId: string;
  /** IANA time zone, for example `America/New_York`. */
  timeZone: string;
  windows: WeeklyAvailabilityWindow[];
  exceptions: AvailabilityException[];
  /** Local calendar dates (YYYY-MM-DD). */
  effectiveFrom: string;
  effectiveUntil?: string;
  leadTimeMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  bookingHorizonDays: number;
  version: number;
}

export interface AvailabilitySlot {
  startsAt: string;
  endsAt: string;
}

export interface ExistingBooking {
  id: string;
  startsAt: string;
  endsAt: string;
}

export interface AvailabilityConflict {
  bookingId: string;
  startsAt: string;
  endsAt: string;
}

export type AvailabilityIssueCode =
  | 'INVALID_TIME_ZONE'
  | 'INVALID_WINDOW'
  | 'INVALID_EFFECTIVE_RANGE'
  | 'INVALID_EXCEPTION'
  | 'INVALID_POLICY'
  | 'INVALID_VERSION';

export interface AvailabilityIssue {
  code: AvailabilityIssueCode;
  field: string;
  message: string;
}

export type AvailabilityUpdateErrorCode = AvailabilityIssueCode | 'BOOKING_CONFLICT';

export interface AvailabilityUpdateError {
  code: AvailabilityUpdateErrorCode;
  message: string;
  issues?: AvailabilityIssue[];
  conflicts?: AvailabilityConflict[];
}

export type AvailabilityUpdateResult =
  | { ok: true; schedule: RecurringAvailability; conflicts: AvailabilityConflict[] }
  | { ok: false; error: AvailabilityUpdateError };

export class AvailabilityValidationError extends Error {
  readonly code: AvailabilityIssueCode;
  readonly issues: AvailabilityIssue[];

  constructor(issues: AvailabilityIssue[]) {
    super(issues[0]?.message ?? 'Invalid availability schedule');
    this.name = 'AvailabilityValidationError';
    this.code = issues[0]?.code ?? 'INVALID_WINDOW';
    this.issues = issues;
  }
}

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timeZone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  formatterCache.set(timeZone, formatter);
  return formatter;
}

function readParts(at: Date, timeZone: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const parts = formatterFor(timeZone).formatToParts(at);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? '0');
  return {
    year: pick('year'),
    month: pick('month'),
    day: pick('day'),
    hour: pick('hour'),
    minute: pick('minute'),
    second: pick('second'),
  };
}

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

function parseDate(value: string): { year: number; month: number; day: number } | null {
  const match = DATE_PATTERN.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

function parseTime(value: string): { hour: number; minute: number } | null {
  const match = TIME_PATTERN.exec(value);
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

function dateToUtcMs(value: string): number | null {
  const parts = parseDate(value);
  if (!parts) return null;
  return Date.UTC(parts.year, parts.month - 1, parts.day);
}

function dateFromUtcMs(value: number): string {
  const date = new Date(value);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function timeToMinutes(value: string): number | null {
  const parts = parseTime(value);
  return parts ? parts.hour * 60 + parts.minute : null;
}

export function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone.trim()) return false;
  try {
    formatterFor(timeZone);
    return true;
  } catch {
    return false;
  }
}

export function localDateInTimeZone(at: Date, timeZone: string): string {
  const parts = readParts(at, timeZone);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

function offsetMsAt(timeZone: string, at: Date): number {
  const parts = readParts(at, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - at.getTime();
}

/**
 * Converts a local calendar date and wall-clock time to a UTC instant.
 * Returns null for invalid or non-existent local times (for example the
 * spring-forward gap). Ambiguous fall-back times resolve to the first
 * occurrence, making repeated expansions deterministic.
 */
export function localDateTimeToUtc(
  date: string,
  time: string,
  timeZone: string,
): Date | null {
  if (!isValidTimeZone(timeZone)) return null;
  const day = parseDate(date);
  const clock = parseTime(time);
  if (!day || !clock) return null;

  const target = Date.UTC(day.year, day.month - 1, day.day, clock.hour, clock.minute, 0, 0);
  let candidate = target;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const next = target - offsetMsAt(timeZone, new Date(candidate));
    if (next === candidate) break;
    candidate = next;
  }

  const result = new Date(candidate);
  const local = readParts(result, timeZone);
  const matches =
    local.year === day.year &&
    local.month === day.month &&
    local.day === day.day &&
    local.hour === clock.hour &&
    local.minute === clock.minute;
  return matches ? result : null;
}

export function normalizeWeeklyWindows(
  windows: readonly WeeklyAvailabilityWindow[],
): WeeklyAvailabilityWindow[] {
  const issues: AvailabilityIssue[] = [];
  const parsed = windows.map((window, index) => {
    const start = timeToMinutes(window.start);
    const end = timeToMinutes(window.end);
    if (!Number.isInteger(window.dayOfWeek) || window.dayOfWeek < 0 || window.dayOfWeek > 6) {
      issues.push({
        code: 'INVALID_WINDOW',
        field: `windows[${index}].dayOfWeek`,
        message: 'Choose a weekday between Sunday and Saturday.',
      });
    }
    if (start === null || end === null) {
      issues.push({
        code: 'INVALID_WINDOW',
        field: `windows[${index}]`,
        message: 'Weekly windows need a valid HH:mm start and end.',
      });
    } else if (start >= end) {
      issues.push({
        code: 'INVALID_WINDOW',
        field: `windows[${index}]`,
        message: 'A weekly window must end after it starts.',
      });
    }
    return { window, start: start ?? 0, end: end ?? 0 };
  });
  if (issues.length > 0) throw new AvailabilityValidationError(issues);

  const sorted = [...parsed].sort(
    (a, b) =>
      a.window.dayOfWeek - b.window.dayOfWeek ||
      a.start - b.start ||
      a.end - b.end,
  );

  const merged: WeeklyAvailabilityWindow[] = [];
  for (const entry of sorted) {
    const previous = merged[merged.length - 1];
    const previousEnd = previous ? timeToMinutes(previous.end) : null;
    if (
      previous &&
      previous.dayOfWeek === entry.window.dayOfWeek &&
      previousEnd !== null &&
      entry.start <= previousEnd
    ) {
      const mergedEnd = Math.max(previousEnd, entry.end);
      previous.end = `${pad(Math.floor(mergedEnd / 60))}:${pad(mergedEnd % 60)}`;
      continue;
    }
    merged.push({ ...entry.window });
  }
  return merged;
}

export function validateRecurringAvailability(
  schedule: RecurringAvailability,
): AvailabilityIssue[] {
  const issues: AvailabilityIssue[] = [];

  if (!isValidTimeZone(schedule.timeZone)) {
    issues.push({
      code: 'INVALID_TIME_ZONE',
      field: 'timeZone',
      message: 'Choose a valid IANA time zone.',
    });
  }

  try {
    normalizeWeeklyWindows(schedule.windows);
  } catch (error) {
    if (error instanceof AvailabilityValidationError) issues.push(...error.issues);
  }

  for (const [index, exception] of schedule.exceptions.entries()) {
    if (!parseDate(exception.date)) {
      issues.push({
        code: 'INVALID_EXCEPTION',
        field: `exceptions[${index}].date`,
        message: 'An exception needs a valid calendar date.',
      });
    }
    if (exception.kind !== 'available' && exception.kind !== 'unavailable') {
      issues.push({
        code: 'INVALID_EXCEPTION',
        field: `exceptions[${index}].kind`,
        message: 'An exception must add or remove availability.',
      });
    }
    const hasStart = exception.start !== undefined;
    const hasEnd = exception.end !== undefined;
    if (hasStart !== hasEnd) {
      issues.push({
        code: 'INVALID_EXCEPTION',
        field: `exceptions[${index}]`,
        message: 'An exception needs both a start and end time, or neither.',
      });
    }
    if (hasStart && hasEnd) {
      const start = timeToMinutes(exception.start!);
      const end = timeToMinutes(exception.end!);
      if (start === null || end === null || start >= end) {
        issues.push({
          code: 'INVALID_EXCEPTION',
          field: `exceptions[${index}]`,
          message: 'An exception window must use valid HH:mm times and end after it starts.',
        });
      }
    }
    if (exception.kind === 'available' && !hasStart) {
      issues.push({
        code: 'INVALID_EXCEPTION',
        field: `exceptions[${index}]`,
        message: 'An added availability exception needs a start and end time.',
      });
    }
  }

  const effectiveFrom = dateToUtcMs(schedule.effectiveFrom);
  if (effectiveFrom === null) {
    issues.push({
      code: 'INVALID_EFFECTIVE_RANGE',
      field: 'effectiveFrom',
      message: 'The effective start must be a valid calendar date.',
    });
  }
  if (schedule.effectiveUntil !== undefined) {
    const effectiveUntil = dateToUtcMs(schedule.effectiveUntil);
    if (effectiveUntil === null) {
      issues.push({
        code: 'INVALID_EFFECTIVE_RANGE',
        field: 'effectiveUntil',
        message: 'The effective end must be a valid calendar date.',
      });
    } else if (effectiveFrom !== null && effectiveUntil < effectiveFrom) {
      issues.push({
        code: 'INVALID_EFFECTIVE_RANGE',
        field: 'effectiveUntil',
        message: 'The effective end must be on or after the effective start.',
      });
    }
  }

  const policyFields: Array<[keyof RecurringAvailability, number]> = [
    ['leadTimeMinutes', schedule.leadTimeMinutes],
    ['bufferBeforeMinutes', schedule.bufferBeforeMinutes],
    ['bufferAfterMinutes', schedule.bufferAfterMinutes],
    ['bookingHorizonDays', schedule.bookingHorizonDays],
  ];
  for (const [field, value] of policyFields) {
    if (!Number.isInteger(value) || value < 0) {
      issues.push({
        code: 'INVALID_POLICY',
        field,
        message: `${field} must be a non-negative whole number.`,
      });
    }
  }

  if (!Number.isInteger(schedule.version) || schedule.version < 1) {
    issues.push({
      code: 'INVALID_VERSION',
      field: 'version',
      message: 'The availability version must be a positive whole number.',
    });
  }

  return issues;
}

export function assertValidRecurringAvailability(schedule: RecurringAvailability): void {
  const issues = validateRecurringAvailability(schedule);
  if (issues.length > 0) throw new AvailabilityValidationError(issues);
}

function interval(slot: AvailabilitySlot): { start: number; end: number } {
  return { start: Date.parse(slot.startsAt), end: Date.parse(slot.endsAt) };
}

function subtractInterval(
  slots: AvailabilitySlot[],
  removeStart: number,
  removeEnd: number,
): AvailabilitySlot[] {
  const result: AvailabilitySlot[] = [];
  for (const slot of slots) {
    const { start, end } = interval(slot);
    if (removeEnd <= start || removeStart >= end) {
      result.push(slot);
      continue;
    }
    if (start < removeStart) {
      result.push({ startsAt: new Date(start).toISOString(), endsAt: new Date(removeStart).toISOString() });
    }
    if (end > removeEnd) {
      result.push({ startsAt: new Date(removeEnd).toISOString(), endsAt: new Date(end).toISOString() });
    }
  }
  return result;
}

function normalizeSlots(slots: AvailabilitySlot[]): AvailabilitySlot[] {
  const sorted = slots
    .filter((slot) => {
      const { start, end } = interval(slot);
      return Number.isFinite(start) && Number.isFinite(end) && start < end;
    })
    .sort((a, b) => interval(a).start - interval(b).start || interval(a).end - interval(b).end);

  const merged: AvailabilitySlot[] = [];
  for (const slot of sorted) {
    const { start, end } = interval(slot);
    const previous = merged[merged.length - 1];
    if (previous) {
      const previousInterval = interval(previous);
      if (start <= previousInterval.end) {
        previous.endsAt = new Date(Math.max(previousInterval.end, end)).toISOString();
        continue;
      }
    }
    merged.push({ startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString() });
  }
  return merged;
}

export function expandAvailability(
  schedule: RecurringAvailability,
  rangeStart: Date,
  rangeEnd: Date,
): AvailabilitySlot[] {
  assertValidRecurringAvailability(schedule);
  if (rangeEnd.getTime() <= rangeStart.getTime()) {
    throw new AvailabilityValidationError([
      {
        code: 'INVALID_EFFECTIVE_RANGE',
        field: 'range',
        message: 'The requested range must end after it starts.',
      },
    ]);
  }

  const timeZone = schedule.timeZone;
  const rangeStartDate = localDateInTimeZone(rangeStart, timeZone);
  const rangeEndDate = localDateInTimeZone(rangeEnd, timeZone);
  const effectiveFrom = schedule.effectiveFrom;
  const effectiveUntil = schedule.effectiveUntil ?? rangeEndDate;
  const firstDate = rangeStartDate > effectiveFrom ? rangeStartDate : effectiveFrom;
  const lastDate = rangeEndDate < effectiveUntil ? rangeEndDate : effectiveUntil;
  const firstMs = dateToUtcMs(firstDate);
  const lastMs = dateToUtcMs(lastDate);
  if (firstMs === null || lastMs === null || lastMs < firstMs) return [];

  const weeklyByDay = new Map<Weekday, WeeklyAvailabilityWindow[]>();
  for (const window of normalizeWeeklyWindows(schedule.windows)) {
    const existing = weeklyByDay.get(window.dayOfWeek) ?? [];
    existing.push(window);
    weeklyByDay.set(window.dayOfWeek, existing);
  }

  const exceptionsByDate = new Map<string, AvailabilityException[]>();
  for (const exception of schedule.exceptions) {
    const existing = exceptionsByDate.get(exception.date) ?? [];
    existing.push(exception);
    exceptionsByDate.set(exception.date, existing);
  }

  const allSlots: AvailabilitySlot[] = [];
  const rangeStartMs = rangeStart.getTime();
  const rangeEndMs = rangeEnd.getTime();

  for (let cursor = firstMs; cursor <= lastMs; cursor += DAY_MS) {
    const date = dateFromUtcMs(cursor);
    const dayOfWeek = new Date(cursor).getUTCDay() as Weekday;
    let slots: AvailabilitySlot[] = [];

    for (const window of weeklyByDay.get(dayOfWeek) ?? []) {
      const start = localDateTimeToUtc(date, window.start, timeZone);
      const end = localDateTimeToUtc(date, window.end, timeZone);
      if (start && end && start.getTime() < end.getTime()) {
        slots.push({ startsAt: start.toISOString(), endsAt: end.toISOString() });
      }
    }

    const exceptions = exceptionsByDate.get(date) ?? [];
    for (const exception of exceptions) {
      if (exception.kind !== 'available' || !exception.start || !exception.end) continue;
      const start = localDateTimeToUtc(date, exception.start, timeZone);
      const end = localDateTimeToUtc(date, exception.end, timeZone);
      if (start && end && start.getTime() < end.getTime()) {
        slots.push({ startsAt: start.toISOString(), endsAt: end.toISOString() });
      }
    }

    for (const exception of exceptions) {
      if (exception.kind !== 'unavailable') continue;
      if (!exception.start || !exception.end) {
        slots = [];
        continue;
      }
      const start = localDateTimeToUtc(date, exception.start, timeZone);
      const end = localDateTimeToUtc(date, exception.end, timeZone);
      if (start && end && start.getTime() < end.getTime()) {
        slots = subtractInterval(slots, start.getTime(), end.getTime());
      }
    }

    for (const slot of slots) {
      const { start, end } = interval(slot);
      const clippedStart = Math.max(start, rangeStartMs);
      const clippedEnd = Math.min(end, rangeEndMs);
      if (clippedStart < clippedEnd) {
        allSlots.push({
          startsAt: new Date(clippedStart).toISOString(),
          endsAt: new Date(clippedEnd).toISOString(),
        });
      }
    }
  }

  return normalizeSlots(allSlots);
}

export function applyBookingPolicy(
  schedule: RecurringAvailability,
  slots: readonly AvailabilitySlot[],
  now: Date = new Date(),
): AvailabilitySlot[] {
  assertValidRecurringAvailability(schedule);
  const earliest = now.getTime() + schedule.leadTimeMinutes * MINUTE_MS;
  const latest = now.getTime() + schedule.bookingHorizonDays * DAY_MS;
  const bufferBefore = schedule.bufferBeforeMinutes * MINUTE_MS;
  const bufferAfter = schedule.bufferAfterMinutes * MINUTE_MS;

  return slots
    .map((slot) => {
      const { start, end } = interval(slot);
      const nextStart = Math.max(start, earliest) + bufferBefore;
      const nextEnd = Math.min(end, latest) - bufferAfter;
      return nextStart < nextEnd
        ? { startsAt: new Date(nextStart).toISOString(), endsAt: new Date(nextEnd).toISOString() }
        : null;
    })
    .filter((slot): slot is AvailabilitySlot => slot !== null);
}

export function findBookingConflicts(
  schedule: RecurringAvailability,
  bookings: readonly ExistingBooking[],
): AvailabilityConflict[] {
  assertValidRecurringAvailability(schedule);
  return bookings
    .filter((booking) => {
      const start = Date.parse(booking.startsAt);
      const end = Date.parse(booking.endsAt);
      if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) return true;
      const slots = expandAvailability(schedule, new Date(start), new Date(end));
      return !slots.some((slot) => {
        const candidate = interval(slot);
        return candidate.start <= start && candidate.end >= end;
      });
    })
    .map((booking) => ({
      bookingId: booking.id,
      startsAt: booking.startsAt,
      endsAt: booking.endsAt,
    }))
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.bookingId.localeCompare(b.bookingId));
}

export interface UpdateRecurringAvailabilityInput {
  current: RecurringAvailability;
  next: RecurringAvailability;
  bookings?: readonly ExistingBooking[];
  acknowledgeConflicts?: boolean;
}

export function updateRecurringAvailability(
  input: UpdateRecurringAvailabilityInput,
): AvailabilityUpdateResult {
  const issues = validateRecurringAvailability(input.next);
  if (issues.length > 0) {
    return {
      ok: false,
      error: {
        code: issues[0].code,
        message: issues[0].message,
        issues,
      },
    };
  }

  if (input.next.version <= input.current.version) {
    return {
      ok: false,
      error: {
        code: 'INVALID_VERSION',
        message: 'The new availability version must be greater than the current version.',
      },
    };
  }

  const conflicts = findBookingConflicts(input.next, input.bookings ?? []);
  if (conflicts.length > 0 && !input.acknowledgeConflicts) {
    return {
      ok: false,
      error: {
        code: 'BOOKING_CONFLICT',
        message: 'Existing bookings fall outside the new availability. Confirm before saving.',
        conflicts,
      },
    };
  }

  return { ok: true, schedule: input.next, conflicts };
}
