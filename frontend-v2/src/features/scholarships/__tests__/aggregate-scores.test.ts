import { describe, it, expect } from 'vitest';
import {
  computeNormalizedAggregate,
  rankAggregates,
  MIN_REVIEWS_FOR_COMPLETE_AGGREGATE,
} from '../aggregate-scores';
import type { ScoringRubric } from '../scoring-rubric';
import type { ReviewSubmission } from '../review-submission';

const RUBRIC: ScoringRubric = {
  id: 'rubric-001',
  name: 'Test Rubric',
  description: 'Two 50/50 criteria',
  version: 1,
  status: 'published',
  criteria: [
    {
      id: 'c-academic',
      name: 'Academic merit',
      description: 'Academic quality',
      weightPercent: 50,
      scale: [
        { value: 0, label: 'None', description: '' },
        { value: 1, label: 'Low', description: '' },
        { value: 2, label: 'Mid', description: '' },
        { value: 3, label: 'High', description: '' },
      ],
      guidanceNotes: '',
      requiresComment: false,
    },
    {
      id: 'c-impact',
      name: 'Community impact',
      description: 'Impact quality',
      weightPercent: 50,
      scale: [
        { value: 0, label: 'None', description: '' },
        { value: 1, label: 'Low', description: '' },
        { value: 2, label: 'Mid', description: '' },
        { value: 3, label: 'High', description: '' },
      ],
      guidanceNotes: '',
      requiresComment: false,
    },
  ],
  createdAt: '2024-01-01T00:00:00Z',
  publishedAt: '2024-01-01T00:00:00Z',
};

function makeReview(id: string, academicScore: number, impactScore: number): ReviewSubmission {
  return {
    id,
    applicationId: 'app-001',
    reviewerId: `reviewer-${id}`,
    rubricId: 'rubric-001',
    rubricVersion: 1,
    scores: [
      { criterionId: 'c-academic', rubricId: 'rubric-001', rubricVersion: 1, score: academicScore },
      { criterionId: 'c-impact', rubricId: 'rubric-001', rubricVersion: 1, score: impactScore },
    ],
    recommendation: 'approve',
    overallComment: 'Test',
    submittedAt: '2024-01-10T00:00:00Z',
    locked: true,
  };
}

describe('computeNormalizedAggregate', () => {
  it('returns error for empty reviews', () => {
    const result = computeNormalizedAggregate('app-001', [], RUBRIC);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('NO_REVIEWS');
  });

  it('computes perfect score correctly', () => {
    const reviews = [makeReview('r1', 3, 3)];
    const result = computeNormalizedAggregate('app-001', reviews, RUBRIC);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.aggregate.aggregateScore).toBe(100);
      expect(result.aggregate.reviewScores[0].normalizedTotal).toBe(100);
    }
  });

  it('computes zero score correctly', () => {
    const reviews = [makeReview('r1', 0, 0)];
    const result = computeNormalizedAggregate('app-001', reviews, RUBRIC);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.aggregate.aggregateScore).toBe(0);
  });

  it('computes 50% score for half-max ratings', () => {
    const reviews = [makeReview('r1', 1, 2)];
    const result = computeNormalizedAggregate('app-001', reviews, RUBRIC);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const score = result.aggregate.aggregateScore;
      expect(score).toBeCloseTo((1 / 3) * 50 + (2 / 3) * 50, 1);
    }
  });

  it('averages scores across multiple reviews', () => {
    const reviews = [makeReview('r1', 3, 3), makeReview('r2', 0, 0)];
    const result = computeNormalizedAggregate('app-001', reviews, RUBRIC);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.aggregate.aggregateScore).toBe(50);
      expect(result.aggregate.totalReviews).toBe(2);
    }
  });

  it('rounds to 2 decimal places (SCORE_PRECISION)', () => {
    const reviews = [makeReview('r1', 1, 1)];
    const result = computeNormalizedAggregate('app-001', reviews, RUBRIC);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const s = result.aggregate.aggregateScore.toString();
      const decimals = s.includes('.') ? s.split('.')[1].length : 0;
      expect(decimals).toBeLessThanOrEqual(2);
    }
  });

  it('flags incomplete when fewer than MIN_REVIEWS reviews', () => {
    const reviews = [makeReview('r1', 3, 3)];
    const result = computeNormalizedAggregate('app-001', reviews, RUBRIC);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.aggregate.isComplete).toBe(
        reviews.length >= MIN_REVIEWS_FOR_COMPLETE_AGGREGATE
      );
    }
  });

  it('marks complete with enough reviews', () => {
    const reviews = [makeReview('r1', 3, 3), makeReview('r2', 2, 2)];
    const result = computeNormalizedAggregate('app-001', reviews, RUBRIC);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.aggregate.isComplete).toBe(true);
  });

  it('detects rubric version mismatch', () => {
    const staleReview: ReviewSubmission = { ...makeReview('r1', 3, 3), rubricVersion: 0 };
    const result = computeNormalizedAggregate('app-001', [staleReview], RUBRIC);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.aggregate.hasRubricVersionMismatch).toBe(true);
  });

  it('sets tiePolicy to application_id_asc', () => {
    const reviews = [makeReview('r1', 2, 2)];
    const result = computeNormalizedAggregate('app-001', reviews, RUBRIC);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.aggregate.tiePolicy).toBe('application_id_asc');
  });

  it('populates criterion weighted contributions', () => {
    const reviews = [makeReview('r1', 3, 3)];
    const result = computeNormalizedAggregate('app-001', reviews, RUBRIC);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const cs = result.aggregate.reviewScores[0].criterionScores;
      expect(cs.every((c) => c.weightedContribution >= 0)).toBe(true);
    }
  });
});

describe('rankAggregates', () => {
  it('sorts by descending aggregateScore', () => {
    const agg = (appId: string, score: number) => ({
      applicationId: appId,
      reviewScores: [],
      aggregateScore: score,
      totalReviews: 2,
      isComplete: true,
      hasRubricVersionMismatch: false,
      tiePolicy: 'application_id_asc' as const,
      computedAt: '',
    });
    const ranked = rankAggregates([agg('b', 70), agg('a', 90), agg('c', 80)]);
    expect(ranked.map((r) => r.aggregateScore)).toEqual([90, 80, 70]);
  });

  it('breaks ties by applicationId ascending', () => {
    const agg = (appId: string) => ({
      applicationId: appId,
      reviewScores: [],
      aggregateScore: 75,
      totalReviews: 2,
      isComplete: true,
      hasRubricVersionMismatch: false,
      tiePolicy: 'application_id_asc' as const,
      computedAt: '',
    });
    const ranked = rankAggregates([agg('app-zzz'), agg('app-aaa'), agg('app-mmm')]);
    expect(ranked.map((r) => r.applicationId)).toEqual(['app-aaa', 'app-mmm', 'app-zzz']);
  });

  it('does not mutate the input array', () => {
    const input = [
      { applicationId: 'b', reviewScores: [], aggregateScore: 70, totalReviews: 2, isComplete: true, hasRubricVersionMismatch: false, tiePolicy: 'application_id_asc' as const, computedAt: '' },
      { applicationId: 'a', reviewScores: [], aggregateScore: 90, totalReviews: 2, isComplete: true, hasRubricVersionMismatch: false, tiePolicy: 'application_id_asc' as const, computedAt: '' },
    ];
    const copy = [...input];
    rankAggregates(input);
    expect(input).toEqual(copy);
  });
});
