'use client';

import { useState } from 'react';
import { IntegrityApiError, IntegrityConflictError } from './shared';
import { publicCheck, type OriginalityCheck } from './checks';
import {
  ConflictState,
  EmptyState,
  ErrorState,
  LoadingState,
  SuccessState,
} from './IntegrityStates';
import { integrityApi } from './shared';
import { useIntegrityResource } from './useIntegrityResource';
import { useIntegritySession } from './useIntegritySession';

/** Screen-reader friendly request form; private manuscript content is never collected here. */
export function OriginalityCheckPanel({ projectId, submissionVersionId }: { projectId: string; submissionVersionId: string }) {
  const { actorId, can } = useIntegritySession();
  const path = projectId ? `/checks?projectId=${encodeURIComponent(projectId)}` : null;
  const resource = useIntegrityResource<OriginalityCheck[]>(path);
  const [consent, setConsent] = useState(false);
  const [similarity, setSimilarity] = useState(80);
  const [citationCoverage, setCitationCoverage] = useState(40);
  const [requestId] = useState(() => integrityApi.newRequestId());
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!actorId || !can('integrity:checks:request')) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await integrityApi.mutate<OriginalityCheck>(
        '/checks',
        requestId,
        {
          projectId,
          submissionVersionId,
          consent: { granted: consent, scope: 'both', grantedBy: actorId },
          thresholds: { similarity, citationCoverage },
        },
      );
      setMessage('Check requested. Restricted results will be available to reviewers only.');
      resource.refresh();
    } catch (cause) {
      setError(
        cause instanceof IntegrityConflictError
          ? 'The check changed while you were working. Refresh before retrying.'
          : cause instanceof IntegrityApiError
            ? cause.message
            : 'Unable to request the check. Try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="checks-heading" className="mx-auto w-full max-w-3xl space-y-4 p-4 sm:p-6">
      <h2 id="checks-heading" className="text-lg font-semibold">Originality and citation checks</h2>
      <p className="text-sm text-gray-600">Consent-aware analysis with restricted reports and human review for threshold breaches.</p>

      {can('integrity:checks:request') && (
        <form onSubmit={submit} className="space-y-4 rounded border border-gray-200 p-4">
          <fieldset disabled={busy}>
            <legend className="text-sm font-medium">Request a check</legend>
            <label className="mt-3 flex items-start gap-2 text-sm">
              <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} required className="mt-1" />
              <span>I consent to similarity and citation analysis of this submission version.</span>
            </label>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-sm">Similarity threshold (%)
                <input type="number" min={0} max={100} value={similarity} onChange={(event) => setSimilarity(Number(event.target.value))} className="mt-1 w-full rounded border p-2" />
              </label>
              <label className="text-sm">Minimum citation coverage (%)
                <input type="number" min={0} max={100} value={citationCoverage} onChange={(event) => setCitationCoverage(Number(event.target.value))} className="mt-1 w-full rounded border p-2" />
              </label>
            </div>
          </fieldset>
          <button type="submit" disabled={busy || !consent} className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            {busy ? 'Requesting…' : 'Request check'}
          </button>
          <div aria-live="polite" className="text-sm">
            {message && <SuccessState>{message}</SuccessState>}
            {error && <ErrorState message={error} onRetry={() => setError(null)} />}
          </div>
        </form>
      )}

      {!can('integrity:checks:read') && (
        <p role="status" className="text-sm text-gray-600">You do not have access to originality checks for this project.</p>
      )}

      {can('integrity:checks:read') && resource.status === 'loading' && <LoadingState label="Loading checks" />}
      {can('integrity:checks:read') && resource.status === 'empty' && <EmptyState title="No checks yet">Request a check to see its provider-independent status here.</EmptyState>}
      {can('integrity:checks:read') && resource.status === 'error' && <ErrorState message={resource.message ?? 'Unable to load checks.'} onRetry={resource.refresh} />}
      {can('integrity:checks:read') && resource.status === 'conflict' && <ConflictState message={resource.message ?? 'The checks changed.'} onRefresh={resource.refresh} />}
      {can('integrity:checks:read') && resource.status === 'ready' && (
        <ul className="space-y-2" aria-label="Check history">
          {resource.data?.map((item) => {
            const safe = publicCheck(item);
            return (
              <li key={safe.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-gray-200 p-3 text-sm">
                <span className="font-medium">{safe.id}</span>
                <span className="text-gray-600">Status: {safe.status} · Provider status: {safe.providerStatus} · Revision {safe.revision}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
