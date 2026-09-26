'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import { AlertTriangle, CheckCircle2, CircleDashed, RefreshCw } from 'lucide-react';
import { ageSecondsOf, buildStudentDashboard, isStaleCount, nextStepFor, studentDashboardService } from '../service';
import { COUNT_MAX_AGE_SECONDS, SECTION_ORDER, type StudentDashboard, type StudentJourneySection } from '../types';

const STATUS_TEXT: Record<StudentJourneySection['status'], string> = {
  loading: 'Loading',
  ready: 'Up to date',
  empty: 'Nothing here yet',
  error: 'Could not load',
};

type Props = {
  studentId?: string;
  /** Injectable dashboard; when omitted the panel loads it part by part. */
  dashboard?: StudentDashboard | null;
  loading?: boolean;
  error?: string | null;
  /** UX guard only — the API enforces the same grant. */
  allowed?: boolean;
  onRetrySection?: (sectionId: StudentJourneySection['id']) => Promise<StudentDashboard | void>;
};

function formatAge(seconds: number): string {
  if (!Number.isFinite(seconds)) return 'unknown age';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function StudentScholarshipDashboard({
  studentId = 'student-001',
  dashboard: dashboardProp,
  loading: loadingProp,
  error: errorProp,
  allowed = true,
  onRetrySection,
}: Props) {
  const uid = useId();

  const [dashboard, setDashboard] = useState<StudentDashboard | null>(dashboardProp ?? null);
  const [loading, setLoading] = useState(loadingProp ?? false);
  const [error, setError] = useState<string | null>(errorProp ?? null);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  // A caller that supplies any of these owns the state; the panel does not fetch.
  const controlled =
    dashboardProp !== undefined || loadingProp !== undefined || errorProp !== undefined;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const parts = await studentDashboardService.getParts(studentId);
      setDashboard(buildStudentDashboard(studentId, parts, new Date()));
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'The dashboard could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    if (dashboardProp !== undefined) {
      setDashboard(dashboardProp);
      return;
    }
    if (controlled) return;
    void load();
  }, [controlled, dashboardProp, load]);

  useEffect(() => {
    setNow(new Date());
  }, [dashboard]);

  if (!allowed) {
    return (
      <section aria-labelledby={`${uid}-heading`} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 id={`${uid}-heading`} className="text-2xl font-bold text-slate-900">
          Your scholarship journey
        </h2>
        <div role="note" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">You do not have permission to view this dashboard.</p>
          <p className="mt-1">
            A student dashboard shows only your own applications and awards. Next step: sign in as the student,
            or ask an administrator to restore access to your account.
          </p>
        </div>
      </section>
    );
  }

  if (loading && !dashboard) {
    return (
      <div role="status" aria-live="polite" className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
        Loading your scholarship journey…
      </div>
    );
  }

  if (error && !dashboard) {
    return (
      <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800 shadow-sm">
        <p className="font-semibold">The dashboard could not be loaded.</p>
        <p className="mt-1">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-red-200"
        >
          <RefreshCw aria-hidden="true" className="h-4 w-4" />
          Retry dashboard
        </button>
      </div>
    );
  }

  if (!dashboard || dashboard.sections.length === 0) {
    return (
      <div role="status" aria-live="polite" className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
        <p className="font-semibold text-slate-900">Nothing to show yet.</p>
        <p className="mt-1">Once you start an application the journey tiles will appear here.</p>
      </div>
    );
  }

  const allErrored = dashboard.sections.every((section) => section.status === 'error');

  async function handleRetry(sectionId: StudentJourneySection['id']) {
    setRetrying(sectionId);
    try {
      const result = await onRetrySection?.(sectionId);
      if (result) setDashboard(result);
      else await load();
    } finally {
      setRetrying(null);
    }
  }

  return (
    <section aria-labelledby={`${uid}-heading`} className="mx-auto max-w-6xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Dashboard</p>
      <h2 id={`${uid}-heading`} className="mt-2 text-3xl font-black text-slate-900">
        Your scholarship journey
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        Each tile is a count with its own timestamp, so an empty tile never hides a failed query. Generated{' '}
        {dashboard.generatedAt}.
      </p>

      {allErrored && (
        <div role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle aria-hidden="true" className="h-4 w-4" />
            No section could be loaded
          </p>
          <p className="mt-1">Every part of the dashboard failed. Retry once the scholarship service responds.</p>
        </div>
      )}

      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTION_ORDER.map((id) => {
          const section = dashboard.sections.find((entry) => entry.id === id);
          if (!section) return null;
          const age = ageSecondsOf(section.count, now);
          const stale = isStaleCount(section.count, now, COUNT_MAX_AGE_SECONDS);

          return (
            <li key={section.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-slate-900">{section.title}</h3>
              <p className="mt-2 text-3xl font-black tabular-nums text-slate-900">
                {section.status === 'error' ? '—' : section.count.value.toLocaleString()}
              </p>
              <p className="mt-1 flex items-center gap-1 text-sm text-slate-700">
                {section.status === 'error' ? (
                  <AlertTriangle aria-hidden="true" className="h-4 w-4 text-red-700" />
                ) : section.status === 'empty' ? (
                  <CircleDashed aria-hidden="true" className="h-4 w-4 text-slate-500" />
                ) : (
                  <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-emerald-700" />
                )}
                Status: {STATUS_TEXT[section.status]}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                As of {formatAge(age)} ({section.count.asOf}) — source {section.count.source}
                {stale && section.status !== 'error' ? ' — stale, may lag behind' : ''}
              </p>

              {section.status === 'error' && (
                <div role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  <p className="font-semibold">This section failed to load.</p>
                  <p className="mt-1">{section.error}</p>
                  <button
                    type="button"
                    onClick={() => void handleRetry(section.id)}
                    disabled={retrying === section.id}
                    aria-busy={retrying === section.id}
                    className="mt-2 inline-flex items-center gap-2 rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-red-200 disabled:opacity-60"
                  >
                    <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
                    {retrying === section.id ? 'Retrying…' : 'Retry this section'}
                  </button>
                </div>
              )}

              {section.status === 'empty' && section.nextStep && (
                <a
                  href={section.nextStep.href}
                  className="mt-3 inline-block rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
                >
                  {section.nextStep.label}
                </a>
              )}

              {section.status === 'ready' && section.nextStep && (
                <a
                  href={nextStepFor(section.id).href}
                  className="mt-3 inline-block text-xs font-semibold text-indigo-700 underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                >
                  {nextStepFor(section.id).label}
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default StudentScholarshipDashboard;
