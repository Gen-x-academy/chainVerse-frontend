'use client';

import { useEffect, useId, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, XCircle } from 'lucide-react';
import {
  assertSponsorScope,
  assessFreshness,
  budgetSummary,
  funnelStages,
  reconciles,
  reviewProgress,
  sponsorDashboardService,
} from '../service';
import {
  FRESHNESS_MAX_AGE_SECONDS,
  type LedgerTotals,
  type ProgramBudgetSummary,
  type SponsorApplication,
  type SponsorDashboard,
  type SponsorScope,
  type ReviewAssignment,
} from '../types';

function formatMinorUnits(amountCents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amountCents / 100);
}

function formatAge(seconds: number): string {
  if (!Number.isFinite(seconds)) return 'unknown age';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

export type SponsorDashboardData = {
  scope: SponsorScope;
  programName: string;
  budgetCents: number;
  committedCents: number;
  disbursedCents: number;
  currency: string;
  applications: SponsorApplication[];
  reviews: ReviewAssignment[];
  ledgerTotals: LedgerTotals;
  impact: SponsorDashboard['impact'];
  computedAt: string;
};

type Props = {
  sponsorId?: string;
  programId?: string;
  /** Injectable data; when omitted the panel loads it from the dashboard API. */
  data?: SponsorDashboardData | null;
  loading?: boolean;
  error?: string | null;
  /** UX guard only — the API enforces the same grant. */
  allowed?: boolean;
};

export function SponsorProgramDashboard({
  sponsorId = 'sponsor-acme',
  programId = 'chainverse-scholarship',
  data: dataProp,
  loading: loadingProp,
  error: errorProp,
  allowed = true,
}: Props) {
  const uid = useId();
  const [data, setData] = useState<SponsorDashboardData | null>(dataProp ?? null);
  const [loading, setLoading] = useState(loadingProp ?? false);
  const [error, setError] = useState<string | null>(errorProp ?? null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    setData(dataProp);
  }, [dataProp]);

  useEffect(() => {
    if (dataProp !== undefined) return;
    let cancelled = false;
    setLoading(true);
    sponsorDashboardService
      .get(sponsorId, { sponsorId, programIds: [programId] })
      .then((dashboard) => {
        if (cancelled) return;
        const summary = dashboard.budget[0];
        setData({
          scope: dashboard.scope,
          programName: summary?.programName ?? programId,
          budgetCents: summary?.budgetCents ?? 0,
          committedCents: summary?.committedCents ?? 0,
          disbursedCents: summary?.disbursedCents ?? 0,
          currency: summary?.currency ?? 'USD',
          applications: [],
          reviews: [],
          ledgerTotals: {
            programId,
            committedCents: summary?.committedCents ?? 0,
            disbursedCents: summary?.disbursedCents ?? 0,
            currency: summary?.currency ?? 'USD',
          },
          impact: dashboard.impact,
          computedAt: dashboard.freshness.computedAt,
        });
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'The dashboard could not be loaded.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dataProp, programId, sponsorId]);

  if (!allowed) {
    return (
      <section aria-labelledby={`${uid}-heading`} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 id={`${uid}-heading`} className="text-2xl font-bold text-slate-900">
          Sponsor program dashboard
        </h2>
        <div role="note" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">You do not have permission to view this sponsor dashboard.</p>
          <p className="mt-1">
            Sponsor dashboards are limited to the owning sponsor, plus finance and administrators. Next step:
            ask finance to confirm your sponsor account, then reload this page.
          </p>
        </div>
      </section>
    );
  }

  if (loading && !data) {
    return (
      <div role="status" aria-live="polite" className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
        Loading sponsor program dashboard…
      </div>
    );
  }

  if (error && !data) {
    return (
      <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800 shadow-sm">
        <p className="font-semibold">The sponsor dashboard could not be loaded.</p>
        <p className="mt-1">{error}</p>
        <p className="mt-2">Next step: retry, or ask finance to confirm the sponsor's program scope.</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div role="status" aria-live="polite" className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
        <p className="font-semibold text-slate-900">No program data for this sponsor.</p>
        <p className="mt-1">
          This sponsor has no funded program in scope yet. Next step: create or fund a program before reporting on it.
        </p>
      </div>
    );
  }

  const refusal = assertSponsorScope(data.scope, programId);
  if (refusal.refused) {
    return (
      <section aria-labelledby={`${uid}-heading`} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 id={`${uid}-heading`} className="text-2xl font-bold text-slate-900">
          Sponsor program dashboard
        </h2>
        <div role="note" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Program out of scope.</p>
          <p className="mt-1">{refusal.reason}</p>
        </div>
      </section>
    );
  }

  const summary: ProgramBudgetSummary = budgetSummary({
    programId,
    programName: data.programName,
    budgetCents: data.budgetCents,
    committedCents: data.committedCents,
    disbursedCents: data.disbursedCents,
    currency: data.currency,
  });
  const funnel = funnelStages(data.applications, programId);
  const review = reviewProgress(data.reviews, programId, now);
  const freshness = assessFreshness(data.computedAt, now, FRESHNESS_MAX_AGE_SECONDS);
  const ledgerMatches = reconciles(summary, data.ledgerTotals);
  const hasActivity =
    data.applications.length > 0 || data.reviews.length > 0 || summary.committedCents > 0;

  return (
    <section aria-labelledby={`${uid}-heading`} className="mx-auto max-w-6xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Sponsor reporting</p>
          <h2 id={`${uid}-heading`} className="mt-2 text-3xl font-black text-slate-900">
            {data.programName}
          </h2>
        </div>
        <span
          className={`inline-flex items-center gap-1 self-start rounded-full px-3 py-1 text-xs font-semibold ${
            freshness.stale ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
          }`}
        >
          <Clock aria-hidden="true" className="h-3.5 w-3.5" />
          {freshness.stale ? `Data is stale — computed ${formatAge(freshness.ageSeconds)}` : `Fresh — computed ${formatAge(freshness.ageSeconds)}`}
        </span>
      </div>

      {freshness.stale && (
        <div role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle aria-hidden="true" className="h-4 w-4" />
            Data is stale
          </p>
          <p className="mt-1">
            These figures were computed {formatAge(freshness.ageSeconds)} ago, beyond the{' '}
            {FRESHNESS_MAX_AGE_SECONDS} second freshness window. Do not use them for a funding decision until the
            dashboard refreshes.
          </p>
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Budget</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">
            {formatMinorUnits(summary.budgetCents, summary.currency)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Committed</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">
            {formatMinorUnits(summary.committedCents, summary.currency)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Disbursed</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">
            {formatMinorUnits(summary.disbursedCents, summary.currency)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Remaining</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">
            {formatMinorUnits(summary.remainingCents, summary.currency)}
          </p>
          {summary.overspent && (
            <p className="mt-1 text-xs font-semibold text-red-700">
              Over budget by {formatMinorUnits(summary.committedCents - summary.budgetCents, summary.currency)}
            </p>
          )}
        </div>
      </div>

      <p className="mt-3 flex items-center gap-2 text-sm font-medium text-slate-700">
        {ledgerMatches ? (
          <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-emerald-700" />
        ) : (
          <XCircle aria-hidden="true" className="h-4 w-4 text-red-700" />
        )}
        {ledgerMatches
          ? 'These totals reconcile with the ledger.'
          : 'These totals do not reconcile with the ledger — do not report them until the discrepancy is resolved.'}
      </p>

      {hasActivity ? (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Application funnel</h3>
            <table className="mt-3 w-full border-collapse text-left text-sm">
              <caption className="pb-2 text-left text-sm text-slate-600">
                Cumulative counts per funnel stage, in stage order
              </caption>
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th scope="col" className="py-2 pr-3">Stage</th>
                  <th scope="col" className="py-2">Applications</th>
                </tr>
              </thead>
              <tbody>
                {funnel.stages.map((stage) => (
                  <tr key={stage.label} className="border-b border-slate-100">
                    <th scope="row" className="py-2 pr-3 font-medium text-slate-700">{stage.label}</th>
                    <td className="py-2 tabular-nums text-slate-700">{stage.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-900">Review progress</h3>
            <dl className="mt-3 grid grid-cols-2 gap-3">
              {[
                ['Assigned', review.assigned],
                ['In progress', review.inProgress],
                ['Completed', review.completed],
                ['Overdue', review.overdue],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</dt>
                  <dd className="mt-1 text-xl font-bold tabular-nums text-slate-900">{Number(value)}</dd>
                </div>
              ))}
            </dl>
            {review.overdue > 0 && (
              <p className="mt-2 text-sm font-medium text-red-700">
                {review.overdue} review(s) are past their due date.
              </p>
            )}
          </div>
        </div>
      ) : (
        <div role="status" aria-live="polite" className="mt-8 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
          <p className="font-semibold text-slate-900">No activity in this program yet.</p>
          <p className="mt-1">
            No applications or reviews have been recorded. Next step: open the round and invite applicants so the
            funnel and impact indicators have something to report.
          </p>
        </div>
      )}

      {data.impact.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-slate-900">Impact indicators</h3>
          <ul className="mt-3 space-y-2">
            {data.impact.map((indicator) => (
              <li key={indicator.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-700">{indicator.label}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                  {indicator.value}
                  {indicator.unit ? ` ${indicator.unit}` : ''}
                  {indicator.direction ? ` (${indicator.direction})` : ''}
                </p>
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-semibold text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-200">
                    How is this defined?
                  </summary>
                  <p className="mt-2 text-sm text-slate-600">{indicator.definition}</p>
                </details>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export default SponsorProgramDashboard;
