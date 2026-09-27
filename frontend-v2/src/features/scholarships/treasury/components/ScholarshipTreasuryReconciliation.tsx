'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, History, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react';
import { canOperateTreasury, evaluateAwardGate, treasuryService } from '../service';
import type { Discrepancy, ReconciliationRun, TreasuryAccount, TreasuryPosition, Liability } from '../types';

type Props = {
  role?: string;
  programId?: string;
  /** Pre-loaded fixtures; when omitted the component fetches from the API. */
  initialAccounts?: TreasuryAccount[];
  initialLiabilities?: Liability[];
  initialRuns?: ReconciliationRun[];
};

type LoadState = 'loading' | 'ready' | 'error';

const STATE_TEXT: Record<
  ReconciliationRun['status'],
  { label: string; icon: 'ok' | 'drift' | 'insolvent' | 'running'; tone: string }
> = {
  balanced: {
    label: 'Balanced',
    icon: 'ok',
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  },
  drifted: {
    label: 'Drifted',
    icon: 'drift',
    tone: 'border-amber-300 bg-amber-50 text-amber-800',
  },
  insolvent: {
    label: 'Insolvent',
    icon: 'insolvent',
    tone: 'border-red-300 bg-red-50 text-red-800',
  },
  running: {
    label: 'Running',
    icon: 'running',
    tone: 'border-slate-300 bg-slate-50 text-slate-700',
  },
};

function formatMinorUnits(cents: number, currency: string): string {
  if (!currency) return `${(cents / 100).toFixed(2)} (no currency)`;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
  } catch {
    return `${currency} ${(cents / 100).toFixed(2)}`;
  }
}

function StatusIcon({ icon }: { icon: 'ok' | 'drift' | 'insolvent' | 'running' }) {
  const className = 'h-5 w-5 shrink-0';
  if (icon === 'ok') return <CheckCircle2 className={className} aria-hidden="true" />;
  if (icon === 'drift') return <AlertTriangle className={className} aria-hidden="true" />;
  if (icon === 'insolvent') return <ShieldAlert className={className} aria-hidden="true" />;
  return <RefreshCw className={`${className} motion-safe:animate-spin`} aria-hidden="true" />;
}

export function ScholarshipTreasuryReconciliation({
  role = 'finance',
  programId,
  initialAccounts,
  initialLiabilities,
  initialRuns,
}: Props) {
  const headingId = useId();
  const runsHeadingId = `${headingId}-runs`;
  const discrepanciesHeadingId = `${headingId}-discrepancies`;

  const permitted = canOperateTreasury(role);

  const [loadState, setLoadState] = useState<LoadState>(initialAccounts ? 'ready' : 'loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<TreasuryAccount[]>(initialAccounts ?? []);
  const [liabilities, setLiabilities] = useState<Liability[]>(initialLiabilities ?? []);
  const [runs, setRuns] = useState<ReconciliationRun[]>(initialRuns ?? []);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadState('loading');
    setLoadError(null);
    try {
      const [nextAccounts, nextLiabilities, nextRuns] = await Promise.all([
        treasuryService.listAccounts(programId),
        treasuryService.listLiabilities(programId),
        treasuryService.listRuns(programId),
      ]);
      setAccounts(nextAccounts);
      setLiabilities(nextLiabilities);
      setRuns(nextRuns);
      setLoadState('ready');
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to load the treasury position.');
      setLoadState('error');
    }
  }, [programId]);

  useEffect(() => {
    if (initialAccounts) return;
    void load();
  }, [initialAccounts, load]);

  const latestRun = runs.length > 0 ? runs[0] : null;

  const position: TreasuryPosition | null = useMemo(() => {
    if (accounts.length === 0) return null;
    const availableCents = accounts.reduce((total, a) => total + a.availableCents, 0);
    const reservedCents = accounts.reduce((total, a) => total + a.reservedCents, 0);
    const payableCents = accounts.reduce((total, a) => total + a.payableCents, 0);
    return {
      availableCents,
      reservedCents,
      payableCents,
      netCents: availableCents - payableCents,
      currency: accounts[0].currency,
      accounts,
    };
  }, [accounts]);

  const gate = useMemo(() => (latestRun ? evaluateAwardGate(latestRun) : null), [latestRun]);

  const handleRun = async () => {
    if (!permitted) return;
    setBusy(true);
    setActionError(null);
    setNotice(null);
    try {
      const asOf = new Date().toISOString();
      const run = await treasuryService.runReconciliation({
        asOf,
        previousRunId: latestRun?.id,
        idempotencyKey: `treasury-recon-${asOf}-${programId ?? 'all'}`,
      });
      setRuns((current) => [run, ...current]);
      setNotice(
        `Reconciliation run ${run.id} recorded as ${run.status}. Earlier runs are unchanged — reconciliation appends a snapshot, it never rewrites history.`
      );
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to run reconciliation.');
    } finally {
      setBusy(false);
    }
  };

  const handleAcknowledge = async (discrepancy: Discrepancy) => {
    if (!latestRun || !permitted) return;
    setBusy(true);
    setActionError(null);
    setNotice(null);
    try {
      const acknowledged = await treasuryService.acknowledge(latestRun.id, {
        discrepancyId: discrepancy.id,
        by: role,
      });
      setRuns((current) => [acknowledged, ...current]);
      setNotice(
        `Acknowledgement recorded for ${discrepancy.id} as a new run. The original run and its discrepancies remain on record.`
      );
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to record the acknowledgement.');
    } finally {
      setBusy(false);
    }
  };

  if (loadState === 'loading') {
    return (
      <div
        className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm"
        role="status"
        aria-live="polite"
      >
        Loading treasury accounts, liabilities, and reconciliation history…
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <div
        className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800 shadow-sm"
        role="alert"
      >
        <p className="font-semibold">Treasury data could not be loaded.</p>
        <p className="mt-2">{loadError}</p>
        <p className="mt-2">Next step: retry the request, or continue once the treasury API is reachable.</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-300"
        >
          Retry loading treasury
        </button>
      </div>
    );
  }

  return (
    <section
      className="mx-auto max-w-5xl space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      aria-labelledby={headingId}
    >
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Treasury</p>
          <h2 id={headingId} className="mt-2 text-2xl font-black text-slate-900">
            Treasury reconciliation
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Balances and liabilities in integer minor units, single currency per position.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleRun()}
          disabled={!permitted || busy}
          aria-busy={busy}
          className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? 'Recording run…' : 'Run reconciliation'}
        </button>
      </header>

      {!permitted && (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
          role="note"
          aria-label="Treasury permission notice"
        >
          <p className="font-semibold">Treasury actions are not available for your role.</p>
          <p className="mt-1">
            Next step: ask a finance, sponsor, or administrator to run reconciliation or acknowledge a
            discrepancy. You can still read the position below.
          </p>
        </div>
      )}

      {position === null ? (
        <div
          className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600"
          role="status"
          aria-live="polite"
        >
          No treasury accounts are configured. Next step: record a program pool or unrestricted pool
          account before reconciling.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {(
            [
              ['Available', position.availableCents],
              ['Reserved', position.reservedCents],
              ['Payable', position.payableCents],
              ['Net', position.netCents],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {formatMinorUnits(value, position.currency)}
              </p>
            </div>
          ))}
        </div>
      )}

      <div
        className={`rounded-xl border p-4 text-sm ${latestRun ? STATE_TEXT[latestRun.status].tone : 'border-slate-300 bg-slate-50 text-slate-700'}`}
        role="status"
        aria-live="polite"
      >
        {latestRun ? (
          <div className="flex items-start gap-3">
            <StatusIcon icon={STATE_TEXT[latestRun.status].icon} />
            <div>
              <p className="font-semibold uppercase tracking-wide">
                {STATE_TEXT[latestRun.status].label} — {latestRun.status}
              </p>
              <p className="mt-1">
                Run {latestRun.id} as of {latestRun.asOf}. Variance{' '}
                {formatMinorUnits(latestRun.varianceCents, latestRun.position.currency)}.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <StatusIcon icon="running" />
            <div>
              <p className="font-semibold uppercase tracking-wide">No run yet</p>
              <p className="mt-1">
                No reconciliation run has been recorded. Next step: select “Run reconciliation” to
                append the first snapshot.
              </p>
            </div>
          </div>
        )}
      </div>

      {gate && (
        <div
          className={`rounded-xl border p-4 text-sm ${gate.allowed ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}
          role="note"
          aria-label="Award gate"
        >
          <div className="flex items-start gap-3">
            {gate.allowed ? (
              <ShieldCheck className="h-5 w-5 shrink-0" aria-hidden="true" />
            ) : (
              <ShieldAlert className="h-5 w-5 shrink-0" aria-hidden="true" />
            )}
            <div>
              <p className="font-semibold uppercase tracking-wide">
                {gate.allowed ? 'Awards allowed' : 'New awards blocked'}
              </p>
              <p className="mt-1">{gate.reason}</p>
              {gate.blockingDiscrepancyIds.length > 0 && (
                <p className="mt-1 text-xs">
                  Blocking discrepancies: {gate.blockingDiscrepancyIds.join(', ')}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {actionError && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {actionError}
        </div>
      )}

      {notice && (
        <div role="status" aria-live="polite" className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          {notice}
        </div>
      )}

      <section aria-labelledby={discrepanciesHeadingId} className="space-y-3">
        <h3 id={discrepanciesHeadingId} className="text-lg font-semibold text-slate-900">
          Discrepancies
        </h3>
        {!latestRun || latestRun.discrepancies.length === 0 ? (
          <p
            className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600"
            role="status"
            aria-live="polite"
          >
            No discrepancies were detected in the latest run.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <caption className="sr-only">
                Discrepancies from run {latestRun.id} with expected, actual, and variance amounts
              </caption>
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-3">Id</th>
                  <th scope="col" className="px-4 py-3">Kind</th>
                  <th scope="col" className="px-4 py-3">Description</th>
                  <th scope="col" className="px-4 py-3">Expected</th>
                  <th scope="col" className="px-4 py-3">Actual</th>
                  <th scope="col" className="px-4 py-3">Variance</th>
                  <th scope="col" className="px-4 py-3">Acknowledged</th>
                  <th scope="col" className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {latestRun.discrepancies.map((discrepancy) => (
                  <tr key={discrepancy.id}>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{discrepancy.id}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{discrepancy.kind}</td>
                    <td className="px-4 py-3 text-slate-600">{discrepancy.description}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatMinorUnits(discrepancy.expectedCents, discrepancy.currency)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatMinorUnits(discrepancy.actualCents, discrepancy.currency)}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {formatMinorUnits(discrepancy.varianceCents, discrepancy.currency)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {discrepancy.acknowledgedAt
                        ? `Yes — ${discrepancy.acknowledgedBy} at ${discrepancy.acknowledgedAt}`
                        : 'No'}
                    </td>
                    <td className="px-4 py-3">
                      {discrepancy.acknowledgedAt ? (
                        <span className="text-slate-500">—</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleAcknowledge(discrepancy)}
                          disabled={!permitted || busy}
                          aria-busy={busy}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Acknowledge
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!permitted && (
          <p className="text-xs text-slate-500">
            Acknowledgement controls are disabled: your role cannot record treasury approvals.
          </p>
        )}
      </section>

      <section aria-labelledby={runsHeadingId} className="space-y-3">
        <h3 id={runsHeadingId} className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <History className="h-5 w-5 text-slate-500" aria-hidden="true" />
          Run history
        </h3>
        <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          Reconciliation is repeatable and read-only. Each run is an immutable snapshot: balances and
          liabilities are never edited, and a correction is always recorded as a new run, never as a
          rewrite of an older one — reconciliation never rewrites history.
        </p>
        {runs.length === 0 ? (
          <p
            className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600"
            role="status"
            aria-live="polite"
          >
            No reconciliation runs recorded yet.
          </p>
        ) : (
          <ol className="space-y-2">
            {runs.map((run) => (
              <li
                key={run.id}
                className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-white p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-slate-900">{run.id}</p>
                  <p className="text-xs text-slate-500">
                    As of {run.asOf} · status {run.status} · variance{' '}
                    {formatMinorUnits(run.varianceCents, run.position.currency)} · {run.discrepancies.length}{' '}
                    discrepanc{run.discrepancies.length === 1 ? 'y' : 'ies'}
                  </p>
                </div>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  {STATE_TEXT[run.status].label}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </section>
  );
}

export default ScholarshipTreasuryReconciliation;
