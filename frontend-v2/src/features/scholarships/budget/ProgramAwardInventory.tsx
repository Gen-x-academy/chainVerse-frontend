'use client';

import { useEffect, useMemo, useState } from 'react';
import { awardInventoryService, computeAwardCapacity } from './service';
import { useAwardInventoryStore } from './store';

type ProgramAwardInventoryProps = {
  programId?: string;
  programName?: string;
  canManage?: boolean;
};

export function ProgramAwardInventory({
  programId = 'chainverse-scholarship',
  programName = 'ChainVerse Scholarship',
  canManage = true,
}: ProgramAwardInventoryProps) {
  const { inventory, loading, error, fetchInventory, updateInventory, submitDecision, lastDecision } = useAwardInventoryStore();
  const [requestedRecipients, setRequestedRecipients] = useState(3);
  const [requestedAmount, setRequestedAmount] = useState(4000);
  const [budgetDraft, setBudgetDraft] = useState({
    maxRecipients: 12,
    perAwardAmount: 4000,
    totalBudget: 48000,
    reserveAmount: 6000,
    currency: 'USD',
  });

  useEffect(() => {
    void fetchInventory(programId);
  }, [fetchInventory, programId]);

  useEffect(() => {
    if (inventory) {
      setBudgetDraft({
        maxRecipients: inventory.maxRecipients,
        perAwardAmount: inventory.perAwardAmount,
        totalBudget: inventory.totalBudget,
        reserveAmount: inventory.reserveAmount,
        currency: inventory.currency,
      });
    }
  }, [inventory]);

  const capacity = useMemo(() => {
    if (!inventory) return 0;
    return computeAwardCapacity({
      maxRecipients: inventory.maxRecipients,
      perAwardAmount: inventory.perAwardAmount,
      totalBudget: inventory.totalBudget,
      reserveAmount: inventory.reserveAmount,
      committedAwards: inventory.committedAwards,
    });
  }, [inventory]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600" role="status" aria-live="polite">
        Loading award inventory and budget capacity...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700" role="alert">
        {error}
      </div>
    );
  }

  if (!inventory) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600" role="status" aria-live="polite">
        No award inventory is configured for this program.
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-5xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" aria-labelledby="award-budget-heading">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Award controls</p>
          <h2 id="award-budget-heading" className="mt-2 text-3xl font-black text-slate-900">{programName}</h2>
        </div>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
          {capacity} remaining slots
        </span>
      </div>

      {!canManage && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" role="note">
          You do not have permission to adjust award inventory and budget ceilings.
        </div>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Max recipients</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{inventory.maxRecipients}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Per award</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{inventory.currency} {inventory.perAwardAmount.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Total budget</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{inventory.currency} {inventory.totalBudget.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Reserve rule</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{inventory.currency} {inventory.reserveAmount.toLocaleString()}</p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
          <h3 className="text-lg font-semibold text-slate-900">Configure budget ceiling</h3>
          <div className="mt-4 space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              Max recipients
              <input
                type="number"
                min={0}
                value={budgetDraft.maxRecipients}
                onChange={(event) => setBudgetDraft((current) => ({ ...current, maxRecipients: Number(event.target.value) }))}
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Per award amount
              <input
                type="number"
                min={0}
                value={budgetDraft.perAwardAmount}
                onChange={(event) => setBudgetDraft((current) => ({ ...current, perAwardAmount: Number(event.target.value) }))}
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Total budget
              <input
                type="number"
                min={0}
                value={budgetDraft.totalBudget}
                onChange={(event) => setBudgetDraft((current) => ({ ...current, totalBudget: Number(event.target.value) }))}
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Reserve amount
              <input
                type="number"
                min={0}
                value={budgetDraft.reserveAmount}
                onChange={(event) => setBudgetDraft((current) => ({ ...current, reserveAmount: Number(event.target.value) }))}
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              />
            </label>
            <button
              type="button"
              disabled={!canManage}
              onClick={() => void updateInventory({
                programId,
                maxRecipients: budgetDraft.maxRecipients,
                perAwardAmount: budgetDraft.perAwardAmount,
                totalBudget: budgetDraft.totalBudget,
                reserveAmount: budgetDraft.reserveAmount,
                currency: budgetDraft.currency,
                expectedVersion: inventory.version,
              })}
              className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Update budget ceiling
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
          <h3 className="text-lg font-semibold text-slate-900">Try a decision</h3>
          <div className="mt-4 space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              Requested recipients
              <input
                type="number"
                min={0}
                value={requestedRecipients}
                onChange={(event) => setRequestedRecipients(Number(event.target.value))}
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Requested award amount
              <input
                type="number"
                min={0}
                value={requestedAmount}
                onChange={(event) => setRequestedAmount(Number(event.target.value))}
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              />
            </label>
            <button
              type="button"
              onClick={() => void submitDecision(programId, requestedRecipients, requestedAmount)}
              className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              Evaluate award commitment
            </button>

            {lastDecision && (
              <div className={`rounded-lg border p-3 text-sm ${lastDecision.status === 'approved' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`} role="status" aria-live="polite">
                <p className="font-semibold uppercase tracking-wide">{lastDecision.status}</p>
                <p className="mt-2">{lastDecision.reason ?? `Approved for ${lastDecision.recipientsCount} recipient(s) at ${inventory.currency} ${lastDecision.awardAmount.toLocaleString()} each.`}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        Remaining capacity is authoritative: {capacity} award slot(s) remain within the budget ceiling and reserve rules.
      </div>
    </section>
  );
}
