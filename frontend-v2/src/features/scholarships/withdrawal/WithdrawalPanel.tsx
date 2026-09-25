'use client';

import { useState } from 'react';
import { useScholarshipWithdrawalStore } from './store';
import { getWithdrawalPolicyImpact } from './service';

type WithdrawalPanelProps = {
  applicationId?: string;
  programId?: string;
  canWithdraw?: boolean;
};

export function WithdrawalPanel({
  applicationId = 'application-demo-001',
  programId = 'chainverse-scholarship',
  canWithdraw = true,
}: WithdrawalPanelProps) {
  const { requestWithdrawal, withdrawal, loading, error } = useScholarshipWithdrawalStore();
  const [selectedReason, setSelectedReason] = useState<'personal' | 'academic' | 'financial' | 'schedule' | 'other'>('personal');
  const [detail, setDetail] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!canWithdraw) return;

    await requestWithdrawal({
      applicationId,
      programId,
      reasonCategory: selectedReason,
      reasonDetail: detail,
      confirmed,
      requestedAt: new Date().toISOString(),
    });
  };

  if (withdrawal) {
    return (
      <section className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" role="status" aria-live="polite">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">Withdrawal recorded</p>
        <h2 className="mt-2 text-3xl font-black text-slate-900">Application withdrawal request</h2>
        <dl className="mt-5 space-y-4 text-sm text-slate-700">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <dt className="font-medium text-slate-500">Withdrawal ID</dt>
            <dd className="mt-1 font-mono text-base text-slate-900">{withdrawal.withdrawalId}</dd>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <dt className="font-medium text-slate-500">Status</dt>
            <dd className="mt-1 text-base text-slate-900">{withdrawal.status}</dd>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <dt className="font-medium text-slate-500">Policy impact</dt>
            <dd className="mt-1 text-base text-slate-900">{withdrawal.policyImpact}</dd>
          </div>
        </dl>
      </section>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" noValidate>
      <div className="mb-5">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">Withdrawal</p>
        <h2 className="mt-2 text-3xl font-black text-slate-900">Withdraw your application</h2>
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!canWithdraw && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" role="note">
          You are not allowed to withdraw this application.
        </div>
      )}

      <div className="space-y-5">
        <div>
          <label htmlFor="reason-category" className="mb-2 block text-sm font-medium text-slate-700">
            Reason category
          </label>
          <select
            id="reason-category"
            value={selectedReason}
            onChange={(event) => setSelectedReason(event.target.value as typeof selectedReason)}
            className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          >
            <option value="personal">Personal</option>
            <option value="academic">Academic</option>
            <option value="financial">Financial</option>
            <option value="schedule">Schedule</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label htmlFor="reason-detail" className="mb-2 block text-sm font-medium text-slate-700">
            Reason details
          </label>
          <textarea
            id="reason-detail"
            rows={4}
            value={detail}
            onChange={(event) => setDetail(event.target.value)}
            placeholder="Share only the information needed to explain the withdrawal request."
            className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          />
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <p className="font-medium text-slate-900">Policy impact</p>
          <p className="mt-2">{getWithdrawalPolicyImpact({ applicationId, programId, reasonCategory: selectedReason, reasonDetail: detail, confirmed, requestedAt: new Date().toISOString() })}</p>
        </div>

        <label className="flex items-start gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            className="mt-1 rounded border-slate-300 text-emerald-600 focus:ring-emerald-200"
          />
          <span>
            I confirm this withdrawal request and understand that review history remains part of the applicant record.
          </span>
        </label>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
        <button
          type="submit"
          disabled={loading || !canWithdraw || !confirmed}
          className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Submitting withdrawal...' : 'Submit withdrawal'}
        </button>
      </div>
    </form>
  );
}
