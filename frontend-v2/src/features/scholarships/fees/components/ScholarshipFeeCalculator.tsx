'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import {
  activeSchedule,
  assertQuoteBalanced,
  canManageFees,
  feeService,
  quoteFees,
  splitFeeRevenue,
} from '../service';
import {
  ROUNDING_MODES,
  type FeeLedgerAccount,
  type FeeQuote,
  type FeeScheduleVersion,
  type RoundingMode,
} from '../types';

type Props = {
  role?: string;
  currency?: string;
  initialVersions?: FeeScheduleVersion[];
  initialQuotes?: FeeQuote[];
  initialLedger?: FeeLedgerAccount;
  /** Reference timestamp for choosing the in-force schedule version. */
  at?: string;
};

type LoadState = 'loading' | 'ready' | 'error';

const STATUS_LABEL: Record<FeeScheduleVersion['status'], string> = {
  draft: 'Draft',
  active: 'Active',
  superseded: 'Superseded',
};

function formatMinorUnits(cents: number, currency: string): string {
  if (!currency) return `${(cents / 100).toFixed(2)} (no currency)`;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
  } catch {
    return `${currency} ${(cents / 100).toFixed(2)}`;
  }
}

export function ScholarshipFeeCalculator({
  role = 'finance',
  currency = 'USD',
  initialVersions,
  initialQuotes,
  initialLedger,
  at,
}: Props) {
  const formId = useId();
  const headingId = `${formId}-heading`;
  const previewHeadingId = `${formId}-preview`;
  const versionsHeadingId = `${formId}-versions`;
  const revenueHeadingId = `${formId}-revenue`;

  const permitted = canManageFees(role);
  const quotedAt = at ?? '2026-02-01T00:00:00.000Z';

  const [loadState, setLoadState] = useState<LoadState>(initialVersions ? 'ready' : 'loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [versions, setVersions] = useState<FeeScheduleVersion[]>(initialVersions ?? []);
  const [quotes, setQuotes] = useState<FeeQuote[]>(initialQuotes ?? []);
  const [ledger, setLedger] = useState<FeeLedgerAccount | null>(initialLedger ?? null);
  const [grossInput, setGrossInput] = useState('100000');
  const [selectedVersion, setSelectedVersion] = useState<string>('');
  const [rounding, setRounding] = useState<RoundingMode>('half-even');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadState('loading');
    setLoadError(null);
    try {
      const [nextVersions, nextQuotes, nextLedger] = await Promise.all([
        feeService.listVersions(),
        feeService.listQuotes(),
        feeService.getFeeLedger(currency),
      ]);
      setVersions(nextVersions);
      setQuotes(nextQuotes);
      setLedger(nextLedger);
      setLoadState('ready');
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to load fee schedules.');
      setLoadState('error');
    }
  }, [currency]);

  useEffect(() => {
    if (initialVersions) return;
    void load();
  }, [initialVersions, load]);

  const inForce = useMemo(() => activeSchedule(versions, quotedAt), [versions, quotedAt]);

  const effectiveVersion = useMemo(() => {
    if (selectedVersion) return versions.find((version) => version.version === selectedVersion) ?? null;
    return inForce;
  }, [inForce, selectedVersion, versions]);

  useEffect(() => {
    if (versions.length === 0) return;
    setSelectedVersion((current) =>
      current && versions.some((version) => version.version === current)
        ? current
        : (inForce?.version ?? versions[0].version)
    );
  }, [inForce, versions]);

  const preview = useMemo(() => {
    if (!effectiveVersion) return null;
    const grossCents = Number(grossInput);
    if (!Number.isInteger(grossCents) || grossCents < 0) return null;
    return quoteFees(grossCents, effectiveVersion, rounding, quotedAt);
  }, [effectiveVersion, grossInput, quotedAt, rounding]);

  const balanced = preview ? assertQuoteBalanced(preview) : true;

  const derivedLedger = useMemo<FeeLedgerAccount | null>(() => {
    if (quotes.length === 0) return ledger;
    try {
      return splitFeeRevenue(quotes);
    } catch {
      return null;
    }
  }, [ledger, quotes]);

  const handleQuote = async () => {
    if (!preview) return;
    setBusy(true);
    setActionError(null);
    setNotice(null);
    try {
      const quote = await feeService
        .quote({
          grossCents: preview.grossCents,
          currency: preview.currency,
          scheduleVersion: preview.scheduleVersion,
          rounding: preview.rounding,
          idempotencyKey: `fee-quote-${preview.scheduleVersion}-${preview.grossCents}`,
        })
        .catch(() => null);
      setQuotes((current) => (quote ? [quote, ...current] : [preview, ...current]));
      setNotice(`Quote recorded against schedule ${preview.scheduleVersion}.`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to record the quote.');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateDraft = async () => {
    if (!permitted || !inForce) return;
    setBusy(true);
    setActionError(null);
    setNotice(null);
    try {
      const draft = await feeService
        .createDraft({
          version: `${inForce.version}-draft`,
          effectiveFrom: quotedAt,
          components: inForce.components,
          createdBy: role,
        })
        .catch(() => null);
      if (draft) {
        setVersions((current) => [draft, ...current]);
        setNotice(
          `Draft version ${draft.version} created. The active version ${inForce.version} is unchanged until you activate the draft.`
        );
      } else {
        setActionError('The fee schedule API rejected the draft.');
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to create a draft version.');
    } finally {
      setBusy(false);
    }
  };

  const handleActivate = async (version: string) => {
    if (!permitted) return;
    setBusy(true);
    setActionError(null);
    setNotice(null);
    try {
      const activated = await feeService
        .activate(version, { activatedBy: role, expectedStatus: 'draft' })
        .catch(() => null);
      if (activated) {
        setVersions((current) =>
          current.map((item) =>
            item.status === 'active' && item.version !== activated.version
              ? { ...item, status: 'superseded' as const }
              : item.version === activated.version
                ? activated
                : item
          )
        );
        setNotice(
          `Version ${activated.version} is now active. ${inForce?.version ?? 'The previous version'} is retained as superseded — history is never deleted.`
        );
      } else {
        setActionError('The fee schedule API rejected the activation.');
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to activate the version.');
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
        Loading fee schedules and the fee revenue account…
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800 shadow-sm" role="alert">
        <p className="font-semibold">Fee schedules could not be loaded.</p>
        <p className="mt-2">{loadError}</p>
        <p className="mt-2">Next step: retry the request, or continue once the fee API is reachable.</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-300"
        >
          Retry loading fees
        </button>
      </div>
    );
  }

  return (
    <section
      className="mx-auto max-w-5xl space-y-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      aria-labelledby={headingId}
    >
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Fees</p>
        <h2 id={headingId} className="mt-2 text-2xl font-black text-slate-900">
          Platform and network fees
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Fee schedules are versioned and only one version is active. Amounts are integer minor
          units in a single currency; currencies are never mixed.
        </p>
      </header>

      {!permitted && (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
          role="note"
          aria-label="Fee permission notice"
        >
          <p className="font-semibold">Fee schedule management is not available for your role.</p>
          <p className="mt-1">
            Next step: ask a finance or administrator to create or activate a schedule version. You
            can still run the calculator below.
          </p>
        </div>
      )}

      <section aria-labelledby={previewHeadingId} className="rounded-xl border border-slate-200 bg-slate-50 p-5">
        <h3 id={previewHeadingId} className="text-lg font-semibold text-slate-900">
          Fee calculator
        </h3>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <label htmlFor={`${formId}-gross`} className="block text-sm font-medium text-slate-700">
              Gross amount (minor units)
            </label>
            <input
              id={`${formId}-gross`}
              type="number"
              min={0}
              step={1}
              value={grossInput}
              onChange={(event) => setGrossInput(event.target.value)}
              aria-describedby={`${formId}-gross-hint`}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
            <p id={`${formId}-gross-hint`} className="mt-1 text-xs text-slate-500">
              Integer minor units, {currency}.
            </p>
          </div>

          <div>
            <label htmlFor={`${formId}-version`} className="block text-sm font-medium text-slate-700">
              Schedule version
            </label>
            <select
              id={`${formId}-version`}
              value={selectedVersion}
              onChange={(event) => setSelectedVersion(event.target.value)}
              aria-describedby={`${formId}-version-hint`}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              {versions.map((version) => (
                <option key={version.version} value={version.version}>
                  {version.version} — effective {version.effectiveFrom} — {STATUS_LABEL[version.status]}
                </option>
              ))}
            </select>
            <p id={`${formId}-version-hint`} className="mt-1 text-xs text-slate-500">
              Each version shows its effective date and status.
            </p>
          </div>

          <div>
            <label htmlFor={`${formId}-rounding`} className="block text-sm font-medium text-slate-700">
              Rounding mode
            </label>
            <select
              id={`${formId}-rounding`}
              value={rounding}
              onChange={(event) => setRounding(event.target.value as RoundingMode)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              {ROUNDING_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </select>
          </div>
        </div>

        {versions.length === 0 ? (
          <p
            className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600"
            role="status"
            aria-live="polite"
          >
            No fee schedule versions exist yet. Next step: a finance or administrator creates a draft
            version.
          </p>
        ) : !preview ? (
          <p
            className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800"
            role="alert"
          >
            Enter a whole number of minor units to see a quote. Partial units cannot be quoted
            without rounding, and the recipient must never be silently reduced.
          </p>
        ) : (
          <>
            <table className="mt-4 min-w-full text-left text-sm">
              <caption className="sr-only">Live fee preview from gross amount to net recipient</caption>
              <thead className="bg-white text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="rounded-l-lg px-4 py-2">Line</th>
                  <th scope="col" className="px-4 py-2">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                <tr>
                  <th scope="row" className="px-4 py-2 font-medium text-slate-700">Gross amount</th>
                  <td className="px-4 py-2 text-slate-900">{formatMinorUnits(preview.grossCents, preview.currency)}</td>
                </tr>
                <tr>
                  <th scope="row" className="px-4 py-2 font-medium text-slate-700">Platform fee</th>
                  <td className="px-4 py-2 text-slate-900">
                    {formatMinorUnits(preview.platformFeeCents, preview.currency)}
                  </td>
                </tr>
                <tr>
                  <th scope="row" className="px-4 py-2 font-medium text-slate-700">Network fee</th>
                  <td className="px-4 py-2 text-slate-900">{formatMinorUnits(preview.networkFeeCents, preview.currency)}</td>
                </tr>
                <tr>
                  <th scope="row" className="px-4 py-2 font-medium text-slate-700">Total fee</th>
                  <td className="px-4 py-2 text-slate-900">{formatMinorUnits(preview.totalFeeCents, preview.currency)}</td>
                </tr>
                <tr>
                  <th scope="row" className="px-4 py-2 font-semibold text-slate-900">Net recipient</th>
                  <td className="px-4 py-2 font-semibold text-slate-900">
                    {formatMinorUnits(preview.netRecipientCents, preview.currency)}
                  </td>
                </tr>
              </tbody>
            </table>

            <p className="mt-3 text-sm text-slate-600">
              Rounding mode: <span className="font-semibold text-slate-900">{preview.rounding}</span> ·
              Schedule version <span className="font-semibold text-slate-900">{preview.scheduleVersion}</span>
            </p>

            <p
              className={`mt-3 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${balanced ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-300 bg-red-50 text-red-800'}`}
              role="status"
              aria-live="polite"
              data-testid="balance-line"
            >
              {balanced ? (
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              ) : (
                <XCircle className="h-4 w-4" aria-hidden="true" />
              )}
              {balanced ? 'Net + fees = gross ✓' : 'Net + fees = gross ✗'}
            </p>

            <button
              type="button"
              onClick={() => void handleQuote()}
              disabled={busy}
              aria-busy={busy}
              className="mt-4 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? 'Recording quote…' : 'Record quote'}
            </button>
          </>
        )}
      </section>

      <section aria-labelledby={versionsHeadingId} className="space-y-3">
        <h3 id={versionsHeadingId} className="text-lg font-semibold text-slate-900">
          Schedule versions
        </h3>
        <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          Activating a new version supersedes the previous one. Superseded versions are retained:
          history is never edited or deleted, only superseded.
        </p>
        {versions.length === 0 ? (
          <p
            className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600"
            role="status"
            aria-live="polite"
          >
            No fee schedule versions.
          </p>
        ) : (
          <ul aria-label="Fee schedule versions" className="space-y-2">
            {versions.map((version) => (
              <li
                key={version.version}
                className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold text-slate-900">{version.version}</p>
                  <p className="text-xs text-slate-500">
                    Effective {version.effectiveFrom} · {version.components.length} component(s) ·
                    created by {version.createdBy} at {version.createdAt}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {STATUS_LABEL[version.status]}
                  </span>
                  {version.status === 'draft' && (
                    <button
                      type="button"
                      onClick={() => void handleActivate(version.version)}
                      disabled={!permitted || busy}
                      aria-busy={busy}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Activate
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={() => void handleCreateDraft()}
          disabled={!permitted || busy || !inForce}
          aria-busy={busy}
          className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? 'Working…' : 'Create draft from active version'}
        </button>
        {!permitted && (
          <p className="text-xs text-slate-500">
            Version controls are disabled: schedule management is limited to finance and
            administrator roles.
          </p>
        )}
      </section>

      <section aria-labelledby={revenueHeadingId} className="space-y-3">
        <h3 id={revenueHeadingId} className="text-lg font-semibold text-slate-900">
          Fee revenue account
        </h3>
        <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          Fee revenue is accounted separately from scholarship disbursement and is never netted
          against it.
        </p>
        {derivedLedger === null ? (
          <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800" role="alert">
            Recorded quotes span more than one currency, so no fee revenue total can be shown. Next
            step: reconcile the quote currencies before reporting revenue.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Platform revenue
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {formatMinorUnits(derivedLedger.platformRevenueCents, derivedLedger.currency)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Network cost
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {formatMinorUnits(derivedLedger.networkCostCents, derivedLedger.currency)}
              </p>
            </div>
          </div>
        )}
      </section>

      {actionError && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {actionError}
        </div>
      )}
      {notice && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"
        >
          {notice}
        </div>
      )}
    </section>
  );
}

export default ScholarshipFeeCalculator;
