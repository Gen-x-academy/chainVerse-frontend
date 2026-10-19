'use client';

import { useId, useRef, useState } from 'react';
import {
  CORRECTION_REASON_MAX_LENGTH,
  canViewAttendance,
  toAttendanceError,
  type AttendanceCorrection,
  type AttendanceSession,
  type AttendanceStatus,
  type AttendanceViewer,
  type ParticipantAttendance,
  type SignalInput,
} from '../attendance';

export interface AttendancePanelProps {
  viewer: AttendanceViewer;
  session: AttendanceSession;
  attendance: readonly ParticipantAttendance[];
  corrections?: readonly AttendanceCorrection[];
  /** Display labels keyed by participant id; ids are never shown. */
  labels: Readonly<Record<string, string>>;
  rawSignalsExpireAt?: string;
  loading?: boolean;
  error?: string | null;
  onRecord?: (input: SignalInput, idempotencyKey: string) => Promise<void> | void;
  onRequestCorrection?: (
    input: {
      participantId: string;
      reason: string;
      proposedStatus: AttendanceCorrection['proposedStatus'];
    },
    idempotencyKey: string,
  ) => Promise<void> | void;
  onDecideCorrection?: (
    correction: AttendanceCorrection,
    decision: 'approved' | 'rejected',
  ) => Promise<void> | void;
}

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  attended: 'Attended',
  partial: 'Partial attendance',
  absent: 'Absent',
  'pending-corroboration': 'Awaiting confirmation',
};

const METHOD_LABEL: Record<string, string> = {
  'platform-presence': 'platform presence',
  'calendar-link': 'calendar link',
  'counterpart-confirmation': 'confirmed by the other participant',
  'self-report': 'self-reported',
};

let counter = 0;
function newKey(): string {
  counter += 1;
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `att-${counter}`;
}

export function AttendancePanel({
  viewer,
  session,
  attendance,
  corrections = [],
  labels,
  rawSignalsExpireAt,
  loading = false,
  error,
  onRecord,
  onRequestCorrection,
  onDecideCorrection,
}: AttendancePanelProps) {
  const baseId = useId();
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [correctingId, setCorrectingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [proposed, setProposed] = useState<AttendanceCorrection['proposedStatus']>('attended');
  const keys = useRef<Record<string, string>>({});

  const allowed = canViewAttendance(viewer, session);
  const isParticipant = Boolean(viewer.userId) && session.participantIds.includes(viewer.userId!);

  const keyFor = (name: string) => (keys.current[name] ??= newKey());

  const run = async (name: string, success: string, action: () => Promise<void> | void) => {
    setPending(name);
    setLocalError(null);
    setMessage(null);
    try {
      await action();
      delete keys.current[name];
      setMessage(success);
      return true;
    } catch (caught) {
      setLocalError(toAttendanceError(caught).message);
      return false;
    } finally {
      setPending(null);
    }
  };

  const record = (kind: SignalInput['kind']) =>
    run(`record-${kind}`, 'Attendance recorded.', () =>
      onRecord?.(
        { kind, method: 'platform-presence', at: new Date().toISOString() },
        keyFor(`record-${kind}`),
      ),
    );

  const submitCorrection = async (participantId: string) => {
    if (reason.trim().length === 0) {
      setLocalError('Describe the correction in 1 to 500 characters and pick a valid outcome.');
      return;
    }
    const ok = await run(`correct-${participantId}`, 'Correction requested.', () =>
      onRequestCorrection?.(
        { participantId, reason, proposedStatus: proposed },
        keyFor(`correct-${participantId}`),
      ),
    );
    if (ok) {
      setCorrectingId(null);
      setReason('');
    }
  };

  const open = corrections.filter((c) => c.state === 'requested');
  const shownError = localError ?? error;

  return (
    <section
      aria-labelledby={`${baseId}-title`}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
    >
      <h2 id={`${baseId}-title`} className="text-lg font-semibold text-slate-900">
        Session attendance
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        We record only when someone joined or left and how it was verified. Location, device and
        biometric data are never collected.
        {rawSignalsExpireAt && (
          <>
            {' '}
            Raw signals are deleted after <time dateTime={rawSignalsExpireAt}>{rawSignalsExpireAt.slice(0, 10)}</time>;
            the attendance summary is kept.
          </>
        )}
      </p>

      {!allowed ? (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {toAttendanceError({ status: 403 }).message}
        </p>
      ) : loading ? (
        <p role="status" className="mt-4 text-sm text-slate-600">
          Loading attendance…
        </p>
      ) : (
        <>
          {isParticipant && (
            <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Record my attendance">
              {(['check-in', 'join', 'leave'] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  disabled={pending !== null}
                  onClick={() => void record(kind)}
                  className="min-h-11 rounded-lg border border-indigo-600 px-4 py-2 text-sm font-semibold text-indigo-700 disabled:opacity-60"
                >
                  {pending === `record-${kind}`
                    ? 'Recording…'
                    : kind === 'check-in'
                      ? 'Check in'
                      : kind === 'join'
                        ? 'I joined'
                        : 'I left'}
                </button>
              ))}
            </div>
          )}

          <div className="mt-5" aria-live="polite">
            {attendance.length === 0 ? (
              <p role="status" className="text-sm text-slate-600">
                No attendance has been recorded for this session yet.
              </p>
            ) : (
              <ul aria-label="Attendance by participant" className="space-y-3">
                {attendance.map((row) => (
                  <li key={row.participantId} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <p className="font-medium text-slate-900">
                        {labels[row.participantId] ?? 'Participant'}
                      </p>
                      <p className="text-sm font-semibold text-slate-800">
                        {STATUS_LABEL[row.status]}
                        {row.corrected && ' (corrected)'}
                      </p>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {row.presentMinutes} min present ({Math.round(row.ratio * 100)}% of the
                      session)
                      {row.methods.length > 0 &&
                        ` · ${row.methods.map((m) => METHOD_LABEL[m] ?? m).join(', ')}`}
                    </p>
                    {row.status === 'pending-corroboration' && (
                      <p className="mt-1 text-sm text-amber-800">
                        This attendance needs confirmation from the platform or the other
                        participant before it counts.
                      </p>
                    )}

                    {isParticipant && correctingId !== row.participantId && (
                      <button
                        type="button"
                        disabled={pending !== null}
                        onClick={() => {
                          setCorrectingId(row.participantId);
                          setReason('');
                        }}
                        aria-label={`Request correction for ${labels[row.participantId] ?? 'participant'}`}
                        className="mt-3 min-h-11 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      >
                        Request correction
                      </button>
                    )}

                    {correctingId === row.participantId && (
                      <div className="mt-3 space-y-2">
                        <label
                          htmlFor={`${baseId}-outcome`}
                          className="block text-sm font-medium text-slate-800"
                        >
                          Correct outcome
                        </label>
                        <select
                          id={`${baseId}-outcome`}
                          value={proposed}
                          onChange={(e) =>
                            setProposed(e.target.value as AttendanceCorrection['proposedStatus'])
                          }
                          className="w-full rounded-lg border border-slate-300 p-2 text-base"
                        >
                          <option value="attended">Attended</option>
                          <option value="partial">Partial attendance</option>
                          <option value="absent">Absent</option>
                        </select>
                        <label
                          htmlFor={`${baseId}-reason`}
                          className="block text-sm font-medium text-slate-800"
                        >
                          Reason for correction
                        </label>
                        <textarea
                          id={`${baseId}-reason`}
                          value={reason}
                          rows={3}
                          maxLength={CORRECTION_REASON_MAX_LENGTH}
                          onChange={(e) => setReason(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 p-2 text-base"
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={pending !== null}
                            onClick={() => void submitCorrection(row.participantId)}
                            className="min-h-11 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                          >
                            {pending === `correct-${row.participantId}`
                              ? 'Sending…'
                              : 'Send correction request'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setCorrectingId(null)}
                            className="min-h-11 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {open.length > 0 && (
            <div className="mt-5">
              <h3 className="text-sm font-semibold text-slate-900">Pending corrections</h3>
              <ul aria-label="Pending corrections" className="mt-2 space-y-3">
                {open.map((c) => {
                  const own = c.requestedBy === viewer.userId;
                  return (
                    <li key={c.id} className="rounded-xl border border-slate-200 p-4">
                      <p className="text-sm text-slate-900">
                        Correction for {labels[c.participantId] ?? 'participant'} to{' '}
                        {STATUS_LABEL[c.proposedStatus].toLowerCase()}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-600">
                        {c.reason}
                      </p>
                      {own ? (
                        <p className="mt-2 text-xs text-slate-600">
                          Waiting for someone else to review. You cannot approve your own request.
                        </p>
                      ) : (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {(['approved', 'rejected'] as const).map((decision) => (
                            <button
                              key={decision}
                              type="button"
                              disabled={pending !== null}
                              onClick={() =>
                                void run(
                                  `decide-${c.id}`,
                                  decision === 'approved' ? 'Correction approved.' : 'Correction rejected.',
                                  () => onDecideCorrection?.(c, decision),
                                )
                              }
                              className="min-h-11 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold"
                            >
                              {decision === 'approved' ? 'Approve' : 'Reject'}
                            </button>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}

      {message && (
        <p role="status" className="mt-3 text-sm text-green-800">
          {message}
        </p>
      )}
      {shownError && allowed && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {shownError}
        </p>
      )}
    </section>
  );
}

export default AttendancePanel;
