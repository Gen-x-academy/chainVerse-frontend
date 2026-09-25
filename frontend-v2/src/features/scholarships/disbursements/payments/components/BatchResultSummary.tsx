'use client';

import type { PaymentBatchResult } from '../types';

type Props = {
  result: PaymentBatchResult;
};

const STATUS_COLOR: Record<PaymentBatchResult['status'], string> = {
  idle: 'text-slate-600',
  running: 'text-indigo-600',
  completed: 'text-emerald-700',
  partially_failed: 'text-amber-700',
  failed: 'text-red-700',
};

export function BatchResultSummary({ result }: Props) {
  const isFullSuccess = result.status === 'completed' && result.failureCount === 0;

  return (
    <section
      aria-label="Batch execution result"
      className={`space-y-4 rounded-2xl border p-5 ${
        isFullSuccess
          ? 'border-emerald-200 bg-emerald-50'
          : result.status === 'partially_failed'
          ? 'border-amber-200 bg-amber-50'
          : result.status === 'failed'
          ? 'border-red-200 bg-red-50'
          : 'border-slate-200 bg-slate-50'
      }`}
    >
      <header className="flex items-center justify-between gap-4">
        <h3 className="font-semibold text-slate-900">Batch result</h3>
        <span className={`text-sm font-medium capitalize ${STATUS_COLOR[result.status]}`}>
          {result.status.replace('_', ' ')}
        </span>
      </header>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 text-sm">
        <div className="rounded-lg bg-white/70 p-3">
          <dt className="text-xs text-slate-500">Total</dt>
          <dd className="text-lg font-bold text-slate-900">{result.totalItems}</dd>
        </div>
        <div className="rounded-lg bg-white/70 p-3">
          <dt className="text-xs text-emerald-600">Succeeded</dt>
          <dd className="text-lg font-bold text-emerald-700">{result.successCount}</dd>
        </div>
        <div className="rounded-lg bg-white/70 p-3">
          <dt className="text-xs text-red-500">Failed</dt>
          <dd className="text-lg font-bold text-red-600">{result.failureCount}</dd>
        </div>
      </dl>

      <p className="text-xs text-slate-500 font-mono break-all">
        Batch ID: {result.batchId}
      </p>

      {result.outcomes.some((o) => !o.success) && (
        <details className="text-sm">
          <summary className="cursor-pointer font-medium text-amber-800 hover:underline focus:outline-none focus:ring-2 focus:ring-amber-500 rounded">
            Show {result.failureCount} failed item{result.failureCount !== 1 ? 's' : ''}
          </summary>
          <ul className="mt-3 space-y-2" role="list">
            {result.outcomes
              .filter((o) => !o.success)
              .map((o) => (
                <li
                  key={o.scheduledPaymentId}
                  className="rounded-lg border border-red-200 bg-white p-3"
                >
                  <p className="font-mono text-xs text-slate-700">{o.scheduledPaymentId}</p>
                  {o.failureReason && (
                    <p className="mt-1 text-xs text-red-700">{o.failureReason}</p>
                  )}
                </li>
              ))}
          </ul>
        </details>
      )}
    </section>
  );
}

export default BatchResultSummary;
