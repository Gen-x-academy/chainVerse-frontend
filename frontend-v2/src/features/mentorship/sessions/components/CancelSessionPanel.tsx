'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import {
  NOTE_MAX_LENGTH,
  NOTE_MIN_LENGTH,
  PARTICIPANT_REASON_CODES,
  previewCancellation,
  type CancellationPolicySnapshot,
} from '../session-cancellation';
import type { CancelSessionRequest, CancelSessionResponse } from '../session-cancellation.service';
import {
  CANCELLATION_REASON_LABELS,
  createIdempotencyKey,
  describeSchedulingFailure,
  formatLocalAndUtc,
  isSafePlainText,
  schedulingError,
  type CancellationReasonCode,
  type MentorshipSession,
  type SchedulingError,
  type SchedulingRole,
  type SessionCancellation,
} from '../session-core';

export interface CancelSessionPanelProps {
  session: Pick<MentorshipSession, 'sessionId' | 'startsAt' | 'endsAt' | 'status' | 'cancellation'> | null;
  viewerRole: SchedulingRole | undefined;
  timeZone: string;
  amountMinor: number;
  /** ISO 4217 code used to display money. */
  currency?: string;
  snapshot: CancellationPolicySnapshot;
  /** Injected so the preview is deterministic in tests. */
  now?: Date;
  onCancel: (request: CancelSessionRequest) => Promise<CancelSessionResponse>;
  createKey?: () => string;
}

function formatMoney(amountMinor: number, currency: string): string {
  const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency });
  const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  return formatter.format(amountMinor / 10 ** digits);
}

const WHO: Record<SessionCancellation['cancelledByRole'], string> = {
  mentee: 'the mentee',
  mentor: 'the mentor',
  platform: 'a coordinator',
};

type FieldName = 'reason' | 'note' | 'confirm';

export function CancelSessionPanel({
  session,
  viewerRole,
  timeZone,
  amountMinor,
  currency = 'USD',
  snapshot,
  now,
  onCancel,
  createKey = () => createIdempotencyKey('cancel'),
}: CancelSessionPanelProps) {
  const baseId = useId();
  const [reasonCode, setReasonCode] = useState<CancellationReasonCode | ''>('');
  const [note, setNote] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [failure, setFailure] = useState<SchedulingError | null>(null);
  const [result, setResult] = useState<CancelSessionResponse | null>(null);

  const keyRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const busyRef = useRef(false);
  const alertRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (failure) alertRef.current?.focus();
  }, [failure]);
  useEffect(() => {
    if (result) headingRef.current?.focus();
  }, [result]);

  const titleId = `${baseId}-title`;
  const shell = (children: React.ReactNode, focusable = false) => (
    <section aria-labelledby={titleId} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2
        id={titleId}
        ref={focusable ? headingRef : undefined}
        tabIndex={focusable ? -1 : undefined}
        className="text-lg font-semibold text-slate-900 focus:outline-none"
      >
        {focusable ? 'Session cancelled' : 'Cancel session'}
      </h2>
      {children}
    </section>
  );

  if (!viewerRole) {
    return shell(
      <p role="alert" className="mt-3 text-sm text-red-700">You do not have permission to cancel this session.</p>,
    );
  }
  if (!session) {
    return shell(<p role="status" className="mt-3 text-sm text-slate-600">No session selected.</p>);
  }

  const summary = (cancellation: SessionCancellation, replayed: boolean) => {
    const time = formatLocalAndUtc(session.startsAt, session.endsAt, timeZone);
    const at = formatLocalAndUtc(cancellation.cancelledAt, cancellation.cancelledAt, timeZone);
    return (
      <div role="status" className="mt-3 space-y-2 text-sm text-slate-800">
        {replayed && <p>This session was already cancelled. No second cancellation was made.</p>}
        <p>
          Cancelled by {WHO[cancellation.cancelledByRole]} on {at.local.split(' to ')[0]}.
        </p>
        <p>
          Session time: <time dateTime={time.startsAtUtc}>{time.local}</time>
        </p>
        <p className="text-xs text-slate-500">UTC: {time.utc}</p>
        <p>Reason: {CANCELLATION_REASON_LABELS[cancellation.reasonCode]}</p>
        {cancellation.note && <p>Note: {cancellation.note}</p>}
        <p>Refund to the mentee: {formatMoney(cancellation.refundMinor, currency)}</p>
        <p className="text-xs text-slate-500">
          Cancellation policy {cancellation.policyId}, version {cancellation.policyVersion}
        </p>
      </div>
    );
  };

  if (result) return shell(summary(result.cancellation, result.replayed), true);
  if (session.status === 'cancelled' && session.cancellation) return shell(summary(session.cancellation, false));
  if (session.status !== 'booked') {
    return shell(
      <p role="alert" className="mt-3 text-sm text-red-700">Only a booked session can be cancelled.</p>,
    );
  }

  const clock = now ?? new Date();
  const time = formatLocalAndUtc(session.startsAt, session.endsAt, timeZone);
  const preview = previewCancellation({
    startsAt: session.startsAt,
    amountMinor,
    snapshot,
    actorRole: viewerRole,
    now: clock,
  });

  if (preview.started) {
    return shell(
      <p role="alert" className="mt-3 text-sm text-red-700">{schedulingError('SESSION_STARTED').message}</p>,
    );
  }

  const isCoordinator = viewerRole === 'coordinator' || viewerRole === 'administrator';
  const reasons = isCoordinator ? Object.keys(CANCELLATION_REASON_LABELS) as CancellationReasonCode[] : PARTICIPANT_REASON_CODES;
  const refund = formatMoney(preview.refundMinor, currency);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busyRef.current) return;

    const trimmed = note.trim();
    const errors: Partial<Record<FieldName, string>> = {};
    if (!reasonCode) errors.reason = 'Choose a reason for the cancellation.';
    if (reasonCode === 'other' && trimmed.length < NOTE_MIN_LENGTH) {
      errors.note = `Add a note of at least ${NOTE_MIN_LENGTH} characters.`;
    } else if (trimmed.length > NOTE_MAX_LENGTH) {
      errors.note = `Keep the note to ${NOTE_MAX_LENGTH} characters or fewer.`;
    } else if (trimmed && !isSafePlainText(trimmed)) {
      errors.note = 'Use plain text without markup.';
    }
    if (!confirmed) errors.confirm = 'Confirm that you understand the refund to continue.';
    setFieldErrors(errors);
    setFailure(null);
    if (Object.keys(errors).length > 0 || !reasonCode) return;

    const request: Omit<CancelSessionRequest, 'idempotencyKey'> = {
      reasonCode,
      acknowledgedRefundMinor: preview.refundMinor,
      ...(trimmed ? { note: trimmed } : {}),
    };
    const fingerprint = JSON.stringify(request);
    if (!keyRef.current || keyRef.current.fingerprint !== fingerprint) {
      keyRef.current = { fingerprint, key: createKey() };
    }
    const idempotencyKey = keyRef.current.key;

    busyRef.current = true;
    setSubmitting(true);
    void onCancel({ ...request, idempotencyKey })
      .then((response) => setResult(response))
      .catch((caught: unknown) => setFailure(describeSchedulingFailure(caught)))
      .finally(() => {
        busyRef.current = false;
        setSubmitting(false);
      });
  };

  const describedBy = (field: FieldName, extra?: string) =>
    [fieldErrors[field] ? `${baseId}-${field}-error` : null, extra].filter(Boolean).join(' ') || undefined;

  return shell(
    <form onSubmit={submit} noValidate aria-busy={submitting} className="mt-3 space-y-5">
      <p className="text-sm text-slate-800">
        <time dateTime={time.startsAtUtc}>{time.local}</time>
        <span className="block text-xs text-slate-500">UTC: {time.utc}</span>
      </p>

      <div aria-live="polite" className="rounded-lg bg-slate-50 p-3 text-sm text-slate-800">
        <p className="font-medium">What cancelling means</p>
        <p>{Math.round(preview.noticeHours * 10) / 10} hours until the session starts.</p>
        <p>Refund to the mentee: {refund} ({preview.appliedRefundBps / 100}%)</p>
        {isCoordinator || viewerRole === 'mentor' ? (
          <p>Payment to the mentor: {formatMoney(preview.mentorCompensationMinor, currency)}</p>
        ) : null}
        <ul className="mt-1 list-disc pl-5 text-slate-600">
          {preview.explanation.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      <div>
        <label htmlFor={`${baseId}-reason`} className="block text-sm font-medium text-slate-900">Reason</label>
        <select
          id={`${baseId}-reason`}
          value={reasonCode}
          onChange={(event) => setReasonCode(event.target.value as CancellationReasonCode | '')}
          disabled={submitting}
          required
          aria-required="true"
          aria-invalid={fieldErrors.reason ? true : undefined}
          aria-describedby={describedBy('reason')}
          className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Choose a reason</option>
          {reasons.map((code) => (
            <option key={code} value={code}>{CANCELLATION_REASON_LABELS[code]}</option>
          ))}
        </select>
        {fieldErrors.reason && (
          <p id={`${baseId}-reason-error`} className="mt-1 text-sm text-red-700">{fieldErrors.reason}</p>
        )}
      </div>

      <div>
        <label htmlFor={`${baseId}-note`} className="block text-sm font-medium text-slate-900">
          Note {reasonCode === 'other' ? '' : <span className="font-normal text-slate-500">(optional)</span>}
        </label>
        <textarea
          id={`${baseId}-note`}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          disabled={submitting}
          rows={3}
          aria-required={reasonCode === 'other' ? 'true' : undefined}
          aria-invalid={fieldErrors.note ? true : undefined}
          aria-describedby={describedBy('note', `${baseId}-note-hint`)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <p id={`${baseId}-note-hint`} className="mt-1 text-xs text-slate-500">
          Both participants can read this note. {note.length} of {NOTE_MAX_LENGTH} characters
        </p>
        {fieldErrors.note && (
          <p id={`${baseId}-note-error`} className="mt-1 text-sm text-red-700">{fieldErrors.note}</p>
        )}
      </div>

      <div>
        <label className="flex min-h-[44px] items-start gap-2 text-sm text-slate-900">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            disabled={submitting}
            aria-describedby={describedBy('confirm')}
            className="mt-1 h-4 w-4"
          />
          <span>I understand the refund will be {refund} and that cancelling cannot be undone.</span>
        </label>
        {fieldErrors.confirm && (
          <p id={`${baseId}-confirm-error`} className="text-sm text-red-700">{fieldErrors.confirm}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="min-h-[44px] w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
      >
        {submitting ? 'Cancelling…' : failure?.retryable ? 'Try again' : 'Cancel session'}
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

export default CancelSessionPanel;
