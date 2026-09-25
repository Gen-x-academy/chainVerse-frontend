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

// Issue #1115 — Milestone-based disbursement schedules
export type MilestoneType =
  | 'enrollment'
  | 'attendance'
  | 'coursework'
  | 'completion'
  | 'custom';

export type ScheduleStatus =
  | 'draft'
  | 'active'
  | 'amended'
  | 'completed'
  | 'cancelled';

export type ScheduledMilestoneStatus = 'pending' | 'verified' | 'disbursed' | 'skipped';

export interface ScheduledMilestone {
  id: string;
  scheduleId: string;
  milestoneType: MilestoneType;
  label: string;
  /** 0–100; all milestones in a schedule must sum to exactly 100. */
  percentageShare: number;
  /** Derived: awardAmountCents × percentageShare / 100. */
  amountCents: number;
  /** ISO 8601; must be strictly ascending across the schedule. */
  dueDate: string;
  status: ScheduledMilestoneStatus;
}

export interface DisbursementSchedule {
  id: string;
  awardId: string;
  status: ScheduleStatus;
  milestones: ScheduledMilestone[];
  activatedAt?: string;
  /** Governed amendment — requires authority and documented reason. */
  amendedAt?: string;
  amendmentReason?: string;
  createdAt: string;
}

export interface CreateScheduleMilestone {
  milestoneType: MilestoneType;
  label: string;
  percentageShare: number;
  dueDate: string;
}

export interface CreateSchedulePayload {
  awardId: string;
  milestones: CreateScheduleMilestone[];
  clientToken: string;
}

export interface AmendSchedulePayload {
  scheduleId: string;
  amendmentReason: string;
  milestones: CreateScheduleMilestone[];
  authorityId: string;
}
