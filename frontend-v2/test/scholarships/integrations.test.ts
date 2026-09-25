// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  buildIdempotencyKey,
  createIdempotencyRecord,
  decideIdempotentMutation,
  fingerprintRequest,
  pruneExpiredRecords,
} from '@/src/features/scholarships/idempotency';
import {
  SCHOLARSHIP_API_CONTRACTS,
  contractFixtures,
  evaluateContractCompatibility,
  type ScholarshipContractEndpoint,
} from '@/src/features/scholarships/contracts';
import {
  MAX_WEBHOOK_ATTEMPTS,
  SCHOLARSHIP_WEBHOOK_EVENTS,
  deliveryHistory,
  isReplayDelivery,
  nextRetryDelayMs,
  signWebhookPayload,
  verifyWebhookSignature,
  WEBHOOK_TOLERANCE_MS,
  type WebhookDelivery,
} from '@/src/features/scholarships/webhooks';

describe('scholarship mutation idempotency (#1151)', () => {
  const request = {
    key: buildIdempotencyKey({
      actorId: 'student-1',
      operation: 'application.submit',
      resourceId: 'program-1',
      clientNonce: 'nonce-1',
    }),
    actorId: 'student-1',
    operation: 'application.submit' as const,
    requestFingerprint: fingerprintRequest({ programId: 'program-1', answers: ['a'] }),
  };

  it('binds the key to the actor and operation', () => {
    expect(request.key).toContain('student-1');
    expect(request.key).toContain('application.submit');
  });

  it('returns one outcome for concurrent retries', () => {
    const record = createIdempotencyRecord(request, 'application-1');
    const decision = decideIdempotentMutation(record, request);

    expect(decision).toEqual({ action: 'replay', outcome: 'application-1' });
  });

  it('refuses the same key with a different payload', () => {
    const record = createIdempotencyRecord(request, 'application-1');
    const decision = decideIdempotentMutation(record, {
      ...request,
      requestFingerprint: fingerprintRequest({ programId: 'program-1', answers: ['b'] }),
    });

    expect(decision).toEqual({ action: 'conflict', reason: 'PAYLOAD_MISMATCH' });
  });

  it('reuses keys after the bounded retention window', () => {
    const record = createIdempotencyRecord(request, 'application-1');
    const afterExpiry = new Date(Date.parse(record.expiresAt) + 1);

    expect(decideIdempotentMutation(record, request, afterExpiry)).toEqual({ action: 'proceed' });
    expect(pruneExpiredRecords([record], afterExpiry)).toEqual([]);
  });

  it('produces a stable fingerprint regardless of key order', () => {
    expect(fingerprintRequest({ b: 2, a: 1 })).toBe(fingerprintRequest({ a: 1, b: 2 }));
  });
});

describe('versioned scholarship API contracts (#1161)', () => {
  it('classifies removed response fields as breaking', () => {
    const next = SCHOLARSHIP_API_CONTRACTS.map((endpoint) =>
      endpoint.id === 'programs.list'
        ? { ...endpoint, responseFields: endpoint.responseFields.filter((field) => field !== 'total') }
        : endpoint
    );

    const result = evaluateContractCompatibility(SCHOLARSHIP_API_CONTRACTS, next);
    expect(result.compatible).toBe(false);
    expect(result.requiresVersionBump).toBe(true);
  });

  it('classifies added endpoints and fields as non-breaking', () => {
    const additiveEndpoint: ScholarshipContractEndpoint = {
      id: 'reviews.list',
      version: '1.0.0',
      method: 'GET',
      route: '/scholarships/reviews',
      requestFields: [],
      responseFields: ['items'],
    };
    const result = evaluateContractCompatibility(SCHOLARSHIP_API_CONTRACTS, [
      ...SCHOLARSHIP_API_CONTRACTS,
      additiveEndpoint,
    ]);

    expect(result.compatible).toBe(true);
    expect(result.changes.some((change) => change.changeClass === 'additive')).toBe(true);
  });

  it('ships executable fixtures for every documented endpoint', () => {
    const fixtures = contractFixtures();
    for (const endpoint of SCHOLARSHIP_API_CONTRACTS) {
      expect(fixtures[endpoint.id]).toBeDefined();
    }
  });
});

describe('signed sponsor webhooks (#1163)', () => {
  const payload = JSON.stringify({ programId: 'program-1', status: 'published' });
  const timestamp = '2026-09-24T10:00:00.000Z';
  const secret = 'sponsor-secret';

  it('verifies a freshly signed payload', async () => {
    const signature = await signWebhookPayload(payload, secret, timestamp);
    const valid = await verifyWebhookSignature({
      payload,
      secret,
      timestamp,
      signature,
      now: new Date(timestamp),
    });

    expect(valid).toBe(true);
  });

  it('rejects a wrong secret and a replayed timestamp', async () => {
    const signature = await signWebhookPayload(payload, secret, timestamp);

    const wrongSecret = await verifyWebhookSignature({
      payload,
      secret: 'other-secret',
      timestamp,
      signature,
      now: new Date(timestamp),
    });
    expect(wrongSecret).toBe(false);

    const stale = new Date(Date.parse(timestamp) + WEBHOOK_TOLERANCE_MS + 1000).toISOString();
    const replayed = await verifyWebhookSignature({
      payload,
      secret,
      timestamp,
      signature,
      now: new Date(stale),
    });
    expect(replayed).toBe(false);
  });

  it('caps retry backoff and detects replays', () => {
    expect(nextRetryDelayMs(0)).toBe(1000);
    expect(nextRetryDelayMs(99)).toBe(5 * 60 * 1000);
    expect(isReplayDelivery('delivery-9', ['delivery-1'])).toBe(false);
    expect(isReplayDelivery('delivery-1', ['delivery-1'])).toBe(true);
    expect(MAX_WEBHOOK_ATTEMPTS).toBeGreaterThan(0);
    expect(SCHOLARSHIP_WEBHOOK_EVENTS).toContain('scholarship.payment.finalized');
  });

  it('returns per-subscription delivery history in attempt order', () => {
    const deliveries: WebhookDelivery[] = [
      { id: 'd2', subscriptionId: 'sub-1', event: 'scholarship.award.accepted', attempt: 2, status: 'failed' },
      { id: 'd1', subscriptionId: 'sub-1', event: 'scholarship.program.published', attempt: 1, status: 'delivered' },
      { id: 'd3', subscriptionId: 'sub-2', event: 'scholarship.program.published', attempt: 1, status: 'delivered' },
    ];

    expect(deliveryHistory(deliveries, 'sub-1').map((delivery) => delivery.id)).toEqual(['d1', 'd2']);
  });
});
