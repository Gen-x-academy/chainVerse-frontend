import { beforeEach, describe, expect, it, vi } from 'vitest';

const post = vi.fn();
vi.mock('@/src/lib/api-client', () => ({
  apiClient: { post: (...a: unknown[]) => post(...a), get: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import { trackPrivateNoteEvent } from '../private-notes.service';

describe('trackPrivateNoteEvent', () => {
  beforeEach(() => post.mockReset().mockResolvedValue(undefined));

  it('emits an event with ids only and a stable dedupe key', () => {
    const at = new Date('2026-01-01T00:00:00Z');
    trackPrivateNoteEvent('created', 'note_001', 'actor_x', at);
    trackPrivateNoteEvent('created', 'note_001', 'actor_x', at);
    const [path, first] = post.mock.calls[0];
    expect(path).toBe('/mentorship/analytics/events');
    expect(first.stage).toBe('private_note');
    expect(first.entityId).toBe('note_001:created');
    expect(post.mock.calls[1][1].dedupeKey).toBe(first.dedupeKey);
  });

  it('never rejects when delivery fails', () => {
    // A bare thenable keeps the mock runner from tracking its own rejection.
    const swallowed = vi.fn();
    post.mockImplementation(() => ({
      catch: (handler: (error: Error) => void) => swallowed(handler(new Error('down'))),
    }));
    expect(() => trackPrivateNoteEvent('deleted', 'note_001', 'a')).not.toThrow();
    expect(swallowed).toHaveBeenCalledTimes(1);
  });
});
