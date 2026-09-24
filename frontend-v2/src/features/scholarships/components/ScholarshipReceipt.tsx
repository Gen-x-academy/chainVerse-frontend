'use client';

import { useMemo, useState } from 'react';
import { verifySubmissionReceipt } from '../lib/receipt';
import type { ScholarshipApplicationRecord, ScholarshipSubmissionReceipt } from '../types';

type ScholarshipReceiptProps = {
  receipt: ScholarshipSubmissionReceipt | null;
  application?: ScholarshipApplicationRecord | null;
};

export function ScholarshipReceipt({ receipt, application }: ScholarshipReceiptProps) {
  const [verified, setVerified] = useState<boolean | null>(null);

  const verificationSummary = useMemo(() => {
    if (!receipt) return 'No receipt has been generated yet.';
    if (verified === true) return 'Receipt verified and matches the stored submission data.';
    if (verified === false) return 'Verification failed. The receipt does not match the current submission record.';
    return 'Receipt is generated deterministically and can be independently checked.';
  }, [receipt, verified]);

  if (!receipt) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600" role="status" aria-live="polite">
        No scholarship receipt has been generated yet.
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-2xl rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm" role="status" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Submission receipt</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">Application received</h2>
        </div>
        <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
          verified
        </span>
      </div>

      <dl className="mt-5 space-y-4 text-sm text-slate-700">
        <div className="rounded-lg border border-emerald-100 bg-white p-3">
          <dt className="font-medium text-slate-500">Application ID</dt>
          <dd className="mt-1 break-all font-mono text-base text-slate-900">{receipt.applicationId}</dd>
        </div>
        <div className="rounded-lg border border-emerald-100 bg-white p-3">
          <dt className="font-medium text-slate-500">Program version</dt>
          <dd className="mt-1 text-base font-semibold text-slate-900">{receipt.programVersion}</dd>
        </div>
        <div className="rounded-lg border border-emerald-100 bg-white p-3">
          <dt className="font-medium text-slate-500">Submitted time</dt>
          <dd className="mt-1 text-base text-slate-900">{new Date(receipt.submittedAt).toLocaleString()}</dd>
        </div>
        <div className="rounded-lg border border-emerald-100 bg-white p-3">
          <dt className="font-medium text-slate-500">Integrity commitment</dt>
          <dd className="mt-1 break-all font-mono text-xs text-slate-900">{receipt.integrityCommitment}</dd>
        </div>
      </dl>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={async () => {
            if (!application) {
              setVerified(false);
              return;
            }
            const nextState = await verifySubmissionReceipt(receipt, application);
            setVerified(nextState);
          }}
          className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-200"
        >
          Verify receipt
        </button>
        <p className="text-xs text-slate-600">Sensitive answers are intentionally excluded from this receipt.</p>
      </div>

      <p className="mt-4 rounded-lg border border-emerald-200 bg-white/80 p-3 text-sm text-slate-700" aria-live="polite">
        {verificationSummary}
      </p>
    </section>
  );
}
