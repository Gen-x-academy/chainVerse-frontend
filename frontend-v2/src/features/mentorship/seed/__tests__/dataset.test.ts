import { describe, expect, it } from 'vitest';
import {
  buildMentorshipSeedDataset,
  clearPersistedMentorshipState,
  engagementIdsAreWellFormed,
  resetMentorshipSeedData,
  seedDataIsSynthetic,
} from '../dataset';
import { MENTORSHIP_LIFECYCLES } from '../../glossary';

describe('deterministic mentorship seed data (MENTOR-007, #1254)', () => {
  it('is deterministic: the same seed deep-equals the same dataset', () => {
    const first = buildMentorshipSeedDataset({ seed: 42 });
    const second = buildMentorshipSeedDataset({ seed: 42 });
    expect(second).toEqual(first);
  });

  it('varies with the seed', () => {
    const first = buildMentorshipSeedDataset({ seed: 42 });
    const second = buildMentorshipSeedDataset({ seed: 43 });
    expect(second).not.toEqual(first);
  });

  it('covers every engagement state, including sparse and terminal ones', () => {
    const dataset = buildMentorshipSeedDataset({ seed: 42 });
    const known = new Set(MENTORSHIP_LIFECYCLES.engagement.states as readonly string[]);
    const seen = new Set(dataset.engagements.map((engagement) => engagement.status));
    for (const status of known) {
      expect(seen.has(status as never), `missing engagement status: ${status}`).toBe(true);
    }
  });

  it('uses well-formed, opaque, aggregate-prefixed identifiers', () => {
    const dataset = buildMentorshipSeedDataset({ seed: 42 });
    expect(engagementIdsAreWellFormed(dataset)).toBe(true);
    for (const mentor of dataset.mentors) {
      expect(mentor.id.startsWith('mtr_')).toBe(true);
    }
    for (const payment of dataset.payments) {
      expect(payment.id.startsWith('pay_')).toBe(true);
    }
  });

  it('keeps payment amounts in integer minor units with a supported currency', () => {
    const dataset = buildMentorshipSeedDataset({ seed: 42 });
    for (const payment of dataset.payments) {
      expect(Number.isInteger(payment.amountMinorUnits)).toBe(true);
      expect(['XLM', 'USDC']).toContain(payment.currency);
    }
  });

  it('contains only synthetic names and never stores emails', () => {
    const dataset = buildMentorshipSeedDataset({ seed: 42 });
    expect(seedDataIsSynthetic(dataset)).toBe(true);
    expect(JSON.stringify(dataset)).not.toMatch('@');
  });

  it('clears only mentorship-prefixed storage keys when resetting', () => {
    const store = new Map<string, string>([
      ['chainverse-mentorship-cache', '1'],
      ['unrelated-key', 'keep me'],
      ['chainverse-mentorship-session', '2'],
    ]);
    const fakeStorage = {
      get length() {
        return store.size;
      },
      key: (index: number) => [...store.keys()][index] ?? null,
      removeItem: (key: string) => {
        store.delete(key);
      },
    };
    const dataset = resetMentorshipSeedData(fakeStorage);
    expect(dataset.version).toBe('1.0.0');
    expect(store.has('chainverse-mentorship-cache')).toBe(false);
    expect(store.has('chainverse-mentorship-session')).toBe(false);
    expect(store.has('unrelated-key')).toBe(true);
    expect(clearPersistedMentorshipState(fakeStorage)).toBeUndefined();
  });
});
