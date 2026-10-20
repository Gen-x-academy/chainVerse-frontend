'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import {
  NO_SHOW_CONSEQUENCE_LABELS,
  NO_SHOW_OUTCOMES,
  NO_SHOW_OUTCOME_LABELS,
  STATEMENT_MAX_LENGTH,
  STATEMENT_MIN_LENGTH,
  dueProcessSatisfied,
  isAdverseOutcome,
  type NoShowPolicy,
} from '../no-show-reports';
import type {
  NoShowReportResponse,
  RespondToNoShowRequest,
  ResolveNoShowRequest,
} from '../no-show-reports.service';
import {
  NO_SHOW_TYPE_LABELS,
  describeSchedulingFailure,
  formatLocalAndUtc,
  isSafePlainText,
  type NoShowEvidence,
  type NoShowOutcome,
  type NoShowReport,
  type SchedulingError,
  type SchedulingRole,
} from '../session-core';
import { EvidenceEditor } from './EvidenceEditor';

type Attachment = Extract<NoShowEvidence, { kind: 'attachment' }>;

export interface NoShowCasePanelProps {
  /** The report as the viewer may see it. Attachment references are already restricted. */
  report: NoShowReport | null;
  participants: { mentorId: string; menteeId: string };
  viewerId: string;
  viewerRole: SchedulingRole | undefined;
  timeZone: string;
  policy: NoShowPolicy;
  now?: Date;
  onRespond?: (request: RespondToNoShowRequest) => Promise<NoShowReportResponse>;
  onResolve?: (request: ResolveNoShowRequest) => Promise<NoShowReportResponse>;
  onUploadAttachment?: (file: File) => Promise<Attachment>;
}

const MIME_LABEL: Record<string, string> = { 'image/png': 'PNG', 'image/jpeg': 'JPEG', 'application/pdf': 'PDF' };

function EvidenceList({ evidence }: { evidence: readonly NoShowEvidence[] }) {
  if (evidence.length === 0) return null;
  return (
    <ul className="mt-1 list-disc pl-5 text-slate-700">
      {evidence.map((item, index) => (
        <li key={`${item.kind}-${index}`}>
          {item.kind === 'note'
            ? `Note: ${item.text}`
            : item.restricted
              ? 'Attachment (restricted)'
              : `Attachment: ${MIME_LABEL[item.mimeType ?? ''] ?? 'file'}`}
        </li>
      ))}
    </ul>
  );
}

export function NoShowCasePanel({
  report,
  participants,
  viewerId,
  viewerRole,
  timeZone,
  policy,
  now,
  onRespond,
  onResolve,
  onUploadAttachment,
}: NoShowCasePanelProps) {
  const baseId = useId();
  const [statement, setStatement] = useState('');
  const [evidence, setEvidence] = useState<NoShowEvidence[]>([]);
  const [outcome, setOutcome] = useState<NoShowOutcome | ''>('');
  const [note, setNote] = useState('');
  const [pending, setPending] = useState<'respond' | 'resolve' | null>(null);
  const [errors, setErrors] = useState<Partial<Record<'statement' | 'outcome' | 'note', string>>>({});
  const [failure, setFailure] = useState<SchedulingError | null>(null);
  const [done, setDone] = useState<string | null>(null);

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
      <h2 id={titleId} className="text-lg font-semibold text-slate-900">No-show report</h2>
      {children}
    </section>
  );

  const isParticipant = viewerRole === 'mentor' || viewerRole === 'mentee';
  const isCoordinator = viewerRole === 'coordinator' || viewerRole === 'administrator';
  if (!isParticipant && !isCoordinator) {
    return shell(<p role="alert" className="mt-3 text-sm text-red-700">You do not have permission to see this report.</p>);
  }
  if (!report) return shell(<p role="status" className="mt-3 text-sm text-slate-600">There is no report for this session.</p>);

  const clock = now ?? new Date();
  const at = (iso: string) => formatLocalAndUtc(iso, iso, timeZone);
  const deadline = at(report.responseDeadline);
  const deadlineText = `${deadline.local.split(' to ')[0]} (${deadline.utc.split(' to ')[0]})`;

  const claimant = report.claims.some((claim) => claim.reporterId === viewerId);
  const responded = report.responses.some((response) => response.responderId === viewerId);
  const open = report.status === 'open';
  const canRespond = open && isParticipant && !claimant && !responded && Boolean(onRespond) && !done;
  const canResolve = open && isCoordinator && Boolean(onResolve) && !done;
  const dueProcess = dueProcessSatisfied(report, participants, clock);

  const run = async (kind: 'respond' | 'resolve', action: () => Promise<unknown>, message: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setPending(kind);
    setFailure(null);
    try {
      await action();
      setDone(message);
    } catch (caught) {
      setFailure(describeSchedulingFailure(caught));
    } finally {
      busyRef.current = false;
      setPending(null);
    }
  };

  const submitResponse = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!onRespond) return;
    const text = statement.trim();
    const next: typeof errors = {};
    if (text.length < STATEMENT_MIN_LENGTH) next.statement = `Describe your side in at least ${STATEMENT_MIN_LENGTH} characters.`;
    else if (text.length > STATEMENT_MAX_LENGTH) next.statement = `Keep your response to ${STATEMENT_MAX_LENGTH} characters or fewer.`;
    else if (!isSafePlainText(text)) next.statement = 'Use plain text without markup.';
    setErrors(next);
    setFailure(null);
    if (Object.keys(next).length > 0) return;
    void run('respond', () => onRespond({ statement: text, evidence }), 'Your response has been sent to the coordinator.');
  };

  const submitResolution = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!onResolve) return;
    const text = note.trim();
    const next: typeof errors = {};
    if (!outcome) next.outcome = 'Choose an outcome.';
    if (text.length > 500) next.note = 'Keep the note to 500 characters or fewer.';
    else if (text && !isSafePlainText(text)) next.note = 'Use plain text without markup.';
    setErrors(next);
    setFailure(null);
    if (Object.keys(next).length > 0 || !outcome) return;
    void run('resolve', () => onResolve({ outcome, ...(text ? { note: text } : {}) }), 'The report has been resolved. Both participants will be told.');
  };

  return shell(
    <div className="mt-3 space-y-5 text-sm text-slate-800">
      <p>
        Status: {report.status === 'open' ? 'Open' : 'Resolved'}. {NO_SHOW_CONSEQUENCE_LABELS[report.consequence]}
      </p>

      <div>
        <h3 className="font-medium text-slate-900">Reports</h3>
        <ol aria-label="Reports" className="mt-2 space-y-2">
          {report.claims.map((claim) => (
            <li key={claim.claimId} className="rounded-lg border border-slate-200 p-3">
              <p className="font-medium">
                {claim.reporterRole === 'mentor' ? 'Mentor' : 'Mentee'} reported: {NO_SHOW_TYPE_LABELS[claim.type]}
              </p>
              <p>{claim.statement}</p>
              <EvidenceList evidence={claim.evidence} />
            </li>
          ))}
        </ol>
        {report.conflicting && (
          <p className="mt-2 text-amber-800">The participants disagree. A coordinator will decide.</p>
        )}
      </div>

      {report.responses.length > 0 && (
        <div>
          <h3 className="font-medium text-slate-900">Responses</h3>
          <ol aria-label="Responses" className="mt-2 space-y-2">
            {report.responses.map((response) => (
              <li key={response.responderId} className="rounded-lg border border-slate-200 p-3">
                <p>{response.statement}</p>
                <EvidenceList evidence={response.evidence} />
              </li>
            ))}
          </ol>
        </div>
      )}

      {report.status === 'resolved' && report.outcome && (
        <div role="status" className="rounded-lg bg-slate-50 p-3">
          <p className="font-medium">Outcome: {NO_SHOW_OUTCOME_LABELS[report.outcome]}</p>
          {report.resolutionNote && <p>Note: {report.resolutionNote}</p>}
        </div>
      )}

      {canRespond && (
        <form onSubmit={submitResponse} noValidate aria-busy={pending === 'respond'} className="space-y-4" aria-label="Respond to this report">
          <p className="rounded-lg bg-indigo-50 p-3">
            You can respond until {deadlineText}. Nothing is decided against you before you have had the chance.
          </p>
          <div>
            <label htmlFor={`${baseId}-response`} className="block font-medium text-slate-900">Your response</label>
            <textarea
              id={`${baseId}-response`}
              value={statement}
              onChange={(event) => setStatement(event.target.value)}
              disabled={pending !== null}
              rows={4}
              required
              aria-required="true"
              aria-invalid={errors.statement ? true : undefined}
              aria-describedby={errors.statement ? `${baseId}-response-error` : undefined}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
            {errors.statement && <p id={`${baseId}-response-error`} className="mt-1 text-red-700">{errors.statement}</p>}
          </div>
          <EvidenceEditor value={evidence} onChange={setEvidence} policy={policy} onUploadAttachment={onUploadAttachment} disabled={pending !== null} />
          <button
            type="submit"
            disabled={pending !== null}
            className="min-h-[44px] w-full rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white disabled:opacity-60 sm:w-auto"
          >
            {pending === 'respond' ? 'Sending…' : 'Send response'}
          </button>
        </form>
      )}

      {canResolve && (
        <form onSubmit={submitResolution} noValidate aria-busy={pending === 'resolve'} className="space-y-4" aria-label="Resolve this report">
          <div>
            <label htmlFor={`${baseId}-outcome`} className="block font-medium text-slate-900">Outcome</label>
            <select
              id={`${baseId}-outcome`}
              value={outcome}
              onChange={(event) => setOutcome(event.target.value as NoShowOutcome | '')}
              disabled={pending !== null}
              required
              aria-required="true"
              aria-invalid={errors.outcome ? true : undefined}
              aria-describedby={`${baseId}-outcome-hint${errors.outcome ? ` ${baseId}-outcome-error` : ''}`}
              className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              <option value="">Choose an outcome</option>
              {NO_SHOW_OUTCOMES.map((value) => (
                <option key={value} value={value} disabled={isAdverseOutcome(value) && !dueProcess}>
                  {NO_SHOW_OUTCOME_LABELS[value]}
                </option>
              ))}
            </select>
            <p id={`${baseId}-outcome-hint`} className="mt-1 text-xs text-slate-500">
              {dueProcess
                ? 'The accused participant has had the chance to respond.'
                : `A ruling against a participant waits until they respond or ${deadlineText}.`}
            </p>
            {errors.outcome && <p id={`${baseId}-outcome-error`} className="mt-1 text-red-700">{errors.outcome}</p>}
          </div>
          <div>
            <label htmlFor={`${baseId}-note`} className="block font-medium text-slate-900">
              Note <span className="font-normal text-slate-500">(optional)</span>
            </label>
            <textarea
              id={`${baseId}-note`}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              disabled={pending !== null}
              rows={3}
              aria-invalid={errors.note ? true : undefined}
              aria-describedby={errors.note ? `${baseId}-note-error` : undefined}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
            {errors.note && <p id={`${baseId}-note-error`} className="mt-1 text-red-700">{errors.note}</p>}
          </div>
          <button
            type="submit"
            disabled={pending !== null}
            className="min-h-[44px] w-full rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white disabled:opacity-60 sm:w-auto"
          >
            {pending === 'resolve' ? 'Resolving…' : 'Resolve report'}
          </button>
        </form>
      )}

      {done && (
        <p ref={doneRef} role="status" tabIndex={-1} className="rounded-lg bg-emerald-50 p-3 text-emerald-900 focus:outline-none">
          {done}
        </p>
      )}

      {failure && (
        <div ref={alertRef} role="alert" tabIndex={-1} className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800 focus:outline-none">
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

export default NoShowCasePanel;
