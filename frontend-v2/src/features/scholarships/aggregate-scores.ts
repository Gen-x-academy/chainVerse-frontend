/**
 * Normalized aggregate score computation (issue #1108).
 *
 * Each criterion score is first normalized to [0, 1] by dividing by the
 * criterion's maximum scale value, then multiplied by the criterion's weight
 * (weightPercent / 100). The sum across all criteria gives a per-review
 * normalized score in [0, 1], which is then multiplied by 100. All final
 * values are rounded to two decimal places using standard half-up rounding
 * (Math.round(x * 100) / 100) so results are reproducible from immutable
 * inputs.
 *
 * Tie policy: when two applications share the same normalized aggregate score
 * (to two decimal places), they rank equal. Where a strict ordering is
 * required callers should break ties by applicationId lexicographic order
 * (ascending) — this is deterministic and documented here as the canonical
 * tiebreaker.
 */

import type { CriterionScore, ScoringRubric } from './scoring-rubric';
import type { ReviewSubmission } from './review-submission';
import { apiClient } from '@/src/lib/api-client';

export const SCORE_PRECISION = 2;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Minimum number of reviews required before an aggregate can be considered complete. */
export const MIN_REVIEWS_FOR_COMPLETE_AGGREGATE = 2;

export type NormalizedCriterionScore = {
  criterionId: string;
  criterionName: string;
  weightPercent: number;
  rawScore: number;
  maxRawScore: number;
  /** Contribution to the overall score: round2((rawScore / maxRawScore) * weightPercent). */
  weightedContribution: number;
};

export type NormalizedReviewScore = {
  reviewId: string;
  reviewerId: string;
  criterionScores: NormalizedCriterionScore[];
  /** Normalized total in [0, 100], rounded to SCORE_PRECISION decimal places. */
  normalizedTotal: number;
  rubricVersion: number;
  submittedAt: string;
};

export type TiePolicy = 'application_id_asc';

export type NormalizedAggregateScore = {
  applicationId: string;
  reviewScores: NormalizedReviewScore[];
  /** Average of per-review normalized totals, rounded to SCORE_PRECISION. */
  aggregateScore: number;
  totalReviews: number;
  /** True when totalReviews >= MIN_REVIEWS_FOR_COMPLETE_AGGREGATE. */
  isComplete: boolean;
  /** True when at least one review used a different rubric version. */
  hasRubricVersionMismatch: boolean;
  tiePolicy: TiePolicy;
  computedAt: string;
};

export type AggregateComputationError = {
  code: 'NO_REVIEWS' | 'RUBRIC_MISMATCH' | 'INVALID_CRITERION';
  message: string;
};

export type AggregateComputationResult =
  | { ok: true; aggregate: NormalizedAggregateScore }
  | { ok: false; error: AggregateComputationError };

function computeNormalizedReviewScore(
  review: ReviewSubmission,
  rubric: ScoringRubric
): NormalizedReviewScore {
  const criterionScores: NormalizedCriterionScore[] = [];

  for (const criterion of rubric.criteria) {
    const scoreEntry: CriterionScore | undefined = review.scores.find(
      (s) => s.criterionId === criterion.id
    );
    const rawScore = scoreEntry?.score ?? 0;
    const maxRawScore = Math.max(...criterion.scale.map((s) => s.value), 1);
    const weightedContribution = round2((rawScore / maxRawScore) * criterion.weightPercent);

    criterionScores.push({
      criterionId: criterion.id,
      criterionName: criterion.name,
      weightPercent: criterion.weightPercent,
      rawScore,
      maxRawScore,
      weightedContribution,
    });
  }

  const normalizedTotal = round2(
    criterionScores.reduce((sum, cs) => sum + cs.weightedContribution, 0)
  );

  return {
    reviewId: review.id,
    reviewerId: review.reviewerId,
    criterionScores,
    normalizedTotal,
    rubricVersion: review.rubricVersion,
    submittedAt: review.submittedAt,
  };
}

export function computeNormalizedAggregate(
  applicationId: string,
  reviews: ReviewSubmission[],
  rubric: ScoringRubric
): AggregateComputationResult {
  if (reviews.length === 0) {
    return {
      ok: false,
      error: { code: 'NO_REVIEWS', message: 'No reviews available to compute an aggregate score.' },
    };
  }

  const reviewScores = reviews.map((r) => computeNormalizedReviewScore(r, rubric));

  const hasRubricVersionMismatch = reviewScores.some((r) => r.rubricVersion !== rubric.version);

  const aggregateScore = round2(
    reviewScores.reduce((sum, r) => sum + r.normalizedTotal, 0) / reviewScores.length
  );

  return {
    ok: true,
    aggregate: {
      applicationId,
      reviewScores,
      aggregateScore,
      totalReviews: reviews.length,
      isComplete: reviews.length >= MIN_REVIEWS_FOR_COMPLETE_AGGREGATE,
      hasRubricVersionMismatch,
      tiePolicy: 'application_id_asc',
      computedAt: new Date().toISOString(),
    },
  };
}

/**
 * Rank a list of computed aggregates.
 * Primary sort: descending aggregateScore.
 * Tiebreaker: ascending applicationId (lexicographic, deterministic).
 */
export function rankAggregates(
  aggregates: NormalizedAggregateScore[]
): NormalizedAggregateScore[] {
  return [...aggregates].sort((a, b) => {
    if (b.aggregateScore !== a.aggregateScore) return b.aggregateScore - a.aggregateScore;
    return a.applicationId < b.applicationId ? -1 : 1;
  });
}

export const aggregateScoreService = {
  compute: (applicationId: string): Promise<NormalizedAggregateScore> =>
    apiClient.get<NormalizedAggregateScore>(
      `/scholarships/applications/${encodeURIComponent(applicationId)}/aggregate-score`
    ),

  listByRound: (roundId: string): Promise<NormalizedAggregateScore[]> =>
    apiClient.get<NormalizedAggregateScore[]>(
      `/scholarships/rounds/${encodeURIComponent(roundId)}/aggregate-scores`
    ),
};
