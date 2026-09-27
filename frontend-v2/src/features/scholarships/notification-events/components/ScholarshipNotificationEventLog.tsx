'use client';

import { useCallback, useId, useMemo, useState } from 'react';
import {
  isMandatoryNotificationEvent,
  emitNotificationEvent,
  PAYLOAD_ALLOWLIST,
} from '../service';
import type {
  Channel,
  EmittedEventRecord,
  NotificationSubject,
  ScholarshipNotificationEventName,
} from '../types';

export type ScholarshipNotificationEventLogProps = {
  events?: EmittedEventRecord[];
  state?: 'loading' | 'ready' | 'error';
  errorMessage?: string;
  canView?: boolean;
};

const PANEL = 'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm';
const FOCUS = 'focus:outline-none focus:ring-2 focus:ring-indigo-200';

const EVENT_NAMES = Object.keys(PAYLOAD_ALLOWLIST) as ScholarshipNotificationEventName[];
const CHANNELS: Channel[] = ['in-app', 'email', 'sms', 'push'];

const SIMULATION_SUBJECT: NotificationSubject = { kind: 'application', id: 'app-simulated-001' };

export function ScholarshipNotificationEventLog({
  events: eventsProp,
  state: stateProp,
  errorMessage,
  canView = true,
}: ScholarshipNotificationEventLogProps) {
  const headingId = useId();
  const nameFilterId = `${headingId}-name`;
  const channelFilterId = `${headingId}-channel`;
  const subjectId = `${headingId}-subject`;
  const emailOptInId = `${headingId}-email-optin`;

  const [records, setRecords] = useState<EmittedEventRecord[]>(eventsProp ?? []);
  const [nameFilter, setNameFilter] = useState<'all' | ScholarshipNotificationEventName>('all');
  const [channelFilter, setChannelFilter] = useState<'all' | Channel>('all');
  const [subjectIdValue, setSubjectIdValue] = useState(SIMULATION_SUBJECT.id);
  const [emailOptIn, setEmailOptIn] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [inspectKey, setInspectKey] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      records.filter(
        (record) =>
          (nameFilter === 'all' || record.event.name === nameFilter) &&
          (channelFilter === 'all' || record.event.channel === channelFilter)
      ),
    [records, nameFilter, channelFilter]
  );

  const simulate = useCallback(
    (name: ScholarshipNotificationEventName, channel: Channel) => {
      const subject: NotificationSubject = { kind: 'application', id: subjectIdValue || 'app-1' };
      const mandatory = isMandatoryNotificationEvent(name);
      const preferences = [
        { eventName: name, channel: channel as Channel, enabled: channel === 'in-app' || emailOptIn },
      ];
      const sent = records.map((record) => record.event);
      const result = emitNotificationEvent(
        {
          name,
          occurredAt: '2026-05-04T10:00:00.000Z',
          correlationId: 'corr-simulated',
          subject,
          programId: 'chainverse-scholarship',
          channel,
          recipientRef: 'user:applicant-001',
          payload: simulatedPayload(name),
        },
        preferences,
        sent,
        new Date('2026-05-04T10:00:00.000Z')
      );
      // Only a delivered event enters the log; suppressed and rejected attempts
      // are reported in the status line so retries stay visible without being
      // mistaken for a second delivery.
      if (result.status === 'emitted') {
        setRecords((current) => [
          ...current,
          { event: result.event, result, recordedAt: result.event.occurredAt },
        ]);
      }
      setStatus(
        result.status === 'emitted'
          ? `Emitted ${name} on ${channel}.${result.reason ? ` ${result.reason}.` : ''}`
          : result.status === 'duplicate-suppressed'
            ? `Suppressed duplicate of ${name} on ${channel}: the idempotency key was already used.`
            : `Rejected ${name} on ${channel}: ${result.reason ?? 'no reason recorded'}.`
      );
    },
    [emailOptIn, records, subjectIdValue]
  );

  if (!canView) {
    return (
      <section className={PANEL} aria-labelledby={headingId} role="note" data-testid="event-log-denied">
        <h1 id={headingId} className="text-2xl font-bold tracking-tight text-slate-900">
          Notification event log unavailable
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          You do not have permission to inspect scholarship notification events. Next step: ask an
          administrator for the reviewer or administrator role, then reload this page.
        </p>
      </section>
    );
  }

  if (stateProp === 'loading') {
    return (
      <div className={PANEL} role="status" aria-live="polite" data-testid="event-log-loading">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Loading notification events
        </h1>
        <p className="mt-2 text-sm text-slate-600">Reading the emitted scholarship notification events.</p>
      </div>
    );
  }

  if (stateProp === 'error') {
    return (
      <div
        className="rounded-2xl border border-red-200 bg-red-50 p-6"
        role="alert"
        data-testid="event-log-error"
      >
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Notification events could not be loaded
        </h1>
        <p className="mt-2 text-sm text-red-800">
          {errorMessage || 'The notification event service returned an error.'}
        </p>
        <p className="mt-3 text-sm text-red-800">
          Next step: retry the request, and if it keeps failing escalate to the platform team.
        </p>
      </div>
    );
  }

  return (
    <section className={PANEL} aria-labelledby={headingId} data-testid="event-log-ready">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">
          Notification events
        </p>
        <h1 id={headingId} className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
          Scholarship notification event log
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Events carry a stable subject reference and an allowlisted payload only &mdash; no names,
          email addresses, or application text.
        </p>
      </header>

      <fieldset className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <legend className="px-1 text-sm font-semibold text-slate-900">Filter events</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={nameFilterId} className="block text-sm font-medium text-slate-700">
              Event name
            </label>
            <select
              id={nameFilterId}
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value as 'all' | ScholarshipNotificationEventName)}
              className={`mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 ${FOCUS}`}
            >
              <option value="all">All events</option>
              {EVENT_NAMES.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={channelFilterId} className="block text-sm font-medium text-slate-700">
              Channel
            </label>
            <select
              id={channelFilterId}
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value as 'all' | Channel)}
              className={`mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 ${FOCUS}`}
            >
              <option value="all">All channels</option>
              {CHANNELS.map((channel) => (
                <option key={channel} value={channel}>
                  {channel}
                </option>
              ))}
            </select>
          </div>
        </div>
      </fieldset>

      <section className="mt-6" aria-labelledby={`${headingId}-simulate`}>
        <h2 id={`${headingId}-simulate`} className="text-lg font-semibold text-slate-900">
          Simulate an emit
        </h2>
        <div className="mt-3 space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div>
            <label htmlFor={subjectId} className="block text-sm font-medium text-slate-700">
              Subject reference id
            </label>
            <input
              id={subjectId}
              value={subjectIdValue}
              onChange={(e) => setSubjectIdValue(e.target.value)}
              className={`mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 ${FOCUS}`}
            />
            <p className="mt-1 text-xs text-slate-500">
              Emitting the same event and subject twice reuses the same idempotency key and is
              suppressed as a duplicate.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <input
              id={emailOptInId}
              type="checkbox"
              checked={emailOptIn}
              onChange={(e) => setEmailOptIn(e.target.checked)}
              className={`h-4 w-4 rounded border-slate-300 text-indigo-600 ${FOCUS}`}
            />
            <label htmlFor={emailOptInId} className="text-sm text-slate-700">
              Email channel is opted in (unticking it demonstrates preference suppression)
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => simulate('review.assigned', 'email')}
              className={`rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 ${FOCUS}`}
            >
              Emit review.assigned on email
            </button>
            <button
              type="button"
              onClick={() => simulate('decision.recorded', 'in-app')}
              className={`rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 ${FOCUS}`}
            >
              Emit decision.recorded on in-app
            </button>
          </div>
          <p className="text-sm text-slate-700" role="status" aria-live="polite" data-testid="event-log-status">
            {status || 'No simulation run yet.'}
          </p>
        </div>
      </section>

      <section className="mt-6" aria-labelledby={`${headingId}-table`}>
        <h2 id={`${headingId}-table`} className="text-lg font-semibold text-slate-900">
          Emitted events
        </h2>
        {filtered.length === 0 ? (
          <p
            className="mt-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600"
            role="status"
            aria-live="polite"
            data-testid="event-log-empty"
          >
            No notification events match this filter. Next step: clear the filters or emit a
            simulated event.
          </p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">
                Scholarship notification events with idempotency key, subject reference, and allowlisted
                payload
              </caption>
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th scope="col" className="py-2 pr-3">
                    Event
                  </th>
                  <th scope="col" className="py-2 pr-3">
                    Channel
                  </th>
                  <th scope="col" className="py-2 pr-3">
                    Subject reference
                  </th>
                  <th scope="col" className="py-2 pr-3">
                    Mandatory
                  </th>
                  <th scope="col" className="py-2 pr-3">
                    Outcome
                  </th>
                  <th scope="col" className="py-2 pr-3">
                    Idempotency key
                  </th>
                  <th scope="col" className="py-2 pr-3">
                    Payload
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((record, index) => (
                  <tr
                    key={`${record.event.idempotencyKey}-${record.result.status}-${index}`}
                    className="border-b border-slate-100 align-top"
                  >
                    <th scope="row" className="py-2 pr-3 font-semibold text-slate-900">
                      {record.event.name}
                    </th>
                    <td className="py-2 pr-3 text-slate-600">{record.event.channel}</td>
                    <td className="py-2 pr-3 text-slate-600">
                      <span className="font-mono text-xs">
                        {record.event.subject.kind}:{record.event.subject.id}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          record.event.mandatory
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {record.event.mandatory ? 'Mandatory (required notice)' : 'Optional'}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-slate-600">
                      <span className="font-semibold">{record.result.status}</span>
                      {record.result.reason ? ` (${record.result.reason})` : ''}
                    </td>
                    <td className="py-2 pr-3">
                      <span className="break-all font-mono text-xs text-slate-600">
                        {record.event.idempotencyKey}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      <code className="block max-w-xs break-all text-xs text-slate-700">
                        {JSON.stringify(record.event.payload)}
                      </code>
                      <button
                        type="button"
                        onClick={() => setInspectKey(record.event.idempotencyKey)}
                        aria-expanded={inspectKey === record.event.idempotencyKey}
                        className={`mt-1 rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 ${FOCUS}`}
                      >
                        {inspectKey === record.event.idempotencyKey
                          ? 'Hide payload inspection'
                          : 'Inspect payload'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {inspectKey && (
        <section className="mt-6" aria-labelledby={`${headingId}-inspection`}>
          <h2 id={`${headingId}-inspection`} className="text-lg font-semibold text-slate-900">
            Payload inspection
          </h2>
          <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <p>
              Only the keys in each event&rsquo;s allowlist survive emission. Every other key &mdash;
              including applicant names, email addresses, and essay text &mdash; is stripped before
              the event is stored.
            </p>
            <ul className="mt-2 space-y-1 text-xs">
              {EVENT_NAMES.map((name: ScholarshipNotificationEventName) => (
                <li key={name}>
                  <span className="font-mono">{name}</span> &rarr; {PAYLOAD_ALLOWLIST[name].join(', ')}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </section>
  );
}

/** A payload that deliberately carries a PII key so the strip is visible. */
function simulatedPayload(name: ScholarshipNotificationEventName) {
  const allowlisted: Record<string, string | number | boolean | null> = {
    'deadline.approaching': { daysRemaining: 3, deadlineAt: '2026-05-20T00:00:00.000Z' },
    'application.action-required': { missingFieldCount: 2, actionDueAt: '2026-05-10T00:00:00.000Z' },
    'review.assigned': {
      applicationId: 'app-simulated-001',
      roundId: 'round-2026',
      assignedAt: '2026-05-04T10:00:00.000Z',
    },
    'decision.recorded': { outcome: 'awarded', decidedAt: '2026-05-04T09:00:00.000Z' },
    'award.acceptance-required': { awardAmountCents: 400000, currency: 'USD', acceptBy: '2026-05-18T00:00:00.000Z' },
    'milestone.evidence-required': { milestoneId: 'ms-1', requiredEvidenceCount: 1 },
    'payment.processed': { amountCents: 400000, currency: 'USD', settledAt: '2026-05-06T00:00:00.000Z' },
    'payout.setup-required': { missingFieldCount: 1, requiredBy: '2026-05-15T00:00:00.000Z' },
  }[name] ?? {};

  return {
    ...allowlisted,
    applicantName: 'Ada Lovelace',
    applicantEmail: 'ada@example.edu',
    essayText: 'Long free-text essay that must never be emitted.',
  };
}

export default ScholarshipNotificationEventLog;
