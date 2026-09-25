export type MilestoneStatus =
  | 'pending'
  | 'evidence_submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'payment_eligible';

export type EvidenceType = 'document' | 'url' | 'attestation' | 'image';

export type EvidenceVersion = {
  version: number;
  contentHash: string;
  submittedAt: string;
  submissionKey: string;
};

export type MilestoneEvidence = {
  id: string;
  milestoneId: string;
  awardId: string;
  recipientId: string;
  evidenceType: EvidenceType;
  contentHash: string;
  encryptedOffChain: boolean;
  encryptionKeyRef?: string;
  submittedAt: string;
  submissionKey: string;
  version: number;
  versionHistory: EvidenceVersion[];
  metadata?: Record<string, string>;
};

export type SubmitEvidencePayload = {
  milestoneId: string;
  awardId: string;
  evidenceType: EvidenceType;
  content: string;
  encryptOffChain?: boolean;
  submissionKey: string;
  metadata?: Record<string, string>;
};

export type SubmitEvidenceResult = {
  evidence: MilestoneEvidence;
  isNew: boolean;
};

export type VerificationAction = 'approve' | 'reject' | 'request_changes';

export type VerifierDecisionReasonCode =
  | 'EVIDENCE_COMPLETE'
  | 'EVIDENCE_INSUFFICIENT'
  | 'EVIDENCE_FRAUDULENT'
  | 'MILESTONE_NOT_MET'
  | 'CHANGES_REQUIRED'
  | 'CONFLICT_OF_INTEREST';

export type VerifierDecision = {
  id: string;
  evidenceId: string;
  milestoneId: string;
  verifierId: string;
  action: VerificationAction;
  reasonCode: VerifierDecisionReasonCode;
  reasonNote?: string;
  decidedAt: string;
  paymentEligibilityTriggered: boolean;
};

export type AssignVerifierPayload = {
  evidenceId: string;
  verifierId: string;
};

export type RecordDecisionPayload = {
  evidenceId: string;
  action: VerificationAction;
  reasonCode: VerifierDecisionReasonCode;
  reasonNote?: string;
};
