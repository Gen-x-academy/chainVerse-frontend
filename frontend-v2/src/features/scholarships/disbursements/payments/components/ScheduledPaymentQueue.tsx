'use client';

import { useEffect, useState } from 'react';
import { scheduledPaymentService } from '../service';
import type { ScheduledPayment } from '../types';

type Props = {
  programId?: string;
  limit?: number;
  onSelectPayment?: (payment: ScheduledPayment) => void;
  selectedIds?: Set<string>;
};

export function ScheduledPaymentQueue({ programId, limit = 50, onSelectPayment, selectedIds }: Props) {
  const [payments, setPayments] = useState<ScheduledPayment[]>([]);
  const [status, setStatus] = useState<'loading' | 'empty' | 'loaded' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    scheduledPaymentService
      .listDue({ programId, limit })
      .then((data) => {
        if (!cancelled) {
          setPayments(data);
          setStatus(data.length === 0 ? 'empty' : 'loaded');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setErrorMessage(err instanceof Error ? err.message : 'Failed to load scheduled payments.');
          setStatus('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [programId, limit]);

  if (status === 'loading') {
    return (
      <div role="status" aria-label="Loading scheduled payments" className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" aria-hidden="true" />
        ))}
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        {errorMessage}
      </div>
    );
  }

  if (status === 'empty') {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
        No payments due at this time.
      </div>
    );
  }

  return (
    <section aria-label="Scheduled payments due">
      <p className="mb-2 text-xs text-slate-500">{payments.length} payment{payments.length !== 1 ? 's' : ''} due</p>
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white" role="list">
        {payments.map((payment) => {
          const isSelected = selectedIds?.has(payment.id) ?? false;
          return (
            <li key={payment.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900 truncate">
                  Recipient: <span className="font-mono">{payment.recipientId}</span>
                </p>
                <p className="text-xs text-slate-500">
                  {payment.amount} {payment.currency} · due{' '}
                  {new Date(payment.scheduledAt).toLocaleDateString()}
                </p>
              </div>
              {onSelectPayment && (
                <button
                  type="button"
                  onClick={() => onSelectPayment(payment)}
                  aria-pressed={isSelected}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 ${
                    isSelected
                      ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                      : 'border border-slate-300 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {isSelected ? 'Selected' : 'Select'}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default ScheduledPaymentQueue;
