'use client';

import { useState } from 'react';
import { REPORT_CATEGORIES, type IntegrityReport } from './reports';
import { ConflictState, EmptyState, ErrorState, LoadingState, SuccessState } from './IntegrityStates';
import { IntegrityApiError, IntegrityConflictError, integrityApi } from './shared';
import { useIntegrityResource } from './useIntegrityResource';
import { useIntegritySession } from './useIntegritySession';

export function ConcernReportPanel({ projectId }: { projectId: string }) {
  const { actorId, can } = useIntegritySession();
  const resource = useIntegrityResource<IntegrityReport[]>(projectId ? `/reports?projectId=${encodeURIComponent(projectId)}` : null);
  const [category, setCategory] = useState<string>(REPORT_CATEGORIES[0]);
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high'>('medium');
  const [evidenceRefs, setEvidenceRefs] = useState('');
  const [contact, setContact] = useState<'none' | 'platform_email' | 'platform_phone'>('none');
  const [requestId] = useState(() => integrityApi.newRequestId());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!actorId || !can('integrity:reports:submit')) return;
    setBusy(true); setError(null); setMessage(null);
    try {
      await integrityApi.mutate<IntegrityReport>('/reports', requestId, {
        projectId, category, severity, contactPreference: contact,
        evidenceRefs: evidenceRefs.split(/[\s,]+/).filter(Boolean).filter((ref) => /^ev_[A-Za-z0-9_-]+$/.test(ref)),
      });
      setMessage('Report submitted. Your contact preference and evidence references were saved privately.');
      resource.refresh();
    } catch (cause) {
      setError(cause instanceof IntegrityConflictError ? 'This report changed. Refresh before retrying.'
        : cause instanceof IntegrityApiError ? cause.message : 'Unable to submit the report.');
    } finally { setBusy(false); }
  };

  return (
    <section aria-labelledby="reports-heading" className="mx-auto w-full max-w-3xl space-y-4 p-4 sm:p-6">
      <h2 id="reports-heading" className="text-lg font-semibold">Report an integrity concern</h2>
      <p className="text-sm text-gray-600">Use opaque evidence references; do not paste private research, identity or financial content.</p>
      {can('integrity:reports:submit') && (
        <form onSubmit={submit} className="grid gap-3 rounded border border-gray-200 p-4 sm:grid-cols-2">
          <label className="text-sm">Category
            <select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-1 w-full rounded border p-2">
              {REPORT_CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-sm">Severity
            <select value={severity} onChange={(event) => setSeverity(event.target.value as typeof severity)} className="mt-1 w-full rounded border p-2">
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
            </select>
          </label>
          <label className="text-sm sm:col-span-2">Evidence references (comma separated, e.g. ev_abc123)
            <input value={evidenceRefs} onChange={(event) => setEvidenceRefs(event.target.value)} className="mt-1 w-full rounded border p-2" />
          </label>
          <label className="text-sm sm:col-span-2">Safe contact preference
            <select value={contact} onChange={(event) => setContact(event.target.value as typeof contact)} className="mt-1 w-full rounded border p-2">
              <option value="none">No contact</option><option value="platform_email">Through platform email</option><option value="platform_phone">Through platform phone</option>
            </select>
          </label>
          <button type="submit" disabled={busy} className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:col-span-2">
            {busy ? 'Submitting…' : 'Submit report'}
          </button>
          <div aria-live="polite" className="text-sm sm:col-span-2">
            {message && <SuccessState>{message}</SuccessState>}
            {error && <ErrorState message={error} onRetry={() => setError(null)} />}
          </div>
        </form>
      )}
      {!can('integrity:reports:read') && <p role="status" className="text-sm text-gray-600">You do not have access to the report queue.</p>}
      {can('integrity:reports:read') && resource.status === 'loading' && <LoadingState label="Loading reports" />}
      {can('integrity:reports:read') && resource.status === 'empty' && <EmptyState title="No reports yet">Reports for this project will appear here.</EmptyState>}
      {can('integrity:reports:read') && resource.status === 'error' && <ErrorState message={resource.message ?? 'Unable to load reports.'} onRetry={resource.refresh} />}
      {can('integrity:reports:read') && resource.status === 'conflict' && <ConflictState message={resource.message ?? 'Reports changed.'} onRefresh={resource.refresh} />}
      {can('integrity:reports:read') && resource.status === 'ready' && (
        <ul aria-label="Report queue" className="space-y-2">
          {resource.data?.map((item) => (
            <li key={item.id} className="rounded border border-gray-200 p-3 text-sm">{item.id}: {item.category} · {item.status} · revision {item.revision}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
