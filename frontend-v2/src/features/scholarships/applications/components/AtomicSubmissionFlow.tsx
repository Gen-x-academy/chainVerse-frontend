'use client';

import React, { useId, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  FileCheck2,
  FileText,
  Lock,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { consentRequirements } from '../../consent';
import { DOCUMENT_LIMITS, type SupportingDocument, type SupportingDocumentKind } from '../../documents';
import { validateAtomicSubmission } from '../domain';
import { useApplicationDraft, useSubmitApplicationAtomically } from '../hooks';
import { AtomicChecklist } from './AtomicChecklist';
import { SubmissionReceiptView } from './SubmissionReceiptView';
import type { AtomicValidationContext } from '../types';
import type { EligibilityApplicant } from '../../types';
import type { ScholarshipRound } from '../../types/scholarship.types';

export interface AtomicSubmissionFlowProps {
  round: ScholarshipRound;
  studentId?: string;
  userRole?: string;
  initialApplicant?: EligibilityApplicant;
  className?: string;
}

const defaultApplicant: EligibilityApplicant = {
  enrollmentStatus: 'current',
  courseIds: ['intro-to-blockchain'],
  gradeValue: 85,
  gradeMetric: 'percentage',
  region: 'africa',
  incomeBand: 'low',
  role: 'student',
  age: 22,
  customAttestation: 'confirmed',
  completedAchievementIds: ['blockchain-foundations'],
  selectedScholarshipIds: [],
  priorAwardIds: [],
  evidencePermissionGranted: true,
};

export function AtomicSubmissionFlow({
  round,
  studentId = 'student-applicant-1',
  userRole = 'student',
  initialApplicant = defaultApplicant,
  className = '',
}: AtomicSubmissionFlowProps) {
  const isStudent = userRole === 'student' || userRole === 'applicant';
  const statementInputId = useId();
  const amountInputId = useId();
  const aidCheckboxId = useId();

  // Draft management
  const {
    draft,
    statementSummary,
    setStatementSummary,
    requestedAmountCents,
    setRequestedAmountCents,
    needsFinancialAid,
    setNeedsFinancialAid,
    documents,
    addDocument,
    removeDocument,
    acceptedConsentKinds,
    toggleConsent,
    clientNonce,
  } = useApplicationDraft(round.id, studentId, initialApplicant);

  // Atomic submission mutation hook
  const {
    submitAtomically,
    isSubmitting,
    isSuccess,
    isError,
    result,
    reset,
  } = useSubmitApplicationAtomically();

  // Validation context
  const validationContext = useMemo<AtomicValidationContext>(() => {
    return {
      round,
      now: new Date(),
      existingApplicationIds: [],
      requiredDocumentKinds: ['transcript'],
    };
  }, [round]);

  // Real-time 6-pillar validation status
  const liveValidation = useMemo(() => {
    return validateAtomicSubmission(draft, validationContext);
  }, [draft, validationContext]);

  // Mock document upload helper for user journey
  const handleMockUpload = (kind: SupportingDocumentKind) => {
    const limits = DOCUMENT_LIMITS[kind];
    const newDoc: SupportingDocument = {
      id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      applicationId: `draft-${round.id}`,
      kind,
      fileName: `${kind}-verified-${new Date().getFullYear()}.pdf`,
      contentType: 'application/pdf',
      sizeBytes: Math.floor(limits.maxBytes * 0.4),
      status: 'available',
      scanStatus: 'clean',
      uploadedAt: new Date().toISOString(),
      accessLogged: true,
    };
    addDocument(newDoc);
  };

  // Form submission handler
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    await submitAtomically({
      draft,
      context: validationContext,
    });
  };

  // Retry demonstration handler for proving idempotency
  const handleRetryDemonstration = async () => {
    await submitAtomically({
      draft,
      context: validationContext,
    });
  };

  // 1. EMPTY STATE: Invalid or missing round
  if (!round || !round.id) {
    return (
      <div
        role="status"
        className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-xs"
      >
        <AlertCircle className="mx-auto h-12 w-12 text-slate-300" />
        <h2 className="mt-3 text-lg font-bold text-slate-900">No Scholarship Round Selected</h2>
        <p className="mt-1 text-xs text-slate-500">
          Please select an active, open scholarship round to begin your application.
        </p>
      </div>
    );
  }

  // 2. SUCCESS STATE: Submission succeeded and receipt generated
  if (isSuccess && result?.ok && result.receipt) {
    return (
      <SubmissionReceiptView
        receipt={result.receipt}
        onRetryDemonstration={handleRetryDemonstration}
        isRetrying={isSubmitting}
      />
    );
  }

  return (
    <div className={`mx-auto w-full max-w-6xl space-y-8 ${className}`}>
      {/* Journey Header */}
      <header className="border-b border-slate-200 pb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-indigo-100 px-3 py-0.5 text-xs font-semibold text-indigo-700">
                Atomic Application Submission
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                Round: {round.name}
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
              Scholarship Application
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Complete your draft below. Eligibility, form completeness, documents, consent, deadline, and uniqueness are validated atomically in one transition.
            </p>
          </div>

          {!isStudent && (
            <div
              role="status"
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600"
            >
              <ShieldAlert className="h-4 w-4 text-slate-400" />
              <span>Inspection Mode (Role: {userRole}). Only applicant can execute final submission.</span>
            </div>
          )}
        </div>
      </header>

      {/* ERROR STATE: Submission check failures banner (Draft remains fully editable!) */}
      {isError && result && !result.ok && (
        <div
          role="alert"
          aria-labelledby="submission-error-heading"
          className="rounded-2xl border border-red-200 bg-red-50/90 p-5 text-red-900 shadow-xs"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
            <h2 id="submission-error-heading" className="text-sm font-bold text-red-950">
              Atomic Submission Blocked — Draft Preserved
            </h2>
          </div>
          <p className="mt-1 text-xs text-red-800">
            One or more verification checks failed. Your draft remains completely editable below so you can adjust your inputs and re-submit without losing progress.
          </p>

          <ul className="mt-3 list-disc pl-5 text-xs space-y-1 font-medium text-red-900">
            {result.checkFailures.map((failure, i) => (
              <li key={i}>{failure.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Main Dual-Pane Layout: Form on Left, 6-Pillar Checklist on Right */}
      <div className="grid gap-8 lg:grid-cols-12">
        {/* Left Column: Form & Requirements (8 cols on desktop) */}
        <form onSubmit={handleFormSubmit} className="space-y-6 lg:col-span-7">
          {/* Section 1: Statement & Funding Details */}
          <fieldset className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
            <legend className="flex items-center gap-2 px-1 text-base font-bold text-slate-900">
              <FileText className="h-5 w-5 text-indigo-600" />
              <span>1. Application Details</span>
            </legend>

            <div>
              <label htmlFor={statementInputId} className="block text-sm font-medium text-slate-700">
                Personal Statement <span className="text-red-500">*</span>
              </label>
              <p id="statement-help" className="text-xs text-slate-500 mb-1">
                Explain your academic background, career trajectory, and financial need (min 80 characters).
              </p>
              <textarea
                id={statementInputId}
                required
                rows={5}
                value={statementSummary}
                onChange={(e) => setStatementSummary(e.target.value)}
                placeholder="Detail your goals, why this scholarship matters to you, and your commitment to Web3 and blockchain development..."
                aria-describedby="statement-help"
                aria-invalid={statementSummary.length > 0 && statementSummary.trim().length < 80}
                className="w-full rounded-xl border border-slate-300 p-3 text-sm shadow-xs focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="flex justify-between text-xs mt-1">
                <span
                  className={
                    statementSummary.trim().length >= 80 ? 'text-emerald-600 font-semibold' : 'text-slate-400'
                  }
                >
                  {statementSummary.trim().length} / 80 minimum characters
                </span>
                {statementSummary.trim().length >= 80 && (
                  <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                    <CheckCircle2 className="h-3 w-3" /> Met requirement
                  </span>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 pt-2">
              <div>
                <label htmlFor={amountInputId} className="block text-sm font-medium text-slate-700">
                  Requested Funding (USD)
                </label>
                <div className="relative mt-1">
                  <span className="pointer-events-none absolute left-3 top-2 text-slate-400 text-sm">$</span>
                  <input
                    id={amountInputId}
                    type="number"
                    min={0}
                    step={100}
                    value={requestedAmountCents != null ? (requestedAmountCents / 100).toString() : ''}
                    onChange={(e) =>
                      setRequestedAmountCents(
                        e.target.value ? Math.round(Number(e.target.value) * 100) : undefined
                      )
                    }
                    placeholder="2500"
                    className="w-full rounded-xl border border-slate-300 pl-7 pr-3 py-2 text-sm shadow-xs focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-end pb-2">
                <label htmlFor={aidCheckboxId} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                  <input
                    id={aidCheckboxId}
                    type="checkbox"
                    checked={needsFinancialAid}
                    onChange={(e) => setNeedsFinancialAid(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Applying on financial-aid grounds</span>
                </label>
              </div>
            </div>
          </fieldset>

          {/* Section 2: Supporting Documents */}
          <fieldset className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
            <legend className="flex items-center gap-2 px-1 text-base font-bold text-slate-900">
              <FileCheck2 className="h-5 w-5 text-indigo-600" />
              <span>2. Supporting Documents</span>
            </legend>
            <p className="text-xs text-slate-500">
              Upload required transcripts and supporting evidence. Documents are automatically scanned for security.
            </p>

            {/* Document Upload Triggers */}
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => handleMockUpload('transcript')}
                className="flex items-center justify-between rounded-xl border border-dashed border-indigo-300 bg-indigo-50/40 p-3 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <span className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  <span>Attach Academic Transcript</span>
                </span>
                <span className="text-[10px] uppercase font-bold text-indigo-500">Required</span>
              </button>

              <button
                type="button"
                onClick={() => handleMockUpload('incomeEvidence')}
                className="flex items-center justify-between rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <span className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  <span>Attach Income Evidence</span>
                </span>
                <span className="text-[10px] uppercase font-bold text-slate-400">
                  {needsFinancialAid ? 'Required' : 'Optional'}
                </span>
              </button>
            </div>

            {/* Uploaded Documents List */}
            {documents.length > 0 && (
              <ul className="space-y-2 pt-2" aria-label="Attached supporting documents">
                {documents.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <FileCheck2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <div>
                        <p className="font-semibold text-slate-900">{doc.fileName}</p>
                        <p className="text-[11px] text-slate-500">
                          {doc.kind} • {(doc.sizeBytes / 1024).toFixed(0)} KB • Scan: clean
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeDocument(doc.id)}
                      className="text-slate-400 hover:text-red-600 font-bold px-2 py-1"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>

          {/* Section 3: Required Affirmative Consents */}
          <fieldset className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
            <legend className="flex items-center gap-2 px-1 text-base font-bold text-slate-900">
              <ShieldCheck className="h-5 w-5 text-indigo-600" />
              <span>3. Affirmative Consents</span>
            </legend>
            <p className="text-xs text-slate-500">
              Affirmative versioned agreements are required before the application can transition to submission.
            </p>

            <div className="space-y-3">
              {consentRequirements.map((req) => (
                <label
                  key={req.kind}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-xs transition ${
                    acceptedConsentKinds.includes(req.kind)
                      ? 'border-indigo-300 bg-indigo-50/40 text-indigo-950'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={acceptedConsentKinds.includes(req.kind)}
                    onChange={() => toggleConsent(req.kind)}
                    aria-label={`Agree to ${req.title}`}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <p className="font-bold text-slate-900">{req.title}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{req.description}</p>
                    <span className="text-[10px] text-indigo-600 font-semibold block mt-1">
                      Policy Version: {req.version}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Submit Action */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting || !isStudent}
              aria-busy={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3.5 px-6 text-sm font-bold text-white shadow-md transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Validating and Submitting Atomically…</span>
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  <span>Submit Application Atomically</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
            <p className="mt-2 text-center text-xs text-slate-500">
              Submission creates one immutable digital receipt protected by client idempotency nonce ({clientNonce.slice(0, 12)}…).
            </p>
          </div>
        </form>

        {/* Right Column: 6-Pillar Real-Time Checklist (5 cols on desktop) */}
        <aside className="lg:col-span-5 space-y-6">
          <AtomicChecklist checks={liveValidation.checks} isSubmitting={isSubmitting} />

          {/* Round Info Summary Card */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 text-xs text-slate-700 space-y-2">
            <h4 className="font-bold text-slate-900">Scholarship Round Details</h4>
            <div className="flex justify-between">
              <span className="text-slate-500">Round Name:</span>
              <span className="font-semibold">{round.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Status:</span>
              <span className="font-semibold uppercase text-emerald-700">{round.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Application Deadline:</span>
              <span className="font-semibold">{new Date(round.applicationDeadline).toLocaleDateString()}</span>
            </div>
            {round.awardAmountCents && (
              <div className="flex justify-between">
                <span className="text-slate-500">Award Amount:</span>
                <span className="font-semibold">${(round.awardAmountCents / 100).toFixed(2)} USD</span>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
