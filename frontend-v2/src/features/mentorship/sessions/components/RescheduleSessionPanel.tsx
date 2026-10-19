'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import {
  REASON_MAX_LENGTH,
  REASON_MIN_LENGTH,
  previewRescheduleConsequences,
  type RescheduleDecision,
  type ReschedulePolicy,
} from '../session-reschedule';
import type {
  ApplyRescheduleRequest,
  ProposeRescheduleRequest,
  RescheduleResponse,
} from '../session-reschedule.service';
import {
  createIdempotencyKey,
  describeSchedulingFailure,
  formatLocalAndUtc,
  isSafePlainText,
  type MentorshipSession,
  type RescheduleProposal,
  type SchedulingError,
  type SchedulingRole,
} from '../session-core';

export interface RescheduleSessionPanelProps {
  session:
    | Pick<MentorshipSession, 'sessionId' | 'startsAt' | 'endsAt' | 'originalStartsAt' | 'status' | 'timeChanges'>
    | null;
  viewerId: string;
  viewerRole: SchedulingRole | undefined;
  timeZone: string;
  /** Candidate times from the slot finder. */
  slots: readonly { startsAt: string; endsAt: string }[];
  /** The newest request for this session, with the reason already redacted for the viewer. */
  pendingProposal?: RescheduleProposal | null;
  amountMinor: number;
  /** ISO 4217 code used to display the fee. */
  currency?: string;
  policy: ReschedulePolicy;
  /** Injected so the preview is deterministic in tests. */
  now?: Date;
  onPropose?: (request: ProposeRescheduleRequest) => Promise<RescheduleResponse>;
  onApply?: (request: ApplyRescheduleRequest) => Promise<RescheduleResponse>;
  onDecide?: (proposalId: string, decision: RescheduleDecision) => Promise<RescheduleResponse>;
  createKey?: () => string;
}

function formatMoney(amountMinor: number, currency: string): string {
  const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency });
  const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  return formatter.format(amountMinor / 10 ** digits);
}

const DECISION_DONE: Record<RescheduleDecision, string> = {
  approve: 'You approved the new time. The session has been moved.',
  decline: 'You declined the request. The session stays as it was.',
  withdraw: 'You withdrew the request. The session stays as it was.',
};

export function RescheduleSessionPanel({
  session,
  viewerId,
  viewerRole,
  timeZone,
  slots,
  pendingProposal = null,
  amountMinor,
  currency = 'USD',
  policy,
  now,
  onPropose,
  onApply,
  onDecide,
  createKey = () => createIdempotencyKey('resch'),
}: RescheduleSessionPanelProps) {
  const baseId = useId();
  const [slotStart, setSlotStart] = useState('');
  const [reason, setReason] = useState('');
  const [feeAccepted, setFeeAccepted] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<'slot' | 'reason' | 'fee', string>>>({});
  const [failure, setFailure] = useState<SchedulingError | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const keyRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const busyRef = useRef(false);
  const alertRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (failure) alertRef.current?.focus();
  }, [failure]);
  useEffect(() => {
    if (done) doneRef.current?.focus();
  }, [done]);

  const titleId = `${baseId}-title`;
  const shell = (children: React.ReactNode) => (
    <section aria-labelledby={titleId} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 id={titleId} className="text-lg font-semibold text-slate-900">Reschedule session</h2>
      {children}
    </section>
  );

  const canParticipate = viewerRole === 'mentor' || viewerRole === 'mentee';
  const canApply = (viewerRole === 'coordinator' || viewerRole === 'administrator') && Boolean(onApply);

  if (!viewerRole || (!canParticipate && !canApply && !session)) {
    return shell(
      <p role="alert" className="mt-3 text-sm text-red-700">
        You do not have permission to change this session.
      </p>,
    );
  }
  if (!session) {
    return shell(
      <p role="status" className="mt-3 text-sm text-slate-600">No session selected.</p>,
    );
  }
  if (session.status !== 'booked') {
    return shell(
      <p role="alert" className="mt-3 text-sm text-red-700">Only a booked session can be rescheduled.</p>,
    );
  }
  if (!canParticipate && !canApply) {
    return shell(
      <p role="alert" className="mt-3 text-sm text-red-700">
        You do not have permission to change this session.
      </p>,
    );
  }

  const clock = now ?? new Date();
  const current = formatLocalAndUtc(session.startsAt, session.endsAt, timeZone);
  const original = formatLocalAndUtc(
    session.originalStartsAt,
    new Date(Date.parse(session.originalStartsAt) + (Date.parse(session.endsAt) - Date.parse(session.startsAt))).toISOString(),
    timeZone,
  );
  const options = slots.filter((slot) => slot.startsAt !== session.startsAt);
  const chosen = options.find((slot) => slot.startsAt === slotStart);

  const preview = previewRescheduleConsequences({
    currentStartsAt: session.startsAt,
    amountMinor,
    requesterRole: viewerRole,
    policy,
    now: clock,
  });

  const open = pendingProposal && pendingProposal.status === 'pending' ? pendingProposal : null;
  const expired = open ? clock.getTime() >= Date.parse(open.expiresAt) : false;
  const mine = open ? open.proposedBy === viewerId : false;

  const run = async (key: string, action: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setPending(key);
    setFailure(null);
    setDone(null);
    try {
      await action();
    } catch (caught) {
      setFailure(describeSchedulingFailure(caught));
    } finally {
      busyRef.current = false;
      setPending(null);
    }
  };

  const decide = (decision: RescheduleDecision) => {
    if (!open || !onDecide) return;
    void run(decision, async () => {
      await onDecide(open.proposalId, decision);
      setDone(DECISION_DONE[decision]);
    });
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = reason.trim();
    const errors: typeof fieldErrors = {};
    if (!chosen) errors.slot = 'Choose a new time.';
    if (trimmed.length < REASON_MIN_LENGTH) {
      errors.reason = `Give a reason of at least ${REASON_MIN_LENGTH} characters.`;
    } else if (trimmed.length > REASON_MAX_LENGTH) {
      errors.reason = `Keep the reason to ${REASON_MAX_LENGTH} characters or fewer.`;
    } else if (!isSafePlainText(trimmed)) {
      errors.reason = 'Use plain text without markup.';
    }
    if (canParticipate && preview.feeMinor > 0 && !feeAccepted) {
      errors.fee = 'Confirm that you accept the fee to continue.';
    }
    setFieldErrors(errors);
    setFailure(null);
    if (Object.keys(errors).length > 0 || !chosen) return;

    const fee = canParticipate ? preview.feeMinor : 0;
    const fingerprint = JSON.stringify([chosen.startsAt, trimmed, fee]);
    if (!keyRef.current || keyRef.current.fingerprint !== fingerprint) {
      keyRef.current = { fingerprint, key: createKey() };
    }
    const idempotencyKey = keyRef.current.key;

    void run('submit', async () => {
      if (canApply && onApply) {
        await onApply({ proposedStartsAt: chosen.startsAt, reason: trimmed, idempotencyKey });
        setDone('The session has been moved. Both participants will be told.');
      } else if (onPropose) {
        await onPropose({
          proposedStartsAt: chosen.startsAt,
          reason: trimmed,
          acknowledgedFeeMinor: fee,
          idempotencyKey,
        });
        setDone('Request sent. The other participant needs to approve before anything changes.');
      }
    });
  };

  const busy = pending !== null;
  const showForm = !open || (canApply && !mine);

  return shell(
    <div className="mt-3 space-y-5">
      <div className="space-y-1 text-sm text-slate-800">
        <p>
          <span className="font-medium">Current time:</span>{' '}
          <time dateTime={current.startsAtUtc}>{current.local}</time>
        </p>
        <p className="text-xs text-slate-500">UTC: {current.utc}</p>
        {session.timeChanges.length > 0 && (
          <p>
            <span className="font-medium">Originally scheduled:</span>{' '}
            <time dateTime={original.startsAtUtc}>{original.local}</time>
          </p>
        )}
      </div>

      {session.timeChanges.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-slate-900">Time changes</h3>
          <ol aria-label="Time changes" className="mt-2 space-y-2 text-sm text-slate-700">
            {session.timeChanges.map((change) => {
              const from = formatLocalAndUtc(change.fromStartsAt, change.fromStartsAt, timeZone);
              const to = formatLocalAndUtc(change.toStartsAt, change.toStartsAt, timeZone);
              return (
                <li key={change.proposalId} className="rounded-lg border border-slate-200 p-3">
                  <p>
                    {from.local.split(' to ')[0]} moved to {to.local.split(' to ')[0]}
                    {change.override ? ' by a coordinator' : ''}
                  </p>
                  {change.reason && <p className="text-slate-600">Reason: {change.reason}</p>}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {open && (
        <div role="group" aria-label="Open reschedule request" className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-sm text-slate-800">
          <p className="font-medium">
            {mine ? 'Your request is waiting for a reply' : 'The other participant asked to move this session'}
          </p>
          <p className="mt-1">
            New time:{' '}
            <time dateTime={open.proposedStartsAt}>
              {formatLocalAndUtc(open.proposedStartsAt, open.proposedEndsAt, timeZone).local}
            </time>
          </p>
          {open.reason && <p className="mt-1">Reason: {open.reason}</p>}
          {open.feeMinor > 0 && (
            <p className="mt-1">Late change fee: {formatMoney(open.feeMinor, currency)}</p>
          )}
          {expired ? (
            <p role="status" className="mt-2 text-red-700">This request has expired. Ask for a new time.</p>
          ) : (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              {mine ? (
                <button
                  type="button"
                  disabled={busy || !onDecide}
                  onClick={() => decide('withdraw')}
                  className="min-h-[44px] rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-800 disabled:opacity-60"
                >
                  {pending === 'withdraw' ? 'Withdrawing…' : 'Withdraw request'}
                </button>
              ) : canParticipate ? (
                <>
                  <button
                    type="button"
                    disabled={busy || !onDecide}
                    onClick={() => decide('approve')}
                    className="min-h-[44px] rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white disabled:opacity-60"
                  >
                    {pending === 'approve' ? 'Approving…' : 'Approve new time'}
                  </button>
                  <button
                    type="button"
                    disabled={busy || !onDecide}
                    onClick={() => decide('decline')}
                    className="min-h-[44px] rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-800 disabled:opacity-60"
                  >
                    {pending === 'decline' ? 'Declining…' : 'Decline'}
                  </button>
                </>
              ) : null}
            </div>
          )}
        </div>
      )}

      {showForm && (
        <form onSubmit={submit} noValidate aria-busy={busy} className="space-y-5">
          <fieldset disabled={busy} className="space-y-2">
            <legend className="text-sm font-medium text-slate-900">Choose a new time</legend>
            {options.length === 0 ? (
              <p role="status" className="text-sm text-slate-600">No other times are available right now.</p>
            ) : (
              <div className="space-y-1">
                {options.map((slot) => {
                  const label = formatLocalAndUtc(slot.startsAt, slot.endsAt, timeZone);
                  return (
                    <label key={slot.startsAt} className="flex min-h-[44px] items-start gap-2 text-sm text-slate-800">
                      <input
                        type="radio"
                        name={`${baseId}-slot`}
                        value={slot.startsAt}
                        checked={slotStart === slot.startsAt}
                        onChange={() => setSlotStart(slot.startsAt)}
                        className="mt-1 h-4 w-4"
                      />
                      <span>
                        {label.local}
                        <span className="block text-xs text-slate-500">UTC: {label.utc}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
            {fieldErrors.slot && <p className="text-sm text-red-700">{fieldErrors.slot}</p>}
          </fieldset>

          <div>
            <label htmlFor={`${baseId}-reason`} className="block text-sm font-medium text-slate-900">
              Reason
            </label>
            <textarea
              id={`${baseId}-reason`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={busy}
              rows={3}
              required
              aria-required="true"
              aria-invalid={fieldErrors.reason ? true : undefined}
              aria-describedby={`${baseId}-reason-hint${fieldErrors.reason ? ` ${baseId}-reason-error` : ''}`}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <p id={`${baseId}-reason-hint`} className="mt-1 text-xs text-slate-500">
              {canApply
                ? 'Both participants can read this reason.'
                : 'The other participant can read this reason.'}{' '}
              {reason.length} of {REASON_MAX_LENGTH} characters
            </p>
            {fieldErrors.reason && (
              <p id={`${baseId}-reason-error`} className="mt-1 text-sm text-red-700">{fieldErrors.reason}</p>
            )}
          </div>

          <div aria-live="polite" className="rounded-lg bg-slate-50 p-3 text-sm text-slate-800">
            <p className="font-medium">What this change costs</p>
            {canApply ? (
              <p>Coordinator changes are free for both participants.</p>
            ) : preview.blocked ? (
              <p role="alert" className="text-red-700">
                It is too close to the session start to reschedule. Contact a coordinator if this is urgent.
              </p>
            ) : (
              <>
                <p>
                  {preview.feeMinor > 0
                    ? `Fee: ${formatMoney(preview.feeMinor, currency)}`
                    : 'No fee for this change.'}
                </p>
                <ul className="mt-1 list-disc pl-5 text-slate-600">
                  {preview.explanation.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {canParticipate && !preview.blocked && preview.feeMinor > 0 && (
            <div>
              <label className="flex min-h-[44px] items-start gap-2 text-sm text-slate-900">
                <input
                  type="checkbox"
                  checked={feeAccepted}
                  onChange={(event) => setFeeAccepted(event.target.checked)}
                  disabled={busy}
                  aria-describedby={fieldErrors.fee ? `${baseId}-fee-error` : undefined}
                  className="mt-1 h-4 w-4"
                />
                <span>I accept the fee of {formatMoney(preview.feeMinor, currency)} for this change.</span>
              </label>
              {fieldErrors.fee && <p id={`${baseId}-fee-error`} className="text-sm text-red-700">{fieldErrors.fee}</p>}
            </div>
          )}

          <button
            type="submit"
            disabled={busy || (canParticipate && preview.blocked) || options.length === 0}
            className="min-h-[44px] w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
          >
            {pending === 'submit'
              ? 'Sending…'
              : canApply
                ? 'Apply change'
                : failure?.retryable
                  ? 'Try again'
                  : 'Send request'}
          </button>
        </form>
      )}

      {done && (
        <p ref={doneRef} role="status" tabIndex={-1} className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900 focus:outline-none">
          {done}
        </p>
      )}

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
    </div>,
  );
}

export default RescheduleSessionPanel;
