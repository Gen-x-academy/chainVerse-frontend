'use client';

import { type FormEvent, useId, useRef, useState } from 'react';
import { disbursementService } from '../service';
import type { CreateIntentPayload, DisbursementCurrency, DisbursementIntent } from '../types';

type FormStatus = 'idle' | 'loading' | 'success' | 'error';

type Props = {
  awardId: string;
  installmentId: string;
  recipientId: string;
  recipientWalletAddress: string;
  defaultAmount?: string;
  defaultCurrency?: DisbursementCurrency;
  onSuccess?: (intent: DisbursementIntent, isNew: boolean) => void;
};

function generateIntentKey(): string {
  return `intent-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function DisbursementIntentForm({
  awardId,
  installmentId,
  recipientId,
  recipientWalletAddress,
  defaultAmount = '',
  defaultCurrency = 'XLM',
  onSuccess,
}: Props) {
  const formId = useId();
  const [amount, setAmount] = useState(defaultAmount);
  const [currency, setCurrency] = useState<DisbursementCurrency>(defaultCurrency);
  const [status, setStatus] = useState<FormStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [lastIntent, setLastIntent] = useState<DisbursementIntent | null>(null);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const intentKeyRef = useRef<string>(generateIntentKey());
  const statusRegionId = `${formId}-status`;

  const missingConfig = !recipientId || !recipientWalletAddress;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedAmount = amount.trim();
    if (!trimmedAmount || Number(trimmedAmount) <= 0) return;

    setStatus('loading');
    setErrorMessage('');

    const payload: CreateIntentPayload = {
      intentKey: intentKeyRef.current,
      awardId,
      installmentId,
      recipientId,
      recipientWalletAddress,
      amount: trimmedAmount,
      currency,
    };

    try {
      const result = await disbursementService.createIntent(payload);
      setLastIntent(result.intent);
      setIsDuplicate(!result.isNew);
      setStatus('success');
      onSuccess?.(result.intent, result.isNew);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to create intent. Please try again.');
      setStatus('error');
    }
  };

  const handleReset = () => {
    setStatus('idle');
    setErrorMessage('');
    setLastIntent(null);
    setIsDuplicate(false);
    intentKeyRef.current = generateIntentKey();
  };

  if (missingConfig) {
    return (
      <section
        aria-label="Create disbursement intent"
        className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"
        role="alert"
      >
        Recipient wallet address must be verified before a disbursement intent can be created.
      </section>
    );
  }

  return (
    <section
      aria-label="Create disbursement intent"
      className="mx-auto w-full max-w-2xl space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
          Disbursements
        </p>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Create payment intent</h2>
        <p className="text-sm text-slate-500">
          Converts an eligible installment into a stable payment intent. Submitting the same intent
          key more than once safely returns the existing record.
        </p>
      </header>

      <div
        id={statusRegionId}
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {status === 'loading' && 'Creating payment intent…'}
        {status === 'success' && (isDuplicate ? 'Duplicate key — existing intent returned.' : 'Payment intent created.')}
        {status === 'error' && `Error: ${errorMessage}`}
      </div>

      {status === 'success' && lastIntent ? (
        <div role="status" className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="font-semibold text-emerald-800">
            {isDuplicate
              ? 'Duplicate intent key — existing intent returned. No double payment will occur.'
              : 'Payment intent created successfully.'}
          </p>
          <dl className="space-y-2 text-sm text-emerald-700">
            <div className="flex justify-between gap-4">
              <dt className="font-medium text-emerald-900">Intent ID</dt>
              <dd className="break-all font-mono text-xs">{lastIntent.id}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="font-medium text-emerald-900">Intent key</dt>
              <dd className="break-all font-mono text-xs">{lastIntent.intentKey}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="font-medium text-emerald-900">Amount</dt>
              <dd>{lastIntent.amount} {lastIntent.currency}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="font-medium text-emerald-900">Recipient wallet</dt>
              <dd className="break-all font-mono text-xs">{lastIntent.recipientWalletAddress}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="font-medium text-emerald-900">Status</dt>
              <dd className="capitalize">{lastIntent.status}</dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={handleReset}
            className="mt-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
          >
            Create another
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} aria-describedby={statusRegionId} noValidate>
          <fieldset className="space-y-5" disabled={status === 'loading'}>
            <legend className="sr-only">Payment intent details</legend>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-medium text-slate-900">Recipient wallet</p>
              <p className="mt-1 break-all font-mono text-xs">{recipientWalletAddress}</p>
              <p className="mt-2 text-xs text-slate-400">
                This address is set at intent creation and cannot be changed afterwards.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label
                  htmlFor={`${formId}-amount`}
                  className="block text-sm font-medium text-slate-700"
                >
                  Amount
                  <span className="ml-1 text-red-500" aria-hidden="true">*</span>
                </label>
                <input
                  id={`${formId}-amount`}
                  type="number"
                  min="0.0000001"
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  aria-required="true"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor={`${formId}-currency`}
                  className="block text-sm font-medium text-slate-700"
                >
                  Currency
                </label>
                <select
                  id={`${formId}-currency`}
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as DisbursementCurrency)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="XLM">XLM</option>
                  <option value="USDC">USDC</option>
                </select>
              </div>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-500">
              <span className="font-medium text-slate-700">Idempotency key: </span>
              <span className="break-all font-mono">{intentKeyRef.current}</span>
            </div>

            {status === 'error' && (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={status === 'loading' || !amount.trim() || Number(amount) <= 0}
              className="w-full rounded-full bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              aria-busy={status === 'loading'}
            >
              {status === 'loading' ? 'Creating intent…' : 'Create payment intent'}
            </button>
          </fieldset>
        </form>
      )}
    </section>
  );
}

export default DisbursementIntentForm;
