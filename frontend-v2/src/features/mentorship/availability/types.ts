/**
 * Mentor availability for issue MENTOR-013.
 */

/** Availability states a mentor can be in. */
export type MentorAvailabilityStatus =
  | 'accepting_requests'
  | 'limited_availability'
  | 'waitlist_only'
  | 'temporarily_unavailable'
  | 'inactive';

export interface MentorAvailability {
  /** Relational key used by the API; never exposed in public endpoints. */
  internalId: string;
  /** Stable, collision-resistant identifier that is safe to expose. */
  publicId: string;
  /** Correlation identifier used to group retries and event logs. */
  correlationId: string;
  status: MentorAvailabilityStatus;
  /** ISO 8601 date from which this status takes effect. */
  effectiveFrom: string;
  /** ISO 8601 date until which this status stays in force. */
  effectiveUntil?: string;
  updatedBy: string;
  updatedAt: string;
}

export interface MentorAvailabilityUpdate {
  status: MentorAvailabilityStatus;
  effectiveFrom: string;
  effectiveUntil?: string;
  reason?: string;
}
