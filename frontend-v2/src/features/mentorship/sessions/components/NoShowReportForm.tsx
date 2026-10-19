'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import {
  REPORTABLE_TYPES,
  STATEMENT_MAX_LENGTH,
  STATEMENT_MIN_LENGTH,
  type NoShowPolicy,
} from '../no-show-reports';
import type { CreateNoShowReportRequest, NoShowReportResponse } from '../no-show-reports.service';
import {
  MINUTES,
  HOUR_MS,
  NO_SHOW_TYPE_LABELS,
  createIdempotencyKey,
  describeSchedulingFailure,
  formatLocalAndUtc,
  isSafePlainText,
  schedulingError,
  type MentorshipSession,
  type NoShowEvidence,
  type NoShowReport,
  type NoShowType,
  type SchedulingError,
  type SchedulingRole,
} from '../session-core';
import { EvidenceEditor } from './EvidenceEditor';

type Attachment = Extract<NoShowEvidence, { kind: 'attachment' }>;

export interface NoShowReportFormProps {
  session: Pick<MentorshipSession, 'sessionId' | 'startsAt' | 'endsAt' | 'status'> | null;
  viewerId: string;
  viewerRole: SchedulingRole | undefined;
  timeZone: string;
  policy: NoShowPolicy;
  /** The report for this session as the viewer may see it, if one exists. */
  existingReport?: NoShowReport | null;
  /** Injected so the window checks are deterministic in tests. */
  now?: Date;
  onSubmit: (request: CreateNoShowReportRequest) => Promise<NoShowReportResponse>;
  onUploadAttachment?: (file: File) => Promise<Attachment>;
  createKey?: () => string;
}

export function NoShowReportForm({
  session,
  viewerId,
  viewerRole,
  timeZone,
  policy,
  existingReport = null,
  now,
  onSubmit,
  onUploadAttachment,
  createKey = () => createIdempotencyKey('noshow'),
}: NoShowReportFormProps) {
  const baseId = useId();
  const [type, setType] = useState<NoShowType | ''>('');
  const [statement, setStatement] = useState('');
  const [evidence, setEvidence] = useState<NoShowEvidence[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<'type' | 'statement', string>>>({});
  const [failure, setFailure] = useState<SchedulingError | null>(null);
  const [outcome, setOutcome] = useState<NoShowReportResponse | null>(null);

  const keyRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const busyRef = useRef(false);
  const alertRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (failure) alertRef.current?.focus();
  }, [failure]);
  useEffect(() => {
    if (outcome) headingRef.current?.focus();
  }, [outcome]);

  const titleId = `${baseId}-title`;
  const shell = (children: React.ReactNode, title = 'Report a no-show', focusable = false) => (
    <section aria-labelledby={titleId} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2
        id={titleId}
        ref={focusable ? headingRef : undefined}
        tabIndex={focusable ? -1 : undefined}
        className="text-lg font-semibold text-slate-900 focus:outline-none"
      >
        {title}
      </h2>
      {children}
    </section>
  );

  const participant = viewerRole === 'mentor' || viewerRole === 'mentee' ? viewerRole : null;
  if (!participant) {
    return shell(<p role="alert" className="mt-3 text-sm text-red-700">You do not have permission to report on this session.</p>);
  }
  if (!session) return shell(<p role="status" className="mt-3 text-sm text-slate-600">No session selected.</p>);
  if (session.status === 'cancelled') {
    return shell(<p role="alert" className="mt-3 text-sm text-red-700">A cancelled session cannot have a no-show report.</p>);
  }

  const clock = now ?? new Date();
  const opensAt = Date.parse(session.startsAt) + policy.opensAfterMinutes * MINUTES;
  const closesAt = Date.parse(session.endsAt) + policy.reportWindowHours * HOUR_MS;
  const when = (ms: number) => formatLocalAndUtc(new Date(ms).toISOString(), new Date(ms).toISOString(), timeZone);

  const own = existingReport?.claims.find((claim) => claim.reporterId === viewerId);
  if (outcome || own) {
    const report = outcome?.report ?? (existingReport as NoShowReport);
    const deadline = when(Date.parse(report.responseDeadline));
    return shell(
      <div role="status" className="mt-3 space-y-2 text-sm text-slate-800">
        {outcome?.replayed && <p>This report was already submitted. No second report was made.</p>}
        {outcome?.merged && <p>Your report was added to the report already opened for this session.</p>}
        <p>Your report is {report.status === 'open' ? 'open' : 'resolved'}.</p>
        <p>
          The other participant has until <time dateTime={report.responseDeadline}>{deadline.local.split(' to ')[0]}</time>{' '}
          ({deadline.utc.split(' to ')[0]}) to respond. Nothing happens to them before then.
        </p>
        <p>A coordinator reviews every report. No consequence is applied automatically.</p>
      </div>,
      outcome ? 'Report submitted' : 'Report a no-show',
      Boolean(outcome),
    );
  }
  if (clock.getTime() < opensAt) {
    const opens = when(opensAt);
    return shell(
      <p role="status" className="mt-3 text-sm text-slate-700">
        You can report a no-show from {opens.local.split(' to ')[0]} ({opens.utc.split(' to ')[0]}), once the grace
        period after the start has passed.
      </p>,
    );
  }
  if (clock.getTime() > closesAt) {
    return shell(<p role="alert" className="mt-3 text-sm text-red-700">{schedulingError('NO_SHOW_WINDOW_CLOSED').message}</p>);
  }

  const options = REPORTABLE_TYPES[participant];

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busyRef.current) return;

    const text = statement.trim();
    const errors: typeof fieldErrors = {};
    if (!type) errors.type = 'Choose what happened.';
    if (text.length < STATEMENT_MIN_LENGTH) {
      errors.statement = `Describe what happened in at least ${STATEMENT_MIN_LENGTH} characters.`;
    } else if (text.length > STATEMENT_MAX_LENGTH) {
      errors.statement = `Keep the statement to ${STATEMENT_MAX_LENGTH} characters or fewer.`;
    } else if (!isSafePlainText(text)) {
      errors.statement = 'Use plain text without markup.';
    }
    setFieldErrors(errors);
    setFailure(null);
    if (Object.keys(errors).length > 0 || !type) return;

    const request: Omit<CreateNoShowReportRequest, 'idempotencyKey'> = { type, statement: text, evidence };
    const fingerprint = JSON.stringify(request);
    if (!keyRef.current || keyRef.current.fingerprint !== fingerprint) {
      keyRef.current = { fingerprint, key: createKey() };
    }
    const idempotencyKey = keyRef.current.key;

    busyRef.current = true;
    setSubmitting(true);
    void onSubmit({ ...request, idempotencyKey })
      .then((response) => setOutcome(response))
      .catch((caught: unknown) => setFailure(describeSchedulingFailure(caught)))
      .finally(() => {
        busyRef.current = false;
        setSubmitting(false);
      });
  };

  const describedBy = (field: 'type' | 'statement', extra?: string) =>
    [fieldErrors[field] ? `${baseId}-${field}-error` : null, extra].filter(Boolean).join(' ') || undefined;

  return shell(
    <form onSubmit={submit} noValidate aria-busy={submitting} className="mt-3 space-y-5">
      <p className="text-sm text-slate-700">
        The other participant will be told and can respond. A coordinator reviews every report before any consequence.
      </p>

      <fieldset disabled={submitting} className="space-y-2" aria-describedby={describedBy('type')}>
        <legend className="text-sm font-medium text-slate-900">What happened?</legend>
        {options.map((option) => (
          <label key={option} className="flex min-h-[44px] items-center gap-2 text-sm text-slate-800">
            <input
              type="radio"
              name={`${baseId}-type`}
              value={option}
              checked={type === option}
              onChange={() => setType(option)}
              className="h-4 w-4"
            />
            {NO_SHOW_TYPE_LABELS[option]}
          </label>
        ))}
        {fieldErrors.type && <p id={`${baseId}-type-error`} className="text-sm text-red-700">{fieldErrors.type}</p>}
      </fieldset>

      <div>
        <label htmlFor={`${baseId}-statement`} className="block text-sm font-medium text-slate-900">Statement</label>
        <textarea
          id={`${baseId}-statement`}
          value={statement}
          onChange={(event) => setStatement(event.target.value)}
          disabled={submitting}
          rows={4}
          required
          aria-required="true"
          aria-invalid={fieldErrors.statement ? true : undefined}
          aria-describedby={describedBy('statement', `${baseId}-statement-hint`)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <p id={`${baseId}-statement-hint`} className="mt-1 text-xs text-slate-500">
          The other participant can read this. {statement.length} of {STATEMENT_MAX_LENGTH} characters
        </p>
        {fieldErrors.statement && (
          <p id={`${baseId}-statement-error`} className="mt-1 text-sm text-red-700">{fieldErrors.statement}</p>
        )}
      </div>

      <EvidenceEditor
        value={evidence}
        onChange={setEvidence}
        policy={policy}
        onUploadAttachment={onUploadAttachment}
        disabled={submitting}
      />

      <button
        type="submit"
        disabled={submitting}
        className="min-h-[44px] w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
      >
        {submitting ? 'Submitting…' : failure?.retryable ? 'Try again' : 'Submit report'}
      </button>

      {failure && (
        <div ref={alertRef} role="alert" tabIndex={-1} className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 focus:outline-none">
          <p>{failure.message}</p>
          {failure.issues && failure.issues.length > 0 && (
            <ul className="mt-2 list-disc pl-5">
              {failure.issues.map((issue) => (
                <li key={`${issue.field}-${issue.message}`}>{issue.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>,
  );
}

export default NoShowReportForm;
