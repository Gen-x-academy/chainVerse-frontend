import { describe, expect, it } from 'vitest';
import {
  fallbackReviewerPool,
  filterActiveReviewers,
  getWorkloadRatio,
  isReviewerAvailable,
  validateReviewerPool,
} from '../reviewer-pool';
import type { Reviewer } from '../reviewer-pool';

const baseReviewer: Reviewer = {
  id: 'r1',
  displayName: 'Alice',
  expertiseTags: ['blockchain'],
  availability: 'available',
  currentAssignments: 1,
  maxAssignments: 5,
  conflictApplicationIds: [],
  active: true,
};

describe('reviewer pool', () => {
  it('marks a reviewer at capacity as unavailable', () => {
    expect(
      isReviewerAvailable({ ...baseReviewer, currentAssignments: 5, maxAssignments: 5 })
    ).toBe(false);
  });

  it('marks an inactive reviewer as unavailable', () => {
    expect(isReviewerAvailable({ ...baseReviewer, active: false })).toBe(false);
  });

  it('marks a reviewer with availability set to unavailable as unavailable', () => {
    expect(isReviewerAvailable({ ...baseReviewer, availability: 'unavailable' })).toBe(false);
  });

  it('marks an available reviewer under capacity as available', () => {
    expect(isReviewerAvailable(baseReviewer)).toBe(true);
  });

  it('returns only reviewers that pass isReviewerAvailable', () => {
    const active = filterActiveReviewers(fallbackReviewerPool);
    expect(active.every(isReviewerAvailable)).toBe(true);
  });

  it('excludes unavailable reviewers from the active list', () => {
    const inactive = fallbackReviewerPool.reviewers.filter((r) => !isReviewerAvailable(r));
    const active = filterActiveReviewers(fallbackReviewerPool);
    expect(inactive.every((r) => !active.includes(r))).toBe(true);
  });

  it('computes workload ratio correctly', () => {
    expect(
      getWorkloadRatio({ ...baseReviewer, currentAssignments: 3, maxAssignments: 5 })
    ).toBeCloseTo(0.6);
  });

  it('returns 1 for a reviewer with maxAssignments of 0', () => {
    expect(getWorkloadRatio({ ...baseReviewer, maxAssignments: 0 })).toBe(1);
  });

  it('returns 1 for a reviewer at full capacity', () => {
    expect(
      getWorkloadRatio({ ...baseReviewer, currentAssignments: 5, maxAssignments: 5 })
    ).toBe(1);
  });

  it('validates that a pool with no reviewers is invalid', () => {
    const result = validateReviewerPool({ ...fallbackReviewerPool, reviewers: [] });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('validates that a pool with a missing name is invalid', () => {
    const result = validateReviewerPool({ ...fallbackReviewerPool, name: '' });
    expect(result.valid).toBe(false);
  });

  it('validates that a pool with a missing scholarshipId is invalid', () => {
    const result = validateReviewerPool({ ...fallbackReviewerPool, scholarshipId: '' });
    expect(result.valid).toBe(false);
  });

  it('warns when no reviewers are available despite the pool being non-empty', () => {
    const pool = {
      ...fallbackReviewerPool,
      reviewers: [{ ...baseReviewer, active: false }],
    };
    const result = validateReviewerPool(pool);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('reports an error for duplicate reviewer ids', () => {
    const pool = {
      ...fallbackReviewerPool,
      reviewers: [baseReviewer, { ...baseReviewer, displayName: 'Bob' }],
    };
    const result = validateReviewerPool(pool);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Duplicate'))).toBe(true);
  });

  it('reports an error when a reviewer has a negative max assignment count', () => {
    const pool = {
      ...fallbackReviewerPool,
      reviewers: [{ ...baseReviewer, maxAssignments: -1 }],
    };
    const result = validateReviewerPool(pool);
    expect(result.valid).toBe(false);
  });

  it('passes validation for the default fallback pool', () => {
    const result = validateReviewerPool(fallbackReviewerPool);
    expect(result.errors).toHaveLength(0);
  });
});
