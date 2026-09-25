/**
 * Applicant appeals domain logic (issue #1111).
 *
 * Eligibility rules:
 *  - Only 'reject' committee decisions may be appealed.
 *  - The appeal must be submitted before appeal.deadline.
 *  - Each application may have at most one active (non-withdrawn) appeal per
 *    decision; attempting a second raises a validation error.
 *
 * Reviewer exclusion:
 *  - All members listed in appeal.excludedReviewerIds (the original decision
 *    committee) may not review the appeal.
 *  - This exclusion is set automatically when the appeal is created from the
 *    decision's committee member IDs.
 *
 * Finality rules:
 *  - A 'dismissed' outcome is always final: isFinal = true.
 *  - An 'upheld' or 'partially_upheld' outcome produces a new committee
 *    decision and is also final for the original decision.
 *  - Once any appeal decision for a decision is final, no further appeals
 *    against that same decision may be filed.
 */

import type {
  Appeal,
  AppealDecisionRecord,
  AppealDecisionOutcome,
  AppealValidationError,
  SubmitAppealPayload,
} from './types';

export function isEligibleForAppeal(
  decisionType: string,
  existingAppeals: Appeal[]
): { eligible: boolean; reason?: string } {
  if (decisionType !== 'reject') {
    return { eligible: false, reason: 'Only rejected decisions may be appealed.' };
  }
  const activeAppeal = existingAppeals.find(
    (a) => a.status !== 'withdrawn'
  );
  if (activeAppeal) {
    return { eligible: false, reason: 'An appeal for this decision is already in progress.' };
  }
  return { eligible: true };
}

export function isWithinAppealWindow(deadline: string, now: Date = new Date()): boolean {
  return new Date(deadline) > now;
}

export function canReviewAppeal(reviewerId: string, appeal: Appeal): boolean {
  return !appeal.excludedReviewerIds.includes(reviewerId);
}

export function isFinalOutcome(outcome: AppealDecisionOutcome): boolean {
  return outcome === 'dismissed' || outcome === 'upheld' || outcome === 'partially_upheld';
}

export function hasBeenFinallyDecided(decisions: AppealDecisionRecord[]): boolean {
  return decisions.some((d) => d.isFinal);
}

export function validateAppealSubmission(
  payload: SubmitAppealPayload,
  decisionType: string,
  existingAppeals: Appeal[],
  now: Date = new Date()
): AppealValidationError[] {
  const errors: AppealValidationError[] = [];

  const eligibility = isEligibleForAppeal(decisionType, existingAppeals);
  if (!eligibility.eligible) {
    errors.push({ field: 'decisionId', message: eligibility.reason ?? 'Not eligible for appeal.' });
  }

  if (!payload.statement.trim()) {
    errors.push({ field: 'statement', message: 'An appeal statement is required.' });
  }

  if (payload.statement.trim().length < 50) {
    errors.push({
      field: 'statement',
      message: 'Appeal statement must be at least 50 characters.',
    });
  }

  if (!payload.grounds) {
    errors.push({ field: 'grounds', message: 'Appeal grounds must be specified.' });
  }

  return errors;
}

/** Build the list of excluded reviewer IDs from the original decision's committee. */
export function buildExcludedReviewerIds(originalCommitteeMemberIds: string[]): string[] {
  return [...new Set(originalCommitteeMemberIds)];
}

export function validateAppealReview(
  reviewerId: string,
  appeal: Appeal,
  reasoning: string
): AppealValidationError[] {
  const errors: AppealValidationError[] = [];

  if (!canReviewAppeal(reviewerId, appeal)) {
    errors.push({
      field: 'reviewerId',
      message: 'This reviewer was part of the original decision committee and is excluded.',
    });
  }

  if (!reasoning.trim()) {
    errors.push({ field: 'reasoning', message: 'Reasoning is required for an appeal decision.' });
  }

  if (appeal.status !== 'under_review') {
    errors.push({
      field: 'status',
      message: `Appeal must be under review before a decision can be recorded (current: ${appeal.status}).`,
    });
  }

  return errors;
}
