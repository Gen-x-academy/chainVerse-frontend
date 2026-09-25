/**
 * Types and interfaces for Atomic Scholarship Application Submission.
 *
 * Enforces one atomic transition validating:
 * 1. Eligibility (rules engine)
 * 2. Form Completeness (required fields and valid constraints)
 * 3. Supporting Documents (required categories uploaded, clean scan status)
 * 4. Consent (affirmative versioned consents accepted)
 * 5. Deadline (round deadline active and unexpired)
 * 6. Uniqueness & Idempotency (single application per student/round, retries replay receipt)
 */

import type { ConsentKind, ConsentSubmission } from '../consent';
import type { SupportingDocument, SupportingDocumentKind } from '../documents';
import type { EligibilityApplicant, EligibilityDecision } from '../types';
import type { ScholarshipRound } from '../types/scholarship.types';

export type SubmissionCheckKind =
  | 'eligibility'
  | 'form_completeness'
  | 'documents'
  | 'consent'
  | 'deadline'
  | 'uniqueness';

export interface SubmissionCheckResult {
  kind: SubmissionCheckKind;
  passed: boolean;
  title: string;
  description: string;
  errors: string[];
  warnings: string[];
}

export interface SubmissionCheckFailure {
  kind: SubmissionCheckKind;
  code: string;
  field?: string;
  message: string;
}

export interface ApplicationDraft {
  roundId: string;
  studentId: string;
  statementSummary: string;
  requestedAmountCents?: number;
  needsFinancialAid: boolean;
  applicantProfile: EligibilityApplicant;
  uploadedDocumentIds: string[];
  documents: SupportingDocument[];
  acceptedConsentKinds: ConsentKind[];
  clientNonce: string;
  updatedAt: string;
}

export interface SubmissionReceipt {
  receiptId: string;
  applicationId: string;
  roundId: string;
  studentId: string;
  submittedAt: string;
  idempotencyKey: string;
  receiptHash: string;
  summary: {
    requestedAmountCents?: number;
    statementLength: number;
    documentsCount: number;
    verifiedConsentsCount: number;
    eligibilityDecisionKey: string;
  };
  immutable: true;
}

export interface AtomicSubmissionPayload {
  roundId: string;
  studentId: string;
  statementSummary: string;
  requestedAmountCents?: number;
  needsFinancialAid: boolean;
  applicantProfile: EligibilityApplicant;
  uploadedDocumentIds: string[];
  consents: ConsentSubmission[];
  clientNonce: string;
  idempotencyKey: string;
}

export type AtomicSubmissionResult =
  | {
      ok: true;
      status: 'submitted' | 'replayed';
      receipt: SubmissionReceipt;
      message: string;
    }
  | {
      ok: false;
      status: 'failed';
      checkFailures: SubmissionCheckFailure[];
      failedChecks: SubmissionCheckKind[];
      message: string;
      draftPreserved: true;
    };

export interface AtomicValidationContext {
  round: ScholarshipRound;
  now?: Date;
  existingApplicationIds?: string[];
  requiredDocumentKinds?: SupportingDocumentKind[];
}
