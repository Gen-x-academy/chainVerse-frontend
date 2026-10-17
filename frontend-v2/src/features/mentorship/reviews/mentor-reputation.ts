/** MENTOR-095: calculate a robust, explainable mentor reputation from verified reviews and engagement outcomes. */
export type ReviewStatus = 'published' | 'removed';

export interface MentorReview {
  id: string;
  mentorId: string;
  /** Whole-star rating from 1 to 5. */
  rating: number;
  /** Only reviews tied to a completed engagement count towards reputation. */
  verified: boolean;
  status: ReviewStatus;
}

export interface EngagementOutcomes {
  completed: number;
  cancelled: number;
  noShows: number;
}

export interface ReputationInput {
  reviews: MentorReview[];
  outcomes: EngagementOutcomes;
  /** Safety or policy cases that were investigated and substantiated. */
  substantiatedCases: number;
}

export interface ReputationBreakdown {
  /** False until the mentor has enough verified reviews to publish a score. */
  published: boolean;
  reviewCount: number;
  /** Mean rating after outlier trimming, on a 1-5 scale. */
  ratingScore: number | null;
  /** Share of engagements that completed, 0-1. */
  completionRate: number | null;
  /** Share of engagements without a no-show, 0-1. */
  reliabilityScore: number | null;
  /** Multiplier applied to penalise substantiated cases, 0-1. */
  policyPenalty: number;
  /** Final 0-100 score, or null when it cannot be published. */
  overall: number | null;
  /** Ordered, human-readable explanation of each contributing factor. */
  reasons: string[];
}

export const MIN_REVIEWS_FOR_REPUTATION = 3;
const TRIM_THRESHOLD = 5;
const RATING_WEIGHT = 0.6;
const COMPLETION_WEIGHT = 0.25;
const RELIABILITY_WEIGHT = 0.15;
const PENALTY_PER_CASE = 0.1;
const MAX_PENALTY = 0.5;

const isValidRating = (rating: number) => Number.isFinite(rating) && rating >= 1 && rating <= 5;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Eligible reviews are verified, published and carry a valid rating; everything else is ignored. */
export function eligibleReviews(reviews: MentorReview[]): MentorReview[] {
  return reviews.filter((r) => r.status === 'published' && r.verified && isValidRating(r.rating));
}

export function calculateMentorReputation(input: ReputationInput): ReputationBreakdown {
  const eligible = eligibleReviews(input.reviews);
  const reviewCount = eligible.length;
  const { completed, cancelled, noShows } = input.outcomes;
  const totalEngagements = completed + cancelled + noShows;
  const policyPenalty = Math.min(Math.max(0, input.substantiatedCases) * PENALTY_PER_CASE, MAX_PENALTY);

  if (reviewCount < MIN_REVIEWS_FOR_REPUTATION) {
    return {
      published: false,
      reviewCount,
      ratingScore: null,
      completionRate: totalEngagements > 0 ? round2(completed / totalEngagements) : null,
      reliabilityScore: totalEngagements > 0 ? round2(1 - noShows / totalEngagements) : null,
      policyPenalty,
      overall: null,
      reasons: [`A reputation is published only after ${MIN_REVIEWS_FOR_REPUTATION} verified reviews (${reviewCount} so far)`],
    };
  }

  const ratings = eligible.map((r) => r.rating).sort((a, b) => a - b);
  const trimmed = ratings.length >= TRIM_THRESHOLD ? ratings.slice(1, -1) : ratings;
  const ratingScore = trimmed.reduce((sum, r) => sum + r, 0) / trimmed.length;

  const completionRate = totalEngagements > 0 ? completed / totalEngagements : null;
  const reliabilityScore = totalEngagements > 0 ? 1 - noShows / totalEngagements : null;

  const parts = [
    { score: ratingScore / 5, weight: RATING_WEIGHT },
    { score: completionRate, weight: COMPLETION_WEIGHT },
    { score: reliabilityScore, weight: RELIABILITY_WEIGHT },
  ].filter((part): part is { score: number; weight: number } => part.score !== null);

  const weightSum = parts.reduce((sum, part) => sum + part.weight, 0);
  const weighted = parts.reduce((sum, part) => sum + part.score * part.weight, 0) / weightSum;
  const overall = Math.round(weighted * 100 * (1 - policyPenalty));

  const reasons = [
    `Computed from ${reviewCount} verified reviews`,
    ratings.length >= TRIM_THRESHOLD
      ? 'Highest and lowest ratings trimmed to reduce the impact of outliers'
      : 'No trimming: fewer than 5 verified reviews',
    `Rating score ${round2(ratingScore)}/5`,
  ];
  if (completionRate !== null) reasons.push(`Completion rate ${Math.round(completionRate * 100)}%`);
  if (reliabilityScore !== null) reasons.push(`Reliability ${Math.round(reliabilityScore * 100)}% (no-show adjusted)`);
  reasons.push(
    policyPenalty > 0
      ? `${input.substantiatedCases} substantiated case(s) applied a ${Math.round(policyPenalty * 100)}% penalty`
      : 'No substantiated safety or policy cases',
  );

  return {
    published: true,
    reviewCount,
    ratingScore: round2(ratingScore),
    completionRate: completionRate === null ? null : round2(completionRate),
    reliabilityScore: reliabilityScore === null ? null : round2(reliabilityScore),
    policyPenalty,
    overall,
    reasons,
  };
}
