'use client';

import { useCallback, useId, useMemo, useState } from 'react';
import {
  SUPPORTED_TIMEZONES,
  cancelSchedule,
  isValidTimeOfDay,
  previewSchedule,
  reminderKindLabel,
  schedulingPolicy,
} from '../service';
import type {
  QuietHours,
  ReminderKind,
  ReminderSchedule,
  SchedulingPolicy,
  SchedulingResult,
} from '../types';

export type ScholarshipReminderScheduleProps = {
  schedules?: ReminderSchedule[];
  state?: 'loading' | 'ready' | 'error';
  errorMessage?: string;
  canManage?: boolean;
  onCancel?: (schedule: ReminderSchedule) => void;
};

const PANEL = 'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm';
const FOCUS = 'focus:outline-none focus:ring-2 focus:ring-emerald-200';
const INPUT = `mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 ${FOCUS}`;

const KINDS: ReminderKind[] = [
  'incomplete-application',
  'pending-review',
  'award-acceptance',
  'missing-evidence',
  'payout-setup',
];

/** Fixed clock so the preview ladder is deterministic. */
const NOW = new Date('2026-05-04T10:00:00.000Z');
const SUBJECT = { kind: 'application' as const, id: 'app-42' };

export function ScholarshipReminderSchedule({
  schedules: schedulesProp,
  state: stateProp,
  errorMessage,
  canManage = true,
  onCancel,
}: ScholarshipReminderScheduleProps) {
  const headingId = useId();
  const kindId = `${headingId}-kind`;
  const timezoneId = `${headingId}-timezone`;
  const quietStartId = `${headingId}-quiet-start`;
  const quietEndId = `${headingId}-quiet-end`;
  const quietEnabledId = `${headingId}-quiet-enabled`;
  const offsetsId = `${headingId}-offsets`;
  const quietErrorId = `${headingId}-quiet-error`;
  const offsetsErrorId = `${headingId}-offsets-error`;

  const [kind, setKind] = useState<ReminderKind>('incomplete-application');
  const [timezone, setTimezone] = useState<string>('Europe/London');
  const [quietEnabled, setQuietEnabled] = useState(true);
  const [quietStart, setQuietStart] = useState('22:00');
  const [quietEnd, setQuietEnd] = useState('07:00');
  const [offsets, setOffsets] = useState('72, 24, 2');
  const [schedules, setSchedules] = useState<ReminderSchedule[]>(schedulesProp ?? []);
  const [preview, setPreview] = useState<SchedulingResult[] | null>(null);
  const [previewStatus, setPreviewStatus] = useState('');
  const [fieldError, setFieldError] = useState<{ id: string; message: string } | null>(null);

  const quietValid = isValidTimeOfDay(quietStart) && isValidTimeOfDay(quietEnd);
  const parsedOffsets = useMemo(
    () =>
      offsets
        .split(',')
        .map((part) => Number(part.trim()))
        .filter((value) => Number.isFinite(value) && value > 0),
    [offsets]
  );
  const offsetsValid = parsedOffsets.length > 0;

  const policy: SchedulingPolicy = useMemo(() => {
    const quietHours: QuietHours | undefined = quietEnabled
      ? { startLocalTime: quietStart, endLocalTime: quietEnd, timezone }
      : undefined;
    return schedulingPolicy(kind, {
      offsetsHours: offsetsValid ? parsedOffsets : schedulingPolicy(kind).offsetsHours,
      quietHours,
      respectRecipientTimezone: true,
    });
  }, [kind, offsetsValid, parsedOffsets, quietEnabled, quietStart, quietEnd, timezone]);

  const handlePreview = useCallback(() => {
    if (!quietValid) {
      setFieldError({ id: quietStartId, message: 'Quiet hours must use 24-hour HH:MM local times.' });
      setPreviewStatus('');
      return;
    }
    if (!offsetsValid) {
      setFieldError({
        id: offsetsId,
        message: 'Enter at least one positive offset in hours, separated by commas.',
      });
      setPreviewStatus('');
      return;
    }
    setFieldError(null);
    setPreview(previewSchedule(kind, SUBJECT, { now: NOW, timezone, policy, existing: schedules }));
    setPreviewStatus(`Previewed ${kind} in ${timezone}.`);
  }, [kind, offsetsId, offsetsValid, policy, quietStartId, quietValid, schedules, timezone]);

  const handleCancel = useCallback(
    (schedule: ReminderSchedule) => {
      setSchedules((current) =>
        current.map((item) =>
          item.id === schedule.id
            ? cancelSchedule(item, 'Cancelled by an administrator from the reminder schedule.', NOW)
            : item
        )
      );
      onCancel?.(schedule);
      setPreviewStatus(`Cancelled reminder ${schedule.id}.`);
    },
    [onCancel]
  );

  if (stateProp === 'loading') {
    return (
      <div className={PANEL} role="status" aria-live="polite" data-testid="reminders-loading">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Loading reminders</h1>
        <p className="mt-2 text-sm text-slate-600">
          Reading the scheduled deadline and action reminders.
        </p>
      </div>
    );
  }

  if (stateProp === 'error') {
    return (
      <div
        className="rounded-2xl border border-red-200 bg-red-50 p-6"
        role="alert"
        data-testid="reminders-error"
      >
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Reminders could not be loaded
        </h1>
        <p className="mt-2 text-sm text-red-800">
          {errorMessage || 'The reminders service returned an error.'}
        </p>
        <p className="mt-3 text-sm text-red-800">
          Next step: retry, then escalate to the platform team if the failure persists.
        </p>
      </div>
    );
  }

  return (
    <section className={PANEL} aria-labelledby={headingId} data-testid="reminders-ready">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Reminders</p>
        <h1 id={headingId} className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
          Deadline and action reminders
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Reminders fire in the recipient&rsquo;s own timezone, move out of quiet hours, and are
          cancelled as soon as the work they remind about is done.
        </p>
      </header>

      {!canManage && (
        <div
          className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
          role="note"
          data-testid="reminders-denied"
        >
          You can read the reminder schedule but not change it. Next step: ask an administrator to
          cancel or reschedule a reminder.
        </div>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor={kindId} className="block text-sm font-medium text-slate-700">
            Reminder kind
          </label>
          <select
            id={kindId}
            value={kind}
            disabled={!canManage}
            onChange={(e) => setKind(e.target.value as ReminderKind)}
            aria-describedby={`${kindId}-help`}
            className={INPUT}
          >
            {KINDS.map((option) => (
              <option key={option} value={option}>
                {reminderKindLabel(option)}
              </option>
            ))}
          </select>
          <p id={`${kindId}-help`} className="mt-1 text-xs text-slate-500">
            Default offsets: {schedulingPolicy(kind).offsetsHours.join('h, ')}h after now.
          </p>
        </div>

        <div>
          <label htmlFor={timezoneId} className="block text-sm font-medium text-slate-700">
            Recipient timezone (IANA)
          </label>
          <select
            id={timezoneId}
            value={timezone}
            disabled={!canManage}
            onChange={(e) => setTimezone(e.target.value)}
            className={INPUT}
          >
            {SUPPORTED_TIMEZONES.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={offsetsId} className="block text-sm font-medium text-slate-700">
            Policy offsets in hours
          </label>
          <input
            id={offsetsId}
            value={offsets}
            disabled={!canManage}
            onChange={(e) => setOffsets(e.target.value)}
            aria-invalid={fieldError?.id === offsetsId}
            aria-describedby={fieldError?.id === offsetsId ? offsetsErrorId : `${offsetsId}-help`}
            className={INPUT}
          />
          <p id={`${offsetsId}-help`} className="mt-1 text-xs text-slate-500">
            Comma-separated hour offsets, earliest first.
          </p>
          {fieldError?.id === offsetsId && (
            <p id={offsetsErrorId} className="mt-1 text-xs font-semibold text-red-700" role="alert">
              {fieldError.message}
            </p>
          )}
        </div>

        <fieldset className="rounded-xl border border-slate-200 bg-slate-50 p-4" disabled={!canManage}>
          <legend className="px-1 text-sm font-semibold text-slate-900">Quiet hours</legend>
          <div className="flex items-center gap-2">
            <input
              id={quietEnabledId}
              type="checkbox"
              checked={quietEnabled}
              onChange={(e) => setQuietEnabled(e.target.checked)}
              className={`h-4 w-4 rounded border-slate-300 text-emerald-600 ${FOCUS}`}
            />
            <label htmlFor={quietEnabledId} className="text-sm text-slate-700">
              Defer reminders out of quiet hours
            </label>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={quietStartId} className="block text-xs font-medium text-slate-700">
                Quiet start (local)
              </label>
              <input
                id={quietStartId}
                value={quietStart}
                onChange={(e) => setQuietStart(e.target.value)}
                aria-invalid={fieldError?.id === quietStartId}
                aria-describedby={fieldError?.id === quietStartId ? quietErrorId : undefined}
                className={INPUT}
              />
            </div>
            <div>
              <label htmlFor={quietEndId} className="block text-xs font-medium text-slate-700">
                Quiet end (local)
              </label>
              <input
                id={quietEndId}
                value={quietEnd}
                onChange={(e) => setQuietEnd(e.target.value)}
                aria-invalid={fieldError?.id === quietStartId}
                className={INPUT}
              />
            </div>
          </div>
          <p className="mt-1 text-xs text-slate-500">A window such as 22:00 to 07:00 wraps midnight.</p>
          {fieldError?.id === quietStartId && (
            <p id={quietErrorId} className="mt-1 text-xs font-semibold text-red-700" role="alert">
              {fieldError.message}
            </p>
          )}
        </fieldset>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={handlePreview}
          disabled={!canManage}
          className={`rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS}`}
        >
          Preview schedule
        </button>
        <p className="text-sm text-slate-600" role="status" aria-live="polite" data-testid="reminders-preview-status">
          {previewStatus || 'No preview run yet.'}
        </p>
      </div>

      {preview && (
        <section className="mt-6" aria-labelledby={`${headingId}-preview`}>
          <h2 id={`${headingId}-preview`} className="text-lg font-semibold text-slate-900">
            Computed occurrences
          </h2>
          {preview.length === 0 ? (
            <p
              className="mt-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600"
              role="status"
              aria-live="polite"
              data-testid="reminders-preview-empty"
            >
              No offset applies from the current time. Next step: shorten the offsets so at least one
              occurrence is still ahead.
            </p>
          ) : (
            <ul className="mt-2 space-y-2" data-testid="reminders-preview-list">
              {preview.map((result) => (
                <li
                  key={`${result.status}-${result.schedule.scheduledForLocal}`}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"
                >
                  <span className="font-semibold text-slate-900">
                    {result.schedule.scheduledForLocal} ({result.schedule.timezone})
                  </span>
                  {' \u2014 '}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      result.status === 'scheduled'
                        ? 'bg-emerald-100 text-emerald-800'
                        : result.status === 'deferred-to-quiet-hours-end'
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-slate-200 text-slate-800'
                    }`}
                  >
                    {result.status}
                  </span>
                  <p className="mt-1 text-xs text-slate-600">{result.detail}</p>
                  {result.schedule.deliverAfterLocal && (
                    <p className="mt-1 text-xs text-slate-600">
                      Delivers after <span className="font-mono">{result.schedule.deliverAfterLocal}</span>{' '}
                      local.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="mt-6" aria-labelledby={`${headingId}-table`}>
        <h2 id={`${headingId}-table`} className="text-lg font-semibold text-slate-900">
          Scheduled reminders
        </h2>
        {schedules.length === 0 ? (
          <p
            className="mt-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600"
            role="status"
            aria-live="polite"
            data-testid="reminders-empty"
          >
            No reminders are scheduled. Next step: preview the policy above, then save the schedule.
          </p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">
                Scheduled scholarship reminders with kind, subject, local send time, status, and
                cancel control
              </caption>
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th scope="col" className="py-2 pr-3">
                    Kind
                  </th>
                  <th scope="col" className="py-2 pr-3">
                    Subject
                  </th>
                  <th scope="col" className="py-2 pr-3">
                    Sends at (local)
                  </th>
                  <th scope="col" className="py-2 pr-3">
                    Status
                  </th>
                  <th scope="col" className="py-2 pr-3">
                    Dedupe key
                  </th>
                  <th scope="col" className="py-2 pr-3">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((schedule) => (
                  <tr key={schedule.id} className="border-b border-slate-100 align-top">
                    <th scope="row" className="py-2 pr-3 font-semibold text-slate-900">
                      {reminderKindLabel(schedule.kind)}
                    </th>
                    <td className="py-2 pr-3 text-slate-600">
                      <span className="font-mono text-xs">
                        {schedule.subject.kind}:{schedule.subject.id}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-slate-600">
                      {schedule.scheduledForLocal}
                      <span className="block text-xs text-slate-500">{schedule.timezone}</span>
                    </td>
                    <td className="py-2 pr-3 text-slate-600">
                      <span className="font-semibold">{schedule.status}</span>
                      {schedule.cancelledReason && (
                        <span className="block text-xs text-slate-500">{schedule.cancelledReason}</span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      <span className="break-all font-mono text-xs text-slate-600">
                        {schedule.dedupeKey}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      <button
                        type="button"
                        disabled={!canManage || schedule.status === 'cancelled'}
                        onClick={() => handleCancel(schedule)}
                        className={`rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS}`}
                      >
                        Cancel reminder
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}

export default ScholarshipReminderSchedule;
