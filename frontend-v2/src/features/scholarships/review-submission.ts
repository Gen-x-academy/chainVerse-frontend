import { apiClient } from '@/src/lib/api-client';
import type { CriterionScore, ScoringRubric } from './scoring-rubric';
import { validateCriterionScore, isDisqualifyingScore } from './scoring-rubric';

export type ReviewRecommendation = 'approve' | 'reject' | 'shortlist' | 'needs_more_info';

export type ReviewSubmission = {
  id: string;
  applicationId: string;
  reviewerId: string;
  rubricId: string;
  rubricVersion: number;
  scores: CriterionScore[];
  recommendation: ReviewRecommendation;
  overallComment: string;
  submittedAt: string;
  /** Always true after submission. Submitted reviews are immutable. */
  locked: boolean;
};

export type ReviewAmendment = {
  id: string;
  reviewId: string;
  reviewerId: string;
  reason: string;
  changedFields: string[];
  previousValues: Partial<ReviewSubmission>;
  requestedAt: string;
  approvedAt?: string;
  appliedAt?: string;
  status: 'pending' | 'approved' | 'applied' | 'denied';
};

export type AggregateResult = {
  applicationId: string;
  totalReviews: number;
  averageScore: number;
  recommendations: Record<ReviewRecommendation, number>;
  lastUpdatedAt: string;
};

export type SubmitReviewPayload = {
  rubricId: string;
  rubricVersion: number;
  scores: CriterionScore[];
  recommendation: ReviewRecommendation;
  overallComment: string;
};

export type SubmitReviewValidationError = { field: string; message: string };

export function validateSubmission(
  payload: SubmitReviewPayload,
  rubric: ScoringRubric
): SubmitReviewValidationError[] {
  const errors: SubmitReviewValidationError[] = [];

  const scoredIds = new Set(payload.scores.map((s) => s.criterionId));
  for (const criterion of rubric.criteria) {
    if (!scoredIds.has(criterion.id)) {
      errors.push({ field: criterion.id, message: `Criterion "${criterion.name}" has not been scored.` });
    }
  }

  for (const score of payload.scores) {
    errors.push(...validateCriterionScore(score, rubric));
  }

  if (!payload.overallComment.trim()) {
    errors.push({ field: 'overallComment', message: 'An overall comment is required before submission.' });
  }

  return errors;
}

export function hasDisqualifyingScore(scores: CriterionScore[], rubric: ScoringRubric): boolean {
  return scores.some((s) => isDisqualifyingScore(s, rubric));
}

export const reviewSubmissionService = {
  submit: (applicationId: string, payload: SubmitReviewPayload): Promise<ReviewSubmission> =>
    apiClient.post<ReviewSubmission>(
      `/scholarships/applications/${encodeURIComponent(applicationId)}/reviews`,
      payload
    ),

  get: (applicationId: string, reviewId: string): Promise<ReviewSubmission> =>
    apiClient.get<ReviewSubmission>(
      `/scholarships/applications/${encodeURIComponent(applicationId)}/reviews/${encodeURIComponent(reviewId)}`
    ),

  list: (applicationId: string): Promise<ReviewSubmission[]> =>
    apiClient.get<ReviewSubmission[]>(
      `/scholarships/applications/${encodeURIComponent(applicationId)}/reviews`
    ),

  requestAmendment: (
    reviewId: string,
    reason: string,
    changedFields: string[]
  ): Promise<ReviewAmendment> =>
    apiClient.post<ReviewAmendment>(
      `/scholarships/reviews/${encodeURIComponent(reviewId)}/amendments`,
      { reason, changedFields }
    ),

  getAggregate: (applicationId: string): Promise<AggregateResult> =>
    apiClient.get<AggregateResult>(
      `/scholarships/applications/${encodeURIComponent(applicationId)}/review-aggregate`
    ),
};
