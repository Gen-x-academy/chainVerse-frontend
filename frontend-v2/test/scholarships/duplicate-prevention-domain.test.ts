// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  detectDraftConflict,
  evaluateApplicantUniqueness,
  executeApplicationMerge,
  reconcileDraftsSafely,
} from '@/src/features/scholarships/duplicates/domain';
import {
  mockExistingApplications,
  mockUniquenessRules,
} from '@/src/features/scholarships/duplicates/fixtures';
import type {
  ExistingApplicationSummary,
  MergeApplicationsPayload,
  ProgramUniquenessRule,
} from '@/src/features/scholarships/duplicates/types';

describe('Duplicate Application Prevention & Merge Domain Engine', () => {
  describe('1. Uniqueness Policy Evaluation', () => {
    const lifetimeRule: ProgramUniquenessRule = {
      programId: 'prog-stellar-fellows-2026',
      scope: 'one_per_program_lifetime',
      maxApplicationsPerApplicant: 1,
      allowDraftResumption: true,
      lockTimeoutSeconds: 30,
    };

    it('allows submission when applicant has zero previous applications in program', () => {
      const result = evaluateApplicantUniqueness(
        'student-new-user',
        'prog-stellar-fellows-2026',
        'round-stellar-2026',
        mockExistingApplications,
        lifetimeRule
      );

      expect(result.allowed).toBe(true);
      expect(result.existingCount).toBe(0);
    });

    it('blocks duplicate submission when applicant already has a submitted application', () => {
      const result = evaluateApplicantUniqueness(
        'student-chidi-1',
        'prog-stellar-fellows-2026',
        'round-stellar-2026',
        mockExistingApplications,
        lifetimeRule
      );

      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toBe('DUPLICATE_APPLICATION_EXISTS');
        expect(result.existingApplication).toBeDefined();
        expect(result.existingApplication.studentId).toBe('student-chidi-1');
        expect(result.message).toContain('already submitted an active application');
      }
    });

    it('ignores merged and withdrawn applications when enforcing uniqueness', () => {
      const appsWithWithdrawn: ExistingApplicationSummary[] = [
        {
          ...mockExistingApplications[0],
          status: 'withdrawn',
        },
      ];

      const result = evaluateApplicantUniqueness(
        'student-chidi-1',
        'prog-stellar-fellows-2026',
        'round-stellar-2026',
        appsWithWithdrawn,
        lifetimeRule
      );

      expect(result.allowed).toBe(true);
      expect(result.existingCount).toBe(0);
    });
  });

  describe('2. Safe Draft Reconciliation (Zero Data Loss)', () => {
    const draftA = {
      statementSummary: 'Draft statement on mobile device with initial thoughts.',
      requestedAmountCents: 200000,
      documents: [
        {
          id: 'doc-1',
          applicationId: 'draft-1',
          kind: 'transcript' as const,
          fileName: 'transcript-a.pdf',
          contentType: 'application/pdf',
          sizeBytes: 1024 * 100,
          status: 'available' as const,
          scanStatus: 'clean' as const,
          uploadedAt: '2026-09-20T10:00:00.000Z',
          accessLogged: true,
        },
      ],
      updatedAt: '2026-09-20T10:05:00.000Z',
    };

    const draftB = {
      statementSummary:
        'Expanded comprehensive draft statement composed on desktop browser with complete details and blockchain career goals.',
      requestedAmountCents: 250000,
      documents: [
        {
          id: 'doc-2',
          applicationId: 'draft-1',
          kind: 'incomeEvidence' as const,
          fileName: 'income-verification.pdf',
          contentType: 'application/pdf',
          sizeBytes: 1024 * 200,
          status: 'available' as const,
          scanStatus: 'clean' as const,
          uploadedAt: '2026-09-20T10:15:00.000Z',
          accessLogged: true,
        },
      ],
      updatedAt: '2026-09-20T10:20:00.000Z',
    };

    it('detects draft conflict when statements or documents differ', () => {
      expect(
        detectDraftConflict(
          { ...draftA, documentsCount: draftA.documents.length },
          { ...draftB, documentsCount: draftB.documents.length }
        )
      ).toBe(true);
    });

    it('combines documents without losing attachments from either draft', () => {
      const result = reconcileDraftsSafely(draftA, draftB, 'combine_documents');

      expect(result.documents).toHaveLength(2);
      expect(result.documents.map((d) => d.id)).toContain('doc-1');
      expect(result.documents.map((d) => d.id)).toContain('doc-2');
      expect(result.message).toContain('Preserved 2 supporting document(s)');
    });

    it('picks the longest statement when merge_longest_statement strategy is selected', () => {
      const result = reconcileDraftsSafely(draftA, draftB, 'merge_longest_statement');

      expect(result.statementSummary).toBe(draftB.statementSummary);
      expect(result.statementSummary.length).toBeGreaterThan(draftA.statementSummary.length);
    });

    it('keeps latest edits when keep_latest strategy is selected', () => {
      const result = reconcileDraftsSafely(draftA, draftB, 'keep_latest');

      expect(result.statementSummary).toBe(draftB.statementSummary);
      expect(result.requestedAmountCents).toBe(draftB.requestedAmountCents);
    });
  });

  describe('3. Controlled Administrative Merge Process', () => {
    const payload: MergeApplicationsPayload = {
      clusterId: 'cluster-chidi-stellar',
      primaryApplicationId: 'app-dup-1',
      secondaryApplicationIds: ['app-dup-2'],
      combineDocuments: true,
      selectedStatementApplicationId: 'app-dup-2',
      selectedAmountApplicationId: 'app-dup-2',
      adminReason: 'Student created duplicate application across multiple browser sessions.',
      adminUserId: 'admin-auditor-1',
    };

    it('executes merge, preserves selected content, transfers documents, and marks secondaries merged', () => {
      const result = executeApplicationMerge(payload, mockExistingApplications);

      // Primary application updated
      expect(result.primaryApplication.id).toBe('app-dup-1');
      expect(result.primaryApplication.statementSummary).toBe(
        mockExistingApplications[1].statementSummary
      );
      expect(result.primaryApplication.documents).toHaveLength(2); // combined doc-chidi-transcript and doc-chidi-portfolio

      // Secondary application marked merged
      expect(result.mergedSecondaryApplications).toHaveLength(1);
      expect(result.mergedSecondaryApplications[0].id).toBe('app-dup-2');
      expect(result.mergedSecondaryApplications[0].status).toBe('merged');

      // Audit record generated
      expect(result.auditRecord).toBeDefined();
      expect(result.auditRecord.primaryApplicationId).toBe('app-dup-1');
      expect(result.auditRecord.mergedSecondaryIds).toContain('app-dup-2');
      expect(result.auditRecord.adminReason).toBe(
        'Student created duplicate application across multiple browser sessions.'
      );
      expect(result.auditRecord.transferredDocumentCount).toBe(1);
    });

    it('requires mandatory administrative justification reason', () => {
      const invalidPayload: MergeApplicationsPayload = {
        ...payload,
        adminReason: '   ',
      };

      expect(() =>
        executeApplicationMerge(invalidPayload, mockExistingApplications)
      ).toThrow('Administrative justification reason is mandatory');
    });

    it('fails when primary application does not exist', () => {
      const invalidPayload: MergeApplicationsPayload = {
        ...payload,
        primaryApplicationId: 'non-existent-app-id',
      };

      expect(() =>
        executeApplicationMerge(invalidPayload, mockExistingApplications)
      ).toThrow('Primary application "non-existent-app-id" not found');
    });
  });
});
