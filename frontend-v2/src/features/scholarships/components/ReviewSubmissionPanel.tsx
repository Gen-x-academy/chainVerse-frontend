'use client';

import { useState } from 'react';
import {
  validateSubmission,
  hasDisqualifyingScore,
  reviewSubmissionService,
} from '../review-submission';
import type {
  ReviewRecommendation,
  ReviewSubmission,
  SubmitReviewPayload,
} from '../review-submission';
import type { ScoringRubric, CriterionScore } from '../scoring-rubric';

const RECOMMENDATION_LABELS: Record<ReviewRecommendation, string> = {
  approve: 'Approve',
  shortlist: 'Shortlist',
  needs_more_info: 'Needs more information',
  reject: 'Reject',
};

interface Props {
  applicationId: string;
  reviewerId: string;
  rubric: ScoringRubric;
  initialScores?: CriterionScore[];
  onSubmitted?: (review: ReviewSubmission) => void;
}

export function ReviewSubmissionPanel({
  applicationId,
  reviewerId,
  rubric,
  initialScores = [],
  onSubmitted,
}: Props) {
  const [scores, setScores] = useState<Record<string, number>>(
    Object.fromEntries(initialScores.map((s) => [s.criterionId, s.score]))
  );
  const [comments, setComments] = useState<Record<string, string>>(
    Object.fromEntries(initialScores.flatMap((s) => (s.comment ? [[s.criterionId, s.comment]] : [])))
  );
  const [recommendation, setRecommendation] = useState<ReviewRecommendation | ''>('');
  const [overallComment, setOverallComment] = useState('');
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'submitted' | 'error'>(
    'idle'
  );
  const [submitted, setSubmitted] = useState<ReviewSubmission | null>(null);
  const [validationErrors, setValidationErrors] = useState<{ field: string; message: string }[]>([]);
  const [amendmentReason, setAmendmentReason] = useState('');
  const [amendmentStatus, setAmendmentStatus] = useState<'idle' | 'submitting' | 'submitted' | 'error'>('idle');

  const isLocked = submitted?.locked ?? false;

  function buildCriterionScores(): CriterionScore[] {
    return rubric.criteria
      .filter((c) => scores[c.id] !== undefined)
      .map((c) => ({
        criterionId: c.id,
        rubricId: rubric.id,
        rubricVersion: rubric.version,
        score: scores[c.id],
        comment: comments[c.id] || undefined,
      }));
  }

  async function handleSubmit() {
    if (!recommendation) {
      setValidationErrors([{ field: 'recommendation', message: 'A recommendation is required.' }]);
      return;
    }

    const criterionScores = buildCriterionScores();
    const payload: SubmitReviewPayload = {
      rubricId: rubric.id,
      rubricVersion: rubric.version,
      scores: criterionScores,
      recommendation,
      overallComment,
    };

    const errors = validateSubmission(payload, rubric);
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors([]);
    setSubmitStatus('submitting');

    try {
      const review = await reviewSubmissionService.submit(applicationId, payload);
      setSubmitted(review);
      setSubmitStatus('submitted');
      onSubmitted?.(review);
    } catch {
      setSubmitStatus('error');
    }
  }

  async function handleAmendmentRequest() {
    if (!submitted || !amendmentReason.trim()) return;
    setAmendmentStatus('submitting');
    try {
      await reviewSubmissionService.requestAmendment(submitted.id, amendmentReason, []);
      setAmendmentStatus('submitted');
      setAmendmentReason('');
    } catch {
      setAmendmentStatus('error');
    }
  }

  const criterionScores = buildCriterionScores();
  const disqualifying = hasDisqualifyingScore(criterionScores, rubric);

  if (isLocked && submitted) {
    return (
      <section
        className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 text-slate-900"
        aria-labelledby="submission-locked-title"
      >
        <header className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">
            Review submitted
          </p>
          <h2 id="submission-locked-title" className="text-3xl font-bold tracking-tight md:text-4xl">
            Review locked
          </h2>
          <p className="max-w-2xl text-sm text-slate-600">
            Submitted reviews are immutable. To correct an error, request an auditable amendment
            below.
          </p>
        </header>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 space-y-3">
          <p className="text-sm font-semibold text-emerald-800">
            Submitted {new Date(submitted.submittedAt).toLocaleString()} · Rubric v
            {submitted.rubricVersion}
          </p>
          <p className="text-sm text-slate-700">
            Recommendation:{' '}
            <strong>{RECOMMENDATION_LABELS[submitted.recommendation]}</strong>
          </p>
          <p className="text-sm text-slate-700">
            Overall comment: {submitted.overallComment}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <h3 className="text-lg font-semibold">Request amendment</h3>
          <p className="text-sm text-slate-600">
            Amendments are auditable. An administrator must approve the change before it is
            applied.
          </p>
          <label className="block space-y-1 text-sm font-medium text-slate-700">
            Reason for amendment
            <textarea
              value={amendmentReason}
              onChange={(e) => setAmendmentReason(e.target.value)}
              rows={3}
              placeholder="Describe the correction and why it is necessary."
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </label>
          <button
            type="button"
            onClick={() => void handleAmendmentRequest()}
            disabled={!amendmentReason.trim() || amendmentStatus === 'submitting'}
            className="rounded-full bg-indigo-600 px-6 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {amendmentStatus === 'submitting' ? 'Submitting…' : 'Request amendment'}
          </button>
          <div aria-live="polite">
            {amendmentStatus === 'submitted' && (
              <p role="status" className="text-sm text-emerald-700">
                Amendment request submitted and logged for administrator review.
              </p>
            )}
            {amendmentStatus === 'error' && (
              <p role="alert" className="text-sm text-red-700">
                Could not submit amendment request. Please try again.
              </p>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 text-slate-900"
      aria-labelledby="submission-panel-title"
    >
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">
          Submit review
        </p>
        <h2 id="submission-panel-title" className="text-3xl font-bold tracking-tight md:text-4xl">
          Finalise and submit
        </h2>
        <p className="max-w-2xl text-sm text-slate-600">
          Score every rubric criterion before submitting. Submission is final — the review locks
          immediately and contributes to the aggregate result.
        </p>
      </header>

      {disqualifying && (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800"
        >
          One or more criterion scores are below the disqualifying threshold. Submitting will
          disqualify this application.
        </div>
      )}

      <div className="space-y-4">
        {rubric.criteria.map((criterion) => (
          <div
            key={criterion.id}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3"
          >
            <div>
              <h3 className="font-semibold">
                {criterion.name}
                <span className="ml-2 text-xs font-normal text-slate-500">
                  ({criterion.weightPercent}%)
                </span>
              </h3>
              {criterion.description && (
                <p className="mt-1 text-sm text-slate-600">{criterion.description}</p>
              )}
            </div>

            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={`Score for ${criterion.name}`}>
              {criterion.scale.map((point) => {
                const selected = scores[criterion.id] === point.value;
                const isDisq =
                  criterion.disqualifyingThreshold !== undefined &&
                  point.value < criterion.disqualifyingThreshold;
                return (
                  <label
                    key={point.value}
                    title={point.description}
                    className={`flex cursor-pointer flex-col items-center rounded-xl border px-4 py-2 text-sm transition
                      ${selected ? 'border-indigo-500 bg-indigo-50 text-indigo-900' : 'border-slate-200 bg-white hover:border-slate-300'}
                      ${isDisq ? 'border-red-200' : ''}`}
                  >
                    <input
                      type="radio"
                      name={`sub-score-${criterion.id}`}
                      value={point.value}
                      checked={selected}
                      onChange={() =>
                        setScores((prev) => ({ ...prev, [criterion.id]: point.value }))
                      }
                      className="sr-only"
                    />
                    <span className="text-lg font-bold">{point.value}</span>
                    <span className="text-xs">{point.label}</span>
                    {isDisq && (
                      <span className="mt-0.5 text-xs text-red-600">disqualifying</span>
                    )}
                  </label>
                );
              })}
            </div>

            {criterion.requiresComment && (
              <div className="space-y-1">
                <label
                  className="block text-xs font-semibold uppercase tracking-wide text-slate-500"
                  htmlFor={`sub-comment-${criterion.id}`}
                >
                  Comment (required)
                </label>
                <textarea
                  id={`sub-comment-${criterion.id}`}
                  rows={2}
                  value={comments[criterion.id] ?? ''}
                  onChange={(e) =>
                    setComments((prev) => ({ ...prev, [criterion.id]: e.target.value }))
                  }
                  aria-required
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-slate-700">
            Recommendation
          </label>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Recommendation">
            {(Object.keys(RECOMMENDATION_LABELS) as ReviewRecommendation[]).map((r) => (
              <label
                key={r}
                className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 text-sm transition
                  ${recommendation === r ? 'border-indigo-500 bg-indigo-50 font-medium text-indigo-900' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}
              >
                <input
                  type="radio"
                  name="recommendation"
                  value={r}
                  checked={recommendation === r}
                  onChange={() => setRecommendation(r)}
                  className="sr-only"
                />
                {RECOMMENDATION_LABELS[r]}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-700" htmlFor="overall-comment">
            Overall comment <span className="text-red-500">*</span>
          </label>
          <textarea
            id="overall-comment"
            rows={4}
            value={overallComment}
            onChange={(e) => setOverallComment(e.target.value)}
            placeholder="Summarise your assessment and justify your recommendation."
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-required
          />
        </div>
      </div>

      {validationErrors.length > 0 && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 space-y-1">
          {validationErrors.map((e) => (
            <p key={e.field}>{e.message}</p>
          ))}
        </div>
      )}

      <div className="flex items-center gap-4" aria-live="polite">
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={submitStatus === 'submitting'}
          className="rounded-full bg-indigo-600 px-8 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {submitStatus === 'submitting' ? 'Submitting…' : 'Submit and lock review'}
        </button>
        {submitStatus === 'error' && (
          <p role="alert" className="text-sm text-red-700">
            Submission failed. Please try again.
          </p>
        )}
      </div>
    </section>
  );
}

export default ReviewSubmissionPanel;
