export type AppealGrounds =
  | 'procedural_error'
  | 'new_evidence'
  | 'bias_conflict'
  | 'calculation_error'
  | 'other';

export type AppealStatus = 'draft' | 'submitted' | 'under_review' | 'decided' | 'withdrawn';

export type AppealDecisionOutcome = 'upheld' | 'partially_upheld' | 'dismissed';

export type AppealEvidenceType = 'document' | 'statement' | 'reference';

export type AppealEvidence = {
  id: string;
  type: AppealEvidenceType;
  title: string;
  url?: string;
  summary: string;
  uploadedAt: string;
};

export type Appeal = {
  id: string;
  applicationId: string;
  /** The committee decision being appealed. */
  decisionId: string;
  appellantId: string;
  grounds: AppealGrounds;
  statement: string;
  evidence: AppealEvidence[];
  /** ISO 8601; appeal must be submitted before this time. */
  deadline: string;
  status: AppealStatus;
  /** Original reviewers automatically excluded from reviewing this appeal. */
  excludedReviewerIds: string[];
  submittedAt?: string;
  createdAt: string;
};

export type AppealDecisionRecord = {
  id: string;
  appealId: string;
  /** Reviewer must NOT appear in appeal.excludedReviewerIds. */
  reviewerId: string;
  outcome: AppealDecisionOutcome;
  reasoning: string;
  /** When true, no further appeals may be filed against the same decision. */
  isFinal: boolean;
  decidedAt: string;
};

export type SubmitAppealPayload = {
  applicationId: string;
  decisionId: string;
  appellantId: string;
  grounds: AppealGrounds;
  statement: string;
  evidence: Omit<AppealEvidence, 'id' | 'uploadedAt'>[];
  idempotencyKey: string;
};

export type DecideAppealPayload = {
  appealId: string;
  reviewerId: string;
  outcome: AppealDecisionOutcome;
  reasoning: string;
};

export type AppealValidationError = { field: string; message: string };
