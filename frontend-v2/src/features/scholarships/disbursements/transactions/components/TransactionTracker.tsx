'use client';

import { useEffect, useState } from 'react';
import { transactionService } from '../service';
import type { LedgerTransaction, TransactionListParams } from '../types';
import { TransactionDetailPanel } from './TransactionDetailPanel';
import { TransactionStatusBadge } from './TransactionStatusBadge';

type Props = {
  params?: TransactionListParams;
};

export function TransactionTracker({ params }: Props) {
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [status, setStatus] = useState<'loading' | 'empty' | 'loaded' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [selected, setSelected] = useState<LedgerTransaction | null>(null);

  useEffect(() => {
    let cancelled = false;

    transactionService
      .list(params)
      .then((data) => {
        if (!cancelled) {
          setTransactions(data);
          setStatus(data.length === 0 ? 'empty' : 'loaded');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setErrorMessage(err instanceof Error ? err.message : 'Failed to load transactions.');
          setStatus('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [params]);

  if (status === 'loading') {
    return (
      <div role="status" aria-label="Loading transactions" className="space-y-2">
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
        No transactions found.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section aria-label="Transaction list">
        <div
          className="overflow-x-auto rounded-xl border border-slate-200"
          tabIndex={0}
          aria-label="Transactions table"
        >
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3 text-left">Status</th>
                <th scope="col" className="px-4 py-3 text-left">Amount</th>
                <th scope="col" className="px-4 py-3 text-left">Submitted</th>
                <th scope="col" className="px-4 py-3 text-left">TX Hash</th>
                <th scope="col" className="px-4 py-3 text-left">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <TransactionStatusBadge status={tx.status} />
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {tx.amount} {tx.currency}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {new Date(tx.submittedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">
                    {tx.txHash ? `${tx.txHash.slice(0, 10)}…` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setSelected(tx)}
                      className="text-xs text-indigo-600 hover:underline focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
                      aria-label={`View details for transaction ${tx.id}`}
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selected && (
        <TransactionDetailPanel
          transaction={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

export default TransactionTracker;
