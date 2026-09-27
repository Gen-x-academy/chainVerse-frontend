'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import {
  assessRetention,
  daysUntilExpiry,
  describeErasurePlan,
  findActiveHold,
  isDeletableClass,
  planErasure,
  scholarshipRetentionService,
} from '../service';
import type {
  LegalHold,
  RecordClass,
  RetentionPolicy,
  RetentionRecord,
} from '../types';

type ScholarshipRetentionPanelProps = {
  canManage?: boolean;
  operatorId?: string;
  records?: RetentionRecord[];
  now?: Date;
};

const INPUT_CLASS =
  'mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:bg-slate-100';

const DEFAULT_RECORDS: RetentionRecord[] = [
  { id: 'rec-draft-1', applicantId: 'applicant-001', class: 'draft', createdAt: '2025-01-05T09:00:00.000Z' },
  { id: 'rec-withdrawn-1', applicantId: 'applicant-001', class: 'withdrawn', createdAt: '2024-06-01T09:00:00.000Z' },
  { id: 'rec-awarded-1', applicantId: 'applicant-001', class: 'awarded', createdAt: '2024-02-01T09:00:00.000Z' },
  { id: 'rec-financial-1', applicantId: 'applicant-001', class: 'financial', createdAt: '2024-02-02T09:00:00.000Z' },
  { id: 'rec-audit-1', applicantId: 'applicant-001', class: 'audit', createdAt: '2024-02-03T09:00:00.000Z' },
];

export function ScholarshipRetentionPanel({
  canManage = true,
  operatorId = 'privacy-officer',
  records = DEFAULT_RECORDS,
  now,
}: ScholarshipRetentionPanelProps) {
  const baseId = useId();
  const applicantIdInputId = `${baseId}-applicant`;
  const reasonId = `${baseId}-reason`;
  const reasonErrorId = `${baseId}-reason-error`;

  const [policy, setPolicy] = useState<RetentionPolicy | null>(null);
  const [holds, setHolds] = useState<LegalHold[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applicantId, setApplicantId] = useState('applicant-001');
  const [holdReason, setHoldReason] = useState('');
  const [holdScope, setHoldScope] = useState<RecordClass[]>(['draft']);
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reference = useMemo(() => now ?? new Date(), [now]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [loadedPolicy, loadedHolds] = await Promise.all([
        scholarshipRetentionService.getPolicy(),
        scholarshipRetentionService.listHolds(),
      ]);
      setPolicy(loadedPolicy);
      setHolds(loadedHolds ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Unable to load the retention policy.'
      );
      setPolicy(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const plan = useMemo(
    () => (policy ? planErasure(policy, records, holds, applicantId.trim(), reference) : null),
    [policy, records, holds, applicantId, reference]
  );

  if (loading) {
    return (
      <div
        className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm"
        role="status"
        aria-live="polite"
      >
        Loading the retention policy, legal holds, and erasure plan...
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700"
        role="alert"
      >
        <p className="font-semibold">The retention policy could not be loaded.</p>
        <p className="mt-2">{error}</p>
        <p className="mt-2">
          Nothing is deleted while the policy is unknown — erasure stays blocked.
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-3 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-200"
        >
          Retry loading the policy
        </button>
      </div>
    );
  }

  if (!policy || policy.rules.length === 0) {
    return (
      <div
        className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600"
        role="status"
        aria-live="polite"
      >
        <p className="font-semibold text-slate-900">No retention rules are approved yet.</p>
        <p className="mt-2">
          A version approved by Privacy and Legal is required before any record can expire.
        </p>
      </div>
    );
  }

  const toggleScope = (recordClass: RecordClass) => {
    setHoldScope((current) =>
      current.includes(recordClass)
        ? current.filter((item) => item !== recordClass)
        : [...current, recordClass]
    );
  };

  const placeHold = async () => {
    if (holdReason.trim().length < 8) {
      setReasonError('Give a reason of at least 8 characters — the hold is auditable.');
      return;
    }
    if (holdScope.length === 0) {
      setReasonError('Select at least one record class the hold covers.');
      return;
    }
    setReasonError(null);
    setBusy(true);
    setActionError(null);
    try {
      const hold: LegalHold = {
        id: `hold-${Date.now().toString(36)}`,
        subjectId: applicantId.trim() || 'applicant-001',
        scope: holdScope,
        reason: holdReason.trim(),
        placedAt: new Date().toISOString(),
        placedBy: operatorId,
      };
      const placed = await scholarshipRetentionService.placeHold(hold);
      setHolds((current) => [placed, ...current]);
      setHoldReason('');
      setStatus(`Placed legal hold ${placed.id} on ${placed.scope.join(', ')}.`);
    } catch (holdError) {
      setActionError(
        holdError instanceof Error ? holdError.message : 'Unable to place the legal hold.'
      );
    } finally {
      setBusy(false);
    }
  };

  const releaseHold = async (holdId: string) => {
    setBusy(true);
    setActionError(null);
    try {
      const released = await scholarshipRetentionService.releaseHold(holdId, operatorId);
      setHolds((current) =>
        current.map((hold) => (hold.id === holdId ? released : hold))
      );
      setStatus(`Released legal hold ${holdId}. Covered records are re-assessed immediately.`);
    } catch (releaseError) {
      setActionError(
        releaseError instanceof Error ? releaseError.message : 'Unable to release the legal hold.'
      );
    } finally {
      setBusy(false);
    }
  };

  const applicantRecords = records.filter((record) => record.applicantId === applicantId.trim());

  return (
    <section
      className="mx-auto max-w-5xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      aria-labelledby={`${baseId}-heading`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
            Retention and erasure
          </p>
          <h2 id={`${baseId}-heading`} className="mt-2 text-3xl font-black text-slate-900">
            Data retention policy
          </h2>
        </div>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
          Policy v{policy.version}
        </span>
      </div>

      {!canManage && (
        <div
          className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
          role="note"
        >
          <p className="font-semibold">You do not have permission to place or release holds.</p>
          <p className="mt-1">
            The policy is shown read-only. Ask the privacy officer, a finance operator, or an
            administrator to act.
          </p>
        </div>
      )}

      <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
        Financial and audit integrity is never broken: settled disbursements and the audit trail
        are never deletable, whatever the retention window says, and an active legal hold always
        wins.
      </p>

      {status && (
        <div
          className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
          role="status"
          aria-live="polite"
        >
          {status}
        </div>
      )}

      {actionError && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          <p className="font-semibold">The legal hold action failed.</p>
          <p className="mt-1">{actionError}</p>
          <p className="mt-1">No hold state changed — try the action again.</p>
        </div>
      )}

      <section className="mt-6" aria-labelledby={`${baseId}-rules-heading`}>
        <h3 id={`${baseId}-rules-heading`} className="text-lg font-semibold text-slate-900">
          Retention rules
        </h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">
              Retention rule per record class with its legal basis and deletability
            </caption>
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-600">
                <th scope="col" className="border-b border-slate-200 py-2 pr-3">Class</th>
                <th scope="col" className="border-b border-slate-200 py-2 pr-3">Retention</th>
                <th scope="col" className="border-b border-slate-200 py-2 pr-3">Basis</th>
                <th scope="col" className="border-b border-slate-200 py-2 pr-3">Legal basis</th>
                <th scope="col" className="border-b border-slate-200 py-2 pr-3">Deletable</th>
                <th scope="col" className="border-b border-slate-200 py-2">Owner</th>
              </tr>
            </thead>
            <tbody>
              {policy.rules.map((rule) => (
                <tr key={rule.recordClass} className="align-top">
                  <th scope="row" className="py-2 pr-3 font-semibold text-slate-900">
                    {rule.recordClass}
                  </th>
                  <td className="py-2 pr-3 text-slate-700">
                    {rule.retentionDays === null ? 'indefinite' : `${rule.retentionDays} days`}
                  </td>
                  <td className="py-2 pr-3 text-slate-700">{rule.basis}</td>
                  <td className="py-2 pr-3 text-slate-600">{rule.legalBasis}</td>
                  <td className="py-2 pr-3 text-slate-700">
                    {isDeletableClass(rule.recordClass) && rule.deletable
                      ? 'Yes, after the window'
                      : 'No — protected'}
                  </td>
                  <td className="py-2 text-slate-600">{rule.owner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8" aria-labelledby={`${baseId}-holds-heading`}>
        <h3 id={`${baseId}-holds-heading`} className="text-lg font-semibold text-slate-900">
          Legal holds
        </h3>

        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
            <label htmlFor={applicantIdInputId} className="block text-sm font-medium text-slate-700">
              Subject (applicant or record id)
            </label>
            <input
              id={applicantIdInputId}
              type="text"
              value={applicantId}
              onChange={(event) => setApplicantId(event.target.value)}
              className={INPUT_CLASS}
            />

            <fieldset className="mt-4">
              <legend className="text-sm font-medium text-slate-700">Scope</legend>
              <div className="mt-2 grid gap-1 sm:grid-cols-2">
                {policy.rules.map((rule) => {
                  const id = `${baseId}-scope-${rule.recordClass}`;
                  return (
                    <div key={rule.recordClass} className="flex items-center gap-2">
                      <input
                        id={id}
                        type="checkbox"
                        checked={holdScope.includes(rule.recordClass)}
                        disabled={!canManage}
                        onChange={() => toggleScope(rule.recordClass)}
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      />
                      <label htmlFor={id} className="text-sm text-slate-700">
                        {rule.recordClass}
                      </label>
                    </div>
                  );
                })}
              </div>
            </fieldset>

            <label htmlFor={reasonId} className="mt-4 block text-sm font-medium text-slate-700">
              Reason
            </label>
            <input
              id={reasonId}
              type="text"
              value={holdReason}
              disabled={!canManage}
              aria-invalid={reasonError ? true : undefined}
              aria-describedby={reasonError ? reasonErrorId : undefined}
              onChange={(event) => setHoldReason(event.target.value)}
              className={INPUT_CLASS}
            />
            {reasonError && (
              <p id={reasonErrorId} role="alert" className="mt-1 text-sm text-red-700">
                {reasonError}
              </p>
            )}

            <button
              type="button"
              disabled={!canManage || busy}
              aria-busy={busy}
              onClick={() => void placeHold()}
              className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? 'Working...' : 'Place legal hold'}
            </button>
            {!canManage && (
              <p className="mt-2 text-sm text-amber-800">
                Placing a hold is disabled for your role — contact the privacy officer.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
            <h4 className="text-sm font-semibold text-slate-900">Active holds</h4>
            {holds.length === 0 ? (
              <p
                className="mt-2 text-sm text-slate-600"
                role="status"
                aria-live="polite"
              >
                No legal hold is active. Records follow their retention rule.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {holds.map((hold) => (
                  <li key={hold.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                    <p className="font-semibold text-slate-900">{hold.id}</p>
                    <p className="mt-1 text-slate-700">
                      {hold.reason} — covers {hold.scope.join(', ')} for {hold.subjectId}.
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Placed by {hold.placedBy} at {hold.placedAt}
                      {hold.releasedAt ? ` · released ${hold.releasedAt}` : ''}
                    </p>
                    <button
                      type="button"
                      disabled={!canManage || busy || Boolean(hold.releasedAt)}
                      aria-busy={busy}
                      onClick={() => void releaseHold(hold.id)}
                      className="mt-2 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Release {hold.id}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section className="mt-8" aria-labelledby={`${baseId}-erasure-heading`}>
        <h3 id={`${baseId}-erasure-heading`} className="text-lg font-semibold text-slate-900">
          Erasure preview
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          A dry run for {applicantId || 'no applicant selected'}. Nothing is deleted from this
          screen.
        </p>

        {!plan || applicantRecords.length === 0 ? (
          <div
            className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600"
            role="status"
            aria-live="polite"
          >
            <p className="font-semibold text-slate-900">No records found for this applicant.</p>
            <p className="mt-1">Check the subject id, or choose an applicant that has submitted.</p>
          </div>
        ) : (
          <>
            <p
              className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"
              role="status"
              aria-live="polite"
            >
              {describeErasurePlan(plan)}
            </p>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <h4 className="text-sm font-semibold text-emerald-900">
                  Will be deleted ({plan.deletable.length})
                </h4>
                {plan.deletable.length === 0 ? (
                  <p className="mt-2 text-sm text-emerald-800">
                    Nothing qualifies for deletion — every record is still inside a retention
                    window, under a legal hold, or integrity-protected.
                  </p>
                ) : (
                  <ul aria-label="Records to delete" className="mt-2 space-y-1 text-sm text-emerald-900">
                    {plan.deletable.map((recordId) => (
                      <li key={recordId}>{recordId}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <h4 className="text-sm font-semibold text-amber-900">
                  Protected ({plan.protected.length})
                </h4>
                {plan.protected.length === 0 ? (
                  <p className="mt-2 text-sm text-amber-800">No protected records for this applicant.</p>
                ) : (
                  <ul aria-label="Protected records" className="mt-2 space-y-2 text-sm text-amber-900">
                    {plan.protected.map((entry) => {
                      const record = records.find((item) => item.id === entry.recordId);
                      const rule = policy.rules.find((item) => item.recordClass === entry.class);
                      const hold = record ? findActiveHold(record, holds) : undefined;
                      const assessment = rule && record
                        ? assessRetention(rule, record, reference, holds)
                        : null;
                      return (
                        <li key={entry.recordId}>
                          <span className="font-semibold">{entry.recordId}</span> — {entry.class},
                          retained on a {entry.basis} basis.
                          <span className="block text-xs text-amber-800">
                            {hold
                              ? `Blocked by legal hold ${hold.id}.`
                              : (assessment?.reason ?? 'No rule is defined for this class.')}
                            {rule && record
                              ? ` Days remaining: ${
                                  daysUntilExpiry(record, rule, reference) ?? 'indefinite'
                                }.`
                              : ''}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            {plan.blockedByHolds.length > 0 && (
              <p className="mt-3 text-sm text-slate-700">
                Blocked by legal hold(s): {plan.blockedByHolds.join(', ')}.
              </p>
            )}
          </>
        )}
      </section>
    </section>
  );
}
