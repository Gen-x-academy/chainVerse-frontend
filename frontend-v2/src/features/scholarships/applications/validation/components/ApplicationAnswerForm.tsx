'use client';

import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  GraduationCap,
  RefreshCw,
  Send,
  ShieldCheck,
} from 'lucide-react';
import {
  useApplicationFormSchema,
  useSubmitApplicationAnswers,
} from '../hooks';
import { useApplicationValidationStore } from '../store';
import { FormFieldRenderer } from './FormFieldRenderer';
import { ValidationSummaryBanner } from './ValidationSummaryBanner';
import type { SubmitAnswersResponse } from '../types';

export interface ApplicationAnswerFormProps {
  roundId?: string;
  studentId?: string;
  userRole?: string; // 'student' | 'reviewer' | 'sponsor' | 'administrator'
  onSubmitted?: (response: SubmitAnswersResponse) => void;
  className?: string;
}

export function ApplicationAnswerForm({
  roundId = 'round-stellar-2026',
  studentId = 'student-test-1',
  userRole = 'student',
  onSubmitted,
  className = '',
}: ApplicationAnswerFormProps) {
  const isReviewerOrSponsor = userRole === 'reviewer' || userRole === 'sponsor';

  // React Query query for remote schema
  const {
    data: schema,
    isLoading,
    isError,
    error,
    refetch,
  } = useApplicationFormSchema(roundId);

  // Store state
  const {
    answers,
    errors,
    touched,
    wordCounts,
    setAnswer,
    touchField,
    validateAll,
    submit,
    isSubmitting,
    submitError,
    submissionResult,
  } = useApplicationValidationStore();

  const [activeSchema, setActiveSchema] = useState(schema);

  useEffect(() => {
    if (schema) {
      useApplicationValidationStore.getState().loadSchema(roundId);
      setActiveSchema(schema);
    }
  }, [schema, roundId]);

  // Handler: Focus field from ValidationSummaryBanner
  function handleFocusField(fieldId: string) {
    const el = document.getElementById(`field-${fieldId}`);
    if (el) {
      el.focus();
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  // Handler: Submit
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isReviewerOrSponsor) return;

    const validation = validateAll();
    if (!validation || !validation.valid) {
      // Scroll to summary banner
      const banner = document.getElementById('validation-summary-title');
      if (banner) {
        banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    const response = await submit(studentId);
    if (response && onSubmitted) {
      onSubmitted(response);
    }
  }

  /* -------------------------------------------------------------------------- */
  /* 1. Loading State                                                           */
  /* -------------------------------------------------------------------------- */
  if (isLoading) {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label="Loading application questionnaire"
        className={`rounded-2xl border border-slate-200 bg-white p-8 shadow-xs space-y-6 ${className}`}
      >
        <div className="space-y-2">
          <div className="h-6 w-1/3 animate-pulse rounded-lg bg-slate-200" />
          <div className="h-4 w-2/3 animate-pulse rounded-lg bg-slate-100" />
        </div>
        <div className="space-y-4 pt-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
        <span className="sr-only">Loading application questionnaire...</span>
      </div>
    );
  }

  /* -------------------------------------------------------------------------- */
  /* 2. Error State                                                             */
  /* -------------------------------------------------------------------------- */
  if (isError || !activeSchema) {
    return (
      <div
        role="alert"
        className={`rounded-2xl border border-rose-200 bg-rose-50/70 p-8 text-center shadow-xs ${className}`}
      >
        <AlertCircle className="mx-auto h-10 w-10 text-rose-500" aria-hidden="true" />
        <h2 className="mt-3 text-lg font-bold text-rose-900">Failed to Load Application Questionnaire</h2>
        <p className="mt-1 text-xs text-rose-700">
          {error instanceof Error ? error.message : 'Unable to retrieve questionnaire rules from server.'}
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-rose-700"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Try again</span>
        </button>
      </div>
    );
  }

  /* -------------------------------------------------------------------------- */
  /* 3. Empty State                                                             */
  /* -------------------------------------------------------------------------- */
  if (activeSchema.fields.length === 0) {
    return (
      <div
        role="status"
        className={`rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-12 text-center ${className}`}
      >
        <FileText className="mx-auto h-10 w-10 text-slate-400" aria-hidden="true" />
        <h2 className="mt-3 text-base font-semibold text-slate-900">No Questions Configured</h2>
        <p className="mt-1 text-xs text-slate-500">
          This scholarship round currently has no additional application questions required.
        </p>
      </div>
    );
  }

  /* -------------------------------------------------------------------------- */
  /* 4. Success State (Submission Receipt)                                      */
  /* -------------------------------------------------------------------------- */
  if (submissionResult?.ok) {
    return (
      <div
        role="status"
        className={`rounded-2xl border border-emerald-200 bg-emerald-50/60 p-8 text-center shadow-sm ${className}`}
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
          <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
        </div>
        <h2 className="mt-3 text-xl font-bold text-slate-900">Application Answers Validated &amp; Submitted</h2>
        <p className="mt-1 text-xs text-slate-600 max-w-md mx-auto">
          Your questionnaire answers were verified against all word limits, option sets, and schemas.
          Your cryptographic submission receipt has been issued.
        </p>

        <div className="mt-6 mx-auto max-w-sm rounded-xl border border-slate-200 bg-white p-4 text-left text-xs space-y-2">
          <div className="flex justify-between">
            <span className="text-slate-500">Application ID:</span>
            <span className="font-mono font-semibold text-slate-800">{submissionResult.applicationId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Submission Ref:</span>
            <span className="font-mono text-slate-800">{submissionResult.submissionId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Validated At:</span>
            <span className="text-slate-700">{new Date(submissionResult.submittedAt).toLocaleTimeString()}</span>
          </div>
        </div>
      </div>
    );
  }

  const errorList = Object.values(errors);

  /* -------------------------------------------------------------------------- */
  /* 5. Main Form Journey                                                      */
  /* -------------------------------------------------------------------------- */
  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header Banner */}
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
            <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />
            Scholarship Application
          </span>
          <span className="text-xs text-slate-400">&bull;</span>
          <span className="text-xs font-medium text-slate-500">Schema v{activeSchema.version}</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">{activeSchema.title}</h1>
        <p className="mt-1 text-sm text-slate-600 leading-relaxed">{activeSchema.description}</p>

        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500 border-t border-slate-100 pt-3">
          <div className="flex items-center gap-1">
            <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            <span>Client &amp; Server validation parity</span>
          </div>
          <div>&bull;</div>
          <div>Strict word limits and XSS sanitization enforced</div>
          {isReviewerOrSponsor && (
            <div className="rounded-lg bg-amber-50 px-2 py-0.5 font-medium text-amber-800 border border-amber-200">
              Read-Only Reviewer View
            </div>
          )}
        </div>
      </header>

      {/* Validation Summary Banner (Alert) */}
      <ValidationSummaryBanner
        errors={errorList}
        onFocusField={handleFocusField}
      />

      {/* Global submission error */}
      {submitError && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
          <span>{submitError}</span>
        </div>
      )}

      {/* Interactive Form */}
      <form onSubmit={handleSubmit} noValidate className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
        <div className="space-y-6">
          {activeSchema.fields.map((field) => {
            return (
              <FormFieldRenderer
                key={field.id}
                field={field}
                value={answers[field.id]}
                error={errors[field.id]}
                touched={touched[field.id]}
                wordCount={wordCounts[field.id] || 0}
                readOnly={isReviewerOrSponsor}
                onChange={(val) => setAnswer(field.id, val)}
                onBlur={() => touchField(field.id)}
              />
            );
          })}
        </div>

        {!isReviewerOrSponsor && (
          <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <p className="text-xs text-slate-500">
              Answers are securely normalized and validated prior to receipt issuance.
            </p>

            <button
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 transition"
            >
              {isSubmitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden="true" />
                  <span>Validating &amp; Submitting...</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" aria-hidden="true" />
                  <span>Submit Answers</span>
                </>
              )}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
