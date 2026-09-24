'use client';

import { useState } from 'react';
import { buildRollbackManifest, generateSeedRun, validateSeedRun } from '../seed';
import type { RollbackManifest, SeedEnvironment, SeedRun } from '../seed';

export function StagingSeedFlow() {
  const [seedKey, setSeedKey] = useState('scholarships-wave-2026');
  const [environment, setEnvironment] = useState<SeedEnvironment>('staging');
  const [applicants, setApplicants] = useState(24);
  const [run, setRun] = useState<SeedRun | null>(null);
  const [manifest, setManifest] = useState<RollbackManifest | null>(null);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleGenerate = () => {
    try {
      const next = generateSeedRun({
        seedKey,
        environment,
        scope: { programs: 3, applicants, reviewers: 4, milestones: 72, payments: 140 },
      });
      const validation = validateSeedRun(next);
      if (!validation.ok) {
        setStatus('error');
        setRun(next);
        setManifest(null);
        return;
      }
      setStatus('success');
      setRun(next);
      setManifest(buildRollbackManifest(next));
    } catch {
      setStatus('error');
      setManifest(null);
    }
  };

  const handleRevoke = () => {
    if (run) {
      setManifest(buildRollbackManifest(run, new Date().toISOString()));
      setStatus('idle');
      setRun(null);
    }
  };

  const totalRecords = (run?.programIds.length ?? 0) + (run?.applicantIds.length ?? 0) + (run?.reviewerIds.length ?? 0) + (run?.walletIds.length ?? 0) + (run?.milestoneIds.length ?? 0) + (run?.paymentIds.length ?? 0);

  return (
    <section className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 text-slate-900">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">Staging & testnet</p>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Synthetic seed flow</h1>
        <p className="max-w-2xl text-sm text-slate-600 md:text-base">
          Rehearse decision, milestone, and payment pipelines with deterministic synthetic records. Runs are
          reproducible from the seed key, contain no real PII, and keep a rollback manifest for a one-call revoke.
        </p>
      </header>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-xl font-semibold">Configure a seed run</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2">
            Seed key
            <input
              type="text"
              value={seedKey}
              onChange={(event) => setSeedKey(event.target.value)}
              autoComplete="off"
              aria-label="Seed key"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </label>

          <label className="space-y-2 text-sm font-medium text-slate-700">
            Environment
            <select
              value={environment}
              onChange={(event) => setEnvironment(event.target.value as SeedEnvironment)}
              aria-label="Seed environment"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="staging">Staging</option>
              <option value="testnet">Testnet</option>
            </select>
          </label>

          <label className="space-y-2 text-sm font-medium text-slate-700">
            Applicants
            <input
              type="number"
              min={1}
              max={500}
              value={applicants}
              onChange={(event) => setApplicants(Math.max(1, Number(event.target.value)))}
              aria-label="Number of synthetic applicants"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={handleGenerate}
          className="mt-4 rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          Generate seed run
        </button>

        {status === 'error' && (
          <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            The generated run failed validation. Check the run summary below and adjust the seed key.
          </div>
        )}

        {status === 'success' && run && (
          <div className="mt-6 space-y-4" aria-live="polite">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <dl className="grid gap-3 text-sm text-slate-600 md:grid-cols-4">
                <div>
                  <dt className="font-medium text-slate-900">Run ID</dt>
                  <dd className="font-mono text-xs">{run.runId}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-900">Environment</dt>
                  <dd>{run.environment}</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-900">Synthetic identity</dt>
                  <dd>Synthetic only, no real PII</dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-900">Records created</dt>
                  <dd>{totalRecords}</dd>
                </div>
              </dl>
            </div>

            <div className="grid gap-3 text-sm text-slate-600 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="font-medium text-slate-900">Applicants ({run.applicants.length})</p>
                <ul className="mt-2 space-y-1 text-xs">
                  {run.applicants.slice(0, 5).map((applicant) => (
                    <li key={applicant.id}>
                      {applicant.syntheticName} · {applicant.region}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="font-medium text-slate-900">Milestones ({run.milestones.length})</p>
                <ul className="mt-2 space-y-1 text-xs">
                  {run.milestones.slice(0, 5).map((milestone) => (
                    <li key={milestone.id}>
                      {milestone.title} · {milestone.amount} XLM
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="font-medium text-slate-900">Wallets ({run.wallets.length})</p>
                <ul className="mt-2 space-y-1 text-xs">
                  {run.wallets.slice(0, 3).map((wallet) => (
                    <li key={wallet.id} className="break-all font-mono">{wallet.address}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Rollback manifest</h2>
          {manifest && !manifest.revokedAt && (
            <button
              type="button"
              onClick={handleRevoke}
              className="rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              Revoke run
            </button>
          )}
        </div>

        {manifest ? (
          <dl className="mt-4 max-w-xl space-y-3 text-sm text-slate-600">
            <div>
              <dt className="font-medium text-slate-900">Manifest IDs</dt>
              <dd className="mt-1 flex max-h-40 flex-wrap gap-1 overflow-y-auto font-mono text-xs">
                {manifest.createdIds.length > 0 ? (
                  manifest.createdIds.slice(0, 40).map((id) => (
                    <span key={id} className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">{id}</span>
                  ))
                ) : (
                  <span>Synthetic-only runs keep manifests for traceability.</span>
                )}
                {manifest.createdIds.length > 40 && (
                  <span className="px-1.5 py-0.5 text-slate-400">+{manifest.createdIds.length - 40} more</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-900">Status</dt>
              <dd className={`font-semibold ${manifest.revokedAt ? 'text-red-600' : 'text-emerald-600'}`}>
                {manifest.revokedAt ? `Revoked at ${new Date(manifest.revokedAt).toLocaleString()}` : 'Active — reversible in one call'}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-slate-600">Generate a seed run to create its rollback manifest.</p>
        )}
      </div>
    </section>
  );
}

export default StagingSeedFlow;