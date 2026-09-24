'use client';

import { useMemo } from 'react';
import { evaluateCompatibilityGate } from '../compatibility';
import type { AbiArtifact, ArtifactKind, CompatibilityApproval, CompatibilityGateResult, ConsumerMap } from '../compatibility';

import apiBaseline from '@/scripts/scholarships/artifacts/baseline/api-contracts.json';
import eventsBaseline from '@/scripts/scholarships/artifacts/baseline/events.json';
import dbBaseline from '@/scripts/scholarships/artifacts/baseline/db-schema.json';
import abiBaseline from '@/scripts/scholarships/artifacts/baseline/stellar-abi.json';

import apiCurrent from '@/scripts/scholarships/artifacts/api-contracts.json';
import eventsCurrent from '@/scripts/scholarships/artifacts/events.json';
import dbCurrent from '@/scripts/scholarships/artifacts/db-schema.json';
import abiCurrent from '@/scripts/scholarships/artifacts/stellar-abi.json';

import approvals from '@/scripts/scholarships/artifacts/compatibility-approvals.json';
import consumers from '@/scripts/scholarships/artifacts/consumers.json';

const gate = (): CompatibilityGateResult =>
  evaluateCompatibilityGate(
    {
      api: { baseline: apiBaseline, current: apiCurrent },
      events: { baseline: eventsBaseline, current: eventsCurrent },
      db: { baseline: dbBaseline, current: dbCurrent },
      abi: { baseline: abiBaseline as unknown as AbiArtifact, current: abiCurrent as unknown as AbiArtifact },
    },
    approvals as CompatibilityApproval[],
    consumers as ConsumerMap
  );

export function CompatibilityGate() {
  const result = useMemo(gate, []);

  return (
    <section className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 text-slate-900">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">Compatibility gate</p>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Contract & schema change review</h1>
        <p className="max-w-2xl text-sm text-slate-600 md:text-base">
          Typed API routes, emitted events, database schema, and the on-chain Stellar ABI are compared against the
          approved baseline. Breaking changes block until an explicit compatibility approval records the migration.
        </p>
      </header>

      <div
        role="status"
        aria-live="polite"
        className={`rounded-2xl border p-5 shadow-sm ${
          result.ok
            ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
            : 'border-red-200 bg-red-50 text-red-900'
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">
              {result.ok ? 'Gate open — no blocking changes' : `${result.blocking.length} blocking change${result.blocking.length === 1 ? '' : 's'}`}
            </h2>
            <p className="mt-1 text-sm">
              {result.additive.length} additive change{result.additive.length === 1 ? '' : 's'} ·{' '}
              {result.compatible.length} compatible change{result.compatible.length === 1 ? '' : 's'} ·{' '}
              {result.blockedArtifacts.length} artifact group{result.blockedArtifacts.length === 1 ? '' : 's'} blocked
            </p>
          </div>
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
              result.ok ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
            }`}
          >
            {result.ok ? 'Approved baseline' : 'Requires approval'}
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-xl font-semibold">Additive changes</h2>
          {result.additive.length === 0 ? (
            <p className="text-sm text-slate-600">No additive changes against the baseline.</p>
          ) : (
            <ul className="space-y-2" aria-label="Additive artifact changes">
              {result.additive.map((change) => (
                <li key={change.approvalKey} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                  <span className="font-medium text-slate-900">{change.artifact} · {change.entity}</span>
                  <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                    {change.changeClass}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-xl font-semibold">Blocking changes & consumers</h2>
          {result.blocking.length === 0 ? (
            <p className="text-sm text-slate-600">No breaking contract, schema, or ABI changes are pending approval.</p>
          ) : (
            <ul className="space-y-2" aria-label="Blocking artifact changes">
              {result.blocking.map((change) => (
                <li key={change.approvalKey} className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm">
                  <p className="font-medium text-slate-900">
                    {change.artifact} · {change.entity} · {change.reason}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Approval key: <code className="font-mono">{change.approvalKey}</code>
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Consumers: {(result.consumers[change.approvalKey] ?? ['unknown']).join(', ')}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
        <h2 className="mb-2 text-base font-semibold text-slate-900">Baseline artifacts reviewed</h2>
        <ul className="list-inside list-disc space-y-1">
          {(['api', 'events', 'db', 'abi'] as ArtifactKind[]).map((kind) => (
            <li key={kind}>{kind} artifacts compared against the approved baseline in <code className="font-mono">scripts/scholarships/artifacts/baseline</code>.</li>
          ))}
        </ul>
        <p className="mt-3">
          This gate also runs in CI (see <code className="font-mono">.github/workflows/scholarships-compatibility.yml</code>), where any
          breaking artifact change fails the workflow unless a matching compatibility approval exists.
        </p>
      </div>
    </section>
  );
}

export default CompatibilityGate;