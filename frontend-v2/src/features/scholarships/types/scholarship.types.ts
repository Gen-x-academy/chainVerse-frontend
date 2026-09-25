export type ScholarshipRole =
  | 'student'
  | 'sponsor'
  | 'reviewer'
  | 'finance'
  | 'administrator';

export type ScholarshipApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'shortlisted'
  | 'approved'
  | 'rejected'
  | 'withdrawn';

export type ScholarshipRoundStatus =
  | 'draft'
  | 'open'
  | 'review'
  | 'closed'
  | 'archived';

export type AwardStatus = 'pending' | 'accepted' | 'declined' | 'disbursed' | 'cancelled';

export type DisbursementStatus = 'scheduled' | 'processing' | 'completed' | 'failed';

export interface ScholarshipProgram {
  id: string;
  name: string;
  description: string;
  /** Invariant: financial values travel in minor units with an explicit currency. */
  fundingPoolCents: number;
  remainingPoolCents: number;
  currency: string;
  owner: ScholarshipRole;
  privacyClass: 'public' | 'restricted';
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
  query?: string;
  page?: number;
  pageSize?: number;
  tenantId?: string;
};