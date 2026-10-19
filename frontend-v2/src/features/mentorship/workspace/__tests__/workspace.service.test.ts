import { beforeEach, describe, expect, it, vi } from 'vitest';

const post = vi.fn();
vi.mock('@/src/lib/api-client', () => ({
  apiClient: { post: (...a: unknown[]) => post(...a), get: vi.fn() },
}));

import { trackWorkspaceEvent, workspaceService } from '../workspace.service';

describe('workspace service', () => {
  beforeEach(() => post.mockReset().mockResolvedValue({}));

  it('posts the command envelope', async () => {
    const env = { commandId: 'c1', baseVersion: 2, command: { type: 'set-follow-up-done', followUpId: 'f', done: true } } as const;
    await workspaceService.apply('ses 1', env);
    expect(post).toHaveBeenCalledWith('/mentorship/sessions/ses%201/workspace/commands', env);
  });

  it('emits id-only analytics with a stable dedupe key', () => {
    const at = new Date('2026-01-01T00:00:00Z');
    trackWorkspaceEvent('opened', 'ses_1', 'actor', at);
    trackWorkspaceEvent('opened', 'ses_1', 'actor', at);
    const first = post.mock.calls[0][1];
    expect(first).toMatchObject({ stage: 'session_workspace', entityId: 'ses_1:opened' });
    expect(post.mock.calls[1][1].dedupeKey).toBe(first.dedupeKey);
  });

  it('never rejects when analytics delivery fails', () => {
    const swallowed = vi.fn();
    post.mockImplementation(() => ({ catch: (h: (e: Error) => void) => swallowed(h(new Error('down'))) }));
    expect(() => trackWorkspaceEvent('section_viewed', 'ses_1', 'a')).not.toThrow();
    expect(swallowed).toHaveBeenCalledTimes(1);
  });
});
