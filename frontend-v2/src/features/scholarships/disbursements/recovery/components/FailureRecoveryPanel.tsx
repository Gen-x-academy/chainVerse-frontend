'use client';

import { useEffect, useRef, useState } from 'react';
import { recoveryService } from '../service';
import type { PayoutFailure, RetryResult } from '../types';
import { DiagnosticsReport } from './DiagnosticsReport';
import { TrustlineGuidanceAlert } from './TrustlineGuidanceAlert';

type Props = {
  programId?: string;
  awardId?: string;
};

type RetryStatus = 'idle' | 'loading' | 'success' | 'error';

function generateEnvelopeKey(): string {
  return `retry-env-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function FailureRecoveryPanel({ programId, awardId }: Props) {
  const [failures, setFailures] = useState<PayoutFailure[]>([]);
  const [listStatus, setListStatus] = useState<'loading' | 'empty' | 'loaded' | 'error'>('loading');
  const [listError, setListError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [retryStatuses, setRetryStatuses] = useState<Record<string, RetryStatus>>({});
  const [retryResults, setRetryResults] = useState<Record<string, RetryResult>>({});
  const [retryErrors, setRetryErrors] = useState<Record<string, string>>({});
  const envelopeKeys = useRef<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    recoveryService
      .listFailures({ programId, awardId })
      .then((data) => {
        if (!cancelled) {
          setFailures(data);
          setListStatus(data.length === 0 ? 'empty' : 'loaded');
          data.forEach((f) => {
            envelopeKeys.current[f.id] = generateEnvelopeKey();
          });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setListError(err instanceof Error ? err.message : 'Failed to load failures.');
          setListStatus('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [programId, awardId]);

  const handleRetry = async (failure: PayoutFailure) => {
    const envelopeKey = envelopeKeys.current[failure.id] ?? generateEnvelopeKey();

    setRetryStatuses((prev) => ({ ...prev, [failure.id]: 'loading' }));
    setRetryErrors((prev) => { const next = { ...prev }; delete next[failure.id]; return next; });

    try {
      const result = await recoveryService.retry({
        failureId: failure.id,
        newEnvelopeKey: envelopeKey,
      });
      setRetryResults((prev) => ({ ...prev, [failure.id]: result }));
      setRetryStatuses((prev) => ({ ...prev, [failure.id]: 'success' }));
      envelopeKeys.current[failure.id] = generateEnvelopeKey();
    } catch (err) {
      setRetryErrors((prev) => ({
        ...prev,
        [failure.id]: err instanceof Error ? err.message : 'Retry failed.',
      }));
      setRetryStatuses((prev) => ({ ...prev, [failure.id]: 'error' }));
    }
  };

  if (listStatus === 'loading') {
    return (
      <div role="status" aria-label="Loading failures" className="space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100" aria-hidden="true" />
        ))}
      </div>
    );
  }

  if (listStatus === 'error') {
    return (
      <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        {listError}
      </div>
    );
  }

  if (listStatus === 'empty') {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center text-sm text-emerald-700">
        No payout failures to recover. All payments are healthy.
      </div>
    );
  }

  return (
    <section aria-label="Payout failure recovery">
      <p className="mb-3 text-xs text-slate-500">
        {failures.length} failure{failures.length !== 1 ? 's' : ''} requiring attention
      </p>
      <ul className="space-y-3" role="list">
        {failures.map((failure) => {
          const retryStatus = retryStatuses[failure.id] ?? 'idle';
          const retryResult = retryResults[failure.id];
          const retryError = retryErrors[failure.id];
          const canRetry = failure.recoveryStatus === 'open' && failure.retryCount < failure.maxRetries;

          return (
            <li
              key={failure.id}
              className="rounded-xl border border-slate-200 bg-white p-4 space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-slate-900">
                    {failure.amount} {failure.currency}
                    <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 capitalize">
                      {failure.failureReason.replace(/_/g, ' ')}
                    </span>
                  </p>
                  <p className="text-xs text-slate-500">
                    Recipient: <span className="font-mono">{failure.recipientId}</span>
                  </p>
                  <p className="text-xs text-slate-400">
                    Retries: {failure.retryCount}/{failure.maxRetries} · Failed{' '}
                    {new Date(failure.failedAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setExpandedId(expandedId === failure.id ? null : failure.id)}
                    aria-expanded={expandedId === failure.id}
                    aria-controls={`diagnostics-${failure.id}`}
                    className="text-xs text-slate-600 underline hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 rounded"
                  >
                    {expandedId === failure.id ? 'Hide' : 'Diagnostics'}
                  </button>

                  {canRetry && retryStatus !== 'success' && (
                    <button
                      type="button"
                      onClick={() => handleRetry(failure)}
                      disabled={retryStatus === 'loading'}
                      aria-busy={retryStatus === 'loading'}
                      className="rounded-full bg-indigo-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {retryStatus === 'loading' ? 'Retrying…' : 'Retry'}
                    </button>
                  )}
                </div>
              </div>

              {failure.failureReason === 'missing_trustline' && (
                <TrustlineGuidanceAlert
                  recipientWalletAddress={failure.recipientWalletAddress}
                  assetCode={failure.currency}
                />
              )}

              {retryError && (
                <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-800">
                  {retryError}
                </div>
              )}

              {retryStatus === 'success' && retryResult && (
                <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-800">
                  Retry enqueued. New intent:{' '}
                  <span className="font-mono">{retryResult.newDisbursementIntentId}</span>
                </div>
              )}

              {expandedId === failure.id && (
                <div id={`diagnostics-${failure.id}`}>
                  <DiagnosticsReport failureId={failure.id} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default FailureRecoveryPanel;
