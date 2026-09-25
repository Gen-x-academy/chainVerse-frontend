/**
 * Signed sponsor webhooks (issue #1163).
 *
 * Selected program and award events are delivered to approved sponsor
 * endpoints. Payloads are signed with a per-subscription secret, timestamped
 * (with a tolerance window) so replays are rejected, retried with bounded
 * exponential backoff, and recorded so delivery history is visible. Secrets are
 * referenced by id and rotated without downtime.
 */

import { apiClient } from '@/src/lib/api-client';

export const SCHOLARSHIP_WEBHOOK_EVENTS = [
  'scholarship.program.published',
  'scholarship.application.submitted',
  'scholarship.decision.recorded',
  'scholarship.award.accepted',
  'scholarship.award.completed',
  'scholarship.payment.finalized',
] as const;

export type ScholarshipWebhookEvent = (typeof SCHOLARSHIP_WEBHOOK_EVENTS)[number];

export const MAX_WEBHOOK_ATTEMPTS = 5;
export const WEBHOOK_TOLERANCE_MS = 5 * 60 * 1000;

export type WebhookSubscription = {
  id: string;
  sponsorId: string;
  endpoint: string;
  /** Reference to the signing secret, never the secret itself. */
  secretRef: string;
  events: ScholarshipWebhookEvent[];
  active: boolean;
  secretRotatedAt?: string;
};

export type WebhookDeliveryStatus = 'pending' | 'delivered' | 'failed' | 'suppressed';

export type WebhookDelivery = {
  id: string;
  subscriptionId: string;
  event: ScholarshipWebhookEvent;
  attempt: number;
  status: WebhookDeliveryStatus;
  statusCode?: number;
  deliveredAt?: string;
  nextAttemptAt?: string;
};

export type WebhookEnvelope = {
  id: string;
  event: ScholarshipWebhookEvent;
  timestamp: string;
  signatureVersion: 'v1';
  payload: Record<string, unknown>;
};

export function buildWebhookEnvelope(input: {
  deliveryId: string;
  event: ScholarshipWebhookEvent;
  payload: Record<string, unknown>;
  timestamp: string;
}): WebhookEnvelope {
  return {
    id: input.deliveryId,
    event: input.event,
    timestamp: input.timestamp,
    signatureVersion: 'v1',
    payload: input.payload,
  };
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/** v1 signature base string: `timestamp.payload`. */
export function signWebhookPayload(
  payload: string,
  secret: string,
  timestamp: string
): Promise<string> {
  return hmacHex(secret, `${timestamp}.${payload}`);
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

export async function verifyWebhookSignature(input: {
  payload: string;
  secret: string;
  timestamp: string;
  signature: string;
  now?: Date;
}): Promise<boolean> {
  const now = input.now ?? new Date();
  const timestampMs = Date.parse(input.timestamp);
  if (Number.isNaN(timestampMs)) return false;
  if (Math.abs(now.getTime() - timestampMs) > WEBHOOK_TOLERANCE_MS) return false;

  const expected = await signWebhookPayload(input.payload, input.secret, input.timestamp);
  return timingSafeEqual(expected, input.signature);
}

export function isReplayDelivery(deliveryId: string, seenDeliveryIds: Iterable<string>): boolean {
  for (const seen of seenDeliveryIds) {
    if (seen === deliveryId) return true;
  }
  return false;
}

export function nextRetryDelayMs(attempt: number): number {
  return Math.min(1000 * 2 ** Math.max(0, attempt), 5 * 60 * 1000);
}

export function deliveryHistory(
  deliveries: WebhookDelivery[],
  subscriptionId: string
): WebhookDelivery[] {
  return deliveries
    .filter((delivery) => delivery.subscriptionId === subscriptionId)
    .sort((left, right) => left.attempt - right.attempt);
}

export const scholarshipWebhookService = {
  listSubscriptions: (sponsorId: string): Promise<WebhookSubscription[]> =>
    apiClient.get<WebhookSubscription[]>(`/scholarships/sponsors/${sponsorId}/webhooks`),

  deliveries: (subscriptionId: string): Promise<WebhookDelivery[]> =>
    apiClient.get<WebhookDelivery[]>(`/scholarships/webhooks/${subscriptionId}/deliveries`),

  rotateSecret: (subscriptionId: string): Promise<{ secretRef: string }> =>
    apiClient.post<{ secretRef: string }>(
      `/scholarships/webhooks/${subscriptionId}/rotate-secret`,
      {}
    ),

  replay: (subscriptionId: string, deliveryId: string): Promise<WebhookDelivery> =>
    apiClient.post<WebhookDelivery>(
      `/scholarships/webhooks/${subscriptionId}/deliveries/${deliveryId}/replay`,
      {}
    ),
};
