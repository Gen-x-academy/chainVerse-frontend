'use client';

import { useId, useRef, useState } from 'react';
import { scheduledPaymentService } from '../service';
import type { PaymentBatchRequest, PaymentBatchResult } from '../types';
import { BatchResultSummary } from './BatchResultSummary';

type ExecutionStatus = 'idle' | 'loading' | 'success' | 'error';

type Props = {
  programId?: string;
  maxItems?: number;
  onBatchComplete?: (result: PaymentBatchResult) => void;
};

function generateBatchKey(): string {
  return `batch-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function PaymentExecutionPanel({ programId, maxItems = 50, onBatchComplete }: Props) {
  const formId = useId();
  const statusRegionId = `${formId}-status`;
  const batchKeyRef = useRef<string>(generateBatchKey());

  const [batchSize, setBatchSize] = useState(String(maxItems));
  const [dryRun, setDryRun] = useState(false);
  const [execStatus, setExecStatus] = useState<ExecutionStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [batchResult, setBatchResult] = useState<PaymentBatchResult | null>(null);

  const handleReset = () => {
    setExecStatus('idle');
    setErrorMessage('');
    setBatchResult(null);
    batchKeyRef.current = generateBatchKey();
  };

  const handleExecute = async () => {
    setExecStatus('loading');
    setErrorMessage('');

    const payload: PaymentBatchRequest = {
      batchKey: batchKeyRef.current,
      programId,
      maxItems: Number(batchSize),
      dryRun,
    };

    try {
      const result = await scheduledPaymentService.executeBatch(payload);
      setBatchResult(result);
      setExecStatus('success');
      onBatchComplete?.(result);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Batch execution failed.');
      setExecStatus('error');
    }
  };

  if (execStatus === 'success' && batchResult) {
    return (
      <div className="space-y-4">
        <BatchResultSummary result={batchResult} />
        <button
          type="button"
          onClick={handleReset}
          className="rounded-full bg-slate-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
        >
          Run another batch
        </button>
      </div>
    );
  }

  return (
    <section
      aria-label="Execute scheduled payments"
      className="mx-auto w-full max-w-2xl space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
          Disbursements
        </p>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Execute payments</h2>
        <p className="text-sm text-slate-500">
          Process due eligible installments in a bounded, idempotent batch. Each batch key can
          execute exactly once — resubmitting the same key returns the original outcome.
        </p>
      </header>

      <div id={statusRegionId} aria-live="polite" aria-atomic="true" className="sr-only">
        {execStatus === 'loading' && 'Executing payment batch…'}
        {execStatus === 'error' && `Error: ${errorMessage}`}
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <label htmlFor={`${formId}-size`} className="block text-sm font-medium text-slate-700">
            Batch size (max payments per run)
          </label>
          <input
            id={`${formId}-size`}
            type="number"
            min="1"
            max="200"
            value={batchSize}
            onChange={(e) => setBatchSize(e.target.value)}
            disabled={execStatus === 'loading'}
            className="w-40 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          />
        </div>

        <div className="flex items-center gap-3">
          <input
            id={`${formId}-dryrun`}
            type="checkbox"
            checked={dryRun}
            onChange={(e) => setDryRun(e.target.checked)}
            disabled={execStatus === 'loading'}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
          />
          <label htmlFor={`${formId}-dryrun`} className="text-sm text-slate-700">
            Dry run (simulate without submitting transactions)
          </label>
        </div>

        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-500">
          <span className="font-medium text-slate-700">Batch key: </span>
          <span className="break-all font-mono">{batchKeyRef.current}</span>
        </div>

        {execStatus === 'error' && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {errorMessage}
          </div>
        )}

        <button
          type="button"
          onClick={handleExecute}
          disabled={execStatus === 'loading' || Number(batchSize) < 1}
          aria-busy={execStatus === 'loading'}
          className="w-full rounded-full bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {execStatus === 'loading'
            ? 'Executing batch…'
            : dryRun
            ? 'Simulate batch (dry run)'
            : 'Execute payment batch'}
        </button>
      </div>
    </section>
  );
}

export default PaymentExecutionPanel;
