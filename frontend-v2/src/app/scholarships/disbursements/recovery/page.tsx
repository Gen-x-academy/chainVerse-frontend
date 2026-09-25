'use client';

import { FailureRecoveryPanel } from '@/src/features/scholarships/disbursements/recovery';

export default function RecoveryPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Payout Failure Recovery
        </h1>
        <p className="mt-2 text-slate-600">
          Surface and recover from missing trustlines, bad destinations, insufficient funds,
          and network expiry. Award eligibility is preserved through the recovery process.
        </p>
      </header>

      <FailureRecoveryPanel />
    </div>
  );
}
