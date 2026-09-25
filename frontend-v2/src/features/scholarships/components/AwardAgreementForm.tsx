'use client';

import React, { useId, useRef, useState } from 'react';
import { Shield } from 'lucide-react';
import { useAcceptAward, useDeclineAward } from '../hooks/useScholarships';
import type {
  AcceptAwardPayload,
  AwardRecord,
} from '../types/scholarship.types';
import { ScholarshipStatusBadge } from './ScholarshipStatusBadge';

const AGREEMENT_VERSION = '2026-09-01';

const DECLARATIONS = [
  'I confirm that the award details shown are accurate and I understand the terms and obligations.',
  'I understand that accepting this award may affect my eligibility for other awards.',
  'I agree to use the award funds solely for the stated educational purpose.',
  'I acknowledge that misrepresentation of information may result in termination and recovery of funds.',
] as const;

type ActionStatus = 'idle' | 'loading' | 'accepted' | 'declined' | 'error';

export interface AwardAgreementFormProps {
  award: AwardRecord;
  signerIdentity: string;
  onAccepted?: () => void;
  onDeclined?: () => void;
}

function formatCurrency(cents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
  }).format(cents / 100);
}

export function AwardAgreementForm({
  award,
  signerIdentity,
  onAccepted,
  onDeclined,
}: AwardAgreementFormProps) {
  const formId = useId();
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [actionStatus, setActionStatus] = useState<ActionStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [acceptedAt, setAcceptedAt] = useState('');
  const clientTokenRef = useRef(`${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

  const acceptMutation = useAcceptAward();
  const declineMutation = useDeclineAward();

  const allChecked = checked.size === DECLARATIONS.length;
  const statusRegionId = `${formId}-live`;

  function toggleDeclaration(index: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function handleAccept() {
    if (!allChecked) return;
    setActionStatus('loading');
    setErrorMessage('');

    const payload: AcceptAwardPayload = {
      awardId: award.id,
      agreementVersion: AGREEMENT_VERSION,
      declarations: [...DECLARATIONS],
      signerIdentity,
      clientToken: clientTokenRef.current,
    };

    try {
      await acceptMutation.mutateAsync(payload);
      setAcceptedAt(new Date().toISOString());
      setActionStatus('accepted');
      onAccepted?.();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Acceptance failed. Please try again.');
      setActionStatus('error');
    }
  }

  async function handleDecline() {
    setActionStatus('loading');
    setErrorMessage('');

    try {
      await declineMutation.mutateAsync({ awardId: award.id });
      setActionStatus('declined');
      onDeclined?.();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Decline failed. Please try again.');
      setActionStatus('error');
    }
  }

  if (actionStatus === 'accepted') {
    return (
      <div
        role="status"
        className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50 p-6"
      >
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-emerald-600" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-emerald-900">Award accepted</h2>
        </div>
        <p className="text-sm text-emerald-700">
          Your acceptance of agreement version <strong>{AGREEMENT_VERSION}</strong> has been
          recorded with your verified identity and timestamp.
        </p>
        <dl className="space-y-1.5 text-sm text-emerald-700">
          <div className="flex justify-between gap-4">
            <dt className="font-medium text-emerald-900">Signer</dt>
            <dd className="font-mono text-xs break-all">{signerIdentity}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="font-medium text-emerald-900">Signed at</dt>
            <dd>
              <time dateTime={acceptedAt}>{new Date(acceptedAt).toLocaleString()}</time>
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="font-medium text-emerald-900">Agreement version</dt>
            <dd>{AGREEMENT_VERSION}</dd>
          </div>
        </dl>
      </div>
    );
  }

  if (actionStatus === 'declined') {
    return (
      <div
        role="status"
        className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-6"
      >
        <h2 className="text-lg font-semibold text-gray-900">Offer declined</h2>
        <p className="text-sm text-gray-600">
          You have declined this award offer. No disbursements will be made for this award.
          This decision is recorded and the offer cannot be re-opened.
        </p>
      </div>
    );
  }

  if (award.status === 'accepted' || award.status === 'declined' || award.status === 'expired') {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
        <span className="text-sm text-gray-600">Award status:</span>
        <ScholarshipStatusBadge status={award.status} />
      </div>
    );
  }

  return (
    <section
      aria-label="Award agreement"
      className="mx-auto w-full max-w-2xl space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
          Agreement v{AGREEMENT_VERSION}
        </p>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          Review and accept award
        </h2>
        <p className="text-sm text-slate-500">
          Read the terms carefully. All declarations must be confirmed before acceptance.
          Once accepted, the agreement version and your identity are immutably recorded.
        </p>
      </header>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-700">Award summary</h3>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-slate-500">Amount</dt>
          <dd className="font-semibold text-slate-900">
            {formatCurrency(award.amountCents, award.currency)}
          </dd>
          <dt className="text-slate-500">Currency</dt>
          <dd className="text-slate-900">{award.currency}</dd>
          <dt className="text-slate-500">Acceptance deadline</dt>
          <dd className="text-slate-900">
            <time dateTime={award.acceptanceDeadline}>
              {new Date(award.acceptanceDeadline).toLocaleString()}
            </time>
          </dd>
        </dl>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-700">Award terms</h3>
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 whitespace-pre-line max-h-48 overflow-y-auto">
          {award.terms}
        </div>
      </div>

      <div
        id={statusRegionId}
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {actionStatus === 'loading' && 'Processing…'}
        {actionStatus === 'error' && `Error: ${errorMessage}`}
      </div>

      <fieldset
        className="space-y-3"
        disabled={actionStatus === 'loading'}
        aria-describedby={statusRegionId}
      >
        <legend className="text-sm font-semibold text-slate-700">Required declarations</legend>
        {DECLARATIONS.map((declaration, index) => (
          <label
            key={index}
            className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 cursor-pointer hover:bg-slate-100"
          >
            <input
              type="checkbox"
              checked={checked.has(index)}
              onChange={() => toggleDeclaration(index)}
              aria-label={declaration}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            {declaration}
          </label>
        ))}
      </fieldset>

      {actionStatus === 'error' && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {errorMessage}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={handleAccept}
          disabled={!allChecked || actionStatus === 'loading'}
          aria-busy={actionStatus === 'loading'}
          aria-describedby={!allChecked ? `${formId}-hint` : undefined}
          className="flex-1 rounded-full bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {actionStatus === 'loading' ? 'Processing…' : 'Accept award'}
        </button>
        <button
          type="button"
          onClick={handleDecline}
          disabled={actionStatus === 'loading'}
          aria-busy={actionStatus === 'loading'}
          className="flex-1 rounded-full border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Decline offer
        </button>
      </div>

      {!allChecked && (
        <p id={`${formId}-hint`} className="text-xs text-slate-500 text-center">
          Please confirm all {DECLARATIONS.length} declarations to enable acceptance.
        </p>
      )}
    </section>
  );
}

export default AwardAgreementForm;
