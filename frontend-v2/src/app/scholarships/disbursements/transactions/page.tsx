'use client';

import { TransactionTracker } from '@/src/features/scholarships/disbursements/transactions';

export default function TransactionsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-10">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Transaction Tracker
        </h1>
        <p className="mt-2 text-slate-600">
          Monitor submitted, pending, successful, failed, expired, and reversed scholarship
          payment transactions. State follows verified on-chain evidence.
        </p>
      </header>

      <TransactionTracker />
    </div>
  );
}
