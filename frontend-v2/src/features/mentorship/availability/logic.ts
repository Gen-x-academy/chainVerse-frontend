/**
 * Pure availability rules for issue MENTOR-013.
 *
 * The current status is derived from the effective windows: the record with
 * the greatest `effectiveFrom` that has already started and has not ended is
 * current. When no window covers `now`, the mentor has no active
 * availability.
 */

import type { MentorAvailability, MentorAvailabilityStatus } from './types';

const INACTIVE: MentorAvailabilityStatus = 'inactive';

/** Returns true when the window started on or before `now`. */
function hasStarted(availability: MentorAvailability, now: number): boolean {
  const startsAt = Date.parse(availability.effectiveFrom);
  return !Number.isNaN(startsAt) && startsAt <= now;
}

/** Returns true when the window ends strictly before `now`. */
function hasEnded(availability: MentorAvailability, now: number): boolean {
  if (!availability.effectiveUntil) return false;
  const endsAt = Date.parse(availability.effectiveUntil);
  return !Number.isNaN(endsAt) && endsAt <= now;
}

/**
 * Resolves the status that applies at `now`.
 *
 * Records are compared by the start of their effective window, so out-of-order
 * entries still resolve to the latest active window.
 */
export function resolveAvailabilityStatus(
  availabilities: MentorAvailability[],
  now: Date = new Date()
): MentorAvailabilityStatus {
  const nowMs = now.getTime();
  let current: MentorAvailability | null = null;
  for (const availability of availabilities) {
    if (!hasStarted(availability, nowMs)) continue;
    if (hasEnded(availability, nowMs)) continue;
    const startsAt = Date.parse(availability.effectiveFrom);
    if (current === null || startsAt > Date.parse(current.effectiveFrom)) {
      current = availability;
    }
  }
  return current === null ? INACTIVE : current.status;
}

/** Lists the distinct statuses, useful for badges and filters. */
export function availabilityStatuses(): MentorAvailabilityStatus[] {
  return [
    'accepting_requests',
    'limited_availability',
    'waitlist_only',
    'temporarily_unavailable',
    'inactive',
  ];
}
