'use client';

import React, { useId, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useCancelAward, useTerminateAward } from '../hooks/useScholarships';
import type {
  AwardCancellation,
  AwardRecord,
  CancellationAuthority,
  CancellationReason,
  FinancialConsequence,
  TerminationReason,
} from '../types/scholarship.types';

type CancelType = 'cancellation' | 'termination';
type FormStatus = 'idle' | 'confirming' | 'loading' | 'success' | 'error';

const CANCELLATION_REASONS: { value: CancellationReason; label: string }[] = [
  { value: 'applicant_request', label: 'Applicant request' },
  { value: 'eligibility_lost', label: 'Eligibility lost' },
  { value: 'terms_violation', label: 'Terms violation' },
  { value: 'funding_withdrawn', label: 'Funding withdrawn' },
  { value: 'administrative', label: 'Administrative decision' },
];

const TERMINATION_REASONS: { value: TerminationReason; label: string }[] = [
  { value: 'academic_failure', label: 'Academic failure' },
  { value: 'terms_violation', label: 'Terms violation' },
  { value: 'fraud_confirmed', label: 'Fraud confirmed' },
  { value: 'program_ended', label: 'Program ended' },
  { value: 'mutual_agreement', label: 'Mutual agreement' },
];

const FINANCIAL_CONSEQUENCES: { value: FinancialConsequence; label: string; description: string }[] = [
  { value: 'none', label: 'No recovery', description: 'No funds will be recovered.' },
  {
    value: 'partial_recovery',
    label: 'Partial recovery',
    description: 'A specified amount will be recovered.',
  },
  {
    value: 'full_recovery',
    label: 'Full recovery',
    description: 'All disbursed funds will be recovered.',
  },
];

export interface AwardCancellationFormProps {
  award: AwardRecord;
  authority: CancellationAuthority;
  authorityId: string;
  onSuccess?: (cancellation: AwardCancellation) => void;
}

export function AwardCancellationForm({
  award,
  authority,
  authorityId,
  onSuccess,
}: AwardCancellationFormProps) {
  const formId = useId();
  const [cancelType, setCancelType] = useState<CancelType>('cancellation');
  const [cancellationReason, setCancellationReason] = useState<CancellationReason>(
    'applicant_request'
  );
  const [terminationReason, setTerminationReason] = useState<TerminationReason>('academic_failure');
  const [financialConsequence, setFinancialConsequence] = useState<FinancialConsequence>('none');
  const [recoveryDollars, setRecoveryDollars] = useState('');
  const [formStatus, setFormStatus] = useState<FormStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [result, setResult] = useState<AwardCancellation | null>(null);
  const clientTokenRef = useRef(`${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

  const cancelMutation = useCancelAward();
  const terminateMutation = useTerminateAward();

  const needsRecoveryAmount = financialConsequence === 'partial_recovery';
  const recoveryAmountCents = needsRecoveryAmount
    ? Math.round(parseFloat(recoveryDollars || '0') * 100)
    : undefined;

  const canSubmit =
    formStatus !== 'loading' &&
    (!needsRecoveryAmount || recoveryAmountCents! > 0);

  async function handleConfirm() {
    setFormStatus('loading');
    setErrorMessage('');

    try {
      let cancellation: AwardCancellation;

      if (cancelType === 'cancellation') {
        cancellation = await cancelMutation.mutateAsync({
          awardId: award.id,
          reason: cancellationReason,
          authority,
          financialConsequence,
          recoveryAmountCents,
          clientToken: clientTokenRef.current,
        });
      } else {
        cancellation = await terminateMutation.mutateAsync({
          awardId: award.id,
          reason: terminationReason,
          authority,
          financialConsequence,
          recoveryAmountCents,
          clientToken: clientTokenRef.current,
        });
      }

      setResult(cancellation);
      setFormStatus('success');
      onSuccess?.(cancellation);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Action failed. Please try again.');
      setFormStatus('error');
      clientTokenRef.current = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }
  }

  if (formStatus === 'success' && result) {
    return (
      <div
        role="status"
        className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-6"
      >
        <h2 className="text-lg font-semibold text-slate-900 capitalize">
          Award {result.type} recorded
        </h2>
        <p className="text-sm text-slate-600">
          Future payments for this award have been stopped.
          {result.financialConsequence !== 'none' &&
            ` A recovery of ${result.financialConsequence === 'full_recovery' ? 'full disbursed amount' : `${((result.recoveryAmountCents ?? 0) / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`} has been initiated.`}
        </p>
        <p className="text-xs text-slate-500">
          A notification has been queued for the recipient.
          {result.notificationSentAt
            ? ` Sent at ${new Date(result.notificationSentAt).toLocaleString()}.`
            : ' Delivery pending.'}
        </p>
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Record ID</dt>
            <dd className="font-mono text-xs break-all text-slate-700">{result.id}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Type</dt>
            <dd className="capitalize text-slate-700">{result.type}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Reason</dt>
            <dd className="text-slate-700">{result.reason.replace(/_/g, ' ')}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Authority</dt>
            <dd className="text-slate-700">{result.authority}</dd>
          </div>
        </dl>
      </div>
    );
  }

  if (formStatus === 'confirming') {
    const reason =
      cancelType === 'cancellation'
        ? CANCELLATION_REASONS.find((r) => r.value === cancellationReason)?.label
        : TERMINATION_REASONS.find((r) => r.value === terminationReason)?.label;

    return (
      <div
        role="alertdialog"
        aria-labelledby={`${formId}-confirm-title`}
        aria-describedby={`${formId}-confirm-desc`}
        className="space-y-5 rounded-2xl border border-red-200 bg-red-50 p-6"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-red-500" aria-hidden="true" />
          <div>
            <h2
              id={`${formId}-confirm-title`}
              className="text-lg font-semibold text-red-900"
            >
              Confirm {cancelType}
            </h2>
            <p id={`${formId}-confirm-desc`} className="mt-1 text-sm text-red-700">
              You are about to <strong>{cancelType}</strong> award{' '}
              <strong>{award.id}</strong> with reason <strong>{reason}</strong>.{' '}
              {cancelType === 'termination'
                ? 'Future payments will stop immediately and a recovery process may begin.'
                : 'The offer will be voided and no disbursements will proceed.'}
              {' '}The recipient will be notified. This action cannot be undone.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={formStatus === 'loading'}
            aria-busy={formStatus === 'loading'}
            className="flex-1 rounded-full bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {formStatus === 'loading' ? 'Processing…' : `Confirm ${cancelType}`}
          </button>
          <button
            type="button"
            onClick={() => setFormStatus('idle')}
            disabled={formStatus === 'loading'}
            className="flex-1 rounded-full border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:opacity-50"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <section
      aria-label="Cancel or terminate award"
      className="mx-auto w-full max-w-2xl space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-red-600">
          Award management
        </p>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          Cancel or terminate award
        </h2>
        <p className="text-sm text-slate-500">
          Cancellation voids a pre-payment offer. Termination stops an active post-payment award.
          Both actions notify the recipient and stop future disbursements.
        </p>
      </header>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
        <p className="font-medium text-slate-700">Award: <span className="font-mono text-xs">{award.id}</span></p>
        <p className="text-slate-500 mt-0.5">Authority: {authority} ({authorityId})</p>
      </div>

      <fieldset className="space-y-5">
        <legend className="sr-only">Cancellation details</legend>

        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700" id={`${formId}-type-label`}>
            Action type
          </p>
          <div
            role="radiogroup"
            aria-labelledby={`${formId}-type-label`}
            className="flex gap-3"
          >
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="radio"
                name={`${formId}-type`}
                value="cancellation"
                checked={cancelType === 'cancellation'}
                onChange={() => setCancelType('cancellation')}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
              />
              Cancellation (pre-payment)
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="radio"
                name={`${formId}-type`}
                value="termination"
                checked={cancelType === 'termination'}
                onChange={() => setCancelType('termination')}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
              />
              Termination (post-payment)
            </label>
          </div>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor={`${formId}-reason`}
            className="block text-sm font-medium text-slate-700"
          >
            Reason
          </label>
          {cancelType === 'cancellation' ? (
            <select
              id={`${formId}-reason`}
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value as CancellationReason)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {CANCELLATION_REASONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          ) : (
            <select
              id={`${formId}-reason`}
              value={terminationReason}
              onChange={(e) => setTerminationReason(e.target.value as TerminationReason)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {TERMINATION_REASONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700" id={`${formId}-consequence-label`}>
            Financial consequence
          </p>
          <div
            role="radiogroup"
            aria-labelledby={`${formId}-consequence-label`}
            className="space-y-2"
          >
            {FINANCIAL_CONSEQUENCES.map((fc) => (
              <label
                key={fc.value}
                className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm cursor-pointer hover:bg-slate-100"
              >
                <input
                  type="radio"
                  name={`${formId}-consequence`}
                  value={fc.value}
                  checked={financialConsequence === fc.value}
                  onChange={() => setFinancialConsequence(fc.value)}
                  className="mt-0.5 h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="font-medium text-slate-800">{fc.label}</span>
                  <span className="ml-2 text-slate-500">{fc.description}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {needsRecoveryAmount && (
          <div className="space-y-1.5">
            <label
              htmlFor={`${formId}-recovery`}
              className="block text-sm font-medium text-slate-700"
            >
              Recovery amount <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <input
              id={`${formId}-recovery`}
              type="number"
              min="0.01"
              step="0.01"
              value={recoveryDollars}
              onChange={(e) => setRecoveryDollars(e.target.value)}
              required
              aria-required="true"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Amount to recover"
            />
          </div>
        )}
      </fieldset>

      {formStatus === 'error' && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {errorMessage}
        </div>
      )}

      <button
        type="button"
        onClick={() => setFormStatus('confirming')}
        disabled={!canSubmit}
        className="w-full rounded-full bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Review and submit
      </button>
    </section>
  );
}

export default AwardCancellationForm;
