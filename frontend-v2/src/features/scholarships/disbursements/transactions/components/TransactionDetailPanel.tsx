'use client';

import type { LedgerTransaction } from '../types';
import { TransactionStatusBadge } from './TransactionStatusBadge';

type Props = {
  transaction: LedgerTransaction;
  onClose?: () => void;
};

export function TransactionDetailPanel({ transaction: tx, onClose }: Props) {
  return (
    <section
      aria-label="Transaction details"
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <header className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-slate-900">Transaction details</h3>
          <p className="mt-0.5 font-mono text-xs text-slate-400 break-all">{tx.id}</p>
        </div>
        <TransactionStatusBadge status={tx.status} />
      </header>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium text-slate-500">Amount</dt>
          <dd className="font-semibold text-slate-900">{tx.amount} {tx.currency}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500">Network</dt>
          <dd className="capitalize text-slate-700">{tx.network}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-medium text-slate-500">Recipient wallet</dt>
          <dd className="break-all font-mono text-xs text-slate-700">{tx.recipientWalletAddress}</dd>
        </div>
        {tx.txHash && (
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium text-slate-500">Transaction hash</dt>
            <dd className="break-all font-mono text-xs text-slate-700">{tx.txHash}</dd>
          </div>
        )}
        {tx.ledgerSequence !== undefined && (
          <div>
            <dt className="text-xs font-medium text-slate-500">Ledger sequence</dt>
            <dd className="text-slate-700">{tx.ledgerSequence}</dd>
          </div>
        )}
        <div>
          <dt className="text-xs font-medium text-slate-500">Confirmations</dt>
          <dd className="text-slate-700">
            {tx.currentConfirmations} / {tx.requiredConfirmations}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500">Submitted</dt>
          <dd className="text-slate-700">{new Date(tx.submittedAt).toLocaleString()}</dd>
        </div>
        {tx.finalizedAt && (
          <div>
            <dt className="text-xs font-medium text-slate-500">Finalized</dt>
            <dd className="text-slate-700">{new Date(tx.finalizedAt).toLocaleString()}</dd>
          </div>
        )}
      </dl>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1"
        >
          Close
        </button>
      )}
    </section>
  );
}

export default TransactionDetailPanel;
