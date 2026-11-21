'use client';

import { useState } from 'react';
import type { EthicsScreening, ScreeningFlags } from './screening';
import { ConflictState, EmptyState, ErrorState, LoadingState, SuccessState } from './IntegrityStates';
import { IntegrityApiError, IntegrityConflictError, integrityApi } from './shared';
import { useIntegrityResource } from './useIntegrityResource';
import { useIntegritySession } from './useIntegritySession';

const FLAG_LABELS: Record<keyof ScreeningFlags, string> = {
  humanSubjects: 'Human subjects', sensitiveData: 'Sensitive data', fieldwork: 'Fieldwork',
  dualUse: 'Dual use', safetyConcerns: 'Safety concerns', safetyMitigation: 'Mitigations in place',
};

export function EthicsScreeningPanel({ projectId }: { projectId: string }) {
  const { actorId, can } = useIntegritySession();
  const resource = useIntegrityResource<EthicsScreening[]>(projectId ? `/screenings?projectId=${encodeURIComponent(projectId)}` : null);
  const [flags, setFlags] = useState<ScreeningFlags>({
    humanSubjects: false, sensitiveData: false, fieldwork: false, dualUse: false, safetyConcerns: false, safetyMitigation: false,
  });
  const [requestId] = useState(() => integrityApi.newRequestId());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!actorId || !can('integrity:screening:create')) return;
    setBusy(true); setError(null); setMessage(null);
    try {
      await integrityApi.mutate<EthicsScreening>('/screenings', requestId, { projectId, projectVersion: 1, flags });
      setMessage('Screening submitted for review.');
      resource.refresh();
    } catch (cause) {
      setError(cause instanceof IntegrityConflictError ? 'The screening changed. Refresh before retrying.'
        : cause instanceof IntegrityApiError ? cause.message : 'Unable to submit the screening.');
    } finally { setBusy(false); }
  };

  return (
    <section aria-labelledby="screening-heading" className="mx-auto w-full max-w-3xl space-y-4 p-4 sm:p-6">
      <h2 id="screening-heading" className="text-lg font-semibold">Research ethics screening</h2>
      <p className="text-sm text-gray-600">Assess approval pathways before activation or a material change.</p>
      {can('integrity:screening:create') && (
        <form onSubmit={submit} className="space-y-3 rounded border border-gray-200 p-4">
          <fieldset disabled={busy}>
            <legend className="text-sm font-medium">Screening questions</legend>
            {(Object.keys(FLAG_LABELS) as (keyof ScreeningFlags)[]).map((key) => (
              <label key={key} className="mt-2 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={Boolean(flags[key])} onChange={(event) => setFlags({ ...flags, [key]: event.target.checked })} />
                {FLAG_LABELS[key]}
              </label>
            ))}
          </fieldset>
          <button type="submit" disabled={busy} className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            {busy ? 'Submitting…' : 'Submit screening'}
          </button>
          <div aria-live="polite" className="text-sm">
            {message && <SuccessState>{message}</SuccessState>}
            {error && <ErrorState message={error} onRetry={() => setError(null)} />}
          </div>
        </form>
      )}
      {!can('integrity:screening:read') && <p role="status" className="text-sm text-gray-600">You do not have access to ethics screenings for this project.</p>}
      {can('integrity:screening:read') && resource.status === 'loading' && <LoadingState label="Loading screenings" />}
      {can('integrity:screening:read') && resource.status === 'empty' && <EmptyState title="No screenings yet">Submit a screening to see its approval pathway.</EmptyState>}
      {can('integrity:screening:read') && resource.status === 'error' && <ErrorState message={resource.message ?? 'Unable to load screenings.'} onRetry={resource.refresh} />}
      {can('integrity:screening:read') && resource.status === 'conflict' && <ConflictState message={resource.message ?? 'The screening changed.'} onRefresh={resource.refresh} />}
      {can('integrity:screening:read') && resource.status === 'ready' && (
        <ul aria-label="Screening history" className="space-y-2">
          {resource.data?.map((item) => (
            <li key={item.id} className="rounded border border-gray-200 p-3 text-sm">
              <span className="font-medium">{item.id}</span>: {item.status} · pathway {item.pathway} · project version {item.projectVersion} · revision {item.revision}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
