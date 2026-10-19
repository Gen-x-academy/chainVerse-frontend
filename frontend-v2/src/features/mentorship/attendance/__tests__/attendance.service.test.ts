import { beforeEach, describe, expect, it, vi } from 'vitest';

const post = vi.fn();
vi.mock('@/src/lib/api-client', () => ({
  apiClient: { post: (...a: unknown[]) => post(...a), get: vi.fn() },
}));

import { attendanceService, trackAttendanceEvent } from '../attendance.service';

describe('attendance service', () => {
  beforeEach(() => post.mockReset().mockResolvedValue({}));

  it('sends the idempotency key with a recorded signal', async () => {
    await attendanceService.record('ses 1', 'usr_1', { kind: 'join', method: 'platform-presence', at: 't' }, 'key-1');
    expect(post).toHaveBeenCalledWith('/mentorship/sessions/ses%201/attendance/signals', {
      kind: 'join',
      method: 'platform-presence',
      at: 't',
      participantId: 'usr_1',
      idempotencyKey: 'key-1',
    });
  });

  it('emits id-only analytics with a stable dedupe key', () => {
    const at = new Date('2026-01-01T00:00:00Z');
    trackAttendanceEvent('recorded', 'ses_1', 'actor', at);
    trackAttendanceEvent('recorded', 'ses_1', 'actor', at);
    const first = post.mock.calls[0][1];
    expect(first).toMatchObject({ stage: 'attendance', entityId: 'ses_1:recorded' });
    expect(post.mock.calls[1][1].dedupeKey).toBe(first.dedupeKey);
  });

  it('never rejects when analytics delivery fails', () => {
    const swallowed = vi.fn();
    post.mockImplementation(() => ({ catch: (h: (e: Error) => void) => swallowed(h(new Error('down'))) }));
    expect(() => trackAttendanceEvent('correction_requested', 'ses_1', 'a')).not.toThrow();
    expect(swallowed).toHaveBeenCalledTimes(1);
  });
});
