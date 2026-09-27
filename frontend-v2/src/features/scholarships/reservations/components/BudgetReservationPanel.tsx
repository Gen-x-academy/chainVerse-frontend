'use client';

import { useState } from 'react';
import { useBudgetReservationStore } from '../store';
import { validateAcquisition } from '../domain';
import type { AcquireReservationPayload, BudgetReservation, ReservationPolicy } from '../types';

const STATUS_LABELS: Record<BudgetReservation['status'], string> = {
  held: 'Held',
  released: 'Released',
  expired: 'Expired',
  committed: 'Committed',
};

const STATUS_COLORS: Record<BudgetReservation['status'], string> = {
  held: 'bg-amber-50 border-amber-200 text-amber-800',
  released: 'bg-slate-50 border-slate-200 text-slate-700',
  expired: 'bg-red-50 border-red-200 text-red-800',
  committed: 'bg-emerald-50 border-emerald-200 text-emerald-800',
};

interface Props {
  programId: string;
  applicationId: string;
  decisionId: string;
  amountCents: number;
  currency: string;
  policy: ReservationPolicy;
  currentHeldCents: number;
  currentCommittedCents: number;
  /** When provided, the panel is rendered in read-only mode. */
  existingReservation?: BudgetReservation;
}

export function BudgetReservationPanel({
  programId,
  applicationId,
  decisionId,
  amountCents,
  currency,
  policy,
  currentHeldCents,
  currentCommittedCents,
  existingReservation,
}: Props) {
  const { reservation, loading, error, acquire, release, commit } = useBudgetReservationStore();
  const [idempotencyKey] = useState(() => `reserve-${decisionId}-${Date.now().toString(36)}`);
  const [validationErrors, setValidationErrors] = useState<{ field: string; message: string }[]>(
    []
  );

  const displayed = existingReservation ?? reservation;

  const prereqErrors = validateAcquisition(
    { programId, applicationId, decisionId, amountCents, currency, idempotencyKey },
    currentHeldCents,
    currentCommittedCents,
    policy
  );

  async function handleAcquire() {
    const payload: AcquireReservationPayload = {
      programId,
      applicationId,
      decisionId,
      amountCents,
      currency,
      idempotencyKey,
    };
    const errors = validateAcquisition(payload, currentHeldCents, currentCommittedCents, policy);
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors([]);
    await acquire(payload);
  }

  async function handleRelease() {
    if (!displayed) return;
    await release(displayed.id);
  }

  async function handleCommit() {
    if (!displayed) return;
    await commit(displayed.id);
  }

  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amountCents / 100);

  const availableCents = policy.maxBudgetCents - currentHeldCents - currentCommittedCents;
  const formattedAvailable = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(availableCents / 100);

  return (
    <section
      aria-labelledby="reservation-panel-title"
      className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 text-slate-900"
    >
      <header className="space-y-1">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">
          Budget reservation
        </p>
        <h2 id="reservation-panel-title" className="text-3xl font-bold tracking-tight">
          Reserve award budget
        </h2>
        <p className="text-sm text-slate-500">
          Holds {formattedAmount} for up to {policy.maxHoldHours}h. Automatically expires if not
          committed.
        </p>
      </header>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-2">
        <p className="text-sm text-slate-600">
          Award amount: <strong className="text-slate-900">{formattedAmount}</strong>
        </p>
        <p className="text-sm text-slate-600">
          Available budget: <strong className="text-slate-900">{formattedAvailable}</strong>
        </p>
        {prereqErrors.length > 0 && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 space-y-1"
          >
            {prereqErrors.map((e) => (
              <p key={e.field}>{e.message}</p>
            ))}
          </div>
        )}
      </div>

      {displayed && (
        <div
          className={`rounded-2xl border px-5 py-4 space-y-2 ${STATUS_COLORS[displayed.status]}`}
          role="status"
          aria-label={`Reservation ${STATUS_LABELS[displayed.status]}`}
        >
          <p className="font-semibold">
            Reservation {STATUS_LABELS[displayed.status]}
          </p>
          <p className="text-sm">
            ID: <span className="font-mono text-xs">{displayed.id}</span>
          </p>
          {displayed.status === 'held' && (
            <p className="text-sm">
              Expires: {new Date(displayed.expiresAt).toLocaleString()}
            </p>
          )}
          {displayed.releasedAt && (
            <p className="text-sm">
              Released: {new Date(displayed.releasedAt).toLocaleString()}
            </p>
          )}
          {displayed.committedAt && (
            <p className="text-sm">
              Committed: {new Date(displayed.committedAt).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      {validationErrors.length > 0 && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 space-y-1"
        >
          {validationErrors.map((e) => (
            <p key={e.field}>{e.message}</p>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-3" aria-live="polite">
        {!displayed && (
          <button
            type="button"
            onClick={() => void handleAcquire()}
            disabled={loading || prereqErrors.length > 0}
            className="rounded-full bg-indigo-600 px-6 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {loading ? 'Reserving…' : 'Reserve budget'}
          </button>
        )}

        {displayed?.status === 'held' && (
          <>
            <button
              type="button"
              onClick={() => void handleCommit()}
              disabled={loading}
              className="rounded-full bg-emerald-600 px-6 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {loading ? 'Committing…' : 'Commit reservation'}
            </button>
            <button
              type="button"
              onClick={() => void handleRelease()}
              disabled={loading}
              className="rounded-full border border-slate-300 bg-white px-6 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              {loading ? 'Releasing…' : 'Release reservation'}
            </button>
          </>
        )}
      </div>
    </section>
  );
}

export default BudgetReservationPanel;
