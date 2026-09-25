'use client';

import React, { useId, useRef, useState } from 'react';
import { useCreateAward } from '../hooks/useScholarships';
import type { AwardRecord, CreateAwardPayload } from '../types/scholarship.types';
import { ScholarshipStatusBadge } from './ScholarshipStatusBadge';

type FormStatus = 'idle' | 'loading' | 'success' | 'error';

function generateClientToken(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function minDeadline(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 60);
  return d.toISOString().slice(0, 16);
}

export interface AwardRecordFormProps {
  onSuccess?: (award: AwardRecord) => void;
}

export function AwardRecordForm({ onSuccess }: AwardRecordFormProps) {
  const formId = useId();
  const [applicationId, setApplicationId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [amountDollars, setAmountDollars] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [terms, setTerms] = useState('');
  const [acceptanceDeadline, setAcceptanceDeadline] = useState('');
  const [status, setStatus] = useState<FormStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [createdAward, setCreatedAward] = useState<AwardRecord | null>(null);
  const clientTokenRef = useRef(generateClientToken());

  const createMutation = useCreateAward();
  const statusRegionId = `${formId}-status`;

  const amountCents = Math.round(parseFloat(amountDollars || '0') * 100);
  const deadlineValid =
    acceptanceDeadline !== '' && new Date(acceptanceDeadline).getTime() > Date.now();

  const canSubmit =
    status !== 'loading' &&
    applicationId.trim() !== '' &&
    studentId.trim() !== '' &&
    amountCents > 0 &&
    terms.trim() !== '' &&
    deadlineValid;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit) return;

    setStatus('loading');
    setErrorMessage('');

    const payload: CreateAwardPayload = {
      applicationId: applicationId.trim(),
      studentId: studentId.trim(),
      amountCents,
      currency,
      terms: terms.trim(),
      acceptanceDeadline: new Date(acceptanceDeadline).toISOString(),
      clientToken: clientTokenRef.current,
    };

    try {
      const award = await createMutation.mutateAsync(payload);
      setCreatedAward(award);
      setStatus('success');
      onSuccess?.(award);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to create award. Please try again.');
      setStatus('error');
      clientTokenRef.current = generateClientToken();
    }
  };

  const handleReset = () => {
    setApplicationId('');
    setStudentId('');
    setAmountDollars('');
    setCurrency('USD');
    setTerms('');
    setAcceptanceDeadline('');
    setStatus('idle');
    setErrorMessage('');
    setCreatedAward(null);
    clientTokenRef.current = generateClientToken();
  };

  if (status === 'success' && createdAward) {
    return (
      <div
        role="status"
        className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50 p-6"
      >
        <p className="font-semibold text-emerald-800">Award record created successfully.</p>
        <dl className="space-y-2 text-sm text-emerald-700">
          <div className="flex justify-between gap-4">
            <dt className="font-medium text-emerald-900">Award ID</dt>
            <dd className="break-all font-mono text-xs">{createdAward.id}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="font-medium text-emerald-900">Status</dt>
            <dd><ScholarshipStatusBadge status={createdAward.status} /></dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="font-medium text-emerald-900">Acceptance deadline</dt>
            <dd>
              <time dateTime={createdAward.acceptanceDeadline}>
                {new Date(createdAward.acceptanceDeadline).toLocaleString()}
              </time>
            </dd>
          </div>
        </dl>
        <button
          type="button"
          onClick={handleReset}
          className="mt-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
        >
          Create another award
        </button>
      </div>
    );
  }

  return (
    <section
      aria-label="Create award record"
      className="mx-auto w-full max-w-2xl space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
          Award management
        </p>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Create award record</h2>
        <p className="text-sm text-slate-500">
          Define the award amount, terms, and acceptance window. Offers expire automatically when
          the deadline passes and reservations are released.
        </p>
      </header>

      <div
        id={statusRegionId}
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {status === 'loading' && 'Creating award record…'}
        {status === 'error' && `Error: ${errorMessage}`}
      </div>

      <form onSubmit={handleSubmit} aria-describedby={statusRegionId} noValidate>
        <fieldset className="space-y-5" disabled={status === 'loading'}>
          <legend className="sr-only">Award details</legend>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor={`${formId}-applicationId`}
                className="block text-sm font-medium text-slate-700"
              >
                Application ID <span className="text-red-500" aria-hidden="true">*</span>
              </label>
              <input
                id={`${formId}-applicationId`}
                type="text"
                value={applicationId}
                onChange={(e) => setApplicationId(e.target.value)}
                required
                aria-required="true"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="app-001"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor={`${formId}-studentId`}
                className="block text-sm font-medium text-slate-700"
              >
                Student ID <span className="text-red-500" aria-hidden="true">*</span>
              </label>
              <input
                id={`${formId}-studentId`}
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                required
                aria-required="true"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="student-001"
              />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor={`${formId}-amount`}
                className="block text-sm font-medium text-slate-700"
              >
                Award amount <span className="text-red-500" aria-hidden="true">*</span>
              </label>
              <input
                id={`${formId}-amount`}
                type="number"
                min="0.01"
                step="0.01"
                value={amountDollars}
                onChange={(e) => setAmountDollars(e.target.value)}
                required
                aria-required="true"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="500.00"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor={`${formId}-currency`}
                className="block text-sm font-medium text-slate-700"
              >
                Currency
              </label>
              <select
                id={`${formId}-currency`}
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="XLM">XLM</option>
                <option value="USDC">USDC</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor={`${formId}-terms`}
              className="block text-sm font-medium text-slate-700"
            >
              Award terms <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <textarea
              id={`${formId}-terms`}
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              rows={5}
              required
              aria-required="true"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Describe the conditions, obligations, and restrictions attached to this award…"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor={`${formId}-deadline`}
              className="block text-sm font-medium text-slate-700"
            >
              Acceptance deadline <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <input
              id={`${formId}-deadline`}
              type="datetime-local"
              value={acceptanceDeadline}
              onChange={(e) => setAcceptanceDeadline(e.target.value)}
              min={minDeadline()}
              required
              aria-required="true"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-slate-500">
              The offer expires at this time and the reservation is automatically released.
            </p>
          </div>

          {status === 'error' && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            >
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            aria-busy={status === 'loading'}
            className="w-full rounded-full bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === 'loading' ? 'Creating award…' : 'Create award record'}
          </button>
        </fieldset>
      </form>
    </section>
  );
}

export default AwardRecordForm;
