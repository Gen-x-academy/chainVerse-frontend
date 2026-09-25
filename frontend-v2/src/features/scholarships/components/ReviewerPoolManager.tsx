'use client';

import { useEffect, useState } from 'react';
import {
  fallbackReviewerPool,
  filterActiveReviewers,
  getWorkloadRatio,
  isReviewerAvailable,
  reviewerPoolService,
  validateReviewerPool,
} from '../reviewer-pool';
import type { ReviewerPool } from '../reviewer-pool';

const SCHOLARSHIP_ID = 'scholarship-standard';

function WorkloadBar({ ratio }: { ratio: number }) {
  const pct = Math.min(Math.round(ratio * 100), 100);
  const color =
    pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div
      className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-200"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Workload ${pct}%`}
    >
      <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function ReviewerPoolManager() {
  const [pools, setPools] = useState<ReviewerPool[]>([fallbackReviewerPool]);
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'empty'>('loading');

  useEffect(() => {
    let isMounted = true;
    reviewerPoolService
      .list(SCHOLARSHIP_ID)
      .then((data) => {
        if (!isMounted) return;
        if (data.length === 0) {
          setStatus('empty');
          setPools([]);
          return;
        }
        setPools(data);
        setStatus('success');
      })
      .catch(() => {
        if (!isMounted) return;
        setPools([fallbackReviewerPool]);
        setStatus('error');
      });
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section
      className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 text-slate-900"
      aria-labelledby="reviewer-pool-title"
    >
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">
          Review management
        </p>
        <h2 id="reviewer-pool-title" className="text-3xl font-bold tracking-tight md:text-4xl">
          Reviewer pools
        </h2>
        <p className="max-w-2xl text-sm text-slate-600 md:text-base">
          Only active qualified reviewers receive work. Capacity updates are concurrency-safe —
          reviewers at their limit are excluded from new assignments automatically.
        </p>
      </header>

      {status === 'loading' && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600"
        >
          Loading reviewer pools…
        </div>
      )}

      {status === 'error' && (
        <div
          role="alert"
          className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        >
          Reviewer pool service is temporarily unavailable. A fallback pool is shown.
        </div>
      )}

      {status === 'empty' && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600"
        >
          No reviewer pools are configured for this scholarship.
        </div>
      )}

      {pools.length > 0 && (
        <ul className="space-y-6" aria-label="Reviewer pool list">
          {pools.map((pool) => {
            const validation = validateReviewerPool(pool);
            const activeReviewers = filterActiveReviewers(pool);
            return (
              <li
                key={pool.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-semibold">{pool.name}</h3>
                    <p className="mt-1 text-sm text-slate-600">{pool.description}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {activeReviewers.length} of {pool.reviewers.length} reviewers available
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2" aria-label="Required expertise tags">
                    {pool.requiredTags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-medium text-indigo-700"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {!validation.valid && (
                  <ul
                    role="alert"
                    className="mt-4 space-y-1 rounded-xl border border-red-200 bg-red-50 p-3"
                  >
                    {validation.errors.map((err) => (
                      <li key={err} className="text-sm text-red-800">
                        • {err}
                      </li>
                    ))}
                  </ul>
                )}

                {validation.warnings.length > 0 && (
                  <ul
                    role="status"
                    aria-live="polite"
                    className="mt-4 space-y-1 rounded-xl border border-amber-200 bg-amber-50 p-3"
                  >
                    {validation.warnings.map((w) => (
                      <li key={w} className="text-sm text-amber-800">
                        • {w}
                      </li>
                    ))}
                  </ul>
                )}

                <ul
                  className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
                  aria-label={`Reviewers in ${pool.name}`}
                >
                  {pool.reviewers.map((reviewer) => {
                    const ratio = getWorkloadRatio(reviewer);
                    const available = isReviewerAvailable(reviewer);
                    return (
                      <li
                        key={reviewer.id}
                        className="rounded-xl border border-slate-200 p-4"
                        aria-label={`${reviewer.displayName}, ${available ? 'available' : 'not available'}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-slate-900">{reviewer.displayName}</p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              !reviewer.active
                                ? 'bg-slate-100 text-slate-500'
                                : reviewer.availability === 'available'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : reviewer.availability === 'limited'
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {reviewer.active ? reviewer.availability : 'inactive'}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1" aria-label="Expertise tags">
                          {reviewer.expertiseTags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                          {reviewer.currentAssignments} / {reviewer.maxAssignments} assignments
                        </p>
                        <WorkloadBar ratio={ratio} />
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default ReviewerPoolManager;
