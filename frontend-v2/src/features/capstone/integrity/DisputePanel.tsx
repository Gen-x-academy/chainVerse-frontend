'use client';

import { useState } from 'react';
import { DISPUTE_TYPES, publicDispute, type ProjectDispute } from './disputes';
import { ConflictState, EmptyState, ErrorState, LoadingState, SuccessState } from './IntegrityStates';
import { IntegrityApiError, IntegrityConflictError, integrityApi } from './shared';
import { useIntegrityResource } from './useIntegrityResource';
import { useIntegritySession } from './useIntegritySession';

export function DisputePanel({ projectId }: { projectId: string }) {
  const { actorId, can } = useIntegritySession();
  const resource = useIntegrityResource<ProjectDispute[]>(projectId ? `/disputes?projectId=${encodeURIComponent(projectId)}` : null);
  const [type, setType] = useState<string>(DISPUTE_TYPES[0]);
  const [reasonCode, setReasonCode] = useState('');
  const [evidenceRefs, setEvidenceRefs] = useState('');
  const [requestId] = useState(() => integrityApi.newRequestId());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!actorId || !can('integrity:disputes:file')) return;
    setBusy(true); setError(null); setMessage(null);
    const now = new Date();
    const deadline = new Date(now.getTime() + 7 * 864e5).toISOString();
    const appealDeadline = new Date(now.getTime() + 14 * 864e5).toISOString();
    try {
      await integrityApi.mutate<ProjectDispute>('/disputes', requestId, {
        projectId, type, reasonCode, responseDeadline: deadline, appealDeadline,
        evidenceRefs: evidenceRefs.split(/[\s,]+/).filter((ref) => /^ev_[A-Za-z0-9_-]+$/.test(ref)),
      });
      setMessage('Dispute filed. Responses, outcomes and remedies are tracked in the timeline.');
      resource.refresh();
    } catch (cause) {
      setError(cause instanceof IntegrityConflictError ? 'The dispute changed. Refresh before retrying.'
        : cause instanceof IntegrityApiError ? cause.message : 'Unable to file the dispute.');
    } finally { setBusy(false); }
  };

  return (
    <section aria-labelledby="disputes-heading" className="mx-auto w-full max-w-3xl space-y-4 p-4 sm:p-6">
      <h2 id="disputes-heading" className="text-lg font-semibold">Project disputes</h2>
      <p className="text-sm text-gray-600">Claims, responses, evidence, deadlines, reasoned outcomes, appeals and idempotent remedies.</p>
      {can('integrity:disputes:file') && (
        <form onSubmit={submit} className="grid gap-3 rounded border border-gray-200 p-4 sm:grid-cols-2">
          <label className="text-sm">Dispute type
            <select value={type} onChange={(event) => setType(event.target.value)} className="mt-1 w-full rounded border p-2">
              {DISPUTE_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-sm">Reason code
            <input required value={reasonCode} onChange={(event) => setReasonCode(event.target.value)} className="mt-1 w-full rounded border p-2" />
          </label>
          <label className="text-sm sm:col-span-2">Evidence references (comma separated, e.g. ev_abc123)
            <input value={evidenceRefs} onChange={(event) => setEvidenceRefs(event.target.value)} className="mt-1 w-full rounded border p-2" />
          </label>
          <button type="submit" disabled={busy} className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:col-span-2">
            {busy ? 'Filing…' : 'File dispute'}
          </button>
          <div aria-live="polite" className="text-sm sm:col-span-2">
            {message && <SuccessState>{message}</SuccessState>}
            {error && <ErrorState message={error} onRetry={() => setError(null)} />}
          </div>
        </form>
      )}
      {!can('integrity:disputes:read') && <p role="status" className="text-sm text-gray-600">You do not have access to disputes for this project.</p>}
      {can('integrity:disputes:read') && resource.status === 'loading' && <LoadingState label="Loading disputes" />}
      {can('integrity:disputes:read') && resource.status === 'empty' && <EmptyState title="No disputes yet">Filed disputes will appear here with their deadlines and outcomes.</EmptyState>}
      {can('integrity:disputes:read') && resource.status === 'error' && <ErrorState message={resource.message ?? 'Unable to load disputes.'} onRetry={resource.refresh} />}
      {can('integrity:disputes:read') && resource.status === 'conflict' && <ConflictState message={resource.message ?? 'Disputes changed.'} onRefresh={resource.refresh} />}
      {can('integrity:disputes:read') && resource.status === 'ready' && (
        <ol aria-label="Dispute timeline" className="space-y-2">
          {resource.data?.map((item) => {
            const safe = publicDispute(item);
            return (
              <li key={safe.id} className="rounded border border-gray-200 p-3 text-sm">
                <span className="font-medium">{safe.id}</span>: {safe.type} · {safe.status} · responds by {safe.responseDeadline} · revision {safe.revision}
                {safe.outcome && <span> · outcome {safe.outcome.reasonCode} / {safe.outcome.remedyCode}</span>}
                {safe.remedy && <span> · remedy applied</span>}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
