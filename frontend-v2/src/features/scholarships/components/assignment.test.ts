import { describe, expect, it } from 'vitest';
import {
  assignLoadBalanced,
  assignManual,
  assignRoundRobin,
  assignSeededRandom,
} from '../assignment';
import type { Reviewer } from '../reviewer-pool';

const reviewers: Reviewer[] = [
  {
    id: 'r1',
    displayName: 'Alice',
    expertiseTags: ['blockchain'],
    availability: 'available',
    currentAssignments: 0,
    maxAssignments: 5,
    conflictApplicationIds: [],
    active: true,
  },
  {
    id: 'r2',
    displayName: 'Bob',
    expertiseTags: ['defi'],
    availability: 'available',
    currentAssignments: 1,
    maxAssignments: 5,
    conflictApplicationIds: [],
    active: true,
  },
];

const appIds = ['app-1', 'app-2', 'app-3'];

describe('deterministic assignment', () => {
  describe('round-robin', () => {
    it('returns empty when no reviewers provided', () => {
      expect(assignRoundRobin(appIds, [])).toEqual([]);
    });

    it('cycles through reviewers in order', () => {
      const results = assignRoundRobin(appIds, reviewers);
      expect(results[0].reviewerId).toBe('r1');
      expect(results[1].reviewerId).toBe('r2');
      expect(results[2].reviewerId).toBe('r1');
    });

    it('assigns every application', () => {
      const results = assignRoundRobin(appIds, reviewers);
      expect(results).toHaveLength(appIds.length);
    });

    it('includes correct applicationId and reviewerName in each result', () => {
      const results = assignRoundRobin(['app-x'], reviewers);
      expect(results[0].applicationId).toBe('app-x');
      expect(results[0].reviewerName).toBe('Alice');
    });
  });

  describe('load-balanced', () => {
    it('returns empty when no reviewers provided', () => {
      expect(assignLoadBalanced(appIds, [])).toEqual([]);
    });

    it('prefers the reviewer with fewer assignments', () => {
      const results = assignLoadBalanced(appIds, reviewers);
      expect(results[0].reviewerId).toBe('r1');
    });

    it('balances load across reviewers over multiple assignments', () => {
      const results = assignLoadBalanced(
        ['a1', 'a2', 'a3', 'a4'],
        [
          { ...reviewers[0], currentAssignments: 0 },
          { ...reviewers[1], currentAssignments: 0 },
        ]
      );
      const r1Count = results.filter((r) => r.reviewerId === 'r1').length;
      const r2Count = results.filter((r) => r.reviewerId === 'r2').length;
      expect(Math.abs(r1Count - r2Count)).toBeLessThanOrEqual(1);
    });
  });

  describe('seeded-random', () => {
    it('returns empty when no reviewers provided', () => {
      expect(assignSeededRandom(appIds, [], 'seed')).toEqual([]);
    });

    it('produces reproducible results with the same seed', () => {
      const a = assignSeededRandom(appIds, reviewers, 'test-seed');
      const b = assignSeededRandom(appIds, reviewers, 'test-seed');
      expect(a.map((r) => r.reviewerId)).toEqual(b.map((r) => r.reviewerId));
    });

    it('produces different results with different seeds', () => {
      const longIds = Array.from({ length: 20 }, (_, i) => `app-${i}`);
      const a = assignSeededRandom(longIds, reviewers, 'seed-alpha');
      const b = assignSeededRandom(longIds, reviewers, 'seed-beta');
      const differ = a.some((res, i) => res.reviewerId !== b[i].reviewerId);
      expect(differ).toBe(true);
    });

    it('assigns every application', () => {
      const results = assignSeededRandom(appIds, reviewers, 'any-seed');
      expect(results).toHaveLength(appIds.length);
    });

    it('only assigns to reviewers in the provided list', () => {
      const results = assignSeededRandom(appIds, reviewers, 'check-seed');
      const validIds = new Set(reviewers.map((r) => r.id));
      expect(results.every((r) => validIds.has(r.reviewerId))).toBe(true);
    });
  });

  describe('manual', () => {
    it('assigns the specified reviewer', () => {
      const result = assignManual('app-1', reviewers[1]);
      expect(result.reviewerId).toBe('r2');
      expect(result.reviewerName).toBe('Bob');
      expect(result.applicationId).toBe('app-1');
    });
  });
});
