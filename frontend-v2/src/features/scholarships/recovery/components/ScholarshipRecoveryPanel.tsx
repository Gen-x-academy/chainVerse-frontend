'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { AlertTriangle, Ban, CheckCircle2, ShieldAlert } from 'lucide-react';
import {
  canIssueInstruction,
  outstandingCents,
  reconcileClaimRecord,
  recoveryService,
} from '../service';
import type { RecoveryClaim, RecoveryInstruction } from '../types';

const REASON_LABELS: Record<RecoveryClaim['reason'], string> = {
  fraud: 'Fraud',
  'withdrawal-after-award': 'Withdrew after award',
  'milestone-failure': 'Milestone failure',
  'duplicate-award': 'Duplicate award',
  'academic-fraud': 'Academic fraud',
  other: 'Other',
};

const LEGAL_BASIS_LABELS: Record<RecoveryClaim['legalBasis'], string> = {
  'program-terms': 'Program terms',
  'signed-agreement': 'Signed agreement',
  'court-order': 'Court order',
  'policy-9.2': 'Policy 9.2',
  none: 'None recorded',
};

const STATUS_LABELS: Record<RecoveryClaim['status'], string> = {
  requested: 'Requested',
  'under-review': 'Under review',
  approved: 'Approved',
  scheduled: 'Scheduled',
  recovered: 'Recovered',
  'written-off': 'Written off',
  reversed: 'Reversed',
};

function formatMinorUnits(amountCents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amountCents / 100);
}

type Props = {
  programId?: string;
  /** UX guard only — the API enforces the same grant. */
  canManage?: boolean;
  /** Injectable claims; when omitted the panel loads them itself. */
  claims?: RecoveryClaim[];
  loading?: boolean;
  error?: string | null;
  onIssueInstruction?: (claim: RecoveryClaim, input: { amountCents: number; authorizationId: string }) => Promise<RecoveryInstruction | void>;
};

export function ScholarshipRecoveryPanel({
  programId,
  canManage = true,
  claims: claimsProp,
  loading: loadingProp,
  error: errorProp,
  onIssueInstruction,
}: Props) {
  const uid = useId();
  const authFieldId = `${uid}-authorization`;
  const authErrorId = `${uid}-authorization-error`;
  const claimsTableCaptionId = `${uid}-claims-caption`;

  const [fetched, setFetched] = useState<RecoveryClaim[] | null>(null);
  const [selfLoading, setSelfLoading] = useState(false);
  const [selfError, setSelfError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [authorizationId, setAuthorizationId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loading = loadingProp ?? selfLoading;
  const error = errorProp !== undefined ? errorProp : selfError;
  const claims = claimsProp ?? fetched;

  useEffect(() => {
    if (claimsProp !== undefined) return;
    let cancelled = false;
    setSelfLoading(true);
    setSelfError(null);
    recoveryService
      .listClaims(programId ? { programId } : {})
      .then((result) => {
        if (!cancelled) setFetched(result);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setSelfError(cause instanceof Error ? cause.message : 'Could not load recovery claims.');
      })
      .finally(() => {
        if (!cancelled) setSelfLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [claimsProp, programId]);

  const selected = useMemo(
    () => (claims ?? []).find((claim) => claim.id === selectedId) ?? null,
    [claims, selectedId]
  );

  if (!canManage) {
    return (
      <section
        aria-labelledby={`${uid}-heading`}
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h2 id={`${uid}-heading`} className="text-2xl font-bold text-slate-900">
          Recoveries and clawbacks
        </h2>
        <div role="note" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">You do not have permission to manage recoveries.</p>
          <p className="mt-1">
            Recovery moves money, so it is limited to finance, sponsor, and administrator roles. Ask a
            finance administrator to review this claim, or continue in the awards overview.
          </p>
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm"
      >
        Loading recovery claims…
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800 shadow-sm">
        <p className="font-semibold">Recovery claims could not be loaded.</p>
        <p className="mt-1">{error}</p>
        <p className="mt-2">Next step: retry once the recovery service is reachable, or ask finance to export the claim list.</p>
      </div>
    );
  }

  if (!claims || claims.length === 0) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600"
      >
        <p className="font-semibold text-slate-900">No recovery claims.</p>
        <p className="mt-1">
          Nothing has been reclaimed under this program. If you expected a claim here, raise one from the
          award record.
        </p>
      </div>
    );
  }

  const issueDecision = selected ? canIssueInstruction(selected) : { allowed: false, reasons: [] };
  const missingAuthorization = authorizationId.trim() === '';

  async function handleIssue() {
    if (!selected) return;
    setSubmitting(true);
    setSubmitError(null);
    setSuccess(null);
    try {
      const instruction = await onIssueInstruction?.(selected, {
        amountCents: outstandingCents(selected),
        authorizationId: authorizationId.trim(),
      });
      setSuccess(
        instruction
          ? `Recovery instruction issued for ${formatMinorUnits(instruction.amountCents, instruction.currency)} under authorization ${instruction.authorizationId}.`
          : 'Recovery instruction submitted.'
      );
    } catch (cause: unknown) {
      setSubmitError(cause instanceof Error ? cause.message : 'The recovery instruction could not be issued.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      aria-labelledby={`${uid}-heading`}
      className="mx-auto max-w-6xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Recoveries</p>
      <h2 id={`${uid}-heading`} className="mt-2 text-3xl font-black text-slate-900">
        Recoveries and clawbacks
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-slate-600">
        A recovery never silently debits a wallet. Every instruction below needs a recorded legal basis, an
        approved claim, an outstanding balance, and an explicit authorization id.
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm" aria-describedby={claimsTableCaptionId}>
          <caption id={claimsTableCaptionId} className="pb-3 text-left text-sm font-semibold text-slate-700">
            Recovery claims for this program, with outstanding balance and reconciliation status
          </caption>
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <th scope="col" className="py-2 pr-3">Claim</th>
              <th scope="col" className="py-2 pr-3">Reason</th>
              <th scope="col" className="py-2 pr-3">Legal basis</th>
              <th scope="col" className="py-2 pr-3">Status</th>
              <th scope="col" className="py-2 pr-3">Requested</th>
              <th scope="col" className="py-2 pr-3">Collected</th>
              <th scope="col" className="py-2 pr-3">Outstanding</th>
              <th scope="col" className="py-2">Reconciliation</th>
            </tr>
          </thead>
          <tbody>
            {claims.map((claim) => {
              const reconciliation = reconcileClaimRecord(claim);
              const isSelected = claim.id === selectedId;
              return (
                <tr
                  key={claim.id}
                  className="border-b border-slate-100 align-top"
                  aria-selected={isSelected}
                >
                  <th scope="row" className="py-3 pr-3 font-semibold text-slate-900">
                    <button
                      type="button"
                      onClick={() => setSelectedId(isSelected ? null : claim.id)}
                      aria-expanded={isSelected}
                      className="rounded text-indigo-700 underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    >
                      {claim.id}
                    </button>
                    <span className="block text-xs font-normal text-slate-500">Award {claim.awardId}</span>
                  </th>
                  <td className="py-3 pr-3 text-slate-700">{REASON_LABELS[claim.reason]}</td>
                  <td className="py-3 pr-3 text-slate-700">
                    {LEGAL_BASIS_LABELS[claim.legalBasis]}
                    {claim.legalBasis === 'none' && (
                      <span className="mt-1 flex items-start gap-1 text-xs font-semibold text-red-700">
                        <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5 shrink-0 motion-safe:animate-pulse" />
                        No legal basis — recovery blocked
                      </span>
                    )}
                  </td>
                  <td className="py-3 pr-3 text-slate-700">{STATUS_LABELS[claim.status]}</td>
                  <td className="py-3 pr-3 tabular-nums text-slate-700">
                    {formatMinorUnits(claim.requestedCents, claim.currency)}
                  </td>
                  <td className="py-3 pr-3 tabular-nums text-slate-700">
                    {formatMinorUnits(claim.collectedCents, claim.currency)}
                  </td>
                  <td className="py-3 pr-3 tabular-nums text-slate-700">
                    {formatMinorUnits(reconciliation.outstandingCents, claim.currency)}
                  </td>
                  <td className="py-3">
                    {reconciliation.reconciles ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
                        Balanced
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700">
                        <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5" />
                        Discrepancy of {formatMinorUnits(reconciliation.discrepancyCents, claim.currency)}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected ? (
        <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-5">
          <h3 className="text-lg font-semibold text-slate-900">Claim {selected.id}</h3>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-medium text-slate-700">Reason</dt>
              <dd className="text-slate-600">{REASON_LABELS[selected.reason]}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-700">Legal basis</dt>
              <dd className="text-slate-600">{LEGAL_BASIS_LABELS[selected.legalBasis]}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-700">Student</dt>
              <dd className="text-slate-600">{selected.studentId}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-700">Requested</dt>
              <dd className="text-slate-600">{formatMinorUnits(selected.requestedCents, selected.currency)}</dd>
            </div>
          </dl>

          {selected.legalBasis === 'none' && (
            <div role="note" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <p className="flex items-center gap-2 font-semibold">
                <ShieldAlert aria-hidden="true" className="h-4 w-4" />
                No legal basis recorded
              </p>
              <p className="mt-1">
                Funds cannot be reclaimed on a &ldquo;none&rdquo; basis. Attach the program terms, signed agreement,
                court order, or policy 9.2 reference before issuing any instruction.
              </p>
            </div>
          )}

          <div className="mt-5 space-y-3">
            <label htmlFor={authFieldId} className="block text-sm font-medium text-slate-700">
              Authorization id
              <input
                id={authFieldId}
                type="text"
                value={authorizationId}
                onChange={(event) => setAuthorizationId(event.target.value)}
                aria-invalid={missingAuthorization || undefined}
                aria-describedby={missingAuthorization ? authErrorId : undefined}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              />
            </label>
            {missingAuthorization && (
              <p id={authErrorId} className="flex items-center gap-1 text-sm text-amber-800">
                <Ban aria-hidden="true" className="h-4 w-4" />
                An authorization id is required. Without it no recovery instruction is issued and no wallet is
                debited.
              </p>
            )}
            {!issueDecision.allowed && (
              <ul className="list-disc space-y-1 pl-5 text-sm text-amber-800">
                {issueDecision.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            )}

            <button
              type="button"
              onClick={() => void handleIssue()}
              disabled={missingAuthorization || !issueDecision.allowed || submitting}
              aria-busy={submitting}
              className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Issuing recovery instruction…' : 'Issue recovery instruction'}
            </button>
            {submitting && (
              <p className="text-sm text-slate-600">Submitting the instruction for review.</p>
            )}

            {submitError && (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {submitError}
              </div>
            )}
            {success && (
              <div role="status" aria-live="polite" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                {success}
              </div>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
          Select a claim to see its reason, legal basis, and recovery controls.
        </p>
      )}
    </section>
  );
}

export default ScholarshipRecoveryPanel;
