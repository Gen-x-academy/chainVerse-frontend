'use client';

import { PaymentExecutionPanel, ScheduledPaymentQueue } from '@/src/features/scholarships/disbursements/payments';

export default function PaymentsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-10 px-4 py-10">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Scheduled Payments
        </h1>
        <p className="mt-2 text-slate-600">
          Review due installments and execute bounded, idempotent payment batches with
          deterministic outcomes.
        </p>
      </header>

      <section aria-labelledby="queue-heading">
        <h2 id="queue-heading" className="mb-4 text-xl font-semibold text-slate-800">
          Due payments
        </h2>
        <ScheduledPaymentQueue />
      </section>

      <section aria-labelledby="execute-heading">
        <h2 id="execute-heading" className="mb-4 text-xl font-semibold text-slate-800">
          Execute batch
        </h2>
        <PaymentExecutionPanel />
      </section>
    </div>
  );
}
