'use client';

import React, { useCallback, useRef, useState } from 'react';
import { useCreateScholarshipApplication } from '../hooks/useScholarships';

export interface ScholarshipApplyFormProps {
  roundId: string;
  onSuccess?: () => void;
}

function createClientToken(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `app-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function ScholarshipApplyForm({ roundId, onSuccess }: ScholarshipApplyFormProps) {
  const mutation = useCreateScholarshipApplication();
  const [statementSummary, setStatementSummary] = useState('');
  const [requestedAmountCents, setRequestedAmountCents] = useState('');
  const [needsFinancialAid, setNeedsFinancialAid] = useState(true);
  const tokenRef = useRef(createClientToken());

  const handleSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      if (mutation.isPending) return;
      mutation.mutate(
        {
          roundId,
          statementSummary: statementSummary.trim(),
          requestedAmountCents: requestedAmountCents
            ? Math.round(Number(requestedAmountCents) * 100)
            : undefined,
          needsFinancialAid,
          clientToken: tokenRef.current,
        },
        {
          onSuccess: () => {
            tokenRef.current = createClientToken();
            setStatementSummary('');
            setRequestedAmountCents('');
            onSuccess?.();
          },
        }
      );
    },
    [mutation, roundId, statementSummary, requestedAmountCents, needsFinancialAid, onSuccess]
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto max-w-2xl rounded-lg border border-gray-200 bg-white p-6"
    >
      <h2 className="text-lg font-semibold text-gray-900">New Application</h2>

      <label className="mt-4 block text-sm font-medium text-gray-700" htmlFor="statement">
        Personal statement
      </label>
      <textarea
        id="statement"
        required
        minLength={80}
        value={statementSummary}
        onChange={(e) => setStatementSummary(e.target.value)}
        rows={5}
        placeholder="Explain your background, goals, and why you are applying…"
        className="mt-1 w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />

      <label className="mt-4 block text-sm font-medium text-gray-700" htmlFor="amount">
        Requested amount (USD)
      </label>
      <input
        id="amount"
        type="number"
        min={0}
        step="0.01"
        value={requestedAmountCents}
        onChange={(e) => setRequestedAmountCents(e.target.value)}
        placeholder="0.00"
        className="mt-1 w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />

      <label className="mt-4 flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={needsFinancialAid}
          onChange={(e) => setNeedsFinancialAid(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300"
        />
        I am applying on financial-aid grounds
      </label>

      {mutation.isError && (
        <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {mutation.error instanceof Error ? mutation.error.message : 'Submission failed. Please try again.'}
        </p>
      )}

      {mutation.isSuccess && (
        <p role="status" className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          Your application was submitted.
        </p>
      )}

      <button
        type="submit"
        disabled={mutation.isPending || statementSummary.trim().length < 80}
        className="mt-6 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
      >
        {mutation.isPending ? 'Submitting…' : 'Submit application'}
      </button>
    </form>
  );
}