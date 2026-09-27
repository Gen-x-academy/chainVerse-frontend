import { describe, expect, it, vi } from 'vitest';
import {
  emitNotificationEvent,
  idempotencyKeyFor,
  isMandatoryNotificationEvent,
  isPiiField,
  occurredAtBucket,
  PAYLOAD_ALLOWLIST,
  stripToAllowlist,
  validatePayload,
  notificationEventService,
} from '@/src/features/scholarships/notification-events/service';
import type {
  NotificationEvent,
  NotificationEventDraft,
  NotificationPayload,
} from '@/src/features/scholarships/notification-events/types';

vi.mock('@/src/lib/api-client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const NOW = new Date('2026-05-04T10:00:00.000Z');
const SUBJECT = { kind: 'application' as const, id: 'app-42' };

function draft(overrides: Partial<NotificationEventDraft> = {}): NotificationEventDraft {
  return {
    name: 'review.assigned',
    occurredAt: '2026-05-04T10:00:00.000Z',
    correlationId: 'corr-1',
    subject: SUBJECT,
    programId: 'chainverse-scholarship',
    channel: 'email',
    recipientRef: 'user:applicant-001',
    payload: { applicationId: 'app-42', roundId: 'round-2026', assignedAt: NOW.toISOString() },
    ...overrides,
  };
}

describe('idempotency keys', () => {
  it('is deterministic for the same fact in the same bucket', () => {
    const first = idempotencyKeyFor('review.assigned', SUBJECT, occurredAtBucket('2026-05-04T10:00:12.000Z'));
    const second = idempotencyKeyFor('review.assigned', SUBJECT, occurredAtBucket('2026-05-04T10:00:59.000Z'));
    expect(first).toBe(second);
    expect(first).toBe('review.assigned:application:app-42:2026-05-04T10:00:00.000Z');
  });

  it('differs across events, subjects, and buckets', () => {
    const bucket = occurredAtBucket('2026-05-04T10:00:00.000Z');
    expect(idempotencyKeyFor('review.assigned', SUBJECT, bucket)).not.toBe(
      idempotencyKeyFor('review.assigned', { kind: 'review', id: 'app-42' }, bucket)
    );
    expect(occurredAtBucket('2026-05-04T10:01:00.000Z')).not.toBe(bucket);
  });
});

describe('emission', () => {
  it('emits once and suppresses a duplicate idempotency key', () => {
    const first = emitNotificationEvent(draft(), undefined, [], NOW);
    expect(first.status).toBe('emitted');
    expect(first.event.payload).toEqual({
      applicationId: 'app-42',
      roundId: 'round-2026',
      assignedAt: '2026-05-04T10:00:00.000Z',
    });

    const second = emitNotificationEvent(draft(), undefined, [first.event], NOW);
    expect(second.status).toBe('duplicate-suppressed');
    expect(second.reason).toBe('DUPLICATE_IDEMPOTENCY_KEY');
  });

  it('lets a mandatory event override an opt-out preference', () => {
    const result = emitNotificationEvent(
      draft({
        name: 'decision.recorded',
        channel: 'sms',
        payload: { outcome: 'awarded', decidedAt: NOW.toISOString() },
      }),
      [{ eventName: 'decision.recorded', channel: 'sms', enabled: false }],
      [],
      NOW
    );
    expect(result.status).toBe('emitted');
    expect(result.reason).toBe('MANDATORY_OVERRIDES_PREFERENCE');
    expect(result.event.mandatory).toBe(true);
    expect(isMandatoryNotificationEvent('decision.recorded')).toBe(true);
  });

  it('suppresses a non-mandatory event on an opted-out channel', () => {
    const result = emitNotificationEvent(
      draft(),
      [{ eventName: 'review.assigned', channel: 'email', enabled: false }],
      [],
      NOW
    );
    expect(result.status).toBe('rejected');
    expect(result.reason).toBe('PREFERENCE_SUPPRESSED');
  });

  it('rejects an event whose payload cannot satisfy its channel', () => {
    const result = emitNotificationEvent(
      draft({ payload: { applicationId: 'app-42' } }),
      undefined,
      [],
      NOW
    );
    expect(result.status).toBe('rejected');
    expect(result.reason).toBe('INSUFFICIENT_PAYLOAD');
    expect(validatePayload('review.assigned', { applicationId: 'app-42' }).missing.length).toBe(2);
  });
});

describe('payload privacy', () => {
  it('recognises PII field names', () => {
    expect(isPiiField('applicantName')).toBe(true);
    expect(isPiiField('applicantEmail')).toBe(true);
    expect(isPiiField('essayText')).toBe(true);
    expect(isPiiField('transcriptGpa')).toBe(true);
    expect(isPiiField('awardAmountCents')).toBe(false);
    expect(isPiiField('daysRemaining')).toBe(false);
  });

  it('strips everything outside the allowlist', () => {
    const payload: NotificationPayload = {
      daysRemaining: 5,
      deadlineAt: '2026-05-20T00:00:00.000Z',
      applicantName: 'Ada Lovelace',
      applicantEmail: 'ada@example.edu',
      essayText: 'free text',
      reviewPanel: 'reviewer-1',
    };
    const stripped = stripToAllowlist('deadline.approaching', payload);
    expect(Object.keys(stripped).sort()).toEqual(['daysRemaining', 'deadlineAt']);
    expect(JSON.stringify(stripped)).not.toContain('Ada Lovelace');
  });

  it('never carries PII through emission', () => {
    const result = emitNotificationEvent(
      draft({
        payload: {
          applicationId: 'app-42',
          roundId: 'round-2026',
          assignedAt: NOW.toISOString(),
          programId: 'chainverse-scholarship',
          applicantName: 'Ada Lovelace',
          applicantEmail: 'ada@example.edu',
          essayText: 'My essay text.',
        },
      }),
      undefined,
      [],
      NOW
    );
    const serialized = JSON.stringify(result.event);
    expect(serialized).not.toContain('Ada Lovelace');
    expect(serialized).not.toContain('ada@example.edu');
    expect(serialized).not.toContain('essayText');
    for (const key of Object.keys(result.event.payload)) {
      expect(PAYLOAD_ALLOWLIST['review.assigned']).toContain(key);
      expect(isPiiField(key)).toBe(false);
    }
  });

  it('reports which keys were stripped', () => {
    const validation = validatePayload('review.assigned', {
      applicationId: 'app-42',
      roundId: 'round-2026',
      assignedAt: NOW.toISOString(),
      applicantName: 'Ada Lovelace',
    });
    expect(validation.valid).toBe(true);
    expect(validation.stripped).toEqual(['applicantName']);
  });
});

describe('notificationEventService', () => {
  it('emits through the api client with a stable event id', async () => {
    const { apiClient } = await import('@/src/lib/api-client');
    const mocked = apiClient as unknown as { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> };
    mocked.get.mockResolvedValue([]);
    const event = emitNotificationEvent(draft(), undefined, [], NOW).event as NotificationEvent;
    mocked.post.mockResolvedValue(event);

    await notificationEventService.emit(event);
    expect(mocked.post).toHaveBeenCalledWith('/scholarships/notifications/events', event);
    expect(event.eventId).toBe(event.idempotencyKey);
  });
});
