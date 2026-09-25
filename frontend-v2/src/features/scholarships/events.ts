/**
 * Transactional scholarship domain events (issue #1162).
 *
 * Cross-module workflows and external consumers need scholarship state changes
 * to be published durably. Events are written to an outbox in the same
 * transaction as the state they describe, carry a schema version and a
 * correlation id, and expose a stable deduplication key so a consumer that sees
 * the same event twice can process it exactly once.
 */

import { apiClient } from '@/src/lib/api-client';

export const SCHOLARSHIP_EVENT_SCHEMA_VERSION = '1.0.0';

export type ScholarshipEventName =
  | 'scholarship.program.published'
  | 'scholarship.application.submitted'
  | 'scholarship.decision.recorded'
  | 'scholarship.award.accepted'
  | 'scholarship.milestone.verified'
  | 'scholarship.payment.finalized';

export const SCHOLARSHIP_EVENT_NAMES: ScholarshipEventName[] = [
  'scholarship.program.published',
  'scholarship.application.submitted',
  'scholarship.decision.recorded',
  'scholarship.award.accepted',
  'scholarship.milestone.verified',
  'scholarship.payment.finalized',
];

export type ScholarshipEventPayloadValue = string | number | boolean | null;
export type ScholarshipEventPayload = Record<string, ScholarshipEventPayloadValue>;

export type ScholarshipEventEnvelope = {
  eventId: string;
  name: ScholarshipEventName;
  version: string;
  occurredAt: string;
  correlationId: string;
  aggregateId: string;
  producer: string;
  dedupeKey: string;
  payload: ScholarshipEventPayload;
};

export type OutboxStatus = 'pending' | 'published' | 'failed';

export type ScholarshipOutboxRecord = {
  envelope: ScholarshipEventEnvelope;
  status: OutboxStatus;
  attempts: number;
};

export type BuildScholarshipEventInput = {
  name: ScholarshipEventName;
  aggregateId: string;
  correlationId: string;
  producer: string;
  /** Caller-supplied operation key; the same key never emits twice. */
  idempotencyKey: string;
  payload?: ScholarshipEventPayload;
  occurredAt?: string;
};

/**
 * The dedupe key is derived from the fact being announced, not from the moment
 * it was announced, so retries of the same operation produce the same key.
 */
export function scholarshipDedupeKey(
  name: ScholarshipEventName,
  aggregateId: string,
  idempotencyKey: string
): string {
  return `${name}:${aggregateId}:${idempotencyKey}`;
}

export function buildScholarshipEvent(input: BuildScholarshipEventInput): ScholarshipEventEnvelope {
  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const dedupeKey = scholarshipDedupeKey(input.name, input.aggregateId, input.idempotencyKey);

  return {
    eventId: dedupeKey,
    name: input.name,
    version: SCHOLARSHIP_EVENT_SCHEMA_VERSION,
    occurredAt,
    correlationId: input.correlationId,
    aggregateId: input.aggregateId,
    producer: input.producer,
    dedupeKey,
    payload: input.payload ?? {},
  };
}

/** Returns the list of problems that make an envelope unsafe to publish. */
export function validateScholarshipEvent(envelope: ScholarshipEventEnvelope): string[] {
  const errors: string[] = [];

  if (!SCHOLARSHIP_EVENT_NAMES.includes(envelope.name)) {
    errors.push(`Unknown scholarship event name: ${envelope.name}`);
  }
  if (!envelope.aggregateId.trim()) {
    errors.push('Scholarship events require an aggregate id.');
  }
  if (!envelope.correlationId.trim()) {
    errors.push('Scholarship events require a correlation id so failures can be traced.');
  }
  if (envelope.version !== SCHOLARSHIP_EVENT_SCHEMA_VERSION) {
    errors.push(`Schema version must be ${SCHOLARSHIP_EVENT_SCHEMA_VERSION} for new events.`);
  }
  if (!envelope.dedupeKey.trim()) {
    errors.push('Scholarship events require a dedupe key so consumers can ignore replays.');
  }
  if (envelope.eventId !== envelope.dedupeKey) {
    errors.push('Event id must match its dedupe key for the same fact.');
  }

  return errors;
}

/** Consumers process the first occurrence of each dedupe key and ignore replays. */
export function dedupeScholarshipEvents(
  events: ScholarshipEventEnvelope[]
): ScholarshipEventEnvelope[] {
  const seen = new Set<string>();
  const unique: ScholarshipEventEnvelope[] = [];
  for (const event of events) {
    if (seen.has(event.dedupeKey)) continue;
    seen.add(event.dedupeKey);
    unique.push(event);
  }
  return unique;
}

export const scholarshipEventService = {
  list: (): Promise<ScholarshipOutboxRecord[]> =>
    apiClient.get<ScholarshipOutboxRecord[]>('/scholarships/events'),

  emit: (envelope: ScholarshipEventEnvelope): Promise<ScholarshipOutboxRecord> =>
    apiClient.post<ScholarshipOutboxRecord>('/scholarships/events', envelope),
};
