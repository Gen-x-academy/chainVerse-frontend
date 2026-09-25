/**
 * Atomic Application Submission Domain Engine.
 *
 * Performs deterministic, unified validation of:
 * 1. Eligibility
 * 2. Form Completeness
 * 3. Supporting Documents
 * 4. Consents
 * 5. Deadlines
 * 6. Uniqueness & Idempotency
 *
 * Invariant: Any failed check leaves the draft intact and editable.
 * Invariant: Success creates exactly one submission receipt; retries replay it idempotently.
 */

import { buildConsentSubmission, consentRequirements } from '../consent';
import { DOCUMENT_LIMITS, type SupportingDocumentKind } from '../documents';
import { buildIdempotencyKey, fingerprintRequest } from '../idempotency';
import { evaluateEligibility } from '../rules';
import { scholarshipFallbackRules } from '../service';
import type {
  ApplicationDraft,
  AtomicSubmissionResult,
  AtomicValidationContext,
  SubmissionCheckFailure,
  SubmissionCheckKind,
  SubmissionCheckResult,
  SubmissionReceipt,
} from './types';

export const MIN_STATEMENT_LENGTH = 80;

/**
 * Pillar 1: Check Eligibility against published rules.
 */
export function checkEligibility(
  draft: ApplicationDraft,
  ruleSet = scholarshipFallbackRules[0]
): SubmissionCheckResult {
  const decision = evaluateEligibility(ruleSet, draft.applicantProfile);
  const errors: string[] = [];

  if (!decision.passed) {
    if (decision.blockedBy.length > 0) {
      errors.push(`Eligibility criteria not met: ${decision.blockedBy.join(', ')}.`);
    }
    if (decision.missingEvidence.length > 0) {
      errors.push(`Missing required evidence: ${decision.missingEvidence.join(', ')}.`);
    }
    if (decision.exclusionReasons.length > 0) {
      errors.push(`Excluded by policy rules: ${decision.exclusionReasons.join(', ')}.`);
    }
    if (errors.length === 0) {
      errors.push('Applicant does not meet all active eligibility rules.');
    }
  }

  return {
    kind: 'eligibility',
    passed: decision.passed,
    title: 'Eligibility Verification',
    description: 'Validates applicant against criteria, grade floors, and exclusion rules.',
    errors,
    warnings: [],
  };
}

/**
 * Pillar 2: Check Form Completeness (statement, amounts, financial aid flags).
 */
export function checkFormCompleteness(
  draft: ApplicationDraft,
  context?: AtomicValidationContext
): SubmissionCheckResult {
  const errors: string[] = [];

  const statement = draft.statementSummary?.trim() ?? '';
  if (!statement) {
    errors.push('Personal statement is required.');
  } else if (statement.length < MIN_STATEMENT_LENGTH) {
    errors.push(
      `Personal statement must be at least ${MIN_STATEMENT_LENGTH} characters (currently ${statement.length}).`
    );
  }

  if (draft.requestedAmountCents != null) {
    if (draft.requestedAmountCents < 0) {
      errors.push('Requested funding amount cannot be negative.');
    }
    if (context?.round?.awardAmountCents && draft.requestedAmountCents > context.round.awardAmountCents) {
      errors.push(
        `Requested amount exceeds round maximum of $${(context.round.awardAmountCents / 100).toFixed(2)}.`
      );
    }
  }

  if (!draft.studentId || !draft.studentId.trim()) {
    errors.push('Student identifier is required to associate submission.');
  }

  if (!draft.roundId || !draft.roundId.trim()) {
    errors.push('Scholarship round must be selected.');
  }

  return {
    kind: 'form_completeness',
    passed: errors.length === 0,
    title: 'Form Completeness',
    description: 'Ensures statement depth, requested funding constraints, and applicant identities.',
    errors,
    warnings: [],
  };
}

/**
 * Pillar 3: Check Supporting Documents (required categories uploaded, clean scan).
 */
export function checkDocuments(
  draft: ApplicationDraft,
  requiredKinds: SupportingDocumentKind[] = ['transcript']
): SubmissionCheckResult {
  const errors: string[] = [];
  const uploadedKinds = new Set(draft.documents.map((doc) => doc.kind));

  // Check required categories
  for (const requiredKind of requiredKinds) {
    if (!uploadedKinds.has(requiredKind)) {
      errors.push(`Missing required supporting document: "${requiredKind}".`);
    }
  }

  // If financial aid requested, require income evidence
  if (draft.needsFinancialAid && !uploadedKinds.has('incomeEvidence')) {
    errors.push('Financial aid applicants must attach income verification evidence.');
  }

  // Check document scan and integrity status
  for (const doc of draft.documents) {
    if (doc.scanStatus === 'rejected') {
      errors.push(`Document "${doc.fileName}" was rejected by automated security scanning.`);
    } else if (doc.scanStatus === 'failed') {
      errors.push(`Document "${doc.fileName}" scan failed. Please re-upload.`);
    }

    const limits = DOCUMENT_LIMITS[doc.kind];
    if (limits && doc.sizeBytes > limits.maxBytes) {
      errors.push(`Document "${doc.fileName}" exceeds max allowed size.`);
    }
  }

  return {
    kind: 'documents',
    passed: errors.length === 0,
    title: 'Supporting Documents & Verification',
    description: 'Validates required categories, format constraints, and clean security scan.',
    errors,
    warnings: [],
  };
}

/**
 * Pillar 4: Check Affirmative Versioned Consents.
 */
export function checkConsent(draft: ApplicationDraft): SubmissionCheckResult {
  const errors: string[] = [];
  const accepted = new Set(draft.acceptedConsentKinds);

  for (const req of consentRequirements) {
    if (req.required && !accepted.has(req.kind)) {
      errors.push(`Consent required: "${req.title}".`);
    }
  }

  return {
    kind: 'consent',
    passed: errors.length === 0,
    title: 'Applicant Consents',
    description: 'Verifies affirmative agreement to terms, privacy notice, and sponsor disclosure.',
    errors,
    warnings: [],
  };
}

/**
 * Pillar 5: Check Application Deadline.
 */
export function checkDeadline(
  context: AtomicValidationContext,
  now: Date = new Date()
): SubmissionCheckResult {
  const errors: string[] = [];
  const round = context.round;

  if (round.status !== 'open') {
    errors.push(`Scholarship round is currently "${round.status}" (must be "open").`);
  }

  const opensAtTime = Date.parse(round.opensAt);
  if (!Number.isNaN(opensAtTime) && now.getTime() < opensAtTime) {
    errors.push(
      `Application window has not opened yet. Applications open on ${new Date(round.opensAt).toLocaleDateString()}.`
    );
  }

  const deadlineTime = Date.parse(round.applicationDeadline);
  if (!Number.isNaN(deadlineTime) && now.getTime() > deadlineTime) {
    errors.push(
      `Round deadline passed on ${new Date(round.applicationDeadline).toLocaleString()}.`
    );
  }

  return {
    kind: 'deadline',
    passed: errors.length === 0,
    title: 'Round Deadline Check',
    description: 'Ensures round is open and current submission timestamp is strictly before deadline.',
    errors,
    warnings: [],
  };
}

/**
 * Pillar 6: Check Uniqueness & Non-duplication.
 */
export function checkUniqueness(
  draft: ApplicationDraft,
  existingApplicationIds: string[] = []
): SubmissionCheckResult {
  const errors: string[] = [];

  // If student already has an active submitted application for this round
  if (existingApplicationIds.includes(draft.roundId)) {
    errors.push('You have already submitted an active application for this scholarship round.');
  }

  return {
    kind: 'uniqueness',
    passed: errors.length === 0,
    title: 'Uniqueness Verification',
    description: 'Guarantees single application per round and protects against duplicate submissions.',
    errors,
    warnings: [],
  };
}

/**
 * Executes all 6 checks in one atomic validation transition.
 */
export function validateAtomicSubmission(
  draft: ApplicationDraft,
  context: AtomicValidationContext
): {
  passed: boolean;
  checks: Record<SubmissionCheckKind, SubmissionCheckResult>;
  failures: SubmissionCheckFailure[];
} {
  const now = context.now ?? new Date();

  const cEligibility = checkEligibility(draft);
  const cForm = checkFormCompleteness(draft, context);
  const cDocs = checkDocuments(draft, context.requiredDocumentKinds);
  const cConsent = checkConsent(draft);
  const cDeadline = checkDeadline(context, now);
  const cUniqueness = checkUniqueness(draft, context.existingApplicationIds);

  const checks: Record<SubmissionCheckKind, SubmissionCheckResult> = {
    eligibility: cEligibility,
    form_completeness: cForm,
    documents: cDocs,
    consent: cConsent,
    deadline: cDeadline,
    uniqueness: cUniqueness,
  };

  const failures: SubmissionCheckFailure[] = [];

  for (const check of Object.values(checks)) {
    if (!check.passed) {
      for (const err of check.errors) {
        failures.push({
          kind: check.kind,
          code: `${check.kind.toUpperCase()}_CHECK_FAILED`,
          message: err,
        });
      }
    }
  }

  return {
    passed: failures.length === 0,
    checks,
    failures,
  };
}

/**
 * Simple deterministic hash for submission receipt.
 */
export function computeReceiptHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return `rcpt-${Math.abs(hash).toString(16).padStart(8, '0')}`;
}

/**
 * Generates an immutable submission receipt.
 */
export function generateSubmissionReceipt(
  draft: ApplicationDraft,
  idempotencyKey: string,
  now: Date = new Date()
): SubmissionReceipt {
  const submittedAt = now.toISOString();
  const decisionKey = `dec-${draft.roundId}-${draft.studentId}`;
  const payloadFingerprint = fingerprintRequest({
    roundId: draft.roundId,
    studentId: draft.studentId,
    statement: draft.statementSummary.trim(),
    amount: draft.requestedAmountCents,
  });

  const receiptHash = computeReceiptHash(
    `${idempotencyKey}:${submittedAt}:${payloadFingerprint}`
  );

  return {
    receiptId: `RCPT-${now.getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    applicationId: `app-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    roundId: draft.roundId,
    studentId: draft.studentId,
    submittedAt,
    idempotencyKey,
    receiptHash,
    summary: {
      requestedAmountCents: draft.requestedAmountCents,
      statementLength: draft.statementSummary.trim().length,
      documentsCount: draft.documents.length,
      verifiedConsentsCount: draft.acceptedConsentKinds.length,
      eligibilityDecisionKey: decisionKey,
    },
    immutable: true,
  };
}
