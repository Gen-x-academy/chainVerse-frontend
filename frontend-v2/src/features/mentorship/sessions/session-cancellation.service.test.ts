import { beforeEach, describe, expect, it, vi } from 'vitest';

const post = vi.fn();
vi.mock('@/src/lib/api-client', () => ({ apiClient: { post: (...args: unknown[]) => post(...args), get: vi.fn() } }));

import {
  sessionCancellationService,
  submitSessionCancellation,
  type CancelSessionRequest,
  type CancelSessionResponse,
} from './session-cancellation.service';

const request: CancelSessionRequest = {
  reasonCode: 'schedule_conflict',
  note: 'Clash with an exam',
  acknowledgedRefundMinor: 5000,
  idempotencyKey: 'cancel-key-0001',
};

const response = (replayed: boolean): CancelSessionResponse => ({
  replayed,
  session: { sessionId: 'ses-1', status: 'cancelled', revision: 2 },
  cancellation: {} as CancelSessionResponse['cancellation'],
});

const analytics = () => post.mock.calls.filter(([path]) => path === '/mentorship/analytics/events');

function respondWith(body: CancelSessionResponse) {
  post.mockImplementation((path: string) =>
    Promise.resolve(path === '/mentorship/analytics/events' ? undefined : body),
  );
}

beforeEach(() => {
  post.mockReset();
});

describe('sessionCancellationService', () => {
  it('posts the cancellation with the key in the body and the header', async () => {
    post.mockResolvedValue(response(false));
    await sessionCancellationService.cancel('ses/1', request);
    expect(post).toHaveBeenCalledWith('/mentorship/sessions/ses%2F1/cancellation', request, {
      headers: { 'Idempotency-Key': 'cancel-key-0001' },
    });
  });
});

describe('submitSessionCancellation', () => {
  it('records one analytics event without the note or the reason text', async () => {
    respondWith(response(false));
    await submitSessionCancellation('ses-1', request, 'actor-key-1');

    const events = analytics();
    expect(events).toHaveLength(1);
    expect(events[0][1]).toMatchObject({ stage: 'session_cancellation', entityId: 'ses-1', actorKey: 'actor-key-1' });
    expect(JSON.stringify(events[0][1])).not.toContain('exam');
  });

  it('never counts a replayed cancellation a second time', async () => {
    respondWith(response(true));
    await submitSessionCancellation('ses-1', request, 'actor-key-1');
    expect(analytics()).toHaveLength(0);
  });

  it('records nothing for a failed request and ignores an analytics outage', async () => {
    post.mockRejectedValue(new Error('boom'));
    await expect(submitSessionCancellation('ses-1', request, 'actor-key-1')).rejects.toThrow('boom');
    expect(analytics()).toHaveLength(0);

    post.mockReset();
    post.mockImplementation((path: string) =>
      path === '/mentorship/analytics/events' ? Promise.reject(new Error('down')) : Promise.resolve(response(false)),
    );
    await expect(submitSessionCancellation('ses-1', request, 'actor-key-1')).resolves.toMatchObject({ replayed: false });
  });
});
