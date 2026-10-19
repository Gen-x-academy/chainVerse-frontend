import { beforeEach, describe, expect, it, vi } from 'vitest';

const post = vi.fn();
vi.mock('@/src/lib/api-client', () => ({ apiClient: { post: (...args: unknown[]) => post(...args), get: vi.fn() } }));

import {
  sessionRescheduleService,
  submitReschedule,
  submitRescheduleApply,
  submitRescheduleDecision,
  type ProposeRescheduleRequest,
  type RescheduleResponse,
} from './session-reschedule.service';

const request: ProposeRescheduleRequest = {
  proposedStartsAt: '2026-11-04T15:00:00.000Z',
  reason: 'An exam moved onto that afternoon',
  acknowledgedFeeMinor: 2500,
  idempotencyKey: 'resch-key-0001',
};

const applyRequest = {
  proposedStartsAt: request.proposedStartsAt,
  reason: request.reason,
  idempotencyKey: request.idempotencyKey,
};

const response = (replayed: boolean): RescheduleResponse => ({
  replayed,
  proposal: { proposalId: 'rsp-1' } as RescheduleResponse['proposal'],
  session: {
    sessionId: 'ses-1',
    startsAt: '2026-11-03T14:00:00.000Z',
    endsAt: '2026-11-03T14:30:00.000Z',
    revision: 1,
  },
});

const analytics = () => post.mock.calls.filter(([path]) => path === '/mentorship/analytics/events');

function respondWith(body: RescheduleResponse) {
  post.mockImplementation((path: string) =>
    Promise.resolve(path === '/mentorship/analytics/events' ? undefined : body),
  );
}

beforeEach(() => {
  post.mockReset();
});

describe('sessionRescheduleService', () => {
  it('posts a request with the idempotency key in the body and the header', async () => {
    post.mockResolvedValue(response(false));
    await sessionRescheduleService.propose('ses/1', request);
    expect(post).toHaveBeenCalledWith('/mentorship/sessions/ses%2F1/reschedule-requests', request, {
      headers: { 'Idempotency-Key': 'resch-key-0001' },
    });
  });

  it('posts a direct change to the coordinator endpoint', async () => {
    post.mockResolvedValue(response(false));
    await sessionRescheduleService.apply('ses-1', applyRequest);
    expect(post).toHaveBeenCalledWith('/mentorship/sessions/ses-1/reschedule', applyRequest, {
      headers: { 'Idempotency-Key': 'resch-key-0001' },
    });
  });

  it.each(['approve', 'decline', 'withdraw'] as const)('posts a %s decision to its own endpoint', async (decision) => {
    post.mockResolvedValue(response(false));
    await sessionRescheduleService.decide('rsp/1', decision);
    expect(post).toHaveBeenCalledWith(`/mentorship/reschedule-requests/rsp%2F1/${decision}`, {});
  });
});

describe('reschedule analytics', () => {
  it('records one event per new fact, tagged by outcome and without personal data', async () => {
    respondWith(response(false));
    await submitReschedule('ses-1', request, 'actor-key-1');
    await submitRescheduleDecision('rsp-1', 'approve', 'actor-key-2');

    const events = analytics().map(([, body]) => body as Record<string, unknown>);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ stage: 'session_reschedule', entityId: 'rsp-1:proposed', actorKey: 'actor-key-1' });
    expect(events[1]).toMatchObject({ entityId: 'rsp-1:approved' });
    expect(events[0].dedupeKey).not.toBe(events[1].dedupeKey);
    expect(JSON.stringify(events)).not.toContain('exam');
  });

  it('records applied for a direct coordinator change', async () => {
    respondWith(response(false));
    await submitRescheduleApply('ses-1', applyRequest, 'actor-key-3');
    expect(analytics()[0][1]).toMatchObject({ entityId: 'rsp-1:applied' });
  });

  it('never counts a replayed response again', async () => {
    respondWith(response(true));
    await submitReschedule('ses-1', request, 'actor-key-1');
    await submitRescheduleDecision('rsp-1', 'decline', 'actor-key-1');
    expect(analytics()).toHaveLength(0);
  });

  it('records nothing when the request fails and does not let analytics break it', async () => {
    post.mockRejectedValue(new Error('boom'));
    await expect(submitReschedule('ses-1', request, 'actor-key-1')).rejects.toThrow('boom');
    expect(analytics()).toHaveLength(0);

    post.mockReset();
    post.mockImplementation((path: string) =>
      path === '/mentorship/analytics/events' ? Promise.reject(new Error('down')) : Promise.resolve(response(false)),
    );
    await expect(submitReschedule('ses-1', request, 'actor-key-1')).resolves.toMatchObject({ replayed: false });
  });
});
