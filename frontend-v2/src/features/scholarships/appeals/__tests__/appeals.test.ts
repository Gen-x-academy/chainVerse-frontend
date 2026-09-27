import { describe, it, expect } from 'vitest';
import {
  isEligibleForAppeal,
  isWithinAppealWindow,
  canReviewAppeal,
  isFinalOutcome,
  hasBeenFinallyDecided,
  validateAppealSubmission,
  buildExcludedReviewerIds,
  validateAppealReview,
} from '../domain';
import type { Appeal, AppealDecisionRecord, SubmitAppealPayload } from '../types';

const FUTURE_DEADLINE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const PAST_DEADLINE = new Date(Date.now() - 1000).toISOString();

const BASE_APPEAL: Appeal = {
  id: 'appeal-001',
  applicationId: 'app-001',
  decisionId: 'dec-001',
  appellantId: 'student-001',
  grounds: 'calculation_error',
  statement: 'The calculation of normalized aggregate scores contains an error in weight application.',
  evidence: [],
  deadline: FUTURE_DEADLINE,
  status: 'under_review',
  excludedReviewerIds: ['reviewer-001', 'reviewer-002'],
  createdAt: new Date().toISOString(),
};

const BASE_PAYLOAD: SubmitAppealPayload = {
  applicationId: 'app-001',
  decisionId: 'dec-001',
  appellantId: 'student-001',
  grounds: 'calculation_error',
  statement: 'The calculation of normalized aggregate scores contains an error in weight application that materially affected the outcome.',
  evidence: [],
  idempotencyKey: 'idem-001',
};

describe('isEligibleForAppeal', () => {
  it('allows appeal of a reject decision with no existing appeals', () => {
    expect(isEligibleForAppeal('reject', []).eligible).toBe(true);
  });

  it('denies appeal of non-reject decision types', () => {
    expect(isEligibleForAppeal('award', []).eligible).toBe(false);
    expect(isEligibleForAppeal('shortlist', []).eligible).toBe(false);
    expect(isEligibleForAppeal('waitlist', []).eligible).toBe(false);
  });

  it('denies second appeal when one is active', () => {
    const existing: Appeal[] = [{ ...BASE_APPEAL, status: 'submitted' }];
    const result = isEligibleForAppeal('reject', existing);
    expect(result.eligible).toBe(false);
    expect(result.reason).toMatch(/in progress/i);
  });

  it('allows re-appeal after withdrawal', () => {
    const withdrawn: Appeal[] = [{ ...BASE_APPEAL, status: 'withdrawn' }];
    expect(isEligibleForAppeal('reject', withdrawn).eligible).toBe(true);
  });
});

describe('isWithinAppealWindow', () => {
  it('returns true before deadline', () => {
    expect(isWithinAppealWindow(FUTURE_DEADLINE)).toBe(true);
  });

  it('returns false after deadline', () => {
    expect(isWithinAppealWindow(PAST_DEADLINE)).toBe(false);
  });

  it('respects a provided now date', () => {
    const deadline = new Date(Date.now() + 60_000).toISOString();
    const futureNow = new Date(Date.now() + 120_000);
    expect(isWithinAppealWindow(deadline, futureNow)).toBe(false);
  });
});

describe('canReviewAppeal', () => {
  it('allows reviewer not in excluded list', () => {
    expect(canReviewAppeal('reviewer-003', BASE_APPEAL)).toBe(true);
  });

  it('blocks reviewer in excluded list', () => {
    expect(canReviewAppeal('reviewer-001', BASE_APPEAL)).toBe(false);
    expect(canReviewAppeal('reviewer-002', BASE_APPEAL)).toBe(false);
  });
});

describe('isFinalOutcome', () => {
  it('dismissed is final', () => {
    expect(isFinalOutcome('dismissed')).toBe(true);
  });

  it('upheld is final', () => {
    expect(isFinalOutcome('upheld')).toBe(true);
  });

  it('partially_upheld is final', () => {
    expect(isFinalOutcome('partially_upheld')).toBe(true);
  });
});

describe('hasBeenFinallyDecided', () => {
  it('returns false with no decisions', () => {
    expect(hasBeenFinallyDecided([])).toBe(false);
  });

  it('returns true when any decision is final', () => {
    const decisions: AppealDecisionRecord[] = [
      {
        id: 'adec-001',
        appealId: 'appeal-001',
        reviewerId: 'reviewer-003',
        outcome: 'dismissed',
        reasoning: 'No new grounds.',
        isFinal: true,
        decidedAt: new Date().toISOString(),
      },
    ];
    expect(hasBeenFinallyDecided(decisions)).toBe(true);
  });

  it('returns false when decision is not final', () => {
    const decisions: AppealDecisionRecord[] = [
      {
        id: 'adec-001',
        appealId: 'appeal-001',
        reviewerId: 'reviewer-003',
        outcome: 'dismissed',
        reasoning: 'Pending.',
        isFinal: false,
        decidedAt: new Date().toISOString(),
      },
    ];
    expect(hasBeenFinallyDecided(decisions)).toBe(false);
  });
});

describe('validateAppealSubmission', () => {
  it('returns no errors for valid payload', () => {
    const errors = validateAppealSubmission(BASE_PAYLOAD, 'reject', []);
    expect(errors).toHaveLength(0);
  });

  it('returns error when decision is not reject', () => {
    const errors = validateAppealSubmission(BASE_PAYLOAD, 'award', []);
    expect(errors.some((e) => e.field === 'decisionId')).toBe(true);
  });

  it('returns error for empty statement', () => {
    const errors = validateAppealSubmission({ ...BASE_PAYLOAD, statement: '' }, 'reject', []);
    expect(errors.some((e) => e.field === 'statement')).toBe(true);
  });

  it('returns error for statement under 50 characters', () => {
    const errors = validateAppealSubmission(
      { ...BASE_PAYLOAD, statement: 'Too short.' },
      'reject',
      []
    );
    expect(errors.some((e) => e.field === 'statement')).toBe(true);
  });

  it('returns error when active appeal already exists', () => {
    const existing: Appeal[] = [{ ...BASE_APPEAL, status: 'under_review' }];
    const errors = validateAppealSubmission(BASE_PAYLOAD, 'reject', existing);
    expect(errors.some((e) => e.field === 'decisionId')).toBe(true);
  });
});

describe('buildExcludedReviewerIds', () => {
  it('deduplicates reviewer IDs', () => {
    const ids = buildExcludedReviewerIds(['r1', 'r2', 'r1', 'r3']);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
  });

  it('returns empty array for empty input', () => {
    expect(buildExcludedReviewerIds([])).toHaveLength(0);
  });
});

describe('validateAppealReview', () => {
  it('returns no errors for valid review', () => {
    const errors = validateAppealReview('reviewer-003', BASE_APPEAL, 'Thorough review conducted.');
    expect(errors).toHaveLength(0);
  });

  it('returns error for excluded reviewer', () => {
    const errors = validateAppealReview('reviewer-001', BASE_APPEAL, 'Some reasoning.');
    expect(errors.some((e) => e.field === 'reviewerId')).toBe(true);
  });

  it('returns error for empty reasoning', () => {
    const errors = validateAppealReview('reviewer-003', BASE_APPEAL, '');
    expect(errors.some((e) => e.field === 'reasoning')).toBe(true);
  });

  it('returns error when appeal is not under_review', () => {
    const submitted: Appeal = { ...BASE_APPEAL, status: 'submitted' };
    const errors = validateAppealReview('reviewer-003', submitted, 'Some reasoning.');
    expect(errors.some((e) => e.field === 'status')).toBe(true);
  });
});
