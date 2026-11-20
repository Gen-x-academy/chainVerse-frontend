'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ExportJob } from '@/src/features/library/types/export.types';
import {
  createRevisionRequest,
  fetchRevisionRequests,
  submitRevisionResponse,
  type RevisionChangeItem,
  type RevisionRequest,
  type RevisionResponse,
} from '@/src/features/capstone/api/revisions.client';
import {
  RevisionConflictError,
  RevisionValidationError,
  type RevisionError,
} from '@/src/features/capstone/types/revision.types';

interface ExportJobStatusProps {
  jobs: ExportJob[];
  isLoading?: boolean;
  error?: string | null;
}

function formatExpiry(expiresAt?: string): string {
  if (!expiresAt) return '—';
  const expiry = new Date(expiresAt);
  const now = new Date();
  if (expiry <= now) return 'Expired';
  const hours = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60));
  return `Expires in ${hours}h`;
}

const STATUS_LABEL: Record<ExportJob['status'], string> = {
  pending: 'Queued',
  processing: 'Processing',
  completed: 'Ready',
  failed: 'Failed',
  expired: 'Expired',
};

/** #929: Background export job list with download expiry */
export function ExportJobStatus({ jobs, isLoading, error }: ExportJobStatusProps) {
  return <ExportJobTable jobs={jobs} isLoading={isLoading} error={error} />;
}

function ExportJobTable({ jobs, isLoading, error }: ExportJobStatusProps) {
  if (isLoading) {
    return (
      <div aria-label="Loading export jobs" className="py-6 text-center text-sm text-muted-foreground">
        Loading export jobs…
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No export jobs yet. Start an export above.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-2 pr-4">Created</th>
            <th className="py-2 pr-4">Format</th>
            <th className="py-2 pr-4">Records</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4 hidden sm:table-cell">Expiry</th>
            <th className="py-2">Download</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id} className="border-b">
              <td className="py-2 pr-4">{new Date(job.createdAt).toLocaleString()}</td>
              <td className="py-2 pr-4 uppercase">{job.format}</td>
              <td className="py-2 pr-4">{job.estimatedRecords}</td>
              <td className="py-2 pr-4">
                <span className={
                  job.status === 'expired' ? 'text-muted-foreground line-through' :
                  job.status === 'failed' ? 'text-destructive' :
                  job.status === 'completed' ? 'text-green-700' : ''
                }>
                  {STATUS_LABEL[job.status]}
                </span>
              </td>
              <td className="py-2 pr-4 hidden sm:table-cell">
                <span className={job.status === 'expired' ? 'text-destructive font-medium' : ''}>
                  {formatExpiry(job.expiresAt)}
                </span>
              </td>
              <td className="py-2">
                {job.status === 'completed' && job.downloadUrl ? (
                  <a
                    href={job.downloadUrl}
                    className="text-indigo-600 hover:underline font-medium"
                    download
                  >
                    Download
                  </a>
                ) : job.status === 'expired' ? (
                  <span className="text-muted-foreground text-xs">Link expired</span>
                ) : job.status === 'processing' || job.status === 'pending' ? (
                  <span className="text-muted-foreground text-xs">In progress…</span>
                ) : job.errorMessage ? (
                  <span className="text-destructive text-xs">{job.errorMessage}</span>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* CAPSTONE-078: Request proposal revisions                            */
/* ------------------------------------------------------------------ */

const MAX_CHANGE_ITEMS = 20;
const MAX_ITEM_LENGTH = 500;
const MIN_DEADLINE_HOURS = 1;
const MAX_DEADLINE_DAYS = 30;

interface RevisionRequestPanelProps {
  projectId: string;
  proposalId: string;
  /** Exact proposal version the reviewer is looking at. */
  proposalVersion: number;
  /** Latest version known to the server; used to detect stale views. */
  latestProposalVersion?: number;
  /** Role-aware: only reviewers may create requests. */
  canRequestRevisions?: boolean;
  /** Role-aware: only the owning team may respond. */
  canRespond?: boolean;
  onNotify?: (message: string) => void;
}

type PanelState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'empty' }
  | { kind: 'ready'; requests: RevisionRequest[] };

type SubmitState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success'; message: string }
  | { kind: 'conflict'; message: string; latestVersion?: number }
  | { kind: 'error'; message: string };

function newChangeItem(): RevisionChangeItem {
  return { id: crypto.randomUUID(), section: '', description: '' };
}

function defaultDeadline(): string {
  const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  d.setMinutes(0, 0, 0);
  return d.toISOString().slice(0, 16);
}

function toRevisionError(err: unknown): RevisionError {
  if (err instanceof RevisionConflictError) {
    return { code: 'stale_version', message: err.message, latestVersion: err.latestVersion };
  }
  if (err instanceof RevisionValidationError) {
    return { code: 'validation', message: err.message, field: err.field };
  }
  return { code: 'unknown', message: 'Something went wrong. Please try again.' };
}

function validateForm(items: RevisionChangeItem[], deadline: string): string | null {
  const filled = items.filter((i) => i.section.trim() || i.description.trim());
  if (filled.length === 0) return 'Add at least one change item.';
  if (filled.length > MAX_CHANGE_ITEMS) return `At most ${MAX_CHANGE_ITEMS} change items are allowed.`;
  for (const item of filled) {
    if (!item.section.trim()) return 'Each change item needs a section.';
    if (!item.description.trim()) return 'Each change item needs a description.';
    if (item.description.length > MAX_ITEM_LENGTH) {
      return `Change item descriptions must be ${MAX_ITEM_LENGTH} characters or fewer.`;
    }
  }
  const parsed = new Date(deadline);
  if (Number.isNaN(parsed.getTime())) return 'Choose a valid deadline.';
  const hours = (parsed.getTime() - Date.now()) / (1000 * 60 * 60);
  if (hours < MIN_DEADLINE_HOURS) return 'Deadline must be at least one hour from now.';
  if (hours > MAX_DEADLINE_DAYS * 24) return `Deadline must be within ${MAX_DEADLINE_DAYS} days.`;
  return null;
}

function RevisionStatusBadge({ request }: { request: RevisionRequest }) {
  const label =
    request.status === 'pending'
      ? 'Awaiting response'
      : request.status === 'responded'
        ? 'Response submitted'
        : request.status === 'resubmitted'
          ? 'Resubmitted'
          : request.status === 'expired'
            ? 'Deadline passed'
            : 'Closed';
  const tone =
    request.status === 'expired'
      ? 'text-destructive'
      : request.status === 'resubmitted'
        ? 'text-green-700'
        : 'text-muted-foreground';
  return <span className={`text-xs font-medium ${tone}`}>{label}</span>;
}

export function RevisionRequestPanel({
  projectId,
  proposalId,
  proposalVersion,
  latestProposalVersion,
  canRequestRevisions = false,
  canRespond = false,
  onNotify,
}: RevisionRequestPanelProps) {
  const formId = useId();
  const [state, setState] = useState<PanelState>({ kind: 'loading' });
  const [items, setItems] = useState<RevisionChangeItem[]>([newChangeItem()]);
  const [deadline, setDeadline] = useState<string>(defaultDeadline);
  const [summary, setSummary] = useState('');
  const [submitState, setSubmitState] = useState<SubmitState>({ kind: 'idle' });
  const [responseDraft, setResponseDraft] = useState<Record<string, string>>({});
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const idempotencyKey = useRef<string>(crypto.randomUUID());
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const requests = await fetchRevisionRequests(projectId, proposalId);
      if (!mounted.current) return;
      setState(requests.length === 0 ? { kind: 'empty' } : { kind: 'ready', requests });
    } catch (err) {
      if (!mounted.current) return;
      setState({ kind: 'error', message: toRevisionError(err).message });
    }
  }, [projectId, proposalId]);

  useEffect(() => {
    void load();
  }, [load]);

  const isStale = useMemo(
    () => typeof latestProposalVersion === 'number' && latestProposalVersion !== proposalVersion,
    [latestProposalVersion, proposalVersion],
  );

  const updateItem = (id: string, patch: Partial<RevisionChangeItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const addItem = () => {
    setItems((prev) => (prev.length >= MAX_CHANGE_ITEMS ? prev : [...prev, newChangeItem()]));
  };

  const removeItem = (id: string) => {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((item) => item.id !== id)));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitState.kind === 'submitting') return;
    const validationError = validateForm(items, deadline);
    if (validationError) {
      setSubmitState({ kind: 'error', message: validationError });
      return;
    }
    if (isStale) {
      setSubmitState({
        kind: 'conflict',
        message: `This proposal has moved to version ${latestProposalVersion}. Reload before requesting revisions.`,
        latestVersion: latestProposalVersion,
      });
      return;
    }

    const snapshot = { items, deadline, summary };
    setSubmitState({ kind: 'submitting' });
    try {
      const created = await createRevisionRequest(
        projectId,
        {
          proposalId,
          proposalVersion,
          deadline: new Date(deadline).toISOString(),
          summary: summary.trim() || undefined,
          changeItems: items
            .filter((i) => i.section.trim() || i.description.trim())
            .map((i) => ({ section: i.section.trim(), description: i.description.trim() })),
        },
        idempotencyKey.current,
      );
      if (!mounted.current) return;
      idempotencyKey.current = crypto.randomUUID();
      setItems([newChangeItem()]);
      setSummary('');
      setSubmitState({ kind: 'success', message: 'Revision request sent to the project team.' });
      setState((prev) =>
        prev.kind === 'ready'
          ? { kind: 'ready', requests: [created, ...prev.requests] }
          : { kind: 'ready', requests: [created] },
      );
      onNotify?.('Revision request sent.');
    } catch (err) {
      if (!mounted.current) return;
      // Optimistic rollback: restore the draft the reviewer had before submitting.
      setItems(snapshot.items);
      setDeadline(snapshot.deadline);
      setSummary(snapshot.summary);
      const revisionError = toRevisionError(err);
      if (revisionError.code === 'stale_version') {
        setSubmitState({
          kind: 'conflict',
          message: revisionError.message,
          latestVersion: revisionError.latestVersion,
        });
      } else {
        setSubmitState({ kind: 'error', message: revisionError.message });
      }
    }
  };

  const handleRespond = async (request: RevisionRequest) => {
    const draft = (responseDraft[request.id] ?? '').trim();
    if (!draft) {
      setSubmitState({ kind: 'error', message: 'Describe the changes you made before resubmitting.' });
      return;
    }
    if (request.status !== 'pending') {
      setSubmitState({
        kind: 'conflict',
        message: 'This request is no longer open for responses. Reload to see the latest status.',
      });
      return;
    }
    setRespondingId(request.id);
    setSubmitState({ kind: 'submitting' });
    try {
      const response: RevisionResponse = await submitRevisionResponse(
        projectId,
        request.id,
        { message: draft, proposalVersion },
        `${request.id}:${proposalVersion}`,
      );
      if (!mounted.current) return;
      setState((prev) =>
        prev.kind === 'ready'
          ? {
              kind: 'ready',
              requests: prev.requests.map((r) =>
                r.id === request.id ? { ...r, status: 'responded', response } : r,
              ),
            }
          : prev,
      );
      setResponseDraft((prev) => ({ ...prev, [request.id]: '' }));
      setSubmitState({ kind: 'success', message: 'Response submitted. The reviewer will be notified.' });
      onNotify?.('Revision response submitted.');
    } catch (err) {
      if (!mounted.current) return;
      const revisionError = toRevisionError(err);
      if (revisionError.code === 'stale_version') {
        setSubmitState({
          kind: 'conflict',
          message: revisionError.message,
          latestVersion: revisionError.latestVersion,
        });
      } else {
        setSubmitState({ kind: 'error', message: revisionError.message });
      }
    } finally {
      if (mounted.current) setRespondingId(null);
    }
  };

  if (state.kind === 'loading') {
    return (
      <section aria-busy="true" aria-label="Loading revision requests" className="py-6 text-center text-sm text-muted-foreground">
        Loading revision requests…
      </section>
    );
  }

  if (state.kind === 'error') {
    return (
      <section role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        <p>{state.message}</p>
        <button type="button" onClick={() => void load()} className="mt-2 underline">
          Retry
        </button>
      </section>
    );
  }

  return (
    <section aria-labelledby={`${formId}-heading`} className="space-y-6">
      <header className="space-y-1">
        <h2 id={`${formId}-heading`} className="text-lg font-semibold">
          Request proposal revisions
        </h2>
        <p className="text-sm text-muted-foreground">
          Pinned to proposal version {proposalVersion}. Requests are tied to this exact version.
        </p>
      </header>

      {isStale && (
        <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          A newer proposal version ({latestProposalVersion}) exists. Reload before requesting revisions.
        </div>
      )}

      {submitState.kind === 'success' && (
        <div role="status" aria-live="polite" className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-800">
          {submitState.message}
        </div>
      )}
      {submitState.kind === 'conflict' && (
        <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p>{submitState.message}</p>
          <button type="button" onClick={() => void load()} className="mt-2 underline">
            Reload requests
          </button>
        </div>
      )}
      {submitState.kind === 'error' && (
        <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {submitState.message}
        </div>
      )}

      {canRequestRevisions && (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Change items</legend>
            {items.map((item, index) => (
              <div key={item.id} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]">
                <label className="sr-only" htmlFor={`${formId}-section-${item.id}`}>
                  Section for change item {index + 1}
                </label>
                <input
                  id={`${formId}-section-${item.id}`}
                  value={item.section}
                  onChange={(e) => updateItem(item.id, { section: e.target.value })}
                  placeholder="Section (e.g. Methodology)"
                  maxLength={120}
                  className="rounded-md border px-3 py-2 text-sm"
                />
                <label className="sr-only" htmlFor={`${formId}-desc-${item.id}`}>
                  Description for change item {index + 1}
                </label>
                <input
                  id={`${formId}-desc-${item.id}`}
                  value={item.description}
                  onChange={(e) => updateItem(item.id, { description: e.target.value })}
                  placeholder="Requested change"
                  maxLength={MAX_ITEM_LENGTH}
                  className="rounded-md border px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  disabled={items.length <= 1}
                  aria-label={`Remove change item ${index + 1}`}
                  className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addItem}
              disabled={items.length >= MAX_CHANGE_ITEMS}
              className="text-sm text-indigo-600 underline disabled:opacity-50"
            >
              Add change item
            </button>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`${formId}-deadline`} className="block text-sm font-medium">
                Response deadline
              </label>
              <input
                id={`${formId}-deadline`}
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label htmlFor={`${formId}-summary`} className="block text-sm font-medium">
                Summary (optional)
              </label>
              <input
                id={`${formId}-summary`}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                maxLength={300}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitState.kind === 'submitting' || isStale}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {submitState.kind === 'submitting' ? 'Sending…' : 'Send revision request'}
          </button>
        </form>
      )}

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Revision requests</h3>
        {state.kind === 'empty' ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No revision requests yet for this proposal.
          </p>
        ) : (
          <ul className="space-y-3">
            {state.requests.map((request) => (
              <li key={request.id} className="rounded-md border p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">Version {request.proposalVersion}</span>
                  <RevisionStatusBadge request={request} />
                </div>
                <p className="mt-1 text-muted-foreground">
                  Deadline: {new Date(request.deadline).toLocaleString()}
                </p>
                {request.summary && <p className="mt-1">{request.summary}</p>}
                <ul className="mt-2 list-disc pl-5">
                  {request.changeItems.map((item, i) => (
                    <li key={`${request.id}-${i}`}>
                      <span className="font-medium">{item.section}:</span> {item.description}
                    </li>
                  ))}
                </ul>
                {request.response && (
                  <p className="mt-2 rounded bg-muted/40 p-2">
                    <span className="font-medium">Team response:</span> {request.response.message}
                  </p>
                )}
                {canRespond && request.status === 'pending' && (
                  <div className="mt-3 space-y-2">
                    <label htmlFor={`${formId}-resp-${request.id}`} className="block text-xs font-medium">
                      Describe your changes
                    </label>
                    <textarea
                      id={`${formId}-resp-${request.id}`}
                      value={responseDraft[request.id] ?? ''}
                      onChange={(e) =>
                        setResponseDraft((prev) => ({ ...prev, [request.id]: e.target.value }))
                      }
                      maxLength={MAX_ITEM_LENGTH}
                      rows={3}
                      className="w-full rounded-md border px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => void handleRespond(request)}
                      disabled={respondingId === request.id || submitState.kind === 'submitting'}
                      className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
                    >
                      {respondingId === request.id ? 'Submitting…' : 'Submit response'}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
