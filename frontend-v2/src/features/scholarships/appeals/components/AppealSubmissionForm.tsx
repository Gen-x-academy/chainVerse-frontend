'use client';

import { useState } from 'react';
import { validateAppealSubmission, isWithinAppealWindow } from '../domain';
import { appealService } from '../service';
import type { Appeal, AppealGrounds, SubmitAppealPayload } from '../types';

const GROUNDS_LABELS: Record<AppealGrounds, string> = {
  procedural_error: 'Procedural error',
  new_evidence: 'New evidence',
  bias_conflict: 'Bias / conflict of interest',
  calculation_error: 'Calculation error',
  other: 'Other',
};

interface Props {
  applicationId: string;
  decisionId: string;
  decisionType: string;
  appellantId: string;
  appealDeadline: string;
  originalReviewerIds: string[];
  existingAppeals: Appeal[];
  onSubmitted?: (appeal: Appeal) => void;
}

export function AppealSubmissionForm({
  applicationId,
  decisionId,
  decisionType,
  appellantId,
  appealDeadline,
  originalReviewerIds,
  existingAppeals,
  onSubmitted,
}: Props) {
  const [grounds, setGrounds] = useState<AppealGrounds | ''>('');
  const [statement, setStatement] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'submitted' | 'error'>('idle');
  const [submittedAppeal, setSubmittedAppeal] = useState<Appeal | null>(null);
  const [validationErrors, setValidationErrors] = useState<{ field: string; message: string }[]>(
    []
  );
  const [idempotencyKey] = useState(
    () => `appeal-${decisionId}-${appellantId}-${Date.now().toString(36)}`
  );

  const withinWindow = isWithinAppealWindow(appealDeadline);
  const deadlineDate = new Date(appealDeadline);

  if (status === 'submitted' && submittedAppeal) {
    return (
      <section
        aria-labelledby="appeal-submitted-title"
        className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 text-slate-900"
      >
        <div
          role="status"
          className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 space-y-2"
        >
          <h2 id="appeal-submitted-title" className="text-xl font-bold text-emerald-900">
            Appeal submitted
          </h2>
          <p className="text-sm text-emerald-800">
            Your appeal has been received and is under review. You will be notified of the outcome.
          </p>
          <p className="text-sm text-slate-700">
            Appeal ID: <span className="font-mono text-xs">{submittedAppeal.id}</span>
          </p>
          <p className="text-sm text-slate-700">
            Grounds: {GROUNDS_LABELS[submittedAppeal.grounds]}
          </p>
          <p className="text-sm text-slate-700">
            Original reviewers ({originalReviewerIds.length}) are excluded from reviewing this
            appeal.
          </p>
        </div>
      </section>
    );
  }

  async function handleSubmit() {
    if (!grounds) {
      setValidationErrors([{ field: 'grounds', message: 'Select the grounds for your appeal.' }]);
      return;
    }

    const payload: SubmitAppealPayload = {
      applicationId,
      decisionId,
      appellantId,
      grounds: grounds as AppealGrounds,
      statement,
      evidence: [],
      idempotencyKey,
    };

    const errors = validateAppealSubmission(payload, decisionType, existingAppeals);
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors([]);
    setStatus('submitting');

    try {
      const appeal = await appealService.create(payload);
      const submitted = await appealService.submit(appeal.id);
      setSubmittedAppeal(submitted);
      setStatus('submitted');
      onSubmitted?.(submitted);
    } catch (err) {
      setStatus('error');
    }
  }

  return (
    <section
      aria-labelledby="appeal-form-title"
      className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 text-slate-900"
    >
      <header className="space-y-1">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">
          File an appeal
        </p>
        <h2 id="appeal-form-title" className="text-3xl font-bold tracking-tight">
          Appeal against decision
        </h2>
        <p className="text-sm text-slate-500">
          Deadline: {deadlineDate.toLocaleString()}
          {!withinWindow && (
            <span className="ml-2 font-semibold text-red-700">(window closed)</span>
          )}
        </p>
      </header>

      {!withinWindow && (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800"
        >
          The appeal window has closed. No further appeals may be filed against this decision.
        </div>
      )}

      {withinWindow && (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-700">
                Grounds for appeal <span className="text-red-500">*</span>
              </p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Appeal grounds">
                {(Object.keys(GROUNDS_LABELS) as AppealGrounds[]).map((g) => (
                  <label
                    key={g}
                    className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 text-sm transition
                      ${grounds === g ? 'border-indigo-500 bg-indigo-50 font-medium text-indigo-900' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}
                  >
                    <input
                      type="radio"
                      name="appeal-grounds"
                      value={g}
                      checked={grounds === g}
                      onChange={() => setGrounds(g)}
                      className="sr-only"
                    />
                    {GROUNDS_LABELS[g]}
                  </label>
                ))}
              </div>
            </div>

            <label className="block space-y-1 text-sm font-medium text-slate-700">
              Statement <span className="text-red-500">*</span>
              <textarea
                value={statement}
                onChange={(e) => setStatement(e.target.value)}
                rows={6}
                placeholder="Describe the grounds for your appeal in detail. Minimum 50 characters."
                aria-required
                aria-describedby="statement-hint"
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span id="statement-hint" className="text-xs text-slate-500">
                {statement.length} characters
              </span>
            </label>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-sm text-slate-600 space-y-1">
            <p className="font-medium text-slate-700">What happens next</p>
            <p>
              Original reviewers ({originalReviewerIds.length}) are automatically excluded from
              reviewing this appeal.
            </p>
            <p>Appeal decisions are separate from the original decision and have their own finality rules.</p>
            <p>A dismissed appeal is final — no further appeals may be filed.</p>
          </div>

          {validationErrors.length > 0 && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 space-y-1"
            >
              {validationErrors.map((e) => (
                <p key={e.field}>{e.message}</p>
              ))}
            </div>
          )}

          <div className="flex items-center gap-4" aria-live="polite">
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={status === 'submitting'}
              className="rounded-full bg-indigo-600 px-8 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {status === 'submitting' ? 'Submitting…' : 'Submit appeal'}
            </button>
            {status === 'error' && (
              <p role="alert" className="text-sm text-red-700">
                Submission failed. Please try again.
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}

export default AppealSubmissionForm;
