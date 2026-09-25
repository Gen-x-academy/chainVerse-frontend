'use client';

import { useEffect, useState } from 'react';
import {
  infoRequestService,
  validateInfoRequest,
  isRequestOverdue,
} from '../info-request';
import type {
  InfoRequest,
  InfoResponse,
  InfoRequestField,
  CreateInfoRequestPayload,
} from '../info-request';

const STATUS_STYLES: Record<InfoRequest['status'], string> = {
  open: 'bg-indigo-100 text-indigo-700',
  responded: 'bg-emerald-100 text-emerald-700',
  overdue: 'bg-red-100 text-red-700',
  closed: 'bg-slate-100 text-slate-600',
};

interface Props {
  applicationId: string;
  reviewerId: string;
  /** When true, shows the response view for an applicant rather than the request creation form. */
  applicantMode?: boolean;
}

export function InfoRequestPanel({ applicationId, reviewerId, applicantMode = false }: Props) {
  const [requests, setRequests] = useState<InfoRequest[]>([]);
  const [responses, setResponses] = useState<Record<string, InfoResponse | null>>({});
  const [loadStatus, setLoadStatus] = useState<'loading' | 'loaded' | 'error'>('loading');

  const [fields, setFields] = useState<InfoRequestField[]>([
    { fieldKey: '', label: '', required: true },
  ]);
  const [message, setMessage] = useState('');
  const [deadline, setDeadline] = useState('');
  const [createStatus, setCreateStatus] = useState<'idle' | 'creating' | 'created' | 'error'>('idle');
  const [createErrors, setCreateErrors] = useState<{ field: string; message: string }[]>([]);

  useEffect(() => {
    let mounted = true;
    setLoadStatus('loading');
    infoRequestService
      .list(applicationId)
      .then(async (list) => {
        if (!mounted) return;
        setRequests(list);
        const responseMap: Record<string, InfoResponse | null> = {};
        await Promise.all(
          list.map(async (req) => {
            try {
              responseMap[req.id] = await infoRequestService.getResponse(req.id);
            } catch {
              responseMap[req.id] = null;
            }
          })
        );
        if (mounted) {
          setResponses(responseMap);
          setLoadStatus('loaded');
        }
      })
      .catch(() => {
        if (mounted) setLoadStatus('error');
      });
    return () => {
      mounted = false;
    };
  }, [applicationId]);

  function addField() {
    setFields((prev) => [...prev, { fieldKey: '', label: '', required: false }]);
  }

  function removeField(idx: number) {
    setFields((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateField(idx: number, patch: Partial<InfoRequestField>) {
    setFields((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  }

  async function handleCreate() {
    const payload: CreateInfoRequestPayload = { fields, message, deadline };
    const errors = validateInfoRequest(payload);
    if (errors.length > 0) {
      setCreateErrors(errors);
      return;
    }
    setCreateErrors([]);
    setCreateStatus('creating');
    try {
      const created = await infoRequestService.create(applicationId, payload);
      setRequests((prev) => [created, ...prev]);
      setResponses((prev) => ({ ...prev, [created.id]: null }));
      setCreateStatus('created');
      setFields([{ fieldKey: '', label: '', required: true }]);
      setMessage('');
      setDeadline('');
    } catch {
      setCreateStatus('error');
    }
  }

  if (loadStatus === 'loading') {
    return (
      <p role="status" aria-live="polite" className="py-8 text-sm text-slate-600">
        Loading information requests…
      </p>
    );
  }

  if (loadStatus === 'error') {
    return (
      <p role="alert" className="py-8 text-sm text-red-700">
        Could not load information requests.
      </p>
    );
  }

  return (
    <section
      className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 text-slate-900"
      aria-labelledby="info-request-title"
    >
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">
          Information requests
        </p>
        <h2 id="info-request-title" className="text-3xl font-bold tracking-tight md:text-4xl">
          {applicantMode ? 'Reviewer questions' : 'Request additional information'}
        </h2>
        <p className="max-w-2xl text-sm text-slate-600">
          {applicantMode
            ? 'A reviewer has asked for additional information. Respond before the deadline to keep your application active.'
            : 'Ask the applicant bounded questions with a deadline. All parties are notified and responses are versioned.'}
        </p>
      </header>

      {!applicantMode && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <h3 className="text-lg font-semibold">New information request</h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-700">Requested fields</p>
              <button
                type="button"
                onClick={addField}
                className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                + Add field
              </button>
            </div>

            {fields.map((f, idx) => (
              <div key={idx} className="flex flex-wrap gap-3 items-end rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex-1 space-y-1 min-w-32">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Field key
                  </label>
                  <input
                    type="text"
                    value={f.fieldKey}
                    onChange={(e) => updateField(idx, { fieldKey: e.target.value })}
                    placeholder="e.g. transcript_url"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex-1 space-y-1 min-w-32">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Label (shown to applicant)
                  </label>
                  <input
                    type="text"
                    value={f.label}
                    onChange={(e) => updateField(idx, { label: e.target.value })}
                    placeholder="e.g. Academic transcript"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={f.required}
                    onChange={(e) => updateField(idx, { required: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Required
                </label>
                {fields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeField(idx)}
                    aria-label={`Remove field ${f.label || idx + 1}`}
                    className="rounded-full p-1 text-slate-400 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700" htmlFor="ir-message">
              Message to applicant
            </label>
            <textarea
              id="ir-message"
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Explain what you need and why it is needed."
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700" htmlFor="ir-deadline">
              Response deadline
            </label>
            <input
              id="ir-deadline"
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {createErrors.length > 0 && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 space-y-1">
              {createErrors.map((e) => (
                <p key={e.field}>{e.message}</p>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3" aria-live="polite">
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={createStatus === 'creating'}
              className="rounded-full bg-indigo-600 px-6 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {createStatus === 'creating' ? 'Sending…' : 'Send request'}
            </button>
            {createStatus === 'created' && (
              <p role="status" className="text-sm text-emerald-700">
                Request sent. The applicant has been notified.
              </p>
            )}
            {createStatus === 'error' && (
              <p role="alert" className="text-sm text-red-700">
                Could not send the request. Please try again.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">
          {requests.length === 0 ? 'No requests' : `${requests.length} request${requests.length > 1 ? 's' : ''}`}
        </h3>

        {requests.length === 0 && (
          <p className="text-sm text-slate-500">No information requests have been sent for this application.</p>
        )}

        {requests.map((req) => {
          const overdue = isRequestOverdue(req);
          const response = responses[req.id];
          return (
            <div
              key={req.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">
                    Requested fields:{' '}
                    {req.fields.map((f) => f.label || f.fieldKey).join(', ')}
                  </p>
                  <p className="text-sm text-slate-600">{req.message}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[req.status]}`}
                >
                  {req.status}
                </span>
              </div>

              <p className={`text-xs ${overdue ? 'font-semibold text-red-700' : 'text-slate-500'}`}>
                Deadline: {new Date(req.deadline).toLocaleString()}
                {overdue && ' — overdue'}
              </p>

              {response ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm space-y-2">
                  <p className="font-semibold text-emerald-800">
                    Response (v{response.version}) · Submitted{' '}
                    {new Date(response.submittedAt).toLocaleString()}
                  </p>
                  {Object.entries(response.answers).map(([key, value]) => {
                    const field = req.fields.find((f) => f.fieldKey === key);
                    return (
                      <div key={key}>
                        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                          {field?.label ?? key}
                        </p>
                        <p className="text-slate-800">{value}</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                req.status === 'open' && (
                  <p className="text-sm text-slate-500">Awaiting applicant response.</p>
                )
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default InfoRequestPanel;
