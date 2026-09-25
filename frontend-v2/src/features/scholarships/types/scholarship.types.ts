export type ScholarshipRole =
  | "student"
  | "sponsor"
  | "reviewer"
  | "finance"
  | "administrator";

export type ScholarshipApplicationStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "shortlisted"
  | "approved"
  | "rejected"
  | "withdrawn";

export type ScholarshipRoundStatus =
  | "draft"
  | "open"
  | "review"
  | "closed"
  | "archived";

export type AwardStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'disbursed'
  | 'cancelled'
  | 'expired';
  | "pending"
  | "accepted"
  | "declined"
  | "disbursed"
  | "cancelled";

export type DisbursementStatus =
  | "scheduled"
  | "processing"
  | "completed"
  | "failed";

export interface ScholarshipProgram {
  id: string;
  name: string;
  description: string;
  /** Invariant: financial values travel in minor units with an explicit currency. */
  fundingPoolCents: number;
  remainingPoolCents: number;
  currency: string;
  owner: ScholarshipRole;
  privacyClass: "public" | "restricted";
  createdAt: string;
}

export interface ScholarshipRound {
  id: string;
  programId: string;
  name: string;
  status: ScholarshipRoundStatus;
  opensAt: string;
  applicationDeadline: string;
  reviewDeadline?: string;
  maxAwards?: number;
  awardAmountCents?: number;
  currency: string;
}

export interface ScholarshipApplication {
  id: string;
  roundId: string;
  studentId: string;
  status: ScholarshipApplicationStatus;
  submittedAt?: string;
  requestedAmountCents?: number;
  needsFinancialAid: boolean;
  statementSummary: string;
  createdAt: string;
}

export interface CreateScholarshipApplicationPayload {
  roundId: string;
  requestedAmountCents?: number;
  needsFinancialAid: boolean;
  statementSummary: string;
  clientToken: string;
}

export interface ScholarshipAward {
  id: string;
  applicationId: string;
  studentId: string;
  amountCents: number;
  currency: string;
  status: AwardStatus;
  grantedAt: string;
  disbursedAt?: string;
}

export interface ScholarshipDisbursement {
  id: string;
  awardId: string;
  studentId: string;
  amountCents: number;
  currency: string;
  status: DisbursementStatus;
  scheduledAt: string;
  completedAt?: string;
  failureReason?: string;
}

export type ScholarshipApplicationListParams = {
  roundId?: string;
  status?: ScholarshipApplicationStatus;
  studentId?: string;
};

// Issue #1112 — Award records and acceptance deadlines
export interface AwardRecord extends ScholarshipAward {
  terms: string;
  /** ISO 8601 deadline; expired offers release reservations. */
  acceptanceDeadline: string;
  milestoneIds: string[];
}

export interface CreateAwardPayload {
  applicationId: string;
  studentId: string;
  amountCents: number;
  currency: string;
  terms: string;
  acceptanceDeadline: string;
  clientToken: string;
}

// Issue #1113 — Signed award agreement acceptance
export type AwardAgreementStatus = 'pending' | 'accepted' | 'declined';

export interface AwardAgreement {
  id: string;
  awardId: string;
  /** Agreement document version — immutable once signed. */
  version: string;
  status: AwardAgreementStatus;
  /** Authenticated user identifier of the signer. */
  signerIdentity?: string;
  /** ISO 8601 timestamp recorded at the moment of acceptance. */
  signedAt?: string;
  declinedAt?: string;
  /** Exact declaration texts the signer confirmed, stored for audit. */
  declarations: string[];
}

export interface AcceptAwardPayload {
  awardId: string;
  agreementVersion: string;
  declarations: string[];
  signerIdentity: string;
  clientToken: string;
}

export interface DeclineAwardPayload {
  awardId: string;
  reason?: string;
}

// Issue #1114 — Award cancellation and termination
export type CancellationReason =
  | 'applicant_request'
  | 'eligibility_lost'
  | 'terms_violation'
  | 'funding_withdrawn'
  | 'administrative';

export type TerminationReason =
  | 'academic_failure'
  | 'terms_violation'
  | 'fraud_confirmed'
  | 'program_ended'
  | 'mutual_agreement';

export type CancellationAuthority = 'administrator' | 'finance' | 'sponsor';

export type FinancialConsequence = 'none' | 'partial_recovery' | 'full_recovery';

export interface AwardCancellation {
  id: string;
  awardId: string;
  /** 'cancellation' = pre-payment; 'termination' = post-payment. */
  type: 'cancellation' | 'termination';
  reason: CancellationReason | TerminationReason;
  authority: CancellationAuthority;
  authorityId: string;
  financialConsequence: FinancialConsequence;
  recoveryAmountCents?: number;
  notificationSentAt?: string;
  effectiveAt: string;
  createdAt: string;
}

export interface CancelAwardPayload {
  awardId: string;
  reason: CancellationReason;
  authority: CancellationAuthority;
  financialConsequence: FinancialConsequence;
  recoveryAmountCents?: number;
  clientToken: string;
}

export interface TerminateAwardPayload {
  awardId: string;
  reason: TerminationReason;
  authority: CancellationAuthority;
  financialConsequence: FinancialConsequence;
  recoveryAmountCents?: number;
  clientToken: string;
}
  query?: string;
  page?: number;
  pageSize?: number;
  tenantId?: string;
};
