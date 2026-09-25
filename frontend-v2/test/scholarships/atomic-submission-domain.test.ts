// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import {
  checkConsent,
  checkDeadline,
  checkDocuments,
  checkEligibility,
  checkFormCompleteness,
  checkUniqueness,
  computeReceiptHash,
  generateSubmissionReceipt,
  MIN_STATEMENT_LENGTH,
  validateAtomicSubmission,
} from '@/src/features/scholarships/applications/domain';
import {
  atomicApplicationService,
  resetApplicationStores,
} from '@/src/features/scholarships/applications/service';
import type {
  ApplicationDraft,
  AtomicValidationContext,
} from '@/src/features/scholarships/applications/types';
import type { ScholarshipRound } from '@/src/features/scholarships/types/scholarship.types';

describe('Atomic Application Submission Domain & Invariants', () => {
  const openRound: ScholarshipRound = {
    id: 'round-stellar-2026',
    programId: 'prog-stellar-2026',
    name: 'Stellar Fellowship 2026 Round 1',
    status: 'open',
    opensAt: '2026-08-01T00:00:00.000Z',
    applicationDeadline: '2026-11-30T23:59:59.000Z',
    awardAmountCents: 500000, // $5,000 max
    currency: 'USD',
  };

  const validDraft: ApplicationDraft = {
    roundId: 'round-stellar-2026',
    studentId: 'student-test-1',
    statementSummary:
      'I am an active computer science student dedicated to building open-source smart contract applications on the Stellar network. This scholarship will fund my tuition and certification fees.',
    requestedAmountCents: 300000,
    needsFinancialAid: true,
    applicantProfile: {
      enrollmentStatus: 'current',
      courseIds: ['intro-to-blockchain'],
      gradeValue: 88,
      gradeMetric: 'percentage',
      region: 'africa',
      incomeBand: 'low',
      role: 'student',
      age: 21,
      customAttestation: 'confirmed',
      completedAchievementIds: ['blockchain-foundations'],
      selectedScholarshipIds: [],
      priorAwardIds: [],
      evidencePermissionGranted: true,
    },
    uploadedDocumentIds: ['doc-transcript-1', 'doc-income-1'],
    documents: [
      {
        id: 'doc-transcript-1',
        applicationId: 'draft-1',
        kind: 'transcript',
        fileName: 'academic-transcript-2026.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1024 * 500,
        status: 'available',
        scanStatus: 'clean',
        uploadedAt: '2026-09-01T00:00:00.000Z',
        accessLogged: true,
      },
      {
        id: 'doc-income-1',
        applicationId: 'draft-1',
        kind: 'incomeEvidence',
        fileName: 'income-statement.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1024 * 300,
        status: 'available',
        scanStatus: 'clean',
        uploadedAt: '2026-09-01T00:00:00.000Z',
        accessLogged: true,
      },
    ],
    acceptedConsentKinds: [
      'acceptedTerms',
      'privacyNotice',
      'dataSharing',
      'sponsorDisclosure',
    ],
    clientNonce: 'test-nonce-12345',
    updatedAt: '2026-09-20T00:00:00.000Z',
  };

  const context: AtomicValidationContext = {
    round: openRound,
    now: new Date('2026-09-24T12:00:00.000Z'),
    existingApplicationIds: [],
    requiredDocumentKinds: ['transcript'],
  };

  beforeEach(() => {
    resetApplicationStores();
  });

  describe('Pillar 1: Eligibility Check', () => {
    it('passes when applicant profile satisfies rules', () => {
      const result = checkEligibility(validDraft);
      expect(result.passed).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('fails when applicant profile violates rules (e.g. ineligible region)', () => {
      const invalidDraft: ApplicationDraft = {
        ...validDraft,
        applicantProfile: {
          ...validDraft.applicantProfile,
          region: 'oceania', // fallback rule allowlist is ['africa', 'asia']
        },
      };
      const result = checkEligibility(invalidDraft);
      expect(result.passed).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Pillar 2: Form Completeness Check', () => {
    it('passes when statement length >= 80 characters and amount is within limits', () => {
      const result = checkFormCompleteness(validDraft, context);
      expect(result.passed).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('fails when personal statement is shorter than 80 characters', () => {
      const shortDraft: ApplicationDraft = {
        ...validDraft,
        statementSummary: 'Too short',
      };
      const result = checkFormCompleteness(shortDraft, context);
      expect(result.passed).toBe(false);
      expect(result.errors[0]).toContain(`at least ${MIN_STATEMENT_LENGTH} characters`);
    });

    it('fails when requested amount exceeds round maximum', () => {
      const excessDraft: ApplicationDraft = {
        ...validDraft,
        requestedAmountCents: 600000, // round max is 500000
      };
      const result = checkFormCompleteness(excessDraft, context);
      expect(result.passed).toBe(false);
      expect(result.errors[0]).toContain('Requested amount exceeds round maximum');
    });
  });

  describe('Pillar 3: Supporting Documents Check', () => {
    it('passes when required documents exist and have clean scan status', () => {
      const result = checkDocuments(validDraft, ['transcript']);
      expect(result.passed).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('fails when required transcript document is missing', () => {
      const missingDocDraft: ApplicationDraft = {
        ...validDraft,
        documents: [],
      };
      const result = checkDocuments(missingDocDraft, ['transcript']);
      expect(result.passed).toBe(false);
      expect(result.errors.some((e) => e.includes('Missing required supporting document'))).toBe(
        true
      );
    });

    it('fails when document security scan is rejected', () => {
      const rejectedScanDraft: ApplicationDraft = {
        ...validDraft,
        documents: [
          {
            ...validDraft.documents[0],
            scanStatus: 'rejected',
          },
        ],
      };
      const result = checkDocuments(rejectedScanDraft, ['transcript']);
      expect(result.passed).toBe(false);
      expect(result.errors.some((e) => e.includes('rejected by automated security scanning'))).toBe(
        true
      );
    });
  });

  describe('Pillar 4: Consents Check', () => {
    it('passes when all 4 required affirmative consents are accepted', () => {
      const result = checkConsent(validDraft);
      expect(result.passed).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('fails when required terms consent is not accepted', () => {
      const missingConsentDraft: ApplicationDraft = {
        ...validDraft,
        acceptedConsentKinds: ['privacyNotice', 'dataSharing'],
      };
      const result = checkConsent(missingConsentDraft);
      expect(result.passed).toBe(false);
      expect(result.errors.some((e) => e.includes('Scholarship terms'))).toBe(true);
    });
  });

  describe('Pillar 5: Round Deadline Check', () => {
    it('passes when round is open and submission timestamp is before deadline', () => {
      const result = checkDeadline(context, new Date('2026-09-24T12:00:00.000Z'));
      expect(result.passed).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('fails when round status is closed', () => {
      const closedContext: AtomicValidationContext = {
        ...context,
        round: { ...openRound, status: 'closed' },
      };
      const result = checkDeadline(closedContext);
      expect(result.passed).toBe(false);
      expect(result.errors[0]).toContain('must be "open"');
    });

    it('fails when current submission timestamp is past deadline', () => {
      const pastDeadline = new Date('2026-12-05T00:00:00.000Z');
      const result = checkDeadline(context, pastDeadline);
      expect(result.passed).toBe(false);
      expect(result.errors[0]).toContain('Round deadline passed');
    });
  });

  describe('Pillar 6: Uniqueness Check', () => {
    it('passes when student has not yet applied to the round', () => {
      const result = checkUniqueness(validDraft, []);
      expect(result.passed).toBe(true);
    });

    it('fails when student already has an active application in this round', () => {
      const result = checkUniqueness(validDraft, [openRound.id]);
      expect(result.passed).toBe(false);
      expect(result.errors[0]).toContain('already submitted an active application');
    });
  });

  describe('Atomic Submission Pipeline & Invariants', () => {
    it('passes all 6 checks in one atomic validation transition', () => {
      const validation = validateAtomicSubmission(validDraft, context);
      expect(validation.passed).toBe(true);
      expect(validation.failures).toHaveLength(0);
      expect(Object.keys(validation.checks)).toHaveLength(6);
    });

    it('failed check leaves draft in editable state and returns all failures', async () => {
      const brokenDraft: ApplicationDraft = {
        ...validDraft,
        statementSummary: 'Too short', // form failure
        acceptedConsentKinds: [], // consent failure
      };

      const result = await atomicApplicationService.submitAtomically(brokenDraft, context);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe('failed');
        expect(result.draftPreserved).toBe(true); // Draft remains editable!
        expect(result.failedChecks).toContain('form_completeness');
        expect(result.failedChecks).toContain('consent');
        expect(result.checkFailures.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('successful submission generates exactly one immutable receipt', async () => {
      const result = await atomicApplicationService.submitAtomically(validDraft, context);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.status).toBe('submitted');
        expect(result.receipt).toBeDefined();
        expect(result.receipt.receiptId).toMatch(/^RCPT-/);
        expect(result.receipt.immutable).toBe(true);
        expect(result.receipt.receiptHash.length).toBeGreaterThan(0);
        expect(result.receipt.studentId).toBe(validDraft.studentId);
        expect(result.receipt.roundId).toBe(validDraft.roundId);
      }
    });

    it('retrying with same idempotency key replays exact same receipt without duplication', async () => {
      // First submission
      const firstResult = await atomicApplicationService.submitAtomically(validDraft, context);
      expect(firstResult.ok).toBe(true);
      if (!firstResult.ok) return;

      // Second identical submission (same draft and clientNonce)
      const secondResult = await atomicApplicationService.submitAtomically(validDraft, context);

      expect(secondResult.ok).toBe(true);
      if (secondResult.ok) {
        expect(secondResult.status).toBe('replayed');
        expect(secondResult.receipt.receiptId).toBe(firstResult.receipt.receiptId);
        expect(secondResult.receipt.receiptHash).toBe(firstResult.receipt.receiptHash);
      }
    });

    it('same idempotency key with modified payload fails with conflict', async () => {
      // First submission
      await atomicApplicationService.submitAtomically(validDraft, context);

      // Mutate draft while keeping clientNonce identical
      const mutatedDraft: ApplicationDraft = {
        ...validDraft,
        statementSummary: validDraft.statementSummary + ' (mutated payload attack)',
      };

      const conflictResult = await atomicApplicationService.submitAtomically(mutatedDraft, context);

      expect(conflictResult.ok).toBe(false);
      if (!conflictResult.ok) {
        expect(conflictResult.checkFailures[0].code).toBe('IDEMPOTENCY_CONFLICT');
      }
    });
  });
});
