import { beforeEach, describe, expect, it, vi } from 'vitest';

const post = vi.fn();
vi.mock('@/src/lib/api-client', () => ({
  apiClient: { post: (...a: unknown[]) => post(...a), get: vi.fn() },
}));

import { agendaService, trackAgendaEvent } from '../agenda.service';

describe('agenda service', () => {
  beforeEach(() => post.mockReset().mockResolvedValue({}));

  it('posts the command envelope with its id and base version', async () => {
    const env = { commandId: 'c1', baseVersion: 4, command: { type: 'withdraw', itemId: 'i' } } as const;
    await agendaService.apply('ses 1', env);
    expect(post).toHaveBeenCalledWith('/mentorship/sessions/ses%201/agenda/commands', env);
  });

  it('emits id-only analytics with a stable dedupe key', () => {
    const at = new Date('2026-01-01T00:00:00Z');
    trackAgendaEvent('propose', 'ses_1', 'actor', at);
    trackAgendaEvent('propose', 'ses_1', 'actor', at);
    const first = post.mock.calls[0][1];
    expect(first).toMatchObject({ stage: 'session_agenda', entityId: 'ses_1:propose' });
    expect(post.mock.calls[1][1].dedupeKey).toBe(first.dedupeKey);
  });

  it('never rejects when analytics delivery fails', () => {
    const swallowed = vi.fn();
    post.mockImplementation(() => ({ catch: (h: (e: Error) => void) => swallowed(h(new Error('down'))) }));
    expect(() => trackAgendaEvent('exported', 'ses_1', 'a')).not.toThrow();
    expect(swallowed).toHaveBeenCalledTimes(1);
  });
});
