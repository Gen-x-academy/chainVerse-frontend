'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { BookOpenCheck, RotateCcw, ShieldAlert, ShieldCheck } from 'lucide-react';
import {
  MINIMUM_REFUND_CENTS,
  canOperateRefunds,
  canRequestRefund,
  checkSolvency,
  refundAuthorityFor,
  refundService,
} from '../service';
import { REFUND_TRIGGERS, type LedgerEntry, type RefundRequest, type RefundTrigger } from '../types';

type Props = {
  role?: string;
  actorId?: string;
  programId?: string;
  initialRequests?: RefundRequest[];
  initialLedger?: LedgerEntry[];
  initialAvailableCents?: number;
  initialPayableCents?: number;
  currency?: string;
};

type LoadState = 'loading' | 'ready' | 'error';

const STATUS_TEXT: Record<RefundRequest['status'], string> = {
  requested: 'Requested',
  authorized: 'Authorized',
  processing: 'Processing',
  settled: 'Settled',
  rejected: 'Rejected',
  reversed: 'Reversed',
};

function formatMinorUnits(cents: number, currency: string): string {
  if (!currency) return `${(cents / 100).toFixed(2)} (no currency)`;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
  } catch {
    return `${currency} ${(cents / 100).toFixed(2)}`;
  }
}

const EMPTY_REQUEST: Omit<RefundRequest, 'id' | 'status' | 'requestedAt' | 'requestedBy'> = {
  programId: '',
  sponsorId: '',
  trigger: 'sponsor-request',
  amountCents: MINIMUM_REFUND_CENTS,
  currency: 'USD',
  assetCode: 'USDC',
  destinationAccountId: '',
  reason: '',
  clientToken: '',
};

export function ScholarshipRefundPanel({
  role = 'finance',
  actorId,
  programId = 'program-1',
  initialRequests,
  initialLedger,
  initialAvailableCents = 500_00,
  initialPayableCents = 200_00,
  currency = 'USD',
}: Props) {
  const formId = useId();
  const headingId = `${formId}-heading`;
  const solvencyHeadingId = `${formId}-solvency`;
  const requestsHeadingId = `${formId}-requests`;
  const ledgerHeadingId = `${formId}-ledger`;

  const authority = refundAuthorityFor(role);
  const permitted = canOperateRefunds(role);

  const [loadState, setLoadState] = useState<LoadState>(initialRequests ? 'ready' : 'loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [requests, setRequests] = useState<RefundRequest[]>(initialRequests ?? []);
  const [ledger, setLedger] = useState<LedgerEntry[]>(initialLedger ?? []);
  const [draft, setDraft] = useState({ ...EMPTY_REQUEST, programId, currency });
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadState('loading');
    setLoadError(null);
    try {
      const [nextRequests, nextLedger] = await Promise.all([
        refundService.listRequests(programId),
        refundService.listLedger(programId),
      ]);
      setRequests(nextRequests);
      setLedger(nextLedger);
      setLoadState('ready');
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to load refund data.');
      setLoadState('error');
    }
  }, [programId]);

  useEffect(() => {
    if (initialRequests) return;
    void load();
  }, [initialRequests, load]);

  const treasury = useMemo(
    () => ({
      availableCents: initialAvailableCents,
      payableCents: initialPayableCents,
      currency,
    }),
    [currency, initialAvailableCents, initialPayableCents]
  );

  const pendingRefunds = useMemo(
    () => requests.filter((request) => request.status === 'requested' || request.status === 'authorized' || request.status === 'processing'),
    [requests]
  );

  const solvency = useMemo(() => checkSolvency(treasury, pendingRefunds), [pendingRefunds, treasury]);

  const draftRequest: RefundRequest = useMemo(
    () => ({
      ...draft,
      id: 'draft',
      status: 'requested',
      requestedBy: actorId ?? role,
      requestedAt: new Date(0).toISOString(),
    }),
    [actorId, draft, role]
  );

  const draftMayRequest = canRequestRefund(draftRequest, role, programId, actorId);
  const draftSolvency = useMemo(() => checkSolvency(treasury, [...pendingRefunds, draftRequest]), [draftRequest, pendingRefunds, treasury]);
  const draftBlocked = draftSolvency.shortfallCents > 0;

  const amountError =
    submitted && (!Number.isInteger(draft.amountCents) || draft.amountCents < MINIMUM_REFUND_CENTS)
      ? `The minimum refund is ${MINIMUM_REFUND_CENTS} minor units.`
      : undefined;
  const reasonError = submitted && !draft.reason.trim() ? 'A documented reason is required.' : undefined;
  const destinationError =
    submitted && !draft.destinationAccountId.trim() ? 'A destination account is required.' : undefined;
  const authorityError = submitted && !draftMayRequest ? `Your role (${role}) cannot request a refund for this program.` : undefined;

  const handleRequest = async () => {
    setSubmitted(true);
    setActionError(null);
    setNotice(null);
    if (!draftMayRequest || draftBlocked) return;

    setBusy(true);
    try {
      const created = await refundService
        .request({ ...draftRequest, idempotencyKey: `refund-${draftRequest.clientToken}` })
        .catch(() => null);
      const local: RefundRequest = {
        ...draftRequest,
        id: `ref-${draftRequest.clientToken}`,
        requestedAt: new Date().toISOString(),
      };
      setRequests((current) => [created ?? local, ...current]);
      setNotice(
        'Refund requested. It must be authorized by finance or an administrator before it can settle.'
      );
      setDraft({ ...EMPTY_REQUEST, programId, currency });
      setSubmitted(false);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to request the refund.');
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
        Loading refund requests and the program ledger…
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800 shadow-sm" role="alert">
        <p className="font-semibold">Refund data could not be loaded.</p>
        <p className="mt-2">{loadError}</p>
        <p className="mt-2">Next step: retry the request once the refunds API is reachable.</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-300"
        >
          Retry loading refunds
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
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Refunds</p>
        <h2 id={headingId} className="mt-2 text-2xl font-black text-slate-900">
          Refunds and returned payments
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Authority is derived from your role, never from the request. Amounts are integer minor
          units in a single currency; a returned payment is reversed, never deleted.
        </p>
      </header>

      <div
        className={`rounded-xl border p-4 text-sm ${permitted ? 'border-slate-200 bg-slate-50 text-slate-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}
        role="note"
        aria-label="Refund authority notice"
      >
        <div className="flex items-start gap-3">
          {permitted ? <ShieldCheck className="h-5 w-5 shrink-0" aria-hidden="true" /> : <ShieldAlert className="h-5 w-5 shrink-0" aria-hidden="true" />}
          <div>
            <p className="font-semibold uppercase tracking-wide">
              {permitted ? `Refund authority: ${authority}` : 'No refund authority'}
            </p>
            <p className="mt-1">
              {permitted
                ? `You are acting as ${authority}. Finance and administrators authorize refunds; sponsors may only request a refund of their own program's funds.`
                : `Your role (${role}) holds no refund authority. Students and reviewers can never request, authorize, or settle a refund. Next step: contact a sponsor, finance, or administrator.`}
            </p>
          </div>
        </div>
      </div>

      <section aria-labelledby={solvencyHeadingId} className="rounded-xl border border-slate-200 bg-slate-50 p-5">
        <h3 id={solvencyHeadingId} className="text-lg font-semibold text-slate-900">
          Solvency check
        </h3>
        <div
          className={`mt-3 flex items-start gap-3 rounded-lg border p-3 text-sm ${solvency.solvent ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-300 bg-red-50 text-red-800'}`}
          role="status"
          aria-live="polite"
        >
          {solvency.solvent ? (
            <ShieldCheck className="h-5 w-5 shrink-0" aria-hidden="true" />
          ) : (
            <ShieldAlert className="h-5 w-5 shrink-0" aria-hidden="true" />
          )}
          <div>
            <p className="font-semibold uppercase tracking-wide">
              {solvency.solvent ? 'Solvent — settlement allowed' : 'Short — settlement blocked'}
            </p>
            <p className="mt-1">
              {formatMinorUnits(solvency.availableCents, solvency.currency)} available,{' '}
              {formatMinorUnits(solvency.payableCents, solvency.currency)} payable,
              {solvency.shortfallCents > 0
                ? ` shortfall of ${formatMinorUnits(solvency.shortfallCents, solvency.currency)} across ${pendingRefunds.length} pending refund(s).`
                : ` no shortfall across ${pendingRefunds.length} pending refund(s).`}
            </p>
            {!solvency.solvent && (
              <p className="mt-1">
                Next step: resolve the shortfall — authorize fewer refunds, top up the program pool,
                or reject the pending requests — before any of them can settle.
              </p>
            )}
          </div>
        </div>
      </section>

      <section aria-labelledby={`${formId}-form-heading`} className="rounded-xl border border-slate-200 bg-slate-50 p-5">
        <h3 id={`${formId}-form-heading`} className="text-lg font-semibold text-slate-900">
          Request a refund
        </h3>

        {submitted && !draftMayRequest && (
          <div
            className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800"
            role="alert"
          >
            Your role does not hold refund authority for this program. Next step: ask a sponsor,
            finance, or administrator to raise the request.
          </div>
        )}

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor={`${formId}-trigger`} className="block text-sm font-medium text-slate-700">
              Trigger
            </label>
            <select
              id={`${formId}-trigger`}
              value={draft.trigger}
              onChange={(event) => setDraft((current) => ({ ...current, trigger: event.target.value as RefundTrigger }))}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            >
              {REFUND_TRIGGERS.map((trigger) => (
                <option key={trigger} value={trigger}>
                  {trigger}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={`${formId}-amount`} className="block text-sm font-medium text-slate-700">
              Amount (minor units)
            </label>
            <input
              id={`${formId}-amount`}
              type="number"
              min={0}
              step={1}
              value={draft.amountCents}
              onChange={(event) => setDraft((current) => ({ ...current, amountCents: Number(event.target.value) }))}
              aria-invalid={amountError ? true : undefined}
              aria-describedby={amountError ? `${formId}-amount-error` : `${formId}-amount-hint`}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            />
            <p id={`${formId}-amount-hint`} className="mt-1 text-xs text-slate-500">
              Minimum {MINIMUM_REFUND_CENTS} minor units, {currency}.
            </p>
            {amountError && (
              <p id={`${formId}-amount-error`} className="mt-1 text-xs text-red-700">
                {amountError}
              </p>
            )}
          </div>

          <div>
            <label htmlFor={`${formId}-asset`} className="block text-sm font-medium text-slate-700">
              Asset code
            </label>
            <input
              id={`${formId}-asset`}
              type="text"
              value={draft.assetCode}
              onChange={(event) => setDraft((current) => ({ ...current, assetCode: event.target.value }))}
              aria-invalid={submitted && !draft.assetCode.trim() ? true : undefined}
              aria-describedby={submitted && !draft.assetCode.trim() ? `${formId}-asset-error` : undefined}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            />
            {submitted && !draft.assetCode.trim() && (
              <p id={`${formId}-asset-error`} className="mt-1 text-xs text-red-700">
                An asset code is required.
              </p>
            )}
          </div>

          <div>
            <label htmlFor={`${formId}-destination`} className="block text-sm font-medium text-slate-700">
              Destination account
            </label>
            <input
              id={`${formId}-destination`}
              type="text"
              value={draft.destinationAccountId}
              onChange={(event) =>
                setDraft((current) => ({ ...current, destinationAccountId: event.target.value }))
              }
              aria-invalid={destinationError ? true : undefined}
              aria-describedby={destinationError ? `${formId}-destination-error` : undefined}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            />
            {destinationError && (
              <p id={`${formId}-destination-error`} className="mt-1 text-xs text-red-700">
                {destinationError}
              </p>
            )}
          </div>

          <div className="md:col-span-2">
            <label htmlFor={`${formId}-token`} className="block text-sm font-medium text-slate-700">
              Client token
            </label>
            <input
              id={`${formId}-token`}
              type="text"
              value={draft.clientToken}
              onChange={(event) => setDraft((current) => ({ ...current, clientToken: event.target.value }))}
              aria-invalid={submitted && !draft.clientToken.trim() ? true : undefined}
              aria-describedby={
                submitted && !draft.clientToken.trim() ? `${formId}-token-error` : `${formId}-token-hint`
              }
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            />
            <p id={`${formId}-token-hint`} className="mt-1 text-xs text-slate-500">
              Deduplication key: the same token can only produce one refund.
            </p>
            {submitted && !draft.clientToken.trim() && (
              <p id={`${formId}-token-error`} className="mt-1 text-xs text-red-700">
                A client token is required so this refund cannot be requested twice.
              </p>
            )}
          </div>

          <div className="md:col-span-2">
            <label htmlFor={`${formId}-reason`} className="block text-sm font-medium text-slate-700">
              Reason
            </label>
            <input
              id={`${formId}-reason`}
              type="text"
              value={draft.reason}
              onChange={(event) => setDraft((current) => ({ ...current, reason: event.target.value }))}
              aria-invalid={reasonError ? true : undefined}
              aria-describedby={reasonError ? `${formId}-reason-error` : undefined}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            />
            {reasonError && (
              <p id={`${formId}-reason-error`} className="mt-1 text-xs text-red-700">
                {reasonError}
              </p>
            )}
          </div>
        </div>

        {draftBlocked && (
          <p
            className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800"
            role="alert"
          >
            This refund would leave a shortfall of {formatMinorUnits(draftSolvency.shortfallCents, currency)}.
            Settlement is blocked until the treasury is solvent again.
          </p>
        )}

        <button
          type="button"
          onClick={() => void handleRequest()}
          disabled={!permitted || busy || draftBlocked}
          aria-busy={busy}
          className="mt-4 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? 'Requesting refund…' : 'Request refund'}
        </button>
        <p className="mt-2 text-xs text-slate-500">
          {draftBlocked
            ? 'Submission is blocked while the treasury cannot cover this refund.'
            : 'A refund must be authorized by finance or an administrator before it can settle.'}
        </p>
        {authorityError && <p className="mt-1 text-xs text-red-700">{authorityError}</p>}
      </section>

      <section aria-labelledby={requestsHeadingId} className="space-y-3">
        <h3 id={requestsHeadingId} className="text-lg font-semibold text-slate-900">
          Refund requests
        </h3>
        {requests.length === 0 ? (
          <p
            className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600"
            role="status"
            aria-live="polite"
          >
            No refund requests recorded. Next step: raise one above if a program has funds to return.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <caption className="sr-only">Refund requests with trigger, amount, and status</caption>
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-3">Trigger</th>
                  <th scope="col" className="px-4 py-3">Amount</th>
                  <th scope="col" className="px-4 py-3">Destination</th>
                  <th scope="col" className="px-4 py-3">Reason</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((request) => (
                  <tr key={request.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{request.trigger}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatMinorUnits(request.amountCents, request.currency)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{request.destinationAccountId}</td>
                    <td className="px-4 py-3 text-slate-600">{request.reason}</td>
                    <td className="px-4 py-3">
                      <span className="font-semibold uppercase tracking-wide text-slate-900">
                        {STATUS_TEXT[request.status]}
                      </span>
                      <span className="sr-only"> ({request.status})</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby={ledgerHeadingId} className="space-y-3">
        <h3 id={ledgerHeadingId} className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <BookOpenCheck className="h-5 w-5 text-slate-500" aria-hidden="true" />
          Ledger
        </h3>
        <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          A returned payment is reversed, never deleted. The original entry stays on the ledger and
          is linked to its reversal, so history is only ever added to, never edited.
        </p>
        {ledger.length === 0 ? (
          <p
            className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600"
            role="status"
            aria-live="polite"
          >
            No ledger entries for this program yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <caption className="sr-only">Program ledger entries and their reversals</caption>
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-3">Entry</th>
                  <th scope="col" className="px-4 py-3">Type</th>
                  <th scope="col" className="px-4 py-3">Amount</th>
                  <th scope="col" className="px-4 py-3">Memo</th>
                  <th scope="col" className="px-4 py-3">Reverses</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ledger.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{entry.id}</td>
                    <td className="px-4 py-3 text-slate-900">
                      {entry.entryType === 'debit' ? 'Debit' : 'Credit'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatMinorUnits(entry.amountCents, entry.currency)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {entry.memo}
                      {entry.reversesEntryId ? (
                        <span className="ml-1 inline-flex items-center gap-1 text-xs text-slate-500">
                          <RotateCcw className="h-3 w-3" aria-hidden="true" />
                          reversal
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
                      {entry.reversesEntryId ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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

export default ScholarshipRefundPanel;
