'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Download, FileText, XCircle } from 'lucide-react';
import {
  buildCsv,
  mismatchedCurrencies,
  pollExportJob,
  reconcileStatement,
  requiresAsyncExport,
  statementService,
  summariseLines,
} from '../service';
import { ASYNCHRONOUS_EXPORT_THRESHOLD, type ExportRequestInput,
  type ExportRequestResult,
  type LedgerEntryRef,
  type Statement,
  type StatementExportJob,
} from '../types';

function formatMinorUnits(amountCents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amountCents / 100);
}

type Props = {
  sponsorId?: string;
  programId?: string;
  initialPeriod?: { from: string; to: string };
  /** Injectable statement for a rendered period; the panel can also fetch it. */
  initialStatement?: Statement | null;
  ledgerEntries?: LedgerEntryRef[];
  loading?: boolean;
  error?: string | null;
  /** UX guard only — the API enforces the same grant. */
  canExport?: boolean;
  onExport?: (input: ExportRequestInput, lineCount: number) => Promise<ExportRequestResult>;
};

export function ScholarshipStatementExport({
  sponsorId = 'sponsor-acme',
  programId = 'chainverse-scholarship',
  initialPeriod = { from: '2026-01-01', to: '2026-03-31' },
  initialStatement = null,
  ledgerEntries = [],
  loading: loadingProp,
  error: errorProp,
  canExport = true,
  onExport,
}: Props) {
  const uid = useId();
  const fromId = `${uid}-from`;
  const toId = `${uid}-to`;
  const periodErrorId = `${uid}-period-error`;

  const [period, setPeriod] = useState(initialPeriod);
  const [statement, setStatement] = useState<Statement | null>(initialStatement);
  const [loading, setLoading] = useState(loadingProp ?? false);
  const [error, setError] = useState<string | null>(errorProp ?? null);
  const [exporting, setExporting] = useState(false);
  const [job, setJob] = useState<StatementExportJob | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    setStatement(initialStatement);
  }, [initialStatement]);

  const periodInvalid = period.from === '' || period.to === '' || period.from > period.to;
  const currencies = useMemo(() => mismatchedCurrencies(statement?.lines ?? []), [statement]);
  const lineCount = statement?.lines.length ?? 0;
  const large = requiresAsyncExport(lineCount);
  const totals = useMemo(
    () => (statement ? summariseLines(statement.lines) : null),
    [statement]
  );
  const reconciliation = useMemo(
    () => (statement ? reconcileStatement(statement.lines, ledgerEntries, statement.id) : null),
    [statement, ledgerEntries]
  );
  const advancedJob = useMemo(
    () => (job ? pollExportJob(job, new Date()) : null),
    [job]
  );

  async function handleGenerate() {
    if (periodInvalid) return;
    setLoading(true);
    setError(null);
    try {
      const result = await statementService.get(
        `${encodeURIComponent(sponsorId)}/${encodeURIComponent(programId)}/${period.from}/${period.to}`
      );
      setStatement(result);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'The statement could not be generated.');
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    if (!statement) return;
    setExporting(true);
    setExportError(null);
    setNotice(null);
    try {
      const input: ExportRequestInput = {
        sponsorId,
        programId,
        period: statement.period,
        format: statement.format,
      };
      const result = onExport
        ? await onExport(input, lineCount)
        : await statementService.requestExport(input, lineCount);
      if (result.kind === 'job') {
        setJob(result.job);
        setNotice(
          `Queued — you'll be notified when the ${result.job.lineCount.toLocaleString()}-line export is ready.`
        );
      } else {
        setJob(null);
        setNotice(`Ready to download: ${buildCsv(result.statement).split('\n').length - 1} line(s) as CSV.`);
      }
    } catch (cause: unknown) {
      setExportError(cause instanceof Error ? cause.message : 'The export could not be started.');
    } finally {
      setExporting(false);
    }
  }

  if (!canExport) {
    return (
      <section aria-labelledby={`${uid}-heading`} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 id={`${uid}-heading`} className="text-2xl font-bold text-slate-900">
          Sponsor statements
        </h2>
        <div role="note" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">You do not have permission to export sponsor statements.</p>
          <p className="mt-1">
            Statements are limited to the sponsor who owns them, plus finance and administrators. Next step:
            ask the sponsor account owner to share the statement, or request it from finance.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby={`${uid}-heading`} className="mx-auto max-w-6xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Statements</p>
      <h2 id={`${uid}-heading`} className="mt-2 text-3xl font-black text-slate-900">
        Sponsor financial statement
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-slate-600">
        Every line traces to a ledger entry, so the statement can be reconciled rather than taken on trust.
        Exports above {ASYNCHRONOUS_EXPORT_THRESHOLD.toLocaleString()} lines run as a background job.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Sponsor</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">{sponsorId}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Program</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">{programId}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-slate-700">Period</p>
          <div className="mt-1 flex gap-2">
            <label htmlFor={fromId} className="sr-only">Period start</label>
            <input
              id={fromId}
              type="date"
              value={period.from}
              onChange={(event) => setPeriod((current) => ({ ...current, from: event.target.value }))}
              aria-invalid={periodInvalid || undefined}
              aria-describedby={periodInvalid ? periodErrorId : undefined}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
            <label htmlFor={toId} className="sr-only">Period end</label>
            <input
              id={toId}
              type="date"
              value={period.to}
              onChange={(event) => setPeriod((current) => ({ ...current, to: event.target.value }))}
              aria-invalid={periodInvalid || undefined}
              aria-describedby={periodInvalid ? periodErrorId : undefined}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>
          {periodInvalid && (
            <p id={periodErrorId} className="mt-1 text-sm text-red-700">
              Enter a start date on or before the end date.
            </p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => void handleGenerate()}
        disabled={periodInvalid || loading}
        aria-busy={loading}
        className="mt-4 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? 'Generating statement…' : 'Generate statement'}
      </button>

      {error && (
        <div role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">The statement could not be generated.</p>
          <p className="mt-1">{error}</p>
          <p className="mt-2">Next step: widen the period or retry once the statement service responds.</p>
        </div>
      )}

      {currencies.length > 1 && (
        <div role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle aria-hidden="true" className="h-4 w-4" />
            Currency mismatch
          </p>
          <p className="mt-1">
            This statement mixes {currencies.join(' and ')}. Currencies are never combined — split the period by
            currency before exporting.
          </p>
        </div>
      )}

      {statement && totals ? (
        <div className="mt-8 space-y-8">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Totals ({statement.currency})</h3>
            <dl className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['Contributions', totals.contributionsCents],
                ['Commitments', totals.commitmentsCents],
                ['Payments', totals.paymentsCents],
                ['Fees', totals.feesCents],
                ['Refunds', totals.refundsCents],
                ['Recoveries', totals.recoveriesCents],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</dt>
                  <dd className="mt-2 text-lg font-bold tabular-nums text-slate-900">
                    {formatMinorUnits(Number(value), statement.currency)}
                  </dd>
                </div>
              ))}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Closing balance</dt>
                <dd className="mt-2 text-lg font-bold tabular-nums text-emerald-800">
                  {formatMinorUnits(totals.closingBalanceCents, statement.currency)}
                </dd>
              </div>
            </dl>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="pb-3 text-left text-sm font-semibold text-slate-700">
                Statement lines, each with the ledger entry it reconciles to
              </caption>
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th scope="col" className="py-2 pr-3">Date</th>
                  <th scope="col" className="py-2 pr-3">Kind</th>
                  <th scope="col" className="py-2 pr-3">Description</th>
                  <th scope="col" className="py-2 pr-3">Amount</th>
                  <th scope="col" className="py-2">Ledger entry</th>
                </tr>
              </thead>
              <tbody>
                {statement.lines.map((line) => (
                  <tr key={line.id} className="border-b border-slate-100">
                    <th scope="row" className="py-2 pr-3 font-normal text-slate-700">{line.occurredAt.slice(0, 10)}</th>
                    <td className="py-2 pr-3 text-slate-700">{line.kind}</td>
                    <td className="py-2 pr-3 text-slate-700">{line.description}</td>
                    <td className="py-2 pr-3 tabular-nums text-slate-700">
                      {formatMinorUnits(line.amountCents, line.currency)} {line.currency}
                    </td>
                    <td className="py-2 font-mono text-xs text-slate-500">{line.ledgerEntryId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {reconciliation && (
            <div
              role={reconciliation.balanced ? 'status' : 'alert'}
              aria-live="polite"
              className={`rounded-xl border p-4 text-sm ${
                reconciliation.balanced
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-red-200 bg-red-50 text-red-800'
              }`}
            >
              <p className="flex items-center gap-2 font-semibold">
                {reconciliation.balanced ? (
                  <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                ) : (
                  <XCircle aria-hidden="true" className="h-4 w-4" />
                )}
                {reconciliation.balanced
                  ? 'Reconciliation: balanced — every line matches a ledger entry'
                  : `Reconciliation: ${reconciliation.discrepancies.length} discrepancy(ies) against the ledger`}
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {reconciliation.discrepancies.map((discrepancy) => (
                  <li key={`${discrepancy.ledgerEntryId}-${discrepancy.reason}`}>
                    {discrepancy.ledgerEntryId}: {discrepancy.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <FileText aria-hidden="true" className="h-4 w-4" />
              {lineCount.toLocaleString()} line(s) in this statement
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {large
                ? `This statement is over the ${ASYNCHRONOUS_EXPORT_THRESHOLD.toLocaleString()} line threshold, so the export is queued as a job.`
                : 'This statement is within the inline threshold, so the export downloads directly.'}
            </p>
            <button
              type="button"
              onClick={() => void handleExport()}
              disabled={exporting}
              aria-busy={exporting}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download aria-hidden="true" className="h-4 w-4" />
              {exporting ? 'Starting export…' : 'Export statement'}
            </button>
            {exportError && (
              <p role="alert" className="mt-3 text-sm text-red-800">{exportError}</p>
            )}
            {notice && (
              <p role="status" aria-live="polite" className="mt-3 text-sm text-slate-700">{notice}</p>
            )}
            {advancedJob && (
              <p className="mt-3 flex items-center gap-2 text-sm text-slate-700">
                <Clock aria-hidden="true" className="h-4 w-4" />
                Export job status: {advancedJob.status}
                {advancedJob.status === 'expired'
                  ? ' — the download link has expired, request a new export.'
                  : advancedJob.downloadUrl
                  ? ` — download ready at ${advancedJob.downloadUrl}`
                  : ' — still being prepared.'}
              </p>
            )}
          </div>
        </div>
      ) : (
        !loading && (
          <div role="status" aria-live="polite" className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">No activity in this period.</p>
            <p className="mt-1">
              The selected period contains no contributions, payments, fees, refunds, or recoveries. Next step:
              choose a wider period, or check the ledger for movements outside the sponsor's program.
            </p>
          </div>
        )
      )}
    </section>
  );
}

export default ScholarshipStatementExport;
