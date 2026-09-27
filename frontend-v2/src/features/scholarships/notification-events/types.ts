/**
 * Scholarship notification events (issue #1139).
 *
 * Every event names a *stable reference* to what it is about (kind + id) and
 * carries only the minimum data its channel needs. Names, email addresses and
 * essay text never enter an event: the payload is filtered through a per-event
 * allowlist before it is stored, so a channel cannot leak applicant identity
 * even if a caller passes it in.
 */

export type ScholarshipNotificationEventName =
  | 'deadline.approaching'
  | 'application.action-required'
  | 'review.assigned'
  | 'decision.recorded'
  | 'award.acceptance-required'
  | 'milestone.evidence-required'
  | 'payment.processed'
  | 'payout.setup-required';

export type Channel = 'in-app' | 'email' | 'sms' | 'push';

/** Alias kept for call sites that spell the channel type out in full. */
export type NotificationChannel = Channel;

export type NotificationSubjectKind =
  | 'application'
  | 'review'
  | 'award'
  | 'milestone'
  | 'payment'
  | 'program';

/** A stable pointer at the record an event concerns. Never a name or an email. */
export type NotificationSubject = {
  kind: NotificationSubjectKind;
  id: string;
};

export type NotificationPayloadValue = string | number | boolean | null;
export type NotificationPayload = Record<string, NotificationPayloadValue>;

export type NotificationEvent = {
  eventId: string;
  name: ScholarshipNotificationEventName;
  version: string;
  occurredAt: string;
  correlationId: string;
  subject: NotificationSubject;
  programId?: string;
  channel: NotificationChannel;
  recipientRef: string;
  mandatory: boolean;
  payload: NotificationPayload;
  idempotencyKey: string;
};

export type EventEmissionRejectionReason =
  | 'MANDATORY_OVERRIDES_PREFERENCE'
  | 'PREFERENCE_SUPPRESSED'
  | 'DUPLICATE_IDEMPOTENCY_KEY'
  | 'INSUFFICIENT_PAYLOAD';

export type EventEmissionResult = {
  status: 'emitted' | 'duplicate-suppressed' | 'rejected';
  event: NotificationEvent;
  reason?: EventEmissionRejectionReason;
};

/** Draft an emitter builds before the allowlist/duplicate checks run. */
export type NotificationEventDraft = {
  name: ScholarshipNotificationEventName;
  occurredAt: string;
  correlationId: string;
  subject: NotificationSubject;
  programId?: string;
  channel: NotificationChannel;
  recipientRef: string;
  mandatory?: boolean;
  payload?: NotificationPayload;
};

export type ChannelPreferences = {
  eventName: ScholarshipNotificationEventName;
  channel: NotificationChannel;
  enabled: boolean;
};

export type PayloadValidation = {
  valid: boolean;
  missing: string[];
  stripped: string[];
};

export type EmittedEventRecord = {
  event: NotificationEvent;
  result: EventEmissionResult;
  recordedAt: string;
};
