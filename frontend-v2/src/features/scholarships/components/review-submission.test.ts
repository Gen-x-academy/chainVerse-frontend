import { describe, expect, it } from 'vitest';
import { validateSubmission, hasDisqualifyingScore } from '../review-submission';
import type { SubmitReviewPayload } from '../review-submission';
import type { ScoringRubric, CriterionScore } from '../scoring-rubric';

const scale = [
  { value: 0, label: 'Insufficient', description: '' },
  { value: 1, label: 'Developing', description: '' },
  { value: 2, label: 'Proficient', description: '' },
  { value: 3, label: 'Excellent', description: '' },
];

const rubric: ScoringRubric = {
  id: 'rubric-1',
  name: 'Test Rubric',
  description: '',
  version: 1,
  status: 'published',
  criteria: [
    {
      id: 'c-merit',
      name: 'Academic merit',
      description: '',
      weightPercent: 50,
      scale,
      guidanceNotes: '',
      requiresComment: false,
    },
    {
      id: 'c-impact',
      name: 'Community impact',
      description: '',
      weightPercent: 50,
      scale,
      guidanceNotes: '',
      requiresComment: true,
    },
  ],
  createdAt: '2024-01-01T00:00:00Z',
};

const validScores: CriterionScore[] = [
  { criterionId: 'c-merit', rubricId: 'rubric-1', rubricVersion: 1, score: 2 },
  { criterionId: 'c-impact', rubricId: 'rubric-1', rubricVersion: 1, score: 3, comment: 'Strong community ties.' },
];

const validPayload: SubmitReviewPayload = {
  rubricId: 'rubric-1',
  rubricVersion: 1,
  scores: validScores,
  recommendation: 'approve',
  overallComment: 'Excellent candidate overall.',
};

describe('validateSubmission (#1106)', () => {
  it('returns no errors for a complete, valid submission', () => {
    expect(validateSubmission(validPayload, rubric)).toEqual([]);
  });

  it('flags an unscored criterion', () => {
    const missingScore: SubmitReviewPayload = {
      ...validPayload,
      scores: [validScores[0]],
    };
    const errors = validateSubmission(missingScore, rubric);
    expect(errors.some((e) => e.field === 'c-impact')).toBe(true);
  });

  it('flags an empty overall comment', () => {
    const noComment: SubmitReviewPayload = { ...validPayload, overallComment: '  ' };
    const errors = validateSubmission(noComment, rubric);
    expect(errors.some((e) => e.field === 'overallComment')).toBe(true);
  });

  it('flags a score that references a stale rubric version', () => {
    const staleScore: CriterionScore = { ...validScores[0], rubricVersion: 99 };
    const payload: SubmitReviewPayload = { ...validPayload, scores: [staleScore, validScores[1]] };
    const errors = validateSubmission(payload, rubric);
    expect(errors.some((e) => e.field === 'rubricVersion')).toBe(true);
  });

  it('flags a missing required comment on a criterion', () => {
    const noCommentScore: CriterionScore = { ...validScores[1], comment: '' };
    const payload: SubmitReviewPayload = { ...validPayload, scores: [validScores[0], noCommentScore] };
    const errors = validateSubmission(payload, rubric);
    expect(errors.some((e) => e.field === 'comment')).toBe(true);
  });

  it('flags an invalid scale value', () => {
    const badScore: CriterionScore = { ...validScores[0], score: 99 };
    const payload: SubmitReviewPayload = { ...validPayload, scores: [badScore, validScores[1]] };
    const errors = validateSubmission(payload, rubric);
    expect(errors.some((e) => e.field === 'score')).toBe(true);
  });

  it('accumulates multiple errors', () => {
    const payload: SubmitReviewPayload = {
      ...validPayload,
      scores: [],
      overallComment: '',
    };
    const errors = validateSubmission(payload, rubric);
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });
});

describe('hasDisqualifyingScore (#1106)', () => {
  const rubricWithThreshold: ScoringRubric = {
    ...rubric,
    criteria: [
      { ...rubric.criteria[0], disqualifyingThreshold: 2 },
      rubric.criteria[1],
    ],
  };

  it('returns true when a criterion score is below the threshold', () => {
    const lowScore: CriterionScore = { ...validScores[0], score: 1 };
    expect(hasDisqualifyingScore([lowScore, validScores[1]], rubricWithThreshold)).toBe(true);
  });

  it('returns false when all scores meet or exceed their thresholds', () => {
    const okScore: CriterionScore = { ...validScores[0], score: 2 };
    expect(hasDisqualifyingScore([okScore, validScores[1]], rubricWithThreshold)).toBe(false);
  });

  it('returns false when no criteria have a disqualifying threshold', () => {
    expect(hasDisqualifyingScore(validScores, rubric)).toBe(false);
  });

  it('returns false for an empty score list', () => {
    expect(hasDisqualifyingScore([], rubricWithThreshold)).toBe(false);
  });
});
