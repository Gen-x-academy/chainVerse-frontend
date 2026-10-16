/** MENTOR-035: structured, append-only application decision records. */
export type DecisionOutcome = 'accepted' | 'rejected' | 'waitlisted' | 'more_info_requested';

export const DECISION_REASON_CODES = [
  'meets_criteria',
  'capacity_reached',
  'criteria_not_met',
  'incomplete_application',
  'duplicate',
  'other',
] as const;
export type DecisionReasonCode = (typeof DECISION_REASON_CODES)[number];

export interface DecisionInput {
  applicationId: string;
  reviewerId: string;
  outcome: DecisionOutcome;
  reasonCode: DecisionReasonCode;
  /** Internal reviewer note; never shown to the applicant. */
  internalNote?: string;
  /** Message shown to the applicant. */
  applicantMessage?: string;
  /** Client-generated key so retries do not duplicate the decision. */
  idempotencyKey: string;
}

export interface DecisionRecord extends DecisionInput {
  id: string;
  decidedAt: string;
  supersedesId?: string;
}

const MAX_NOTE = 2000;

export function validateDecision(input: DecisionInput): string[] {
  const errors: string[] = [];
  if (!DECISION_REASON_CODES.includes(input.reasonCode)) errors.push('Unknown reason code');
  if (input.reasonCode === 'other' && !input.internalNote?.trim()) errors.push('A note is required for reason "other"');
  if (input.outcome === 'rejected' && !input.applicantMessage?.trim()) errors.push('Tell the applicant why they were rejected');
  if ((input.internalNote?.length ?? 0) > MAX_NOTE || (input.applicantMessage?.length ?? 0) > MAX_NOTE) {
    errors.push(`Notes must be at most ${MAX_NOTE} characters`);
  }
  if (!input.idempotencyKey) errors.push('Missing idempotency key');
  return errors;
}

/**
 * Append a decision to the history. A repeated idempotency key returns the existing history unchanged;
 * a new decision supersedes the latest one rather than editing it.
 */
export function appendDecision(history: DecisionRecord[], input: DecisionInput, now: Date = new Date()): DecisionRecord[] {
  const errors = validateDecision(input);
  if (errors.length) throw new Error(errors.join('; '));
  if (history.some((d) => d.idempotencyKey === input.idempotencyKey)) return history;
  const latest = history[history.length - 1];
  const record: DecisionRecord = {
    ...input,
    id: `${input.applicationId}:${history.length + 1}`,
    decidedAt: now.toISOString(),
    supersedesId: latest?.id,
  };
  return [...history, record];
}

export const currentDecision = (history: DecisionRecord[]): DecisionRecord | undefined => history[history.length - 1];

/** Applicant-safe view: strips internal notes and reviewer identity. */
export function toApplicantView(d: DecisionRecord): Pick<DecisionRecord, 'applicationId' | 'outcome' | 'applicantMessage' | 'decidedAt'> {
  return { applicationId: d.applicationId, outcome: d.outcome, applicantMessage: d.applicantMessage, decidedAt: d.decidedAt };
}
