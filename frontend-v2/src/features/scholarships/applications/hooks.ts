'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { scholarshipKeys } from '../hooks/useScholarships';
import { validateAtomicSubmission } from './domain';
import { atomicApplicationService } from './service';
import type {
  ApplicationDraft,
  AtomicSubmissionResult,
  AtomicValidationContext,
  SubmissionReceipt,
} from './types';
import type { ConsentKind } from '../consent';
import type { SupportingDocument } from '../documents';
import type { EligibilityApplicant } from '../types';

export const atomicApplicationKeys = {
  all: ['atomic-applications'] as const,
  receipt: (id: string) => [...atomicApplicationKeys.all, 'receipt', id] as const,
  draft: (roundId: string, studentId: string) =>
    [...atomicApplicationKeys.all, 'draft', roundId, studentId] as const,
};

function generateClientNonce(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `nonce-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Hook to manage an application draft in progress with local recovery.
 */
export function useApplicationDraft(
  roundId: string,
  studentId: string,
  initialApplicantProfile: EligibilityApplicant
) {
  const [statementSummary, setStatementSummary] = useState('');
  const [requestedAmountCents, setRequestedAmountCents] = useState<number | undefined>(undefined);
  const [needsFinancialAid, setNeedsFinancialAid] = useState(true);
  const [applicantProfile, setApplicantProfile] =
    useState<EligibilityApplicant>(initialApplicantProfile);
  const [documents, setDocuments] = useState<SupportingDocument[]>([]);
  const [acceptedConsentKinds, setAcceptedConsentKinds] = useState<ConsentKind[]>([]);
  const clientNonceRef = useRef(generateClientNonce());

  // Build reactive draft snapshot
  const draft = useMemo<ApplicationDraft>(() => {
    return {
      roundId,
      studentId,
      statementSummary,
      requestedAmountCents,
      needsFinancialAid,
      applicantProfile,
      uploadedDocumentIds: documents.map((d) => d.id),
      documents,
      acceptedConsentKinds,
      clientNonce: clientNonceRef.current,
      updatedAt: new Date().toISOString(),
    };
  }, [
    roundId,
    studentId,
    statementSummary,
    requestedAmountCents,
    needsFinancialAid,
    applicantProfile,
    documents,
    acceptedConsentKinds,
  ]);

  const toggleConsent = useCallback((kind: ConsentKind) => {
    setAcceptedConsentKinds((prev) =>
      prev.includes(kind) ? prev.filter((k) => k !== kind) : [...prev, kind]
    );
  }, []);

  const addDocument = useCallback((doc: SupportingDocument) => {
    setDocuments((prev) => [...prev.filter((d) => d.id !== doc.id), doc]);
  }, []);

  const removeDocument = useCallback((docId: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
  }, []);

  const resetDraft = useCallback(() => {
    setStatementSummary('');
    setRequestedAmountCents(undefined);
    setNeedsFinancialAid(true);
    setDocuments([]);
    setAcceptedConsentKinds([]);
    clientNonceRef.current = generateClientNonce();
  }, []);

  return {
    draft,
    statementSummary,
    setStatementSummary,
    requestedAmountCents,
    setRequestedAmountCents,
    needsFinancialAid,
    setNeedsFinancialAid,
    applicantProfile,
    setApplicantProfile,
    documents,
    addDocument,
    removeDocument,
    acceptedConsentKinds,
    toggleConsent,
    resetDraft,
    clientNonce: clientNonceRef.current,
  };
}

/**
 * Hook to submit an application atomically with idempotency replay protection.
 */
export function useSubmitApplicationAtomically() {
  const queryClient = useQueryClient();
  const [submissionResult, setSubmissionResult] = useState<AtomicSubmissionResult | null>(null);

  const mutation = useMutation({
    mutationFn: ({
      draft,
      context,
    }: {
      draft: ApplicationDraft;
      context: AtomicValidationContext;
    }) => atomicApplicationService.submitAtomically(draft, context),
    onSuccess: (result) => {
      setSubmissionResult(result);
      if (result.ok) {
        queryClient.invalidateQueries({ queryKey: scholarshipKeys.applications() });
        queryClient.invalidateQueries({ queryKey: atomicApplicationKeys.all });
      }
    },
    onError: (err) => {
      setSubmissionResult({
        ok: false,
        status: 'failed',
        checkFailures: [
          {
            kind: 'form_completeness',
            code: 'NETWORK_SUBMISSION_ERROR',
            message: err instanceof Error ? err.message : 'Network error during atomic submission.',
          },
        ],
        failedChecks: ['form_completeness'],
        message: 'Submission encountered an error. Draft preserved in editable state.',
        draftPreserved: true,
      });
    },
  });

  const reset = useCallback(() => {
    setSubmissionResult(null);
    mutation.reset();
  }, [mutation]);

  return {
    submitAtomically: mutation.mutateAsync,
    isSubmitting: mutation.isPending,
    isSuccess: mutation.isSuccess && submissionResult?.ok === true,
    isError: mutation.isError || (submissionResult != null && !submissionResult.ok),
    result: submissionResult,
    reset,
  };
}

/**
 * Hook to retrieve a submission receipt.
 */
export function useSubmissionReceipt(receiptId?: string) {
  return useQuery({
    queryKey: atomicApplicationKeys.receipt(receiptId ?? ''),
    queryFn: () => atomicApplicationService.getReceipt(receiptId ?? ''),
    enabled: Boolean(receiptId),
    staleTime: Infinity, // Receipts are immutable
  });
}
