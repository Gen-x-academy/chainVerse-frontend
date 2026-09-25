/**
 * Types and interfaces for Scholarship Application Duplicate Prevention,
 * Safe Draft Reconciliation, and Controlled Administrative Merges.
 */

import type { SupportingDocument } from '../documents';

export type ProgramUniquenessScope =
  | 'one_per_program_lifetime'
  | 'one_per_round'
  | 'one_per_academic_year'
  | 'allow_multi_with_cap';

export interface ProgramUniquenessRule {
  programId: string;
  scope: ProgramUniquenessScope;
  maxApplicationsPerApplicant?: number;
  allowDraftResumption: boolean;
  lockTimeoutSeconds: number;
}

export interface ExistingApplicationSummary {
  id: string;
  programId: string;
  roundId: string;
  studentId: string;
  submittedAt: string;
  status: 'submitted' | 'under_review' | 'approved' | 'rejected' | 'merged' | 'withdrawn';
  statementSummary: string;
  requestedAmountCents?: number;
  documents: SupportingDocument[];
  receiptId?: string;
  idempotencyKey?: string;
}

export type UniquenessCheckResult =
  | {
      allowed: true;
      existingCount: number;
      maxAllowed: number;
      message: string;
    }
  | {
      allowed: false;
      reason: 'DUPLICATE_APPLICATION_EXISTS' | 'CAP_EXCEEDED' | 'ACTIVE_SUBMISSION_IN_PROGRESS';
      existingApplication: ExistingApplicationSummary;
      message: string;
      canResumeDraft?: boolean;
    };

export interface DraftConflictRecord {
  draftId: string;
  studentId: string;
  programId: string;
  roundId: string;
  clientVersionA: {
    statementSummary: string;
    requestedAmountCents?: number;
    updatedAt: string;
    documentsCount: number;
  };
  clientVersionB: {
    statementSummary: string;
    requestedAmountCents?: number;
    updatedAt: string;
    documentsCount: number;
  };
  hasConflict: boolean;
}

export type DraftReconciliationStrategy =
  | 'keep_latest'
  | 'merge_longest_statement'
  | 'combine_documents'
  | 'manual_selection';

export interface ReconciledDraftResult {
  statementSummary: string;
  requestedAmountCents?: number;
  documents: SupportingDocument[];
  reconciledAt: string;
  strategyUsed: DraftReconciliationStrategy;
  message: string;
}

export interface DuplicateCluster {
  clusterId: string;
  studentId: string;
  studentName?: string;
  studentEmail?: string;
  programId: string;
  programName?: string;
  applications: ExistingApplicationSummary[];
  duplicateConfidence: 'exact_student_match' | 'identity_hash_match' | 'email_match';
  detectedAt: string;
}

export interface MergeApplicationsPayload {
  clusterId?: string;
  primaryApplicationId: string;
  secondaryApplicationIds: string[];
  combineDocuments: boolean;
  selectedStatementApplicationId: string;
  selectedAmountApplicationId: string;
  adminReason: string;
  adminUserId: string;
}

export interface ApplicationMergeAuditRecord {
  id: string;
  mergedAt: string;
  primaryApplicationId: string;
  mergedSecondaryIds: string[];
  transferredDocumentCount: number;
  adminReason: string;
  adminUserId: string;
  status: 'completed' | 'reverted';
}
