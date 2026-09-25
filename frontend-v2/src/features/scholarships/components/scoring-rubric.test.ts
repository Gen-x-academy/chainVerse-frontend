import { describe, expect, it } from 'vitest';
import {
  validateRubricWeights,
  validateCriterionScore,
  isDisqualifyingScore,
} from '../scoring-rubric';
import type { RubricCriterion, ScoringRubric, CriterionScore } from '../scoring-rubric';

const scale = [
  { value: 0, label: 'Insufficient', description: '' },
  { value: 1, label: 'Developing', description: '' },
  { value: 2, label: 'Proficient', description: '' },
  { value: 3, label: 'Excellent', description: '' },
];

const criterionA: RubricCriterion = {
  id: 'c-a',
  name: 'Academic merit',
  description: '',
  weightPercent: 60,
  scale,
  guidanceNotes: '',
  requiresComment: false,
};

const criterionB: RubricCriterion = {
  id: 'c-b',
  name: 'Community impact',
  description: '',
  weightPercent: 40,
  scale,
  guidanceNotes: '',
  requiresComment: false,
};

const publishedRubric: ScoringRubric = {
  id: 'rubric-1',
  name: 'Standard Rubric',
  description: '',
  version: 2,
  status: 'published',
  criteria: [criterionA, criterionB],
  createdAt: '2024-01-01T00:00:00Z',
  publishedAt: '2024-01-02T00:00:00Z',
};

describe('validateRubricWeights (#1104)', () => {
  it('returns no errors when weights sum to 100', () => {
    expect(validateRubricWeights([criterionA, criterionB])).toEqual([]);
  });

  it('returns an error when weights do not sum to 100', () => {
    const under: RubricCriterion = { ...criterionA, weightPercent: 50 };
    const errors = validateRubricWeights([under, criterionB]);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].field).toBe('weights');
    expect(errors[0].message).toContain('90');
  });

  it('returns an error when criteria list is empty', () => {
    const errors = validateRubricWeights([]);
    expect(errors[0].field).toBe('criteria');
  });

  it('returns an error for a criterion with zero weight', () => {
    const zero: RubricCriterion = { ...criterionA, weightPercent: 0 };
    const errors = validateRubricWeights([zero, criterionB]);
    expect(errors.some((e) => e.field === zero.id)).toBe(true);
  });

  it('returns an error for a criterion with only one scale point', () => {
    const onePoint: RubricCriterion = {
      ...criterionA,
      scale: [{ value: 1, label: 'Pass', description: '' }],
    };
    const errors = validateRubricWeights([onePoint, criterionB]);
    expect(errors.some((e) => e.field === onePoint.id)).toBe(true);
  });

  it('handles a single criterion with 100% weight', () => {
    const solo: RubricCriterion = { ...criterionA, weightPercent: 100 };
    expect(validateRubricWeights([solo])).toEqual([]);
  });
});

describe('validateCriterionScore (#1104)', () => {
  it('returns no errors for a valid score referencing the correct rubric version', () => {
    const score: CriterionScore = {
      criterionId: 'c-a',
      rubricId: publishedRubric.id,
      rubricVersion: 2,
      score: 2,
    };
    expect(validateCriterionScore(score, publishedRubric)).toEqual([]);
  });

  it('flags a score that references a stale rubric version', () => {
    const score: CriterionScore = {
      criterionId: 'c-a',
      rubricId: publishedRubric.id,
      rubricVersion: 1,
      score: 2,
    };
    const errors = validateCriterionScore(score, publishedRubric);
    expect(errors[0].field).toBe('rubricVersion');
  });

  it('flags a score value that is not in the scale', () => {
    const score: CriterionScore = {
      criterionId: 'c-a',
      rubricId: publishedRubric.id,
      rubricVersion: 2,
      score: 99,
    };
    const errors = validateCriterionScore(score, publishedRubric);
    expect(errors.some((e) => e.field === 'score')).toBe(true);
  });

  it('flags a missing criterion id', () => {
    const score: CriterionScore = {
      criterionId: 'nonexistent',
      rubricId: publishedRubric.id,
      rubricVersion: 2,
      score: 1,
    };
    const errors = validateCriterionScore(score, publishedRubric);
    expect(errors.some((e) => e.field === 'criterionId')).toBe(true);
  });

  it('flags a missing comment when requiresComment is true', () => {
    const requiresComment: ScoringRubric = {
      ...publishedRubric,
      criteria: [{ ...criterionA, requiresComment: true }],
    };
    const score: CriterionScore = {
      criterionId: 'c-a',
      rubricId: requiresComment.id,
      rubricVersion: 2,
      score: 2,
      comment: '',
    };
    const errors = validateCriterionScore(score, requiresComment);
    expect(errors.some((e) => e.field === 'comment')).toBe(true);
  });

  it('accepts a score with a comment when requiresComment is true', () => {
    const requiresComment: ScoringRubric = {
      ...publishedRubric,
      criteria: [{ ...criterionA, requiresComment: true }],
    };
    const score: CriterionScore = {
      criterionId: 'c-a',
      rubricId: requiresComment.id,
      rubricVersion: 2,
      score: 2,
      comment: 'Strong applicant.',
    };
    expect(validateCriterionScore(score, requiresComment)).toEqual([]);
  });
});

describe('isDisqualifyingScore (#1104)', () => {
  const rubricWithThreshold: ScoringRubric = {
    ...publishedRubric,
    criteria: [{ ...criterionA, disqualifyingThreshold: 2 }],
  };

  it('returns true when score is below the disqualifying threshold', () => {
    const score: CriterionScore = {
      criterionId: 'c-a',
      rubricId: rubricWithThreshold.id,
      rubricVersion: 2,
      score: 1,
    };
    expect(isDisqualifyingScore(score, rubricWithThreshold)).toBe(true);
  });

  it('returns false when score meets the disqualifying threshold', () => {
    const score: CriterionScore = {
      criterionId: 'c-a',
      rubricId: rubricWithThreshold.id,
      rubricVersion: 2,
      score: 2,
    };
    expect(isDisqualifyingScore(score, rubricWithThreshold)).toBe(false);
  });

  it('returns false when criterion has no disqualifying threshold', () => {
    const score: CriterionScore = {
      criterionId: 'c-a',
      rubricId: publishedRubric.id,
      rubricVersion: 2,
      score: 0,
    };
    expect(isDisqualifyingScore(score, publishedRubric)).toBe(false);
  });

  it('returns false for an unknown criterion id', () => {
    const score: CriterionScore = {
      criterionId: 'unknown',
      rubricId: rubricWithThreshold.id,
      rubricVersion: 2,
      score: 0,
    };
    expect(isDisqualifyingScore(score, rubricWithThreshold)).toBe(false);
  });
});
