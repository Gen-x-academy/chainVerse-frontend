'use client';

import { useState } from 'react';
import { canReviewAppeal, validateAppealReview, isFinalOutcome, hasBeenFinallyDecided } from '../domain';
import { appealService } from '../service';
import type { Appeal, AppealDecisionRecord, AppealDecisionOutcome, DecideAppealPayload } from '../types';

const OUTCOME_LABELS: Record<AppealDecisionOutcome, string> = {
  upheld: 'Uphold appeal',
  partially_upheld: 'Partially uphold',
  dismissed: 'Dismiss appeal',
};

const OUTCOME_COLORS: Record<AppealDecisionOutcome, string> = {
  upheld: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  partially_upheld: 'bg-amber-50 border-amber-200 text-amber-800',
  dismissed: 'bg-red-50 border-red-200 text-red-800',
};

const STATUS_LABELS: Record<Appeal['status'], string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under review',
  decided: 'Decided',
  withdrawn: 'Withdrawn',
};

interface Props {
  appeal: Appeal;
  existingDecisions: AppealDecisionRecord[];
  reviewerId: string;
  onDecisionRecorded?: (record: AppealDecisionRecord) => void;
}

export function AppealReviewPanel({
  appeal,
  existingDecisions,
  reviewerId,
  onDecisionRecorded,
}: Props) {
  const [outcome, setOutcome] = useState<AppealDecisionOutcome | ''>('');
  const [reasoning, setReasoning] = useState('');
  const [decisionStatus, setDecisionStatus] = useState<
    'idle' | 'submitting' | 'success' | 'error'
  >('idle');
  const [errors, setErrors] = useState<{ field: string; message: string }[]>([]);
  const [recordedDecision, setRecordedDecision] = useState<AppealDecisionRecord | null>(null);

  const isReviewerAllowed = canReviewAppeal(reviewerId, appeal);
  const alreadyFinal = hasBeenFinallyDecided(existingDecisions);

  async function handleDecide() {
    if (!outcome) {
      setErrors([{ field: 'outcome', message: 'Select an outcome before recording a decision.' }]);
      return;
    }
    const validationErrors = validateAppealReview(reviewerId, appeal, reasoning);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors([]);
    setDecisionStatus('submitting');

    const payload: DecideAppealPayload = {
      appealId: appeal.id,
      reviewerId,
      outcome: outcome as AppealDecisionOutcome,
      reasoning,
    };

    try {
      const record = await appealService.decide(payload);
      setRecordedDecision(record);
      setDecisionStatus('success');
      onDecisionRecorded?.(record);
    } catch {
      setDecisionStatus('error');
    }
  }

  if (recordedDecision) {
    return (
      <section
        aria-labelledby="appeal-review-decided-title"
        className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 text-slate-900"
      >
        <div
          role="status"
          className={`rounded-2xl border px-5 py-5 space-y-3 ${OUTCOME_COLORS[recordedDecision.outcome]}`}
        >
          <h2 id="appeal-review-decided-title" className="text-xl font-bold">
            Appeal decision recorded
          </h2>
          <p className="text-sm">
            Outcome: <strong>{OUTCOME_LABELS[recordedDecision.outcome]}</strong>
          </p>
          <p className="text-sm">{recordedDecision.reasoning}</p>
          {recordedDecision.isFinal && (
            <p className="text-sm font-semibold">
              This decision is final. No further appeals may be filed.
            </p>
          )}
          <p className="text-xs opacity-75">
            {new Date(recordedDecision.decidedAt).toLocaleString()}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="appeal-review-title"
      className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 text-slate-900"
    >
      <header className="space-y-1">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">
          Appeal review
        </p>
        <h2 id="appeal-review-title" className="text-3xl font-bold tracking-tight">
          Review appeal
        </h2>
        <p className="text-sm text-slate-500">
          Status: <strong>{STATUS_LABELS[appeal.status]}</strong> · Application:{' '}
          <span className="font-mono text-xs">{appeal.applicationId}</span>
        </p>
      </header>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <h3 className="font-semibold text-slate-800">Appeal details</h3>
        <p className="text-sm text-slate-700">
          <strong>Grounds:</strong>{' '}
          {appeal.grounds.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
        </p>
        <p className="text-sm text-slate-700 whitespace-pre-line">{appeal.statement}</p>
        <p className="text-xs text-slate-500">
          Deadline: {new Date(appeal.deadline).toLocaleString()}
        </p>
        <p className="text-xs text-slate-500">
          {appeal.excludedReviewerIds.length} reviewer
          {appeal.excludedReviewerIds.length !== 1 ? 's' : ''} excluded (original committee)
        </p>
      </div>

      {alreadyFinal && (
        <div
          role="status"
          className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-700"
        >
          A final decision has already been recorded for this appeal. No further decisions may be
          added.
        </div>
      )}

      {!isReviewerAllowed && (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800"
        >
          You were part of the original decision committee and are excluded from reviewing this
          appeal.
        </div>
      )}

      {isReviewerAllowed && !alreadyFinal && appeal.status === 'under_review' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <h3 className="font-semibold text-slate-800">Record decision</h3>

          <div>
            <p className="mb-2 text-sm font-semibold text-slate-700">
              Outcome <span className="text-red-500">*</span>
            </p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Appeal outcome">
              {(Object.keys(OUTCOME_LABELS) as AppealDecisionOutcome[]).map((o) => (
                <label
                  key={o}
                  className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 text-sm transition
                    ${outcome === o ? 'border-indigo-500 bg-indigo-50 font-medium text-indigo-900' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}
                >
                  <input
                    type="radio"
                    name="appeal-outcome"
                    value={o}
                    checked={outcome === o}
                    onChange={() => setOutcome(o)}
                    className="sr-only"
                  />
                  {OUTCOME_LABELS[o]}
                </label>
              ))}
            </div>
            {outcome && isFinalOutcome(outcome as AppealDecisionOutcome) && (
              <p className="mt-2 text-xs text-slate-500">
                This outcome is final — no further appeals may be filed against the original
                decision.
              </p>
            )}
          </div>

          <label className="block space-y-1 text-sm font-medium text-slate-700">
            Reasoning <span className="text-red-500">*</span>
            <textarea
              value={reasoning}
              onChange={(e) => setReasoning(e.target.value)}
              rows={5}
              placeholder="Provide detailed reasoning for your decision."
              aria-required
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </label>

          {errors.length > 0 && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 space-y-1"
            >
              {errors.map((e) => (
                <p key={e.field}>{e.message}</p>
              ))}
            </div>
          )}

          <div className="flex items-center gap-4" aria-live="polite">
            <button
              type="button"
              onClick={() => void handleDecide()}
              disabled={decisionStatus === 'submitting'}
              className="rounded-full bg-indigo-600 px-8 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {decisionStatus === 'submitting' ? 'Recording…' : 'Record decision'}
            </button>
            {decisionStatus === 'error' && (
              <p role="alert" className="text-sm text-red-700">
                Failed to record decision. Please try again.
              </p>
            )}
          </div>
        </div>
      )}

      {existingDecisions.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-slate-700">Decision history</h3>
          {existingDecisions.map((d) => (
            <div
              key={d.id}
              className={`rounded-2xl border px-5 py-4 space-y-2 ${OUTCOME_COLORS[d.outcome]}`}
            >
              <p className="font-semibold text-sm">{OUTCOME_LABELS[d.outcome]}</p>
              <p className="text-sm">{d.reasoning}</p>
              <p className="text-xs opacity-75">
                {new Date(d.decidedAt).toLocaleString()}
                {d.isFinal && ' · Final'}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default AppealReviewPanel;
