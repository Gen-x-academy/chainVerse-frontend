'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import {
  accessibilityService,
  contrastThreshold,
  evaluateContrast,
  isValidHexColour,
  meetsContrast,
  summariseAccessibility,
  WCAG_SEED_CRITERIA,
} from '../service';
import { JOURNEY_LABELS, SCHOLARSHIP_JOURNEYS } from '../types';
import type { A11yCheckResult, ScholarshipJourney, WcagCriterion } from '../types';
import { A11yStatusBadge } from './A11yStatusBadge';

type ScholarshipAccessibilityAuditProps = {
  programId?: string;
  canManage?: boolean;
};

type RunState = 'idle' | 'running' | 'success' | 'error';

type JourneyFilter = ScholarshipJourney | 'all';

export function ScholarshipAccessibilityAudit({
  programId = 'chainverse-scholarship',
  canManage = true,
}: ScholarshipAccessibilityAuditProps) {
  const formId = useId();
  const filterId = `${formId}-journey`;
  const foregroundId = `${formId}-foreground`;
  const backgroundId = `${formId}-background`;

  const [criteria, setCriteria] = useState<WcagCriterion[]>([]);
  const [results, setResults] = useState<A11yCheckResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [journey, setJourney] = useState<JourneyFilter>('all');
  const [runState, setRunState] = useState<RunState>('idle');
  const [runError, setRunError] = useState('');
  const [foreground, setForeground] = useState('#1f2937');
  const [background, setBackground] = useState('#ffffff');
  const [largeText, setLargeText] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [loadedCriteria, loadedResults] = await Promise.all([
        accessibilityService.listCriteria(),
        accessibilityService.listResults(),
      ]);
      setCriteria(loadedCriteria);
      setResults(loadedResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the accessibility audit.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const statusByCriterion = useMemo(() => {
    const map = new Map<string, A11yCheckResult>();
    for (const result of results) map.set(result.criterionId, result);
    return map;
  }, [results]);

  const summary = useMemo(() => summariseAccessibility(results), [results]);

  const rows = useMemo(
    () => (journey === 'all' ? criteria : criteria.filter((criterion) => criterion.journey === journey)),
    [criteria, journey]
  );

  const contrast = useMemo(() => {
    if (!isValidHexColour(foreground) || !isValidHexColour(background)) return null;
    try {
      return evaluateContrast(foreground, background);
    } catch {
      return null;
    }
  }, [background, foreground]);

  const runChecks = async () => {
    setRunState('running');
    setRunError('');
    try {
      const checkResults = await accessibilityService.runChecks({
        criteria: rows.map((criterion) => criterion.id),
        idempotencyKey: `a11y-${programId}-${rows.length}`,
      });
      setResults(checkResults);
      setRunState('success');
    } catch (err) {
      setRunError(err instanceof Error ? err.message : 'The check run failed.');
      setRunState('error');
    }
  };

  if (!canManage) {
    return (
      <div
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        role="note"
        data-testid="a11y-permission-denied"
      >
        <h2 className="text-lg font-semibold text-slate-900">Audit is read-only</h2>
        <p className="mt-2 text-sm text-slate-600">
          Your role cannot record accessibility results. Ask the accessibility owner to run checks, or
          review the current findings below.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm"
        role="status"
        aria-live="polite"
      >
        Loading WCAG criteria for {programId}...
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700" role="alert">
          {error}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-slate-300"
        >
          Retry loading the audit
        </button>
      </div>
    );
  }

  if (criteria.length === 0) {
    return (
      <div
        className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600"
        role="status"
        aria-live="polite"
      >
        No WCAG criteria are configured for this program. The seed list defines{' '}
        {WCAG_SEED_CRITERIA.length} criteria across five journeys.
      </div>
    );
  }

  return (
    <section
      className="mx-auto max-w-6xl space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      aria-labelledby={`${formId}-heading`}
    >
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Accessibility</p>
        <h2 id={`${formId}-heading`} className="mt-2 text-2xl font-black text-slate-900">
          WCAG audit by journey
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Every criterion records a status, whether a tool can decide it, and the evidence behind the
          decision. Level A and AA failures block release.
        </p>
      </header>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Summary</h3>
        <p className="mt-2 text-sm text-slate-700" role="status" aria-live="polite">
          {summary.total} criteria tracked, {summary.passing} passing, {summary.failing} failing,{' '}
          {summary.untested} untested. Automated coverage {Math.round(summary.automatedCoverage * 100)}%.
        </p>
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <p className="font-semibold">Blocking failures ({summary.blockingFailures.length})</p>
          {summary.blockingFailures.length === 0 ? (
            <p className="mt-1">None. No level A or AA criterion is currently failing.</p>
          ) : (
            <ul className="mt-1 list-disc pl-5">
              {summary.blockingFailures.map((criterionId) => (
                <li key={criterionId}>{criterionId}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div>
          <label htmlFor={filterId} className="block text-sm font-medium text-slate-700">
            Journey
          </label>
          <select
            id={filterId}
            value={journey}
            onChange={(event) => setJourney(event.target.value as JourneyFilter)}
            className="mt-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          >
            <option value="all">All journeys</option>
            {SCHOLARSHIP_JOURNEYS.map((value) => (
              <option key={value} value={value}>
                {JOURNEY_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => void runChecks()}
          disabled={runState === 'running'}
          aria-busy={runState === 'running'}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-60 motion-safe:transition"
        >
          {runState === 'running' ? 'Running checks...' : 'Run checks'}
        </button>
        {runState === 'success' && (
          <p role="status" aria-live="polite" className="text-sm text-emerald-800">
            Checks complete.
          </p>
        )}
        {runState === 'error' && (
          <p role="alert" className="text-sm text-red-700">
            {runError}
          </p>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="mb-2 text-left text-sm text-slate-600">
            WCAG success criteria tracked for {programId}, filtered by{' '}
            {journey === 'all' ? 'all journeys' : JOURNEY_LABELS[journey]}.
          </caption>
          <thead>
            <tr className="border-b border-slate-200">
              <th scope="col" className="px-3 py-2 font-semibold text-slate-900">
                Criterion
              </th>
              <th scope="col" className="px-3 py-2 font-semibold text-slate-900">
                Level
              </th>
              <th scope="col" className="px-3 py-2 font-semibold text-slate-900">
                Journey
              </th>
              <th scope="col" className="px-3 py-2 font-semibold text-slate-900">
                Check
              </th>
              <th scope="col" className="px-3 py-2 font-semibold text-slate-900">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-slate-600">
                  No criteria are mapped to this journey yet.
                </td>
              </tr>
            ) : (
              rows.map((criterion) => {
                const result = statusByCriterion.get(criterion.id);
                return (
                  <tr key={criterion.id} className="border-b border-slate-100 align-top">
                    <th scope="row" className="px-3 py-2 font-medium text-slate-900">
                      <span className="font-mono text-xs text-slate-500">{criterion.id}</span>{' '}
                      {criterion.name}
                    </th>
                    <td className="px-3 py-2 text-slate-700">{criterion.level}</td>
                    <td className="px-3 py-2 text-slate-700">{JOURNEY_LABELS[criterion.journey]}</td>
                    <td className="px-3 py-2 text-slate-700">
                      {criterion.automated ? 'Automated' : 'Manual'}
                    </td>
                    <td className="px-3 py-2">
                      <A11yStatusBadge
                        status={result?.status ?? criterion.status}
                        criterionId={criterion.id}
                      />
                      {result?.evidence ? (
                        <p className="mt-1 text-xs text-slate-500">{result.evidence}</p>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <section aria-labelledby={`${formId}-contrast-heading`} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h3 id={`${formId}-contrast-heading`} className="text-lg font-semibold text-slate-900">
          Contrast checker
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          Computes the WCAG 2.1 relative-luminance contrast ratio for a foreground and background pair.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={foregroundId} className="block text-sm font-medium text-slate-700">
              Foreground colour
            </label>
            <input
              id={foregroundId}
              type="text"
              value={foreground}
              onChange={(event) => setForeground(event.target.value)}
              aria-invalid={!isValidHexColour(foreground)}
              aria-describedby={`${foregroundId}-hint`}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
            <p id={`${foregroundId}-hint`} className="mt-1 text-xs text-slate-500">
              3- or 6-digit hex, for example #1f2937.
            </p>
          </div>
          <div>
            <label htmlFor={backgroundId} className="block text-sm font-medium text-slate-700">
              Background colour
            </label>
            <input
              id={backgroundId}
              type="text"
              value={background}
              onChange={(event) => setBackground(event.target.value)}
              aria-invalid={!isValidHexColour(background)}
              aria-describedby={`${backgroundId}-hint`}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
            <p id={`${backgroundId}-hint`} className="mt-1 text-xs text-slate-500">
              3- or 6-digit hex, for example #ffffff.
            </p>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 text-sm text-slate-700">
          <input
            id={`${formId}-large`}
            type="checkbox"
            checked={largeText}
            onChange={(event) => setLargeText(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          <label htmlFor={`${formId}-large`}>Treat the text as large (18.66px bold or 24px regular)</label>
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3 text-sm" role="status" aria-live="polite">
          {contrast === null ? (
            <p className="text-red-700">Enter two hex colours to compute a contrast ratio.</p>
          ) : (
            <>
              <p className="text-slate-900">
                Contrast ratio: <span className="font-mono font-semibold">{contrast}:1</span>
              </p>
              <ul className="mt-2 space-y-1">
                {(['AA', 'AAA'] as const).map((level) => (
                  <li key={level} className="flex items-center gap-2">
                    <A11yStatusBadge status={meetsContrast(contrast, level, largeText) ? 'pass' : 'fail'} />
                    <span className="text-slate-700">
                      {level} needs {contrastThreshold(level, largeText)}:1 for{' '}
                      {largeText ? 'large' : 'normal'} text.
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>
    </section>
  );
}

export default ScholarshipAccessibilityAudit;
