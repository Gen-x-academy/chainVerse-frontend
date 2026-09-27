'use client';

import { useState, useEffect } from 'react';
import type { NormalizedAggregateScore } from '../aggregate-scores';
import { aggregateScoreService, MIN_REVIEWS_FOR_COMPLETE_AGGREGATE } from '../aggregate-scores';

interface Props {
  applicationId: string;
  /** When provided, scores are displayed inline without fetching. */
  initialData?: NormalizedAggregateScore;
}

export function AggregateScorePanel({ applicationId, initialData }: Props) {
  const [data, setData] = useState<NormalizedAggregateScore | null>(initialData ?? null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>(
    initialData ? 'success' : 'idle'
  );
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (initialData) return;
    setStatus('loading');
    aggregateScoreService
      .compute(applicationId)
      .then((result) => {
        setData(result);
        setStatus('success');
      })
      .catch((err: unknown) => {
        setErrorMessage(err instanceof Error ? err.message : 'Failed to load aggregate score.');
        setStatus('error');
      });
  }, [applicationId, initialData]);

  if (status === 'loading') {
    return (
      <section
        aria-label="Aggregate score loading"
        aria-busy="true"
        className="mx-auto w-full max-w-3xl space-y-4 px-4 py-8"
      >
        <div className="h-8 w-48 animate-pulse rounded-xl bg-slate-200" />
        <div className="h-32 w-full animate-pulse rounded-2xl bg-slate-100" />
      </section>
    );
  }

  if (status === 'error') {
    return (
      <section
        aria-labelledby="agg-error-title"
        className="mx-auto w-full max-w-3xl px-4 py-8"
      >
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 space-y-2">
          <h2 id="agg-error-title" className="font-semibold text-red-900">
            Could not load aggregate score
          </h2>
          <p className="text-sm text-red-800">{errorMessage}</p>
          <button
            type="button"
            onClick={() => {
              setStatus('loading');
              aggregateScoreService
                .compute(applicationId)
                .then((result) => {
                  setData(result);
                  setStatus('success');
                })
                .catch((err: unknown) => {
                  setErrorMessage(
                    err instanceof Error ? err.message : 'Failed to load aggregate score.'
                  );
                  setStatus('error');
                });
            }}
            className="rounded-full border border-red-300 bg-white px-4 py-1.5 text-sm font-medium text-red-800 transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            Retry
          </button>
        </div>
      </section>
    );
  }

  if (status === 'success' && !data) {
    return (
      <section
        aria-labelledby="agg-empty-title"
        className="mx-auto w-full max-w-3xl px-4 py-8"
      >
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <h2 id="agg-empty-title" className="font-semibold text-slate-700">
            No aggregate score yet
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            At least {MIN_REVIEWS_FOR_COMPLETE_AGGREGATE} reviews are required before an aggregate
            score can be computed.
          </p>
        </div>
      </section>
    );
  }

  if (!data) return null;

  const scoreColor =
    data.aggregateScore >= 80
      ? 'text-emerald-700'
      : data.aggregateScore >= 50
      ? 'text-amber-700'
      : 'text-red-700';

  return (
    <section
      aria-labelledby="agg-panel-title"
      className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 text-slate-900"
    >
      <header className="space-y-1">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">
          Aggregate score
        </p>
        <h2 id="agg-panel-title" className="text-3xl font-bold tracking-tight">
          Normalized review aggregate
        </h2>
        <p className="text-sm text-slate-500">
          Computed from {data.totalReviews} review{data.totalReviews !== 1 ? 's' : ''} · Tie
          policy: application ID ascending
        </p>
      </header>

      {!data.isComplete && (
        <div
          role="status"
          className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          Incomplete — {MIN_REVIEWS_FOR_COMPLETE_AGGREGATE - data.totalReviews} more review
          {MIN_REVIEWS_FOR_COMPLETE_AGGREGATE - data.totalReviews !== 1 ? 's' : ''} needed for a
          complete aggregate.
        </div>
      )}

      {data.hasRubricVersionMismatch && (
        <div
          role="alert"
          className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800"
        >
          Rubric version mismatch detected. One or more reviews used a different rubric version.
          Scores may not be fully comparable.
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">Aggregate score (0–100)</p>
        <p className={`mt-1 text-5xl font-bold tabular-nums ${scoreColor}`}>
          {data.aggregateScore.toFixed(2)}
        </p>
      </div>

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-slate-700">Per-review breakdown</h3>
        {data.reviewScores.map((rs) => (
          <div
            key={rs.reviewId}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">
                Reviewer <span className="font-mono text-xs text-slate-500">{rs.reviewerId}</span>
              </span>
              <span className="text-sm font-bold text-slate-900 tabular-nums">
                {rs.normalizedTotal.toFixed(2)}
              </span>
            </div>

            <table
              className="w-full text-sm"
              aria-label={`Criterion scores for reviewer ${rs.reviewerId}`}
            >
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th scope="col" className="pb-1 pr-4 font-medium">
                    Criterion
                  </th>
                  <th scope="col" className="pb-1 pr-4 font-medium text-right">
                    Weight
                  </th>
                  <th scope="col" className="pb-1 pr-4 font-medium text-right">
                    Raw
                  </th>
                  <th scope="col" className="pb-1 font-medium text-right">
                    Contribution
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rs.criterionScores.map((cs) => (
                  <tr key={cs.criterionId}>
                    <td className="py-1 pr-4 text-slate-700">{cs.criterionName}</td>
                    <td className="py-1 pr-4 text-right text-slate-500">{cs.weightPercent}%</td>
                    <td className="py-1 pr-4 text-right text-slate-700 tabular-nums">
                      {cs.rawScore}/{cs.maxRawScore}
                    </td>
                    <td className="py-1 text-right font-medium text-slate-900 tabular-nums">
                      {cs.weightedContribution.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-400">
        Computed at {new Date(data.computedAt).toLocaleString()}. Scores are reproducible from
        immutable review inputs and rubric weights.
      </p>
    </section>
  );
}

export default AggregateScorePanel;
