import { describe, expect, it } from 'vitest';
import {
  assertSafePayload,
  dueEntries,
  enqueue,
  markFailed,
  markSent,
  processOutbox,
} from '../communication/notification-outbox';

const base = {
  eventId: 'evt-1',
  templateId: 'session.confirmed',
  locale: 'en',
  channel: 'email',
  recipientId: 'user-1',
  payload: { sessionId: 'ses-1' },
};

describe('MENTOR-103 notification outbox', () => {
  it('deduplicates by (event, recipient, channel) so each event sends at most once', () => {
    const first = enqueue({ entries: [] }, base);
    expect(first.duplicate).toBe(false);
    const second = enqueue(first.state, base);
    expect(second.duplicate).toBe(true);
    expect(second.state.entries).toHaveLength(1);
  });

  it('localizes and rejects unsafe template payloads', () => {
    const en = enqueue({ entries: [] }, { ...base, locale: 'en' });
    const fr = enqueue(en.state, { ...base, channel: 'sms', locale: 'fr' });
    expect(en.entry.locale).toBe('en');
    expect(fr.entry.locale).toBe('fr');
    expect(() => enqueue({ entries: [] }, { ...base, payload: { providerToken: 'tok_live_1234567890' } })).toThrow(
      /sensitive keys/i,
    );
    expect(() => assertSafePayload({ payoutDetails: {} })).toThrow(/sensitive keys/i);
  });

  it('retries with backoff and moves exhausted entries to the dead-letter queue', () => {
    const { state } = enqueue({ entries: [] }, { ...base, maxAttempts: 2 });
    const id = state.entries[0].id;
    const now = new Date('2026-10-17T00:00:00.000Z');
    const failedOnce = markFailed(state, id, 'provider down', now);
    const entry = failedOnce.entries[0];
    expect(entry.status).toBe('pending');
    expect(entry.attempts).toBe(1);
    expect(Date.parse(entry.nextAttemptAt)).toBeGreaterThan(now.getTime());
    const dead = markFailed(failedOnce, id, 'provider down', now);
    expect(dead.entries[0].status).toBe('dead_letter');
  });

  it('drains due entries independent of provider uptime and is idempotent', async () => {
    const { state } = enqueue({ entries: [] }, { ...base, maxAttempts: 1 });
    const sent = markSent(state, state.entries[0].id);
    expect(dueEntries(sent)).toHaveLength(0);

    let attempts = 0;
    const result = await processOutbox(state, async () => {
      attempts += 1;
      throw new Error('boom');
    });
    expect(attempts).toBe(1);
    expect(result.deadLettered).toBe(1);
    expect(result.state.entries[0].status).toBe('dead_letter');
    expect(dueEntries(result.state)).toHaveLength(0);
  });

  it('delivers pending entries through a healthy provider', async () => {
    const { state } = enqueue({ entries: [] }, base);
    const delivered: string[] = [];
    const result = await processOutbox(state, async (entry) => {
      delivered.push(entry.id);
    });
    expect(delivered).toHaveLength(1);
    expect(result.delivered).toBe(1);
    expect(result.state.entries[0].status).toBe('sent');
  });
});
