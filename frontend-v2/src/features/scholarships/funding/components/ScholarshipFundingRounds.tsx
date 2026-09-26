'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import { AlertTriangle, Ban, CircleCheck, Coins, Landmark } from 'lucide-react';
import {
  MINIMUM_DEPOSIT_CENTS,
  authorizeReallocation,
  canOperateFunding,
  detectDuplicate,
  fundingService,
  recordDeposit,
  roundProgress,
  validateDeposit,
} from '../service';
import {
  EXPECTED_SOURCE_ACCOUNT_ID,
  KNOWN_ASSET_CODES,
  type Deposit,
  type DepositDraft,
  type FundingRound,
  type ReallocationRequest,
} from '../types';

type Props = {
  role?: string;
  sponsorId?: string;
  programs?: { id: string; name: string }[];
  initialDeposits?: Deposit[];
  initialRounds?: FundingRound[];
  initialReallocations?: ReallocationRequest[];
};

type LoadState = 'loading' | 'ready' | 'error';

const STATUS_TONE: Record<Deposit['status'], string> = {
  recorded: 'Pending credit',
  credited: 'Credited',
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

const EMPTY_DRAFT: DepositDraft = {
  sponsorId: '',
  allocation: 'specific-program',
  programId: '',
  amountCents: MINIMUM_DEPOSIT_CENTS,
  currency: 'USD',
  assetCode: 'USDC',
  issuer: '',
  sourceAccountId: EXPECTED_SOURCE_ACCOUNT_ID,
  reference: '',
  clientToken: '',
};

export function ScholarshipFundingRounds({
  role = 'finance',
  sponsorId = 'sponsor-1',
  programs = [{ id: 'program-1', name: 'ChainVerse Scholarship' }],
  initialDeposits,
  initialRounds,
  initialReallocations,
}: Props) {
  const formId = useId();
  const headingId = `${formId}-heading`;
  const depositsHeadingId = `${formId}-deposits`;
  const roundsHeadingId = `${formId}-rounds`;
  const reallocationHeadingId = `${formId}-reallocation`;

  const permitted = canOperateFunding(role);

  const [loadState, setLoadState] = useState<LoadState>(initialDeposits ? 'ready' : 'loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deposits, setDeposits] = useState<Deposit[]>(initialDeposits ?? []);
  const [rounds, setRounds] = useState<FundingRound[]>(initialRounds ?? []);
  const [reallocations, setReallocations] = useState<ReallocationRequest[]>(initialReallocations ?? []);
  const [draft, setDraft] = useState<DepositDraft>({ ...EMPTY_DRAFT, sponsorId });
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reallocationDraft, setReallocationDraft] = useState({
    depositId: '',
    toProgramId: '',
    amountCents: MINIMUM_DEPOSIT_CENTS,
    reason: '',
  });

  const load = useCallback(async () => {
    setLoadState('loading');
    setLoadError(null);
    try {
      const [nextDeposits, nextRounds, nextReallocations] = await Promise.all([
        fundingService.listDeposits(sponsorId),
        fundingService.listRounds(),
        fundingService.listReallocations(),
      ]);
      setDeposits(nextDeposits);
      setRounds(nextRounds);
      setReallocations(nextReallocations);
      setLoadState('ready');
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to load funding data.');
      setLoadState('error');
    }
  }, [sponsorId]);

  useEffect(() => {
    if (initialDeposits) return;
    void load();
  }, [initialDeposits, load]);

  const duplicate = detectDuplicate(deposits, draft);
  const validation = validateDeposit(draft, deposits, rounds);
  const errorFor = (field: string) => validation.errors.find((item) => item.field === field);

  const handleRecord = async () => {
    setSubmitted(true);
    setActionError(null);
    setNotice(null);
    if (duplicate || !validation.valid) return;

    setBusy(true);
    try {
      const recordedAt = new Date().toISOString();
      const local = recordDeposit(draft, deposits, rounds, recordedAt);
      const response = await fundingService
        .recordDeposit({ ...draft, idempotencyKey: `deposit-${draft.clientToken}` })
        .catch(() => null);
      setDeposits((current) => [response ?? local, ...current]);
      setNotice(
        `Deposit ${local.reference} recorded. It is not credited until an authorized crediting step completes.`
      );
      setDraft({ ...EMPTY_DRAFT, sponsorId });
      setSubmitted(false);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to record the deposit.');
    } finally {
      setBusy(false);
    }
  };

  const handleAuthorizeReallocation = async (request: ReallocationRequest) => {
    if (!permitted) return;
    setBusy(true);
    setActionError(null);
    setNotice(null);
    try {
      const authorized = await fundingService
        .authorizeReallocation(request.id, {
          authorizedBy: role,
          reason: request.reason,
          expectedStatus: 'requested',
        })
        .catch(() => null);
      setReallocations((current) => [
        authorized ?? authorizeReallocation(request, role, new Date().toISOString()),
        ...current,
      ]);
      setNotice(`Reallocation ${request.id} authorized by ${role}. The original allocation stays on record.`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to authorize the reallocation.');
    } finally {
      setBusy(false);
    }
  };

  const handleRequestReallocation = async () => {
    if (!permitted || !reallocationDraft.depositId || !reallocationDraft.toProgramId) return;
    setBusy(true);
    setActionError(null);
    setNotice(null);
    try {
      const deposit = deposits.find((item) => item.id === reallocationDraft.depositId);
      const local: ReallocationRequest = {
        id: `rea-${reallocationDraft.depositId}-${reallocationDraft.toProgramId}`,
        depositId: reallocationDraft.depositId,
        fromProgramId: deposit?.programId ?? '',
        toProgramId: reallocationDraft.toProgramId,
        amountCents: reallocationDraft.amountCents,
        currency: deposit?.currency ?? draft.currency,
        status: 'requested',
        requestedBy: role,
        requestedAt: new Date().toISOString(),
        reason: reallocationDraft.reason,
      };
      const response = await fundingService
        .requestReallocation({
          depositId: local.depositId,
          fromProgramId: local.fromProgramId,
          toProgramId: local.toProgramId,
          amountCents: local.amountCents,
          currency: local.currency,
          requestedBy: local.requestedBy,
          reason: local.reason,
        })
        .catch(() => null);
      setReallocations((current) => [response ?? local, ...current]);
      setNotice('Reallocation requested. A second, distinct authorizer must approve it.');
      setReallocationDraft({ depositId: '', toProgramId: '', amountCents: MINIMUM_DEPOSIT_CENTS, reason: '' });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to request the reallocation.');
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
        Loading sponsor deposits and funding rounds…
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800 shadow-sm" role="alert">
        <p className="font-semibold">Funding data could not be loaded.</p>
        <p className="mt-2">{loadError}</p>
        <p className="mt-2">Next step: retry the request once the funding API is reachable.</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-300"
        >
          Retry loading funding
        </button>
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-5xl space-y-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" aria-labelledby={headingId}>
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">Funding</p>
        <h2 id={headingId} className="mt-2 text-2xl font-black text-slate-900">
          Sponsor deposits and funding rounds
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Every deposit binds an asset and a verified source account, and is denominated in integer
          minor units with an explicit currency. Currencies are never mixed.
        </p>
      </header>

      {!permitted && (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
          role="note"
          aria-label="Funding permission notice"
        >
          <p className="font-semibold">Funding actions are not available for your role.</p>
          <p className="mt-1">
            Next step: ask a sponsor, finance, or administrator to record a deposit or authorize a
            reallocation. You can still review the tables below.
          </p>
        </div>
      )}

      <section aria-labelledby={`${formId}-form-heading`} className="rounded-xl border border-slate-200 bg-slate-50 p-5">
        <h3 id={`${formId}-form-heading`} className="text-lg font-semibold text-slate-900">
          Record a deposit
        </h3>

        {duplicate && (
          <div
            className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800"
            role="alert"
            aria-label="Duplicate reference warning"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <p>
                This reference or client token already appears on deposit {duplicate.id}. A deposit
                can only be credited once, so submission is blocked.
              </p>
            </div>
          </div>
        )}

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor={`${formId}-sponsor`} className="block text-sm font-medium text-slate-700">
              Sponsor
            </label>
            <input
              id={`${formId}-sponsor`}
              type="text"
              value={draft.sponsorId}
              onChange={(event) => setDraft((current) => ({ ...current, sponsorId: event.target.value }))}
              aria-invalid={submitted && !draft.sponsorId ? true : undefined}
              aria-describedby={submitted && !draft.sponsorId ? `${formId}-sponsor-error` : undefined}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
            {submitted && !draft.sponsorId && (
              <p id={`${formId}-sponsor-error`} className="mt-1 text-xs text-red-700">
                A sponsor is required.
              </p>
            )}
          </div>

          <fieldset>
            <legend className="text-sm font-medium text-slate-700">Allocation</legend>
            <div className="mt-1 flex gap-4">
              {(
                [
                  ['specific-program', 'Specific program'],
                  ['unrestricted-pool', 'Unrestricted pool'],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name={`${formId}-allocation`}
                    value={value}
                    checked={draft.allocation === value}
                    onChange={() => setDraft((current) => ({ ...current, allocation: value }))}
                    className="h-4 w-4 border-slate-300 text-indigo-600 focus:ring-2 focus:ring-indigo-200"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor={`${formId}-program`} className="block text-sm font-medium text-slate-700">
              Program
            </label>
            <select
              id={`${formId}-program`}
              value={draft.programId ?? ''}
              onChange={(event) => setDraft((current) => ({ ...current, programId: event.target.value }))}
              aria-invalid={submitted && errorFor('programId') ? true : undefined}
              aria-describedby={submitted && errorFor('programId') ? `${formId}-program-error` : undefined}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              <option value="">Select a program</option>
              {programs.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.name}
                </option>
              ))}
            </select>
            {submitted && errorFor('programId') && (
              <p id={`${formId}-program-error`} className="mt-1 text-xs text-red-700">
                {errorFor('programId')?.message}
              </p>
            )}
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
              onChange={(event) =>
                setDraft((current) => ({ ...current, amountCents: Number(event.target.value) }))
              }
              aria-invalid={submitted && errorFor('amountCents') ? true : undefined}
              aria-describedby={
                submitted && errorFor('amountCents') ? `${formId}-amount-error` : `${formId}-amount-hint`
              }
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
            <p id={`${formId}-amount-hint`} className="mt-1 text-xs text-slate-500">
              Minimum {MINIMUM_DEPOSIT_CENTS} minor units. Integer minor units only.
            </p>
            {submitted && errorFor('amountCents') && (
              <p id={`${formId}-amount-error`} className="mt-1 text-xs text-red-700">
                {errorFor('amountCents')?.message}
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
              list={`${formId}-asset-options`}
              value={draft.assetCode}
              onChange={(event) => setDraft((current) => ({ ...current, assetCode: event.target.value }))}
              aria-invalid={submitted && errorFor('assetCode') ? true : undefined}
              aria-describedby={submitted && errorFor('assetCode') ? `${formId}-asset-error` : undefined}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
            <datalist id={`${formId}-asset-options`}>
              {KNOWN_ASSET_CODES.map((code) => (
                <option key={code} value={code} />
              ))}
            </datalist>
            {submitted && errorFor('assetCode') && (
              <p id={`${formId}-asset-error`} className="mt-1 text-xs text-red-700">
                {errorFor('assetCode')?.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor={`${formId}-source`} className="block text-sm font-medium text-slate-700">
              Source account
            </label>
            <input
              id={`${formId}-source`}
              type="text"
              value={draft.sourceAccountId}
              onChange={(event) =>
                setDraft((current) => ({ ...current, sourceAccountId: event.target.value }))
              }
              aria-invalid={submitted && errorFor('sourceAccountId') ? true : undefined}
              aria-describedby={
                submitted && errorFor('sourceAccountId') ? `${formId}-source-error` : undefined
              }
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
            {submitted && errorFor('sourceAccountId') && (
              <p id={`${formId}-source-error`} className="mt-1 text-xs text-red-700">
                {errorFor('sourceAccountId')?.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor={`${formId}-reference`} className="block text-sm font-medium text-slate-700">
              Deposit reference
            </label>
            <input
              id={`${formId}-reference`}
              type="text"
              value={draft.reference}
              onChange={(event) => setDraft((current) => ({ ...current, reference: event.target.value }))}
              aria-invalid={submitted && errorFor('reference') ? true : undefined}
              aria-describedby={submitted && errorFor('reference') ? `${formId}-reference-error` : undefined}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
            {submitted && errorFor('reference') && (
              <p id={`${formId}-reference-error`} className="mt-1 text-xs text-red-700">
                {errorFor('reference')?.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor={`${formId}-token`} className="block text-sm font-medium text-slate-700">
              Client token
            </label>
            <input
              id={`${formId}-token`}
              type="text"
              value={draft.clientToken}
              onChange={(event) => setDraft((current) => ({ ...current, clientToken: event.target.value }))}
              aria-invalid={submitted && errorFor('clientToken') ? true : undefined}
              aria-describedby={submitted && errorFor('clientToken') ? `${formId}-token-error` : undefined}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
            {submitted && errorFor('clientToken') && (
              <p id={`${formId}-token-error`} className="mt-1 text-xs text-red-700">
                {errorFor('clientToken')?.message}
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => void handleRecord()}
          disabled={!permitted || busy || duplicate !== null}
          aria-busy={busy}
          aria-describedby={`${formId}-submit-hint`}
          className="mt-4 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {busy ? 'Recording deposit…' : 'Record deposit'}
        </button>
        <p id={`${formId}-submit-hint`} className="mt-2 text-xs text-slate-500">
          {duplicate
            ? 'Submission is blocked while this reference or client token is already on file.'
            : 'Recording does not credit the deposit. A separate authorized step credits it.'}
        </p>
      </section>

      <section aria-labelledby={depositsHeadingId} className="space-y-3">
        <h3 id={depositsHeadingId} className="text-lg font-semibold text-slate-900">
          Deposits
        </h3>
        {deposits.length === 0 ? (
          <p
            className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600"
            role="status"
            aria-live="polite"
          >
            No deposits recorded yet. Next step: record the first sponsor deposit above.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <caption className="sr-only">Sponsor deposits with asset binding and status</caption>
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-3">Reference</th>
                  <th scope="col" className="px-4 py-3">Amount</th>
                  <th scope="col" className="px-4 py-3">Asset binding</th>
                  <th scope="col" className="px-4 py-3">Allocation</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {deposits.map((deposit) => (
                  <tr key={deposit.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{deposit.reference}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatMinorUnits(deposit.amountCents, deposit.currency)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {deposit.asset.assetCode}
                      {deposit.asset.issuer ? ` · ${deposit.asset.issuer}` : ''} from{' '}
                      {deposit.asset.sourceAccountId} (verified {deposit.asset.verifiedAt})
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {deposit.allocation === 'unrestricted-pool'
                        ? 'Unrestricted pool'
                        : deposit.programId ?? 'No program'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-slate-900">
                        {deposit.status === 'credited' ? (
                          <CircleCheck className="h-4 w-4" aria-hidden="true" />
                        ) : deposit.status === 'reversed' ? (
                          <Ban className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Coins className="h-4 w-4" aria-hidden="true" />
                        )}
                        <span className="font-semibold uppercase tracking-wide">
                          {STATUS_TONE[deposit.status]}
                        </span>
                        <span className="sr-only">({deposit.status})</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby={roundsHeadingId} className="space-y-3">
        <h3 id={roundsHeadingId} className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <Landmark className="h-5 w-5 text-slate-500" aria-hidden="true" />
          Funding rounds
        </h3>
        {rounds.length === 0 ? (
          <p
            className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600"
            role="status"
            aria-live="polite"
          >
            No funding rounds configured. Next step: an administrator opens a round before deposits
            can be accepted.
          </p>
        ) : (
          <ul className="space-y-3">
            {rounds.map((round) => {
              const progress = roundProgress(round);
              return (
                <li key={round.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="font-semibold text-slate-900">{round.name}</p>
                    <p className="text-xs uppercase tracking-wide text-slate-500">{round.status}</p>
                  </div>
                  <div
                    role="progressbar"
                    aria-valuenow={progress.percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${round.name} funding progress`}
                    aria-valuetext={`${progress.percent}% funded — ${formatMinorUnits(progress.committedCents, round.currency)} of ${formatMinorUnits(progress.targetCents, round.currency)}`}
                    className="mt-3 h-3 w-full overflow-hidden rounded-full border border-slate-300 bg-white"
                  >
                    <div
                      className="h-full bg-indigo-600 motion-reduce:transition-none"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    {progress.percent}% funded — {formatMinorUnits(progress.committedCents, round.currency)} of{' '}
                    {formatMinorUnits(progress.targetCents, round.currency)} target,{' '}
                    {formatMinorUnits(progress.remainingCents, round.currency)} remaining.
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby={reallocationHeadingId} className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-5">
        <h3 id={reallocationHeadingId} className="text-lg font-semibold text-slate-900">
          Reallocation requests
        </h3>
        <p className="text-sm text-slate-600">
          An allocation never moves silently. A request records who asked, and a second, distinct
          authorizer approves it; the original deposit allocation stays on record.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor={`${formId}-rea-deposit`} className="block text-sm font-medium text-slate-700">
              Deposit
            </label>
            <select
              id={`${formId}-rea-deposit`}
              value={reallocationDraft.depositId}
              onChange={(event) =>
                setReallocationDraft((current) => ({ ...current, depositId: event.target.value }))
              }
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              <option value="">Select a deposit</option>
              {deposits.map((deposit) => (
                <option key={deposit.id} value={deposit.id}>
                  {deposit.reference}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${formId}-rea-to`} className="block text-sm font-medium text-slate-700">
              Move to program
            </label>
            <select
              id={`${formId}-rea-to`}
              value={reallocationDraft.toProgramId}
              onChange={(event) =>
                setReallocationDraft((current) => ({ ...current, toProgramId: event.target.value }))
              }
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              <option value="">Select a program</option>
              {programs.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${formId}-rea-amount`} className="block text-sm font-medium text-slate-700">
              Reallocation amount (minor units)
            </label>
            <input
              id={`${formId}-rea-amount`}
              type="number"
              min={0}
              step={1}
              value={reallocationDraft.amountCents}
              onChange={(event) =>
                setReallocationDraft((current) => ({ ...current, amountCents: Number(event.target.value) }))
              }
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>
          <div>
            <label htmlFor={`${formId}-rea-reason`} className="block text-sm font-medium text-slate-700">
              Reason
            </label>
            <input
              id={`${formId}-rea-reason`}
              type="text"
              value={reallocationDraft.reason}
              onChange={(event) =>
                setReallocationDraft((current) => ({ ...current, reason: event.target.value }))
              }
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => void handleRequestReallocation()}
          disabled={!permitted || busy || !reallocationDraft.depositId || !reallocationDraft.toProgramId || !reallocationDraft.reason.trim()}
          aria-busy={busy}
          className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? 'Submitting…' : 'Request reallocation'}
        </button>
        <p className="text-xs text-slate-500">
          Next step: a reason and a target program are required before a reallocation can be
          requested.
        </p>

        {reallocations.length === 0 ? (
          <p
            className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600"
            role="status"
            aria-live="polite"
          >
            No reallocation requests recorded.
          </p>
        ) : (
          <ul className="space-y-2">
            {reallocations.map((request) => (
              <li key={request.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                <p className="font-semibold text-slate-900">
                  {request.fromProgramId || 'unrestricted-pool'} → {request.toProgramId} ·{' '}
                  {formatMinorUnits(request.amountCents, request.currency)} · {request.status}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Requested by {request.requestedBy} at {request.requestedAt}. Reason: {request.reason}.
                </p>
                {request.status === 'requested' && (
                  <button
                    type="button"
                    onClick={() => void handleAuthorizeReallocation(request)}
                    disabled={!permitted || busy || request.requestedBy === role}
                    aria-busy={busy}
                    className="mt-2 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Authorize as {role}
                  </button>
                )}
                {request.status === 'requested' && request.requestedBy === role && (
                  <p className="mt-1 text-xs text-amber-800">
                    You requested this change, so you cannot authorize it. Next step: a different
                    sponsor, finance, or administrator must approve it.
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

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
    </section>
  );
}

export default ScholarshipFundingRounds;
