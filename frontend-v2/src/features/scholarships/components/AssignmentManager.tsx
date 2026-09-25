'use client';

import { useEffect, useState } from 'react';
import {
  assignLoadBalanced,
  assignRoundRobin,
  assignSeededRandom,
  assignmentService,
  fallbackAssignments,
} from '../assignment';
import type { ApplicationAssignment, AssignmentResult, AssignmentStrategy } from '../assignment';
import { fallbackReviewerPool, filterActiveReviewers } from '../reviewer-pool';

const SCHOLARSHIP_ID = 'scholarship-standard';

const DEMO_APPLICATION_IDS = ['app-1', 'app-2', 'app-3', 'app-4', 'app-5'];

const strategyLabels: Record<AssignmentStrategy, string> = {
  manual: 'Manual',
  'round-robin': 'Round-robin',
  'load-balanced': 'Load-balanced',
  'seeded-random': 'Seeded random',
};

const strategyDescriptions: Record<AssignmentStrategy, string> = {
  manual: 'Assign a specific reviewer to each application.',
  'round-robin': 'Distribute applications evenly in order across reviewers.',
  'load-balanced': 'Always pick the reviewer with the fewest current assignments.',
  'seeded-random': 'Reproducible random assignment using a seed string.',
};

export function AssignmentManager() {
  const [assignments, setAssignments] = useState<ApplicationAssignment[]>(fallbackAssignments);
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'empty'>('loading');
  const [strategy, setStrategy] = useState<AssignmentStrategy>('round-robin');
  const [seed, setSeed] = useState('review-2026-q1');
  const [previewResults, setPreviewResults] = useState<AssignmentResult[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    assignmentService
      .list(SCHOLARSHIP_ID)
      .then((data) => {
        if (!isMounted) return;
        if (data.length === 0) {
          setStatus('empty');
          setAssignments([]);
          return;
        }
        setAssignments(data);
        setStatus('success');
      })
      .catch(() => {
        if (!isMounted) return;
        setAssignments(fallbackAssignments);
        setStatus('error');
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const activeReviewers = filterActiveReviewers(fallbackReviewerPool);

  const handlePreview = () => {
    if (activeReviewers.length === 0) {
      setError('No active reviewers are available for assignment.');
      return;
    }
    setError(null);
    let results: AssignmentResult[] = [];
    if (strategy === 'round-robin') {
      results = assignRoundRobin(DEMO_APPLICATION_IDS, activeReviewers);
    } else if (strategy === 'load-balanced') {
      results = assignLoadBalanced(DEMO_APPLICATION_IDS, activeReviewers);
    } else if (strategy === 'seeded-random') {
      results = assignSeededRandom(DEMO_APPLICATION_IDS, activeReviewers, seed);
    }
    setPreviewResults(results);
  };

  const handleSaveAll = async () => {
    if (previewResults.length === 0) return;
    setSaveStatus('saving');
    setError(null);
    try {
      const saved = await Promise.all(
        previewResults.map((result) =>
          assignmentService.assign(
            SCHOLARSHIP_ID,
            result.applicationId,
            result.reviewerId,
            strategy,
            {
              seed: strategy === 'seeded-random' ? seed : undefined,
              performedBy: 'admin',
              reason: `Bulk ${strategy} assignment`,
            }
          )
        )
      );
      setAssignments((current) => [...current, ...saved]);
      setStatus('success');
      setPreviewResults([]);
      setSaveStatus('success');
    } catch {
      setError('Some assignments could not be saved. Please try again.');
      setSaveStatus('error');
    }
  };

  return (
    <section
      className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 text-slate-900"
      aria-labelledby="assignment-manager-title"
    >
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">
          Review management
        </p>
        <h2
          id="assignment-manager-title"
          className="text-3xl font-bold tracking-tight md:text-4xl"
        >
          Application assignment
        </h2>
        <p className="max-w-2xl text-sm text-slate-600 md:text-base">
          Assign applications reproducibly via round-robin, load-balanced, or seeded-random
          strategy. Every reassignment is audited with a reason and performer.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold">Assignment strategy</h3>
            <div
              className="mt-4 grid gap-3 sm:grid-cols-2"
              role="radiogroup"
              aria-label="Choose assignment strategy"
            >
              {(
                Object.entries(strategyLabels) as [AssignmentStrategy, string][]
              )
                .filter(([s]) => s !== 'manual')
                .map(([value, label]) => (
                  <label
                    key={value}
                    className="flex cursor-pointer gap-3 rounded-xl border border-slate-200 p-3 transition has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50"
                  >
                    <input
                      type="radio"
                      name="strategy"
                      value={value}
                      checked={strategy === value}
                      onChange={() => {
                        setStrategy(value);
                        setPreviewResults([]);
                        setSaveStatus('idle');
                        setError(null);
                      }}
                      className="mt-1 h-4 w-4 border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>
                      <span className="block font-medium text-slate-900">{label}</span>
                      <span className="block text-sm text-slate-600">
                        {strategyDescriptions[value]}
                      </span>
                    </span>
                  </label>
                ))}
            </div>

            {strategy === 'seeded-random' && (
              <label className="mt-4 block space-y-1 text-sm font-medium text-slate-700">
                Seed string
                <input
                  type="text"
                  value={seed}
                  onChange={(e) => {
                    setSeed(e.target.value);
                    setPreviewResults([]);
                  }}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  aria-describedby="seed-help"
                  placeholder="e.g. review-2026-q1"
                />
                <span id="seed-help" className="block text-xs font-normal text-slate-500">
                  The same seed always produces the same assignment order. Store it with the review
                  batch for reproducibility.
                </span>
              </label>
            )}

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handlePreview}
                className="rounded-full bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-600 focus:ring-offset-2"
              >
                Preview assignments
              </button>
              {previewResults.length > 0 && (
                <button
                  type="button"
                  onClick={() => void handleSaveAll()}
                  disabled={saveStatus === 'saving'}
                  className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {saveStatus === 'saving' ? 'Saving…' : 'Save all assignments'}
                </button>
              )}
            </div>

            <div className="mt-3" aria-live="polite">
              {saveStatus === 'success' && (
                <p role="status" className="text-sm text-emerald-700">
                  All assignments saved and audited.
                </p>
              )}
              {error && (
                <p role="alert" className="text-sm text-red-700">
                  {error}
                </p>
              )}
            </div>
          </div>

          {previewResults.length > 0 && (
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-5">
              <h3 className="font-semibold text-indigo-900">
                Preview ({strategyLabels[strategy]})
              </h3>
              <ul className="mt-3 space-y-2" aria-label="Assignment preview">
                {previewResults.map((result) => (
                  <li
                    key={result.applicationId}
                    className="flex items-center justify-between rounded-xl border border-indigo-200 bg-white px-4 py-2 text-sm"
                  >
                    <span className="font-mono text-slate-700">{result.applicationId}</span>
                    <span className="font-medium text-indigo-700">→ {result.reviewerName}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold">Active assignments</h3>

            {status === 'loading' && (
              <p role="status" aria-live="polite" className="mt-4 text-sm text-slate-600">
                Loading assignments…
              </p>
            )}
            {status === 'error' && (
              <p role="alert" className="mt-4 text-sm text-amber-800">
                Using cached assignments — service is temporarily unavailable.
              </p>
            )}
            {status === 'empty' && assignments.length === 0 && (
              <p
                role="status"
                className="mt-4 rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-600"
              >
                No assignments yet. Use the strategy selector above to create the first batch.
              </p>
            )}

            {assignments.length > 0 && (
              <ul className="mt-4 space-y-3" aria-label="Active assignment list">
                {assignments.map((assignment) => (
                  <li
                    key={assignment.id}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-slate-900">{assignment.applicationId}</p>
                        <p className="text-sm text-slate-600">→ {assignment.reviewerName}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                          {strategyLabels[assignment.strategy]}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            assignment.status === 'active'
                              ? 'bg-emerald-100 text-emerald-700'
                              : assignment.status === 'reassigned'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {assignment.status}
                        </span>
                      </div>
                    </div>
                    {assignment.auditLog.length > 0 && (
                      <details className="mt-3">
                        <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                          Audit log ({assignment.auditLog.length} entr
                          {assignment.auditLog.length === 1 ? 'y' : 'ies'})
                        </summary>
                        <ul className="mt-2 space-y-1">
                          {assignment.auditLog.map((entry, i) => (
                            <li key={i} className="text-xs text-slate-600">
                              <span className="font-medium capitalize">{entry.action}</span> by{' '}
                              {entry.performedBy}: {entry.reason}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <aside className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-900 p-5 text-white shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
              Active reviewers
            </p>
            <p className="mt-2 text-3xl font-bold">{activeReviewers.length}</p>
            <p className="mt-1 text-sm text-slate-400">available for assignment</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold">Strategy guide</h3>
            <dl className="mt-3 space-y-3 text-sm">
              <div>
                <dt className="font-medium text-slate-900">Round-robin</dt>
                <dd className="text-slate-600">
                  Predictable, equal distribution. Best for uniform application sets.
                </dd>
              </div>
              <div>
                <dt className="font-medium text-slate-900">Load-balanced</dt>
                <dd className="text-slate-600">
                  Fills the reviewer with the most remaining capacity first.
                </dd>
              </div>
              <div>
                <dt className="font-medium text-slate-900">Seeded random</dt>
                <dd className="text-slate-600">
                  Reproducible shuffle — the same seed always gives the same result.
                </dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </section>
  );
}

export default AssignmentManager;
