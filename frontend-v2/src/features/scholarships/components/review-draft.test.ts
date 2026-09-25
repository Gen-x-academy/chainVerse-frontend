import { describe, expect, it } from 'vitest';
import { isDraftOwner, isDraftConflict } from '../review-draft';
import type { ReviewDraft } from '../review-draft';

const draft: ReviewDraft = {
  id: 'draft-1',
  applicationId: 'app-1',
  reviewerId: 'reviewer-42',
  rubricId: 'rubric-1',
  rubricVersion: 2,
  scores: [],
  notes: 'Working notes.',
  savedAt: '2024-06-01T10:00:00Z',
  etag: 'abc123',
};

describe('isDraftOwner (#1105)', () => {
  it('returns true when the reviewer id matches the draft owner', () => {
    expect(isDraftOwner(draft, 'reviewer-42')).toBe(true);
  });

  it('returns false when the reviewer id does not match', () => {
    expect(isDraftOwner(draft, 'reviewer-99')).toBe(false);
  });

  it('returns false for an empty reviewer id', () => {
    expect(isDraftOwner(draft, '')).toBe(false);
  });

  it('is case-sensitive', () => {
    expect(isDraftOwner(draft, 'Reviewer-42')).toBe(false);
  });
});

describe('isDraftConflict (#1105)', () => {
  it('returns false when etags match', () => {
    expect(isDraftConflict('abc123', 'abc123')).toBe(false);
  });

  it('returns true when etags differ', () => {
    expect(isDraftConflict('abc123', 'xyz789')).toBe(true);
  });

  it('returns true when local etag is stale empty string', () => {
    expect(isDraftConflict('', 'abc123')).toBe(true);
  });

  it('returns false when both etags are empty', () => {
    expect(isDraftConflict('', '')).toBe(false);
  });
});

describe('draft ownership invariants (#1105)', () => {
  it('only the owning reviewer can write — other reviewers are blocked', () => {
    const reviewers = ['reviewer-1', 'reviewer-2', 'reviewer-3'];
    for (const id of reviewers) {
      const owned = isDraftOwner(draft, id);
      expect(owned).toBe(id === draft.reviewerId);
    }
  });

  it('a draft with a fresh etag has no conflict against itself', () => {
    expect(isDraftConflict(draft.etag, draft.etag)).toBe(false);
  });

  it('any mutation to the etag produces a conflict', () => {
    expect(isDraftConflict(draft.etag, draft.etag + '-modified')).toBe(true);
  });
});
