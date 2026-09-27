/**
 * Deadline and action reminders (issue #1141).
 *
 * Reminders are scheduled against a recipient's own IANA timezone, deferred out
 * of quiet hours, deduplicated by a stable key, and cancelled the moment the
 * thing they remind about is finished. Every helper takes the current instant as
 * an argument: nothing here reads the wall clock.
 */

import { apiClient } from '@/src/lib/api-client';
import type {
  BuildScheduleInput,
  ReminderKind,
  ReminderSchedule,
  NotificationSubject,
  SchedulingPolicy,
  SchedulingResult,
} from './types';

/** IANA zones offered in the UI. Any valid IANA zone is accepted by the helpers. */
export const SUPPORTED_TIMEZONES: readonly string[] = [
  'UTC',
  'Africa/Lagos',
  'America/Chicago',
  'America/Los_Angeles',
  'America/New_York',
  'America/Sao_Paulo',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Europe/Berlin',
  'Europe/London',
  'Europe/Nairobi',
];

/** The timezone used when a policy does not respect the recipient's zone. */
export const SCHEDULER_TIMEZONE = 'UTC';

const DEFAULT_OFFSETS: Record<ReminderKind, number[]> = {
  'incomplete-application': [72, 24, 2],
  'pending-review': [48, 4],
  'award-acceptance': [72, 24, 1],
  'missing-evidence': [48, 12, 1],
  'payout-setup': [24, 4],
};

const KIND_LABELS: Record<ReminderKind, string> = {
  'incomplete-application': 'Incomplete application',
  'pending-review': 'Pending review',
  'award-acceptance': 'Award acceptance',
  'missing-evidence': 'Missing evidence',
  'payout-setup': 'Payout setup',
};

export function reminderKindLabel(kind: ReminderKind): string {
  return KIND_LABELS[kind];
}

export function schedulingPolicy(kind: ReminderKind, overrides?: Partial<SchedulingPolicy>): SchedulingPolicy {
  return {
    offsetsHours: [...DEFAULT_OFFSETS[kind]],
    quietHours: undefined,
    respectRecipientTimezone: true,
    ...overrides,
  };
}

function toMinutes(value: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return Number.NaN;
  return Number(match[1]) * 60 + Number(match[2]);
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function isValidTimeOfDay(value: string): boolean {
  const minutes = toMinutes(value);
  return !Number.isNaN(minutes) && minutes >= 0 && minutes < 24 * 60;
}

function zonedParts(instant: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts: Record<string, string> = {};
  for (const part of formatter.formatToParts(instant)) {
    if (part.type !== 'literal') parts[part.type] = part.value;
  }
  const hour = parts.hour === '24' ? '00' : parts.hour;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${hour}:${parts.minute}`,
  };
}

/** `HH:MM` wall-clock time of an instant in an explicit IANA zone. */
export function localTimeInZone(instant: Date, timezone: string): string {
  return zonedParts(instant, timezone).time;
}

/** `YYYY-MM-DD` calendar date of an instant in an explicit IANA zone. */
export function localDateInZone(instant: Date, timezone: string): string {
  return zonedParts(instant, timezone).date;
}

/** `YYYY-MM-DDTHH:MM`, the local time string a schedule carries. */
export function localDateTimeInZone(instant: Date, timezone: string): string {
  const { date, time } = zonedParts(instant, timezone);
  return `${date}T${time}`;
}

function nextLocalDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

/**
 * True when a local `HH:MM` falls inside the quiet window, including a window
 * that wraps past midnight (22:00 -> 07:00).
 */
export function isWithinQuietHours(localTime: string, quietHours?: QuietHours): boolean {
  if (!quietHours) return false;
  const start = toMinutes(quietHours.startLocalTime);
  const end = toMinutes(quietHours.endLocalTime);
  const current = toMinutes(localTime);
  if (Number.isNaN(start) || Number.isNaN(end) || Number.isNaN(current)) return false;
  if (start === end) return false;
  if (start < end) return current >= start && current < end;
  return current >= start || current < end;
}

/**
 * The local time string at which a quiet window closes. For a window that wraps
 * past midnight, a `localDate` of `'2026-05-04T02:00'` resolves to
 * `'2026-05-04T07:00'` while `'2026-05-04T23:00'` resolves to the following day.
 */
export function nextQuietHoursEnd(localDate: string, quietHours: QuietHours): string {
  const [datePart = '', timePart = ''] = localDate.split('T');
  const start = toMinutes(quietHours.startLocalTime);
  const end = toMinutes(quietHours.endLocalTime);
  const current = toMinutes(timePart);
  if (Number.isNaN(end)) return localDate;

  const endTime = `${pad(Math.floor(end / 60))}:${pad(end % 60)}`;
  if (Number.isNaN(start) || start === end || start < end) return `${datePart}T${endTime}`;
  // Wrapping window: before the end time we are still in tonight's quiet period.
  return current < end ? `${datePart}T${endTime}` : `${nextLocalDate(datePart)}T${endTime}`;
}

export function dedupeKeyFor(
  kind: ReminderKind,
  subject: NotificationSubject,
  scheduledForLocal: string
): string {
  return `reminder:${kind}:${subject.kind}:${subject.id}:${scheduledForLocal}`;
}

function baseSchedule(
  kind: ReminderKind,
  subject: NotificationSubject,
  input: BuildScheduleInput,
  timezone: string,
  scheduledForLocal: string
): ReminderSchedule {
  return {
    id: `rem-${kind}-${subject.kind}-${subject.id}-${scheduledForLocal}`,
    kind,
    subject,
    programId: input.programId,
    channel: input.channel ?? 'in-app',
    status: 'scheduled',
    timezone,
    scheduledForLocal,
    dedupeKey: dedupeKeyFor(kind, subject, scheduledForLocal),
    attempts: 0,
    subjectCompletedAt: input.subjectCompletedAt,
  };
}

function describe(
  instant: Date,
  kind: ReminderKind,
  subject: NotificationSubject,
  input: BuildScheduleInput,
  timezone: string
): SchedulingResult {
  const scheduledForLocal = localDateTimeInZone(instant, timezone);
  const dedupeKey = dedupeKeyFor(kind, subject, scheduledForLocal);

  const completed = input.subjectCompletedAt
    ? Date.parse(input.subjectCompletedAt)
    : Number.NaN;
  if (!Number.isNaN(completed) && completed <= instant.getTime()) {
    return {
      status: 'cancelled-subject-complete',
      schedule: {
        ...baseSchedule(kind, subject, input, timezone, scheduledForLocal),
        status: 'cancelled',
        cancelledAt: new Date(completed).toISOString(),
        cancelledReason: 'The subject was completed before this reminder was due.',
      },
      detail: `Cancelled: ${KIND_LABELS[kind]} is no longer outstanding.`,
    };
  }

  const existing = (input.existing ?? []).find((schedule) => schedule.dedupeKey === dedupeKey);
  if (existing) {
    return {
      status: 'duplicate-suppressed',
      schedule: existing,
      detail: `Suppressed: a reminder for ${scheduledForLocal} (${timezone}) already exists.`,
    };
  }

  const quietHours = input.policy.quietHours;
  if (isWithinQuietHours(scheduledForLocal.split('T')[1] ?? '', quietHours)) {
    const deliverAfterLocal = nextQuietHoursEnd(scheduledForLocal, quietHours as QuietHours);
    return {
      status: 'deferred-to-quiet-hours-end',
      schedule: {
        ...baseSchedule(kind, subject, input, timezone, scheduledForLocal),
        deliverAfterLocal,
      },
      detail: `Deferred: ${scheduledForLocal} (${timezone}) is inside quiet hours ${quietHours?.startLocalTime}-${quietHours?.endLocalTime}, so it delivers at ${deliverAfterLocal}.`,
    };
  }

  return {
    status: 'scheduled',
    schedule: baseSchedule(kind, subject, input, timezone, scheduledForLocal),
    detail: `Scheduled for ${scheduledForLocal} (${timezone}).`,
  };
}

/** Offsets are counted in hours before "now"; each one becomes an occurrence. */
function offsetInstants(now: Date, offsetsHours: number[]): Date[] {
  return [...offsetsHours]
    .sort((a, b) => a - b)
    .map((hours) => new Date(now.getTime() + hours * 3600 * 1000));
}

function effectiveTimezone(input: BuildScheduleInput): string {
  return input.policy.respectRecipientTimezone ? input.timezone : SCHEDULER_TIMEZONE;
}

/**
 * Builds the next applicable reminder. Nothing to fire, an already-handled
 * subject, and a duplicate are all reported rather than thrown.
 */
export function buildSchedule(
  kind: ReminderKind,
  subject: NotificationSubject,
  input: BuildScheduleInput
): SchedulingResult {
  const timezone = effectiveTimezone(input);
  const instants = offsetInstants(input.now, input.policy.offsetsHours).filter(
    (instant) => instant.getTime() > input.now.getTime()
  );

  if (instants.length === 0) {
    const scheduledForLocal = localDateTimeInZone(input.now, timezone);
    return {
      status: 'no-offset-applicable',
      schedule: {
        ...baseSchedule(kind, subject, input, timezone, scheduledForLocal),
        status: 'cancelled',
        cancelledAt: input.now.toISOString(),
        cancelledReason: 'No policy offset falls after the current time.',
      },
      detail: 'No policy offset applies from the current time onwards.',
    };
  }

  return describe(instants[0], kind, subject, input, timezone);
}

/** One result per policy offset, so an operator can see the whole ladder. */
export function previewSchedule(
  kind: ReminderKind,
  subject: NotificationSubject,
  input: BuildScheduleInput
): SchedulingResult[] {
  const timezone = effectiveTimezone(input);
  return offsetInstants(input.now, input.policy.offsetsHours)
    .filter((instant) => instant.getTime() > input.now.getTime())
    .map((instant) => describe(instant, kind, subject, input, timezone));
}

export function cancelSchedule(
  schedule: ReminderSchedule,
  reason: string,
  now: Date = new Date()
): ReminderSchedule {
  return {
    ...schedule,
    status: 'cancelled',
    cancelledAt: now.toISOString(),
    cancelledReason: reason,
  };
}

export const reminderService = {
  list: (): Promise<ReminderSchedule[]> => apiClient.get<ReminderSchedule[]>('/scholarships/reminders'),

  preview: (payload: {
    kind: ReminderKind;
    timezone: string;
    policy: SchedulingPolicy;
    subject: NotificationSubject;
    idempotencyKey: string;
  }): Promise<SchedulingResult[]> =>
    apiClient.post<SchedulingResult[]>('/scholarships/reminders/preview', payload),

  cancel: (payload: {
    scheduleId: string;
    reason: string;
    expectedAttempts: number;
    idempotencyKey: string;
  }): Promise<ReminderSchedule> =>
    apiClient.post<ReminderSchedule>(
      `/scholarships/reminders/${encodeURIComponent(payload.scheduleId)}/cancel`,
      payload
    ),
};
