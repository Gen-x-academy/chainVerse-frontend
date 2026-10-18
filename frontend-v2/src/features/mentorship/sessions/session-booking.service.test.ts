import { beforeEach, describe, expect, it, vi } from 'vitest';

const post = vi.fn();
vi.mock('@/src/lib/api-client', () => ({ apiClient: { post: (...args: unknown[]) => post(...args), get: vi.fn() } }));

import {
  sessionBookingService,
  submitSessionBooking,
  type BookSessionRequest,
  type BookSessionResponse,
} from './session-booking.service';

const request: BookSessionRequest = {
  startsAt: '2026-11-03T14:00:00.000Z',
  durationMinutes: 30,
  mode: 'virtual',
  idempotencyKey: 'book-key-0001',
  timeZone: 'America/New_York',
};

const response = (replayed: boolean): BookSessionResponse => ({
  replayed,
  session: {
    sessionId: 'ses-1',
    startsAt: request.startsAt,
    endsAt: '2026-11-03T14:30:00.000Z',
    mode: 'virtual',
    durationMinutes: 30,
  },
});

function analyticsCalls() {
  return post.mock.calls.filter(([path]) => path === '/mentorship/analytics/events');
}

beforeEach(() => {
  post.mockReset();
});

describe('sessionBookingService', () => {
  it('posts the booking with the idempotency key in the body and the header', async () => {
    post.mockResolvedValue(response(false));
    await sessionBookingService.book('agr/1', request);

    expect(post).toHaveBeenCalledWith('/mentorship/agreements/agr%2F1/sessions', request, {
      headers: { 'Idempotency-Key': 'book-key-0001' },
    });
  });
});

describe('submitSessionBooking', () => {
  it('records one analytics event for a new booking, without personal data', async () => {
    post.mockImplementation((path: string) =>
      Promise.resolve(path === '/mentorship/analytics/events' ? undefined : response(false)),
    );
    await submitSessionBooking('agr-1', request, 'actor-key-1');

    const events = analyticsCalls();
    expect(events).toHaveLength(1);
    const event = events[0][1] as Record<string, unknown>;
    expect(event).toMatchObject({ stage: 'session_booking', entityId: 'ses-1', actorKey: 'actor-key-1' });
    expect(JSON.stringify(event)).not.toContain('agr-1');
    expect(JSON.stringify(event)).not.toContain('America/New_York');
  });

  it('does not count a replayed booking a second time', async () => {
    post.mockImplementation((path: string) =>
      Promise.resolve(path === '/mentorship/analytics/events' ? undefined : response(true)),
    );
    await submitSessionBooking('agr-1', request, 'actor-key-1');
    expect(analyticsCalls()).toHaveLength(0);
  });

  it('never lets a failing analytics call break the booking', async () => {
    post.mockImplementation((path: string) =>
      path === '/mentorship/analytics/events' ? Promise.reject(new Error('down')) : Promise.resolve(response(false)),
    );
    await expect(submitSessionBooking('agr-1', request, 'actor-key-1')).resolves.toMatchObject({
      session: { sessionId: 'ses-1' },
    });
  });

  it('propagates a booking failure and records nothing', async () => {
    post.mockRejectedValue(new Error('boom'));
    await expect(submitSessionBooking('agr-1', request, 'actor-key-1')).rejects.toThrow('boom');
    expect(analyticsCalls()).toHaveLength(0);
  });
});
