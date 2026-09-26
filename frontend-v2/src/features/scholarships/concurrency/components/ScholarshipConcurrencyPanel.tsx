'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import {
  applyOptimistic,
  buildFieldDiffs,
  commitWrite,
  describeConflict,
  rebaseOntoServer,
  scholarshipConcurrencyService,
} from '../service';
import type {
  ConcurrencyWriteResult,
  ConflictError,
  FieldDiff,
  VersionedDocument,
  VersionedResource,
} from '../types';

type ScholarshipConcurrencyPanelProps = {
  canManage?: boolean;
  resourceType?: VersionedResource['resourceType'];
  resourceId?: string;
};

type ProgramFields = {
  title: string;
  awardCeilingCents: number;
  currency: string;
  notes: string;
};

const INPUT_CLASS =
  'mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-100';

const moneyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

function formatMoney(cents: number, currency: string): string {
  if (currency !== 'USD') return `${currency} ${(cents / 100).toFixed(2)}`;
  return moneyFormatter.format(cents / 100);
}

export function ScholarshipConcurrencyPanel({
  canManage = true,
  resourceType = 'program',
  resourceId = 'chainverse-scholarship',
}: ScholarshipConcurrencyPanelProps) {
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const ceilingId = `${baseId}-ceiling`;
  const notesId = `${baseId}-notes`;
  const titleErrorId = `${baseId}-title-error`;

  const [document_, setDocument_] = useState<VersionedDocument | null>(null);
  /**
   * The version this editor still holds. It is deliberately separate from the
   * server state so a concurrent server edit leaves the held version stale,
   * which is exactly what the write guard has to catch.
   */
  const [held, setHeld] = useState<VersionedResource | null>(null);
  const [fields, setFields] = useState<ProgramFields | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<ConflictError | null>(null);
  const [diffs, setDiffs] = useState<FieldDiff[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const remote = await scholarshipConcurrencyService.load(resourceType, resourceId);
      setDocument_(remote);
      setHeld(remote ? remote.resource : null);
      if (remote) {
        setFields({
          title: String(remote.fields.title ?? ''),
          awardCeilingCents: Number(remote.fields.awardCeilingCents ?? 0),
          currency: String(remote.fields.currency ?? 'USD'),
          notes: String(remote.fields.notes ?? ''),
        });
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Unable to load the resource version.'
      );
      setDocument_(null);
      setHeld(null);
    } finally {
      setLoading(false);
    }
  }, [resourceType, resourceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const serverVersion = document_?.resource.version ?? 0;

  const clientResource: VersionedResource | null = held;

  if (loading) {
    return (
      <div
        className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm"
        role="status"
        aria-live="polite"
      >
        Loading the current version of this resource...
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700"
        role="alert"
      >
        <p className="font-semibold">The resource version could not be loaded.</p>
        <p className="mt-2">{error}</p>
        <p className="mt-2">Nothing can be written safely until the current version is known.</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-3 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-200"
        >
          Retry loading the resource
        </button>
      </div>
    );
  }

  if (!document_ || !fields || !clientResource) {
    return (
      <div
        className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600"
        role="status"
        aria-live="polite"
      >
        <p className="font-semibold text-slate-900">No versioned resource was found.</p>
        <p className="mt-2">
          Open a {resourceType} first, then return here to edit it under version control.
        </p>
      </div>
    );
  }

  const edit = (patch: Partial<ProgramFields>) => {
    setFields((current) =>
      current ? applyOptimistic(current, (draft) => ({ ...draft, ...patch })) : current
    );
  };

  /**
   * Simulates a second editor saving first. The local client keeps its stale
   * version, which is exactly the situation the write guard has to catch.
   */
  const simulateServerEdit = () => {
    setDocument_((current) => {
      if (!current) return current;
      const resource: VersionedResource = {
        ...current.resource,
        version: current.resource.version + 1,
        updatedAt: new Date().toISOString(),
        updatedBy: 'reviewer-two',
      };
      return {
        resource,
        fields: {
          ...current.fields,
          title: 'ChainVerse Scholarship (renamed by another editor)',
          notes: 'Award ceiling frozen by finance.',
        },
      };
    });
    setConflict(null);
    setDiffs([]);
    setStatus('Another editor saved a new version. Your edit still holds the previous version.');
  };

  const submit = () => {
    if (!fields.title.trim()) {
      setTitleError('A program title is required before saving.');
      return;
    }
    setTitleError(null);
    setSubmitting(true);
    setStatus(null);

    const server = document_.resource;
    const result: ConcurrencyWriteResult<ProgramFields & { version: number; updatedAt: string }> =
      commitWrite({
        base: clientResource,
        incoming: clientResource,
        server,
        fields,
        serverFields: document_.fields,
        now: new Date(),
      });

    setSubmitting(false);

    if (result.status === 'conflict') {
      setConflict(result.conflict);
      setDiffs(
        buildFieldDiffs(
          document_.fields as Record<string, unknown>,
          fields as unknown as Record<string, unknown>,
          document_.fields as Record<string, unknown>
        )
      );
      setStatus(null);
      return;
    }

    const { version, updatedAt, ...appliedFields } = result.value;
    const appliedResource: VersionedResource = { ...server, version, updatedAt, updatedBy: 'you' };
    setDocument_({ resource: appliedResource, fields: appliedFields });
    setHeld(appliedResource);
    setFields(appliedFields as ProgramFields);
    setConflict(null);
    setDiffs([]);
    setStatus(`Saved cleanly as version ${version}.`);
  };

  const reloadServerValue = () => {
    if (!document_) return;
    setFields({
      title: String(document_.fields.title ?? ''),
      awardCeilingCents: Number(document_.fields.awardCeilingCents ?? 0),
      currency: String(document_.fields.currency ?? 'USD'),
      notes: String(document_.fields.notes ?? ''),
    });
    setHeld(document_.resource);
    setConflict(null);
    setDiffs([]);
    setStatus(`Reloaded the server value at version ${document_.resource.version}. Your edit was discarded.`);
  };

  const keepMineAndRebase = () => {
    if (!document_) return;
    const rebased = rebaseOntoServer(
      fields as unknown as Record<string, unknown>,
      document_.fields as Record<string, unknown>
    ) as unknown as ProgramFields;
    const result = commitWrite({
      base: document_.resource,
      incoming: document_.resource,
      server: document_.resource,
      fields: rebased as unknown as Record<string, unknown>,
      serverFields: document_.fields as Record<string, unknown>,
      now: new Date(),
    });

    if (result.status === 'applied') {
      const { version, updatedAt, ...appliedFields } = result.value;
      const appliedResource: VersionedResource = {
        ...document_.resource,
        version,
        updatedAt,
        updatedBy: 'you',
      };
      setDocument_({ resource: appliedResource, fields: appliedFields });
      setHeld(appliedResource);
      setFields(appliedFields as ProgramFields);
      setConflict(null);
      setDiffs([]);
      setStatus(`Rebased onto version ${document_.resource.version} and saved as version ${version}.`);
      return;
    }

    setConflict(result.conflict);
  };

  return (
    <section
      className="mx-auto max-w-5xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      aria-labelledby={`${baseId}-heading`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">
            Optimistic concurrency
          </p>
          <h2 id={`${baseId}-heading`} className="mt-2 text-3xl font-black text-slate-900">
            Version guard and conflict review
          </h2>
        </div>
        <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">
          Server version {serverVersion}
        </span>
      </div>

      {!canManage && (
        <div
          className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
          role="note"
        >
          <p className="font-semibold">You do not have permission to write this resource.</p>
          <p className="mt-1">
            The editor is read-only. Ask a finance operator or an administrator to submit the write.
          </p>
        </div>
      )}

      <p className="mt-4 text-sm text-slate-600">
        You are editing version {clientResource.version} of{' '}
        <span className="font-semibold text-slate-800">
          {resourceType} {document_.resource.resourceId}
        </span>
        . A write is only applied when that version still matches the server; otherwise the whole
        write is rejected and nothing changes.
      </p>

      {status && (
        <div
          className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
          role="status"
          aria-live="polite"
        >
          {status}
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
          <h3 className="text-lg font-semibold text-slate-900">Your edit</h3>
          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor={titleId} className="block text-sm font-medium text-slate-700">
                Program title
              </label>
              <input
                id={titleId}
                type="text"
                value={fields.title}
                disabled={!canManage}
                aria-invalid={titleError ? true : undefined}
                aria-describedby={titleError ? titleErrorId : undefined}
                onChange={(event) => edit({ title: event.target.value })}
                className={INPUT_CLASS}
              />
              {titleError && (
                <p id={titleErrorId} role="alert" className="mt-1 text-sm text-red-700">
                  {titleError}
                </p>
              )}
            </div>

            <div>
              <label htmlFor={ceilingId} className="block text-sm font-medium text-slate-700">
                Award ceiling ({fields.currency}, minor units)
              </label>
              <input
                id={ceilingId}
                type="number"
                min={0}
                value={fields.awardCeilingCents}
                disabled={!canManage}
                onChange={(event) => edit({ awardCeilingCents: Number(event.target.value) })}
                className={INPUT_CLASS}
              />
              <p className="mt-1 text-xs text-slate-500">
                Displayed as {formatMoney(fields.awardCeilingCents, fields.currency)}
              </p>
            </div>

            <div>
              <label htmlFor={notesId} className="block text-sm font-medium text-slate-700">
                Notes
              </label>
              <textarea
                id={notesId}
                rows={3}
                value={fields.notes}
                disabled={!canManage}
                onChange={(event) => edit({ notes: event.target.value })}
                className={INPUT_CLASS}
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={simulateServerEdit}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-200"
              >
                Simulate a concurrent server edit
              </button>
              <button
                type="button"
                disabled={!canManage || submitting}
                aria-busy={submitting}
                onClick={submit}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Submitting...' : 'Submit with the held version'}
              </button>
            </div>
            {!canManage && (
              <p className="text-sm text-amber-800">
                Submitting is disabled for your role — a finance operator or administrator can
                submit on your behalf.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
          <h3 className="text-lg font-semibold text-slate-900">Server state</h3>
          <dl className="mt-4 space-y-2 text-sm text-slate-700">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Version</dt>
              <dd className="font-semibold text-slate-900">{serverVersion}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Updated at</dt>
              <dd>{document_.resource.updatedAt}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Updated by</dt>
              <dd>{document_.resource.updatedBy}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Title on server</dt>
              <dd className="text-right font-medium">{String(document_.fields.title ?? '—')}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Ceiling on server</dt>
              <dd>
                {formatMoney(
                  Number(document_.fields.awardCeilingCents ?? 0),
                  String(document_.fields.currency ?? 'USD')
                )}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {conflict && (
        <div
          className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5"
          role="alert"
          aria-labelledby={`${baseId}-conflict-heading`}
        >
          <h3
            id={`${baseId}-conflict-heading`}
            className="text-lg font-semibold text-red-800"
          >
            Save rejected — version conflict
          </h3>
          <p className="mt-2 text-sm text-red-700">{describeConflict(conflict)}</p>

          <table className="mt-4 w-full border-collapse text-left text-sm">
            <caption className="sr-only">
              Field-by-field comparison of your edit against the current server value
            </caption>
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-600">
                <th scope="col" className="border-b border-red-200 py-2 pr-3">
                  Field
                </th>
                <th scope="col" className="border-b border-red-200 py-2 pr-3">
                  Common base
                </th>
                <th scope="col" className="border-b border-red-200 py-2 pr-3">
                  Yours
                </th>
                <th scope="col" className="border-b border-red-200 py-2">
                  Theirs (server)
                </th>
              </tr>
            </thead>
            <tbody>
              {diffs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-3 text-sm text-slate-700">
                    No field-level differences were reported; the version moved without changing
                    the payload.
                  </td>
                </tr>
              ) : (
                diffs.map((diff) => (
                  <tr key={diff.field} className="align-top">
                    <th scope="row" className="py-2 pr-3 font-semibold text-slate-900">
                      {diff.field}
                    </th>
                    <td className="py-2 pr-3 text-slate-600">{String(diff.base)}</td>
                    <td className="py-2 pr-3 font-medium text-indigo-700">{String(diff.yours)}</td>
                    <td className="py-2 font-medium text-emerald-700">{String(diff.theirs)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={reloadServerValue}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              Reload server value
            </button>
            <button
              type="button"
              onClick={keepMineAndRebase}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              Keep mine (rebase)
            </button>
          </div>
          <p className="mt-3 text-sm text-slate-700">
            Reloading discards your edit and adopts the server value. Rebasing keeps your fields
            and re-applies them on top of the current server version.
          </p>
        </div>
      )}
    </section>
  );
}
