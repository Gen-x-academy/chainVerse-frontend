'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import {
  approvalHistory,
  canPublish,
  renderTemplate,
  sampleValuesFor,
  templateService,
  validateTemplate,
} from '../service';
import type { TemplateChannel, TemplateVersion } from '../types';

const CHANNELS: TemplateChannel[] = ['in-app', 'email', 'sms', 'push'];
const LOCALES = ['en', 'es', 'fr', 'pt-BR'];

type ScholarshipTemplateStudioProps = {
  programId?: string;
  canManage?: boolean;
};

type PublishState = 'idle' | 'publishing' | 'success' | 'error';

export function ScholarshipTemplateStudio({
  programId = 'chainverse-scholarship',
  canManage = true,
}: ScholarshipTemplateStudioProps) {
  const formId = useId();
  const bodyFieldId = `${formId}-body`;
  const bodyErrorId = `${formId}-body-errors`;
  const approverFieldId = `${formId}-approver`;
  const subjectFieldId = `${formId}-subject`;

  const [templates, setTemplates] = useState<TemplateVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState('');
  const [edits, setEdits] = useState<Record<string, Partial<TemplateVersion>>>({});
  const [approver, setApprover] = useState('');
  const [publishState, setPublishState] = useState<PublishState>('idle');
  const [publishError, setPublishError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loaded = await templateService.listTemplates();
      setTemplates(loaded);
      setSelectedKey((current) => current || loaded[0]?.templateKey || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load communication templates.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => templates.find((template) => template.templateKey === selectedKey) ?? templates[0] ?? null,
    [selectedKey, templates]
  );

  /** The selected template overlaid with any unsaved edit for that version. */
  const draft = useMemo<TemplateVersion | null>(
    () => (selected ? { ...selected, ...(edits[selected.id] ?? {}) } : null),
    [edits, selected]
  );

  const editDraft = (patch: Partial<TemplateVersion>) => {
    if (!selected) return;
    setEdits((current) => ({ ...current, [selected.id]: { ...(current[selected.id] ?? {}), ...patch } }));
    setPublishState('idle');
    setPublishError('');
  };

  const validation = useMemo(() => (draft ? validateTemplate(draft) : null), [draft]);
  const publishable = Boolean(draft && validation && canPublish(validation) && approver.trim().length > 0);

  const preview = useMemo(() => {
    if (!draft) return null;
    try {
      return { rendered: renderTemplate(draft, sampleValuesFor(draft), { maskPii: true }), error: null };
    } catch (err) {
      return { rendered: null, error: err instanceof Error ? err.message : 'Preview is unavailable.' };
    }
  }, [draft]);

  const history = useMemo(
    () => (draft ? approvalHistory(templates, draft.templateKey) : []),
    [draft, templates]
  );

  const handlePublish = async () => {
    if (!draft || !publishable) return;
    setPublishState('publishing');
    setPublishError('');
    try {
      await templateService.publishTemplate({
        template: draft,
        expectedVersion: draft.version,
        approver: approver.trim(),
        idempotencyKey: `publish-${draft.templateKey}-${draft.version}`,
      });
      setPublishState('success');
      await load();
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : 'Publication failed.');
      setPublishState('error');
    }
  };

  if (!canManage) {
    return (
      <div
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        role="note"
        data-testid="template-permission-denied"
      >
        <h2 className="text-lg font-semibold text-slate-900">Template studio is read-only</h2>
        <p className="mt-2 text-sm text-slate-600">
          Your role cannot edit, approve, or roll back communication templates. Ask a program
          administrator to grant publishing rights, or review the current published copy below.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm"
        role="status"
        aria-live="polite"
      >
        Loading communication templates for {programId}...
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700" role="alert">
          {error}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-slate-300"
        >
          Retry loading templates
        </button>
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div
        className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600"
        role="status"
        aria-live="polite"
      >
        No communication templates exist yet. Create the first template key to start drafting copy.
      </div>
    );
  }

  const keys = [...new Set(templates.map((template) => template.templateKey))];
  const bodyInvalid = Boolean(validation && !validation.valid);

  return (
    <section
      className="mx-auto max-w-6xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      aria-labelledby={`${formId}-heading`}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Comms</p>
      <h2 id={`${formId}-heading`} className="mt-2 text-2xl font-black text-slate-900">
        Template studio
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        Every message is versioned. Publication is blocked until validation passes and an approver is
        recorded.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor={`${formId}-key`} className="block text-sm font-medium text-slate-700">
            Template key
          </label>
          <select
            id={`${formId}-key`}
            value={selectedKey || selected?.templateKey || ''}
            onChange={(event) => setSelectedKey(event.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          >
            {keys.map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${formId}-channel`} className="block text-sm font-medium text-slate-700">
            Channel
          </label>
          <select
            id={`${formId}-channel`}
            value={draft?.channel ?? 'email'}
            onChange={(event) =>
              editDraft({ channel: event.target.value as TemplateChannel })
            }
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          >
            {CHANNELS.map((channel) => (
              <option key={channel} value={channel}>
                {channel}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${formId}-locale`} className="block text-sm font-medium text-slate-700">
            Locale
          </label>
          <select
            id={`${formId}-locale`}
            value={draft?.locale ?? 'en'}
            onChange={(event) =>
              editDraft({ locale: event.target.value })
            }
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          >
            {LOCALES.map((locale) => (
              <option key={locale} value={locale}>
                {locale}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <label htmlFor={subjectFieldId} className="block text-sm font-medium text-slate-700">
            Subject
          </label>
          <input
            id={subjectFieldId}
            type="text"
            value={draft?.subject ?? ''}
            onChange={(event) =>
              editDraft({ subject: event.target.value })
            }
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          />

          <label htmlFor={bodyFieldId} className="mt-4 block text-sm font-medium text-slate-700">
            Body copy (use {'{{variable}}'} tokens)
          </label>
          <textarea
            id={bodyFieldId}
            rows={8}
            value={draft?.body ?? ''}
            onChange={(event) =>
              editDraft({ body: event.target.value })
            }
            aria-invalid={bodyInvalid}
            aria-describedby={bodyErrorId}
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          />

          <div
            id={bodyErrorId}
            className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
            role="status"
            aria-live="polite"
          >
            {validation && validation.valid ? (
              <p>Validation passed. The template can be published once an approver is recorded.</p>
            ) : (
              <ul className="list-disc space-y-1 pl-5">
                {(validation?.errors ?? []).map((errorItem) => (
                  <li key={`${errorItem.code}-${errorItem.token ?? errorItem.message}`}>
                    <span className="font-semibold">{errorItem.code}</span>: {errorItem.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-slate-900">Preview</h3>
          <p className="mt-1 text-sm text-slate-600">
            Sample values are substituted. Tokens marked as personal data are masked.
          </p>
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
            {preview?.error ? (
              <p role="alert" className="text-red-700">
                {preview.error}
              </p>
            ) : preview?.rendered ? (
              <>
                {preview.rendered.subject ? (
                  <p className="font-semibold">{preview.rendered.subject}</p>
                ) : null}
                <p className="mt-2 whitespace-pre-wrap">{preview.rendered.renderedBody}</p>
              </>
            ) : (
              <p className="text-slate-500">No preview is available yet.</p>
            )}
          </div>

          <label htmlFor={approverFieldId} className="mt-4 block text-sm font-medium text-slate-700">
            Approver
          </label>
          <input
            id={approverFieldId}
            type="text"
            value={approver}
            onChange={(event) => setApprover(event.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          />

          <button
            type="button"
            onClick={() => void handlePublish()}
            disabled={!publishable || publishState === 'publishing'}
            aria-busy={publishState === 'publishing'}
            className="mt-4 w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {publishState === 'publishing' ? 'Publishing...' : 'Publish version'}
          </button>
          {!publishable && (
            <p className="mt-2 text-xs text-slate-500">
              Publishing stays disabled until validation passes and an approver name is supplied.
            </p>
          )}
          {publishState === 'success' && (
            <p role="status" aria-live="polite" className="mt-2 text-sm text-emerald-800">
              Published. The previous published version is now marked rolled back.
            </p>
          )}
          {publishState === 'error' && (
            <p role="alert" className="mt-2 text-sm text-red-700">
              {publishError}
            </p>
          )}
        </div>
      </div>

      <div className="mt-8">
        <h3 className="text-lg font-semibold text-slate-900">Approval and rollback history</h3>
        {history.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">No version of this template has been approved yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {history.map((entry) => (
              <li
                key={entry.id}
                className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"
              >
                <span className="font-semibold">v{entry.version}</span> — {entry.status} — approved by{' '}
                {entry.approvedBy ?? 'no approver recorded'}
                {entry.publishedAt ? ` on ${entry.publishedAt}` : ''}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export default ScholarshipTemplateStudio;
