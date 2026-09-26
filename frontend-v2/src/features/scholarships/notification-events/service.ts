/**
 * Notification event emission and filtering (issue #1139).
 *
 * Emission is a pure function of (draft, preferences, already-sent events, now)
 * so a retry of the same fact produces the same event id and is suppressed
 * rather than delivered twice. `Date.now()` is never called here.
 */

import { apiClient } from '@/src/lib/api-client';
import type {
  ChannelPreferences,
  EmittedEventRecord,
  EventEmissionResult,
  Channel,
  NotificationEvent,
  NotificationEventDraft,
  NotificationPayload,
  NotificationSubject,
  PayloadValidation,
  ScholarshipNotificationEventName,
} from './types';

export const NOTIFICATION_EVENTS_PATH = '/scholarships/notifications/events';
export const NOTIFICATION_EVENT_SCHEMA_VERSION = '1.0.0';

/**
 * The minimum data each channel actually needs, per event. Everything not
 * listed here is stripped from the payload.
 */
/**
 * Stable references every event may carry, so a channel can always link back to
 * the record without a name, an email address, or any free text.
 */
export const SHARED_REFERENCE_PAYLOAD_KEYS = ['programId', 'applicationId'] as const;

export const PAYLOAD_ALLOWLIST: Record<ScholarshipNotificationEventName, readonly string[]> = {
  'deadline.approaching': ['daysRemaining', 'deadlineAt', 'programId'],
  'application.action-required': ['missingFieldCount', 'actionDueAt', 'programId'],
  'review.assigned': ['applicationId', 'roundId', 'assignedAt', 'programId'],
  'decision.recorded': ['outcome', 'decidedAt', 'applicationId', 'programId'],
  'award.acceptance-required': ['awardAmountCents', 'currency', 'acceptBy', 'awardId'],
  'milestone.evidence-required': ['milestoneId', 'evidenceDueAt', 'requiredEvidenceCount'],
  'payment.processed': ['amountCents', 'currency', 'settledAt', 'installmentNumber'],
  'payout.setup-required': ['missingFieldCount', 'requiredBy', 'payoutId'],
};

/** Per-event keys the channel genuinely needs, beyond the shared references. */
export const EVENT_REQUIRED_PAYLOAD_KEYS: Record<ScholarshipNotificationEventName, readonly string[]> =
  Object.fromEntries(
    (Object.entries(PAYLOAD_ALLOWLIST) as [ScholarshipNotificationEventName, readonly string[]][]).map(
      ([name, keys]) => [
        name,
        keys.filter((key) => !(SHARED_REFERENCE_PAYLOAD_KEYS as readonly string[]).includes(key)),
      ]
    )
  ) as Record<ScholarshipNotificationEventName, readonly string[]>;

/** Field names that would carry personal data and are therefore never allowed. */
export const PII_FIELD_PATTERNS: readonly RegExp[] = [
  /name/i,
  /email/i,
  /e-?mail/i,
  /phone/i,
  /address/i,
  /essay/i,
  /dob|dateOfBirth/i,
  /ssn|taxId|nationalId/i,
  /essay|transcript|gpa/i,
  /freeText|notes?/i,
];

export function isPiiField(key: string): boolean {
  return PII_FIELD_PATTERNS.some((pattern) => pattern.test(key));
}

export function stripToAllowlist(
  name: ScholarshipNotificationEventName,
  payload: NotificationPayload
): NotificationPayload {
  const allowlist = PAYLOAD_ALLOWLIST[name];
  const stripped: NotificationPayload = {};
  for (const key of allowlist) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      stripped[key] = payload[key];
    }
  }
  return stripped;
}

/**
 * Reports which required allowlist keys are missing and which supplied keys were
 * removed. A payload missing a required key is not deliverable.
 */
export function validatePayload(
  name: ScholarshipNotificationEventName,
  payload: NotificationPayload
): PayloadValidation {
  const missing = EVENT_REQUIRED_PAYLOAD_KEYS[name].filter(
    (key) => !Object.prototype.hasOwnProperty.call(payload, key)
  );
  const allowlist = PAYLOAD_ALLOWLIST[name];
  const stripped = Object.keys(payload).filter((key) => !allowlist.includes(key));
  return { valid: missing.length === 0, missing: [...missing], stripped };
}

/**
 * Buckets `occurredAt` to the minute so two attempts to announce the same fact
 * within the same minute collapse onto one idempotency key.
 */
export function occurredAtBucket(occurredAt: string): string {
  const parsed = Date.parse(occurredAt);
  if (Number.isNaN(parsed)) return 'invalid';
  return new Date(Math.floor(parsed / 60000) * 60000).toISOString();
}

export function idempotencyKeyFor(
  name: ScholarshipNotificationEventName,
  subject: NotificationSubject,
  bucket: string
): string {
  return `${name}:${subject.kind}:${subject.id}:${bucket}`;
}

export function buildNotificationEvent(
  draft: NotificationEventDraft,
  mandatory: boolean
): NotificationEvent {
  const bucket = occurredAtBucket(draft.occurredAt);
  const idempotencyKey = idempotencyKeyFor(draft.name, draft.subject, bucket);
  return {
    eventId: idempotencyKey,
    name: draft.name,
    version: NOTIFICATION_EVENT_SCHEMA_VERSION,
    occurredAt: draft.occurredAt,
    correlationId: draft.correlationId,
    subject: draft.subject,
    programId: draft.programId,
    channel: draft.channel,
    recipientRef: draft.recipientRef,
    mandatory,
    payload: stripToAllowlist(draft.name, draft.payload ?? {}),
    idempotencyKey,
  };
}

/** Returns the preference record that applies, if the recipient set one. */
function preferenceFor(
  preferences: readonly ChannelPreferences[] | undefined,
  name: ScholarshipNotificationEventName,
  channel: Channel
): ChannelPreferences | undefined {
  return (preferences ?? []).find(
    (preference) => preference.eventName === name && preference.channel === channel
  );
}

/**
 * Decides whether a draft becomes an event.
 *
 * Order matters: the payload is validated first (an undeliverable event is
 * rejected), then a duplicate is suppressed, then preferences are consulted —
 * except for mandatory events, which always proceed.
 */
export function emitNotificationEvent(
  draft: NotificationEventDraft,
  preferences?: readonly ChannelPreferences[],
  sent: readonly NotificationEvent[] = [],
  now: Date = new Date()
): EventEmissionResult {
  const mandatory = draft.mandatory ?? isMandatoryNotificationEvent(draft.name);
  const event = buildNotificationEvent(draft, mandatory);
  const validation = validatePayload(draft.name, draft.payload ?? {});

  if (!validation.valid) {
    return { status: 'rejected', event, reason: 'INSUFFICIENT_PAYLOAD' };
  }

  if (sent.some((previous) => previous.idempotencyKey === event.idempotencyKey)) {
    return { status: 'duplicate-suppressed', event, reason: 'DUPLICATE_IDEMPOTENCY_KEY' };
  }

  const preference = preferenceFor(preferences, draft.name, draft.channel);
  const optedOut = preference ? !preference.enabled : false;

  if (mandatory) {
    return {
      status: 'emitted',
      event,
      reason: optedOut ? 'MANDATORY_OVERRIDES_PREFERENCE' : undefined,
    };
  }

  if (optedOut) {
    return { status: 'rejected', event, reason: 'PREFERENCE_SUPPRESSED' };
  }

  return { status: 'emitted', event, reason: undefined };
}

/**
 * Deadlines, decisions, and legal/financial notices are operational
 * requirements, not marketing, so a recipient cannot opt out of them.
 */
export const MANDATORY_NOTIFICATION_EVENTS: readonly ScholarshipNotificationEventName[] = [
  'deadline.approaching',
  'application.action-required',
  'decision.recorded',
  'award.acceptance-required',
  'payment.processed',
  'payout.setup-required',
];

export function isMandatoryNotificationEvent(name: ScholarshipNotificationEventName): boolean {
  return MANDATORY_NOTIFICATION_EVENTS.includes(name);
}

export function recordEmission(
  result: EventEmissionResult,
  now: Date = new Date()
): EmittedEventRecord {
  return { event: result.event, result, recordedAt: now.toISOString() };
}

export const notificationEventService = {
  list: (): Promise<NotificationEvent[]> =>
    apiClient.get<NotificationEvent[]>(NOTIFICATION_EVENTS_PATH),

  emit: (event: NotificationEvent): Promise<NotificationEvent> =>
    apiClient.post<NotificationEvent>(NOTIFICATION_EVENTS_PATH, event),

  forSubject: (kind: NotificationSubject['kind'], id: string): Promise<NotificationEvent[]> =>
    apiClient.get<NotificationEvent[]>(
      `${NOTIFICATION_EVENTS_PATH}/subjects/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`
    ),
};
