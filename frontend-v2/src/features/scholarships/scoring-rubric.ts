import { apiClient } from '@/src/lib/api-client';

export type RubricScale = {
  value: number;
  label: string;
  description: string;
};

export type RubricCriterion = {
  id: string;
  name: string;
  description: string;
  /** Weight in percentage points. All criteria weights must sum to 100. */
  weightPercent: number;
  scale: RubricScale[];
  guidanceNotes: string;
  requiresComment: boolean;
  /** Scores strictly below this threshold disqualify the application. */
  disqualifyingThreshold?: number;
};

export type RubricStatus = 'draft' | 'published';

export type ScoringRubric = {
  id: string;
  name: string;
  description: string;
  /** Monotonically increasing. Published rubrics are immutable — bumped on every publish. */
  version: number;
  previousVersionId?: string;
  status: RubricStatus;
  criteria: RubricCriterion[];
  createdAt: string;
  publishedAt?: string;
};

export type RubricValidationError = { field: string; message: string };

export type CriterionScore = {
  criterionId: string;
  rubricId: string;
  /** Scores must reference the exact published version used during review. */
  rubricVersion: number;
  score: number;
  comment?: string;
};

export function validateRubricWeights(criteria: RubricCriterion[]): RubricValidationError[] {
  const errors: RubricValidationError[] = [];
  if (criteria.length === 0) {
    errors.push({ field: 'criteria', message: 'At least one criterion is required.' });
    return errors;
  }
  const total = criteria.reduce((sum, c) => sum + c.weightPercent, 0);
  if (total !== 100) {
    errors.push({
      field: 'weights',
      message: `Criterion weights must sum to 100. Current total: ${total}.`,
    });
  }
  for (const c of criteria) {
    if (c.weightPercent <= 0) {
      errors.push({ field: c.id, message: `"${c.name}" must have a positive weight.` });
    }
    if (c.scale.length < 2) {
      errors.push({ field: c.id, message: `"${c.name}" must define at least two scale points.` });
    }
  }
  return errors;
}

export function validateCriterionScore(
  score: CriterionScore,
  rubric: ScoringRubric
): RubricValidationError[] {
  const errors: RubricValidationError[] = [];
  if (rubric.version !== score.rubricVersion) {
    errors.push({
      field: 'rubricVersion',
      message: `Score references rubric version ${score.rubricVersion} but rubric is at version ${rubric.version}.`,
    });
  }
  const criterion = rubric.criteria.find((c) => c.id === score.criterionId);
  if (!criterion) {
    errors.push({ field: 'criterionId', message: `Criterion "${score.criterionId}" not found in rubric.` });
    return errors;
  }
  const validValues = criterion.scale.map((s) => s.value);
  if (!validValues.includes(score.score)) {
    errors.push({
      field: 'score',
      message: `Score ${score.score} is not a valid scale value for "${criterion.name}".`,
    });
  }
  if (criterion.requiresComment && !score.comment?.trim()) {
    errors.push({ field: 'comment', message: `A comment is required for criterion "${criterion.name}".` });
  }
  return errors;
}

export function isDisqualifyingScore(score: CriterionScore, rubric: ScoringRubric): boolean {
  const criterion = rubric.criteria.find((c) => c.id === score.criterionId);
  if (!criterion || criterion.disqualifyingThreshold === undefined) return false;
  return score.score < criterion.disqualifyingThreshold;
}

export const scoringRubricService = {
  list: (roundId: string): Promise<ScoringRubric[]> =>
    apiClient.get<ScoringRubric[]>(`/scholarships/rounds/${encodeURIComponent(roundId)}/rubrics`),

  get: (rubricId: string): Promise<ScoringRubric> =>
    apiClient.get<ScoringRubric>(`/scholarships/rubrics/${encodeURIComponent(rubricId)}`),

  create: (
    roundId: string,
    rubric: Omit<ScoringRubric, 'id' | 'version' | 'status' | 'createdAt'>
  ): Promise<ScoringRubric> =>
    apiClient.post<ScoringRubric>(
      `/scholarships/rounds/${encodeURIComponent(roundId)}/rubrics`,
      rubric
    ),

  update: (
    rubricId: string,
    patch: Partial<Pick<ScoringRubric, 'name' | 'description' | 'criteria'>>
  ): Promise<ScoringRubric> =>
    apiClient.patch<ScoringRubric>(`/scholarships/rubrics/${encodeURIComponent(rubricId)}`, patch),

  publish: (rubricId: string): Promise<ScoringRubric> =>
    apiClient.post<ScoringRubric>(`/scholarships/rubrics/${encodeURIComponent(rubricId)}/publish`, {}),
};
