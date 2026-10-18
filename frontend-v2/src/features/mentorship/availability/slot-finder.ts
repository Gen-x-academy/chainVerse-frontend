/** MENTOR-055: find mutually available mentorship session slots. */

export type SlotWeekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface ParticipantAvailabilityWindow {
  dayOfWeek: SlotWeekday;
  /** Local wall-clock start (HH:mm) in the participant's time zone. */
  start: string;
  /** Local wall-clock end (HH:mm) in the participant's time zone. */
  end: string;
}

export interface TimeRange {
  startsAt: string;
  endsAt: string;
}

export interface ParticipantAvailability {
  participantId: string;
  timeZone: string;
  windows: readonly ParticipantAvailabilityWindow[];
  blackoutPeriods?: readonly TimeRange[];
}

export type SlotSearchRole = 'mentor' | 'mentee' | 'coordinator' | 'administrator';

export interface SlotSearchActor {
  userId: string;
  role: SlotSearchRole;
  tenantId: string;
}

export interface ProgramSlotRules {
  programId: string;
  tenantId: string;
  mentorId: string;
  menteeId: string;
  participantIds: readonly string[];
  durationMinutes: number;
  leadTimeMinutes?: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  capacity: number;
  slotGranularityMinutes?: number;
}

export interface SessionSlotCandidate {
  startsAt: string;
  endsAt: string;
  availableCapacity: number;
}

export interface SlotSearchPage {
  slots: SessionSlotCandidate[];
  nextCursor?: string;
  total: number;
}

export type SlotSearchErrorCode =
  | 'NOT_AUTHORIZED'
  | 'INVALID_SEARCH'
  | 'INVALID_WINDOW'
  | 'INVALID_TIME_ZONE'
  | 'INVALID_PAGE'
  | 'SLOT_STALE'
  | 'CAPACITY_EXCEEDED';

export interface SlotSearchIssue {
  field: string;
  message: string;
}

export interface SlotSearchError {
  code: SlotSearchErrorCode;
  message: string;
  status: number;
  issues?: SlotSearchIssue[];
}

export type SlotSearchResult =
  | { ok: true; page: SlotSearchPage }
  | { ok: false; error: SlotSearchError };

export type SlotRevalidationResult =
  | { ok: true; slot: SessionSlotCandidate }
  | { ok: false; error: SlotSearchError };

export interface SlotSearchInput {
  program: ProgramSlotRules;
  participants: readonly ParticipantAvailability[];
  bookings?: readonly TimeRange[];
  blackouts?: readonly TimeRange[];
  actor: SlotSearchActor;
  rangeStart: Date;
  rangeEnd: Date;
  now?: Date;
  cursor?: string;
  limit?: number;
}

export interface RevalidateSlotInput extends Omit<SlotSearchInput, 'cursor' | 'limit'> {
  candidate: SessionSlotCandidate;
}

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;
const MAX_SEARCH_DAYS = 90;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const formatterCache = new Map<string, Intl.DateTimeFormat>();

const ERROR_MESSAGES: Record<SlotSearchErrorCode, string> = {
  NOT_AUTHORIZED: 'Only participants in this program can search for session slots.',
  INVALID_SEARCH: 'The slot search is invalid. Check the program duration and range.',
  INVALID_WINDOW: 'An availability window is invalid.',
  INVALID_TIME_ZONE: 'An availability time zone is invalid.',
  INVALID_PAGE: 'The requested result page is invalid.',
  SLOT_STALE: 'This slot is no longer available. Search again.',
  CAPACITY_EXCEEDED: 'This slot has no capacity left.',
};

const ERROR_STATUS: Record<SlotSearchErrorCode, number> = {
  NOT_AUTHORIZED: 403,
  INVALID_SEARCH: 422,
  INVALID_WINDOW: 422,
  INVALID_TIME_ZONE: 422,
  INVALID_PAGE: 400,
  SLOT_STALE: 410,
  CAPACITY_EXCEEDED: 409,
};

function slotError(
  code: SlotSearchErrorCode,
  issues?: SlotSearchIssue[],
): SlotSearchError {
  return { code, message: ERROR_MESSAGES[code], status: ERROR_STATUS[code], issues };
}

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

function readParts(at: Date, timeZone: string) {
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

function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone.trim()) return false;
  try {
    formatterFor(timeZone);
    return true;
  } catch {
    return false;
  }
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
  return parts ? Date.UTC(parts.year, parts.month - 1, parts.day) : null;
}

function dateFromUtcMs(value: number): string {
  const date = new Date(value);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function localDate(at: Date, timeZone: string): string {
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

export function localWallClockToUtc(
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

interface Interval {
  start: number;
  end: number;
}

function mergeIntervals(intervals: readonly Interval[]): Interval[] {
  const sorted = intervals
    .filter((interval) => Number.isFinite(interval.start) && Number.isFinite(interval.end) && interval.start < interval.end)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: Interval[] = [];
  for (const interval of sorted) {
    const previous = merged[merged.length - 1];
    if (previous && interval.start <= previous.end) {
      previous.end = Math.max(previous.end, interval.end);
    } else {
      merged.push({ ...interval });
    }
  }
  return merged;
}

function subtractIntervals(intervals: readonly Interval[], blockers: readonly Interval[]): Interval[] {
  let result = [...intervals];
  for (const blocker of mergeIntervals(blockers)) {
    const next: Interval[] = [];
    for (const interval of result) {
      if (blocker.end <= interval.start || blocker.start >= interval.end) {
        next.push(interval);
        continue;
      }
      if (interval.start < blocker.start) next.push({ start: interval.start, end: blocker.start });
      if (interval.end > blocker.end) next.push({ start: blocker.end, end: interval.end });
    }
    result = next;
  }
  return mergeIntervals(result);
}

function intersectIntervals(left: readonly Interval[], right: readonly Interval[]): Interval[] {
  const result: Interval[] = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    const start = Math.max(left[i].start, right[j].start);
    const end = Math.min(left[i].end, right[j].end);
    if (start < end) result.push({ start, end });
    if (left[i].end < right[j].end) i += 1;
    else j += 1;
  }
  return result;
}

function toIntervals(ranges: readonly TimeRange[]): Interval[] {
  return mergeIntervals(
    ranges.map((range) => ({ start: Date.parse(range.startsAt), end: Date.parse(range.endsAt) })),
  );
}

export function canSearchSessionSlots(
  program: ProgramSlotRules,
  actor: SlotSearchActor,
): boolean {
  if (program.tenantId !== actor.tenantId) return false;
  if (actor.role === 'coordinator' || actor.role === 'administrator') return true;
  return program.participantIds.includes(actor.userId);
}

function validateInput(input: SlotSearchInput): SlotSearchIssue[] {
  const issues: SlotSearchIssue[] = [];
  const { program } = input;

  if (!canSearchSessionSlots(program, input.actor)) {
    return issues;
  }
  if (!Number.isInteger(program.durationMinutes) || program.durationMinutes <= 0) {
    issues.push({ field: 'durationMinutes', message: 'Session duration must be a positive whole number.' });
  }
  if (!Number.isInteger(program.capacity) || program.capacity <= 0) {
    issues.push({ field: 'capacity', message: 'Capacity must be a positive whole number.' });
  }
  if (!Number.isInteger(program.bufferBeforeMinutes) || program.bufferBeforeMinutes < 0) {
    issues.push({ field: 'bufferBeforeMinutes', message: 'The pre-session buffer cannot be negative.' });
  }
  if (!Number.isInteger(program.bufferAfterMinutes) || program.bufferAfterMinutes < 0) {
    issues.push({ field: 'bufferAfterMinutes', message: 'The post-session buffer cannot be negative.' });
  }
  if (program.leadTimeMinutes !== undefined && (!Number.isInteger(program.leadTimeMinutes) || program.leadTimeMinutes < 0)) {
    issues.push({ field: 'leadTimeMinutes', message: 'Lead time cannot be negative.' });
  }
  if (program.slotGranularityMinutes !== undefined && (!Number.isInteger(program.slotGranularityMinutes) || program.slotGranularityMinutes <= 0)) {
    issues.push({ field: 'slotGranularityMinutes', message: 'Slot granularity must be a positive whole number.' });
  }

  if (!(input.rangeEnd.getTime() > input.rangeStart.getTime())) {
    issues.push({ field: 'range', message: 'The search range must end after it starts.' });
  } else if (input.rangeEnd.getTime() - input.rangeStart.getTime() > MAX_SEARCH_DAYS * DAY_MS) {
    issues.push({ field: 'range', message: `Search at most ${MAX_SEARCH_DAYS} days at a time.` });
  }

  const participantIds = new Set(input.participants.map((participant) => participant.participantId));
  for (const participantId of program.participantIds) {
    if (!participantIds.has(participantId)) {
      issues.push({ field: 'participants', message: `Missing availability for participant ${participantId}.` });
    }
  }

  for (const participant of input.participants) {
    if (!isValidTimeZone(participant.timeZone)) {
      issues.push({ field: `participants.${participant.participantId}.timeZone`, message: 'Choose a valid IANA time zone.' });
    }
    for (const [index, window] of participant.windows.entries()) {
      if (!Number.isInteger(window.dayOfWeek) || window.dayOfWeek < 0 || window.dayOfWeek > 6) {
        issues.push({ field: `participants.${participant.participantId}.windows[${index}]`, message: 'Choose a SlotWeekday between Sunday and Saturday.' });
      }
      const start = parseTime(window.start);
      const end = parseTime(window.end);
      if (!start || !end || start.hour * 60 + start.minute >= end.hour * 60 + end.minute) {
        issues.push({ field: `participants.${participant.participantId}.windows[${index}]`, message: 'A window must use valid HH:mm times and end after it starts.' });
      }
    }
  }

  const limit = input.limit ?? DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    issues.push({ field: 'limit', message: `Page size must be between 1 and ${MAX_LIMIT}.` });
  }

  return issues;
}

function expandParticipant(
  participant: ParticipantAvailability,
  rangeStart: Date,
  rangeEnd: Date,
): Interval[] {
  const timeZone = participant.timeZone;
  const first = localDate(rangeStart, timeZone);
  const last = localDate(rangeEnd, timeZone);
  const firstMs = dateToUtcMs(first);
  const lastMs = dateToUtcMs(last);
  if (firstMs === null || lastMs === null || lastMs < firstMs) return [];

  const windowsByDay = new Map<SlotWeekday, ParticipantAvailabilityWindow[]>();
  for (const window of participant.windows) {
    const existing = windowsByDay.get(window.dayOfWeek) ?? [];
    existing.push(window);
    windowsByDay.set(window.dayOfWeek, existing);
  }

  const intervals: Interval[] = [];
  for (let cursor = firstMs; cursor <= lastMs; cursor += DAY_MS) {
    const date = dateFromUtcMs(cursor);
    const dayOfWeek = new Date(cursor).getUTCDay() as SlotWeekday;
    for (const window of windowsByDay.get(dayOfWeek) ?? []) {
      const start = localWallClockToUtc(date, window.start, timeZone);
      const end = localWallClockToUtc(date, window.end, timeZone);
      if (!start || !end || start.getTime() >= end.getTime()) continue;
      const clippedStart = Math.max(start.getTime(), rangeStart.getTime());
      const clippedEnd = Math.min(end.getTime(), rangeEnd.getTime());
      if (clippedStart < clippedEnd) intervals.push({ start: clippedStart, end: clippedEnd });
    }
  }

  return subtractIntervals(
    mergeIntervals(intervals),
    toIntervals(participant.blackoutPeriods ?? []),
  );
}

function candidateSlots(
  input: SlotSearchInput,
  intervals: readonly Interval[],
  nowMs: number,
): SessionSlotCandidate[] {
  const { program } = input;
  const durationMs = program.durationMinutes * MINUTE_MS;
  const granularityMs = (program.slotGranularityMinutes ?? 15) * MINUTE_MS;
  const bufferBeforeMs = program.bufferBeforeMinutes * MINUTE_MS;
  const bufferAfterMs = program.bufferAfterMinutes * MINUTE_MS;
  const leadMs = (program.leadTimeMinutes ?? 0) * MINUTE_MS;
  const bookings = (input.bookings ?? [])
    .map((booking) => ({ start: Date.parse(booking.startsAt), end: Date.parse(booking.endsAt) }))
    .filter((booking) => Number.isFinite(booking.start) && Number.isFinite(booking.end) && booking.start < booking.end);
  const earliest = nowMs + leadMs;
  const seen = new Set<number>();
  const slots: SessionSlotCandidate[] = [];

  for (const interval of intervals) {
    for (let start = interval.start; start + durationMs <= interval.end; start += granularityMs) {
      if (start < earliest) continue;
      if (seen.has(start)) continue;
      seen.add(start);

      const end = start + durationMs;
      const blockStart = start - bufferBeforeMs;
      const blockEnd = end + bufferAfterMs;
      const overlapping = bookings.filter(
        (booking) => booking.start < blockEnd && booking.end > blockStart,
      ).length;
      if (overlapping >= program.capacity) continue;

      slots.push({
        startsAt: new Date(start).toISOString(),
        endsAt: new Date(end).toISOString(),
        availableCapacity: program.capacity - overlapping,
      });
    }
  }

  return slots.sort(
    (a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || Date.parse(a.endsAt) - Date.parse(b.endsAt),
  );
}

export function findMutualSessionSlots(input: SlotSearchInput): SlotSearchResult {
  if (!canSearchSessionSlots(input.program, input.actor)) {
    return { ok: false, error: slotError('NOT_AUTHORIZED') };
  }

  const issues = validateInput(input);
  if (issues.length > 0) {
    const code = issues.some((issue) => issue.field.includes('timeZone'))
      ? 'INVALID_TIME_ZONE'
      : issues.some((issue) => issue.field.includes('windows'))
        ? 'INVALID_WINDOW'
        : issues.some((issue) => issue.field === 'limit' || issue.field === 'cursor')
          ? 'INVALID_PAGE'
          : 'INVALID_SEARCH';
    return { ok: false, error: slotError(code, issues) };
  }

  const nowMs = (input.now ?? new Date()).getTime();
  const programBlockers = toIntervals(input.blackouts ?? []);

  let mutual: Interval[] | null = null;
  for (const participantId of input.program.participantIds) {
    const participant = input.participants.find(
      (candidate) => candidate.participantId === participantId,
    );
    if (!participant) continue;
    let intervals = expandParticipant(participant, input.rangeStart, input.rangeEnd);
    intervals = subtractIntervals(intervals, programBlockers);
    mutual = mutual === null ? intervals : intersectIntervals(mutual, intervals);
  }

  const slots = mutual === null ? [] : candidateSlots(input, mutual, nowMs);
  const limit = input.limit ?? DEFAULT_LIMIT;
  let startIndex = 0;
  if (input.cursor) {
    const index = slots.findIndex((slot) => slot.startsAt === input.cursor);
    if (index === -1) {
      return { ok: false, error: slotError('INVALID_PAGE') };
    }
    startIndex = index + 1;
  }

  const pageSlots = slots.slice(startIndex, startIndex + limit);
  const nextCursor =
    startIndex + limit < slots.length ? pageSlots[pageSlots.length - 1]?.startsAt : undefined;

  return { ok: true, page: { slots: pageSlots, nextCursor, total: slots.length } };
}

export function revalidateSessionSlot(input: RevalidateSlotInput): SlotRevalidationResult {
  if (!canSearchSessionSlots(input.program, input.actor)) {
    return { ok: false, error: slotError('NOT_AUTHORIZED') };
  }

  const now = input.now ?? new Date();
  const startsAt = Date.parse(input.candidate.startsAt);
  const endsAt = Date.parse(input.candidate.endsAt);
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || startsAt >= endsAt || endsAt <= now.getTime()) {
    return { ok: false, error: slotError('SLOT_STALE') };
  }

  const result = findMutualSessionSlots({
    ...input,
    rangeStart: new Date(startsAt),
    rangeEnd: new Date(endsAt),
    now,
    limit: MAX_LIMIT,
  });
  if (!result.ok) return { ok: false, error: result.error };

  const match = result.page.slots.find(
    (slot) => slot.startsAt === input.candidate.startsAt && slot.endsAt === input.candidate.endsAt,
  );
  if (!match) return { ok: false, error: slotError('SLOT_STALE') };
  if (match.availableCapacity <= 0) {
    return { ok: false, error: slotError('CAPACITY_EXCEEDED') };
  }
  return { ok: true, slot: match };
}
