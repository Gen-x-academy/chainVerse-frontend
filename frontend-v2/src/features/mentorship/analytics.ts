/**
 * Analytics events for the mentorship subdomains.
 *
 * Events never carry personal data: the actor is an opaque key, the same fact
 * produces the same dedupe key on retries, and the envelope is a closed
 * shape. Failed deliveries are swallowed so analytics can never break a user
 * flow.
 */

import { apiClient } from '@/src/lib/api-client';

/** Analytics stages emitted by the mentorship subdomains. */
export type MentorshipAnalyticsStage =
  | 'engagement_lifecycle'
  | 'mentor_availability'
  | 'credential_verification'
  | 'trust_indicators'
  | 'organization_programs'
  | 'calendar_sync'
  | 'agreement_export'
  | 'session_slot_search'
  | 'session_workspace';
  | 'session_agenda';
  | 'attendance';
  | 'session_booking'
  | 'session_reschedule'
  | 'session_cancellation'
  | 'session_no_show';
  | 'private_note';

export interface MentorshipAnalyticsEvent {
  stage: MentorshipAnalyticsStage;
  entityId: string;
  occurredAt: string;
  /** Opaque actor key; never a user id, email, or name. */
  actorKey: string;
  /** Same fact produces the same key, so retries are counted once. */
  dedupeKey: string;
}

/** Small deterministic hash (djb2); keeps dedupe keys stable across retries. */
function hash(input: string): string {
  let value = 5381;
  for (let index = 0; index < input.length; index += 1) {
    value = (value * 33) ^ input.charCodeAt(index);
  }
  return (value >>> 0).toString(36);
}

/**
 * Builds a single analytics event.
 *
 * The dedupe key is derived from the stage, the entity, and the UTC day, so
 * the same fact retried within a day is counted once.
 */
export function buildMentorshipEvent(
  stage: MentorshipAnalyticsStage,
  entityId: string,
  actorKey: string,
  occurredAt: Date = new Date()
): MentorshipAnalyticsEvent {
  const dayBucket = occurredAt.toISOString().slice(0, 10);
  return {
    stage,
    entityId,
    occurredAt: occurredAt.toISOString(),
    actorKey,
    dedupeKey: `ment-${hash(`${stage}|${entityId}|${dayBucket}`)}`,
  };
}

/** Fire-and-forget delivery; never rejects. */
export function trackMentorshipEvent(event: MentorshipAnalyticsEvent): void {
  apiClient
    .post<void>('/mentorship/analytics/events', event)
    .catch(() => {
      // Analytics must never break a user flow.
    });
}
