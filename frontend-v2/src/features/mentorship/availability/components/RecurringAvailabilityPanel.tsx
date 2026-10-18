'use client';

import { useEffect, useId, useState } from 'react';
import {
  AvailabilityValidationError,
  normalizeWeeklyWindows,
  validateRecurringAvailability,
  type AvailabilityException,
  type AvailabilityIssue,
  type RecurringAvailability,
  type Weekday,
  type WeeklyAvailabilityWindow,
} from '../recurring-availability';

export interface RecurringAvailabilityPanelProps {
  schedule: RecurringAvailability;
  canManage?: boolean;
  onSave?: (next: RecurringAvailability) => Promise<void> | void;
  saving?: boolean;
  serverError?: string | null;
}

const WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];
const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function RecurringAvailabilityPanel({
  schedule,
  canManage = true,
  onSave,
  saving = false,
  serverError,
}: RecurringAvailabilityPanelProps) {
  const formId = useId();
  const [draft, setDraft] = useState<RecurringAvailability>(schedule);
  const [issues, setIssues] = useState<AvailabilityIssue[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [savingLocal, setSavingLocal] = useState(false);

  useEffect(() => {
    setDraft(schedule);
    setIssues([]);
    setFormError(null);
    setSaved(false);
  }, [schedule]);

  const isSaving = saving || savingLocal;
  const timeZoneError = issues.filter((issue) => issue.field === 'timeZone');
  const policyError = (field: keyof RecurringAvailability) =>
    issues.find((issue) => issue.field === field)?.message;

  const updateWindow = (index: number, patch: Partial<WeeklyAvailabilityWindow>) => {
    setDraft((current) => ({
      ...current,
      windows: current.windows.map((window, position) =>
        position === index ? { ...window, ...patch } : window,
      ),
    }));
    setSaved(false);
  };

  const addWindow = () => {
    setDraft((current) => ({
      ...current,
      windows: [...current.windows, { dayOfWeek: 1, start: '09:00', end: '17:00' }],
    }));
    setSaved(false);
  };

  const removeWindow = (index: number) => {
    setDraft((current) => ({
      ...current,
      windows: current.windows.filter((_, position) => position !== index),
    }));
    setSaved(false);
  };

  const updateException = (index: number, patch: Partial<AvailabilityException>) => {
    setDraft((current) => ({
      ...current,
      exceptions: current.exceptions.map((exception, position) =>
        position === index ? { ...exception, ...patch } : exception,
      ),
    }));
    setSaved(false);
  };

  const addException = () => {
    setDraft((current) => ({
      ...current,
      exceptions: [
        ...current.exceptions,
        { id: `exception-${current.exceptions.length + 1}`, date: '', kind: 'unavailable' },
      ],
    }));
    setSaved(false);
  };

  const removeException = (index: number) => {
    setDraft((current) => ({
      ...current,
      exceptions: current.exceptions.filter((_, position) => position !== index),
    }));
    setSaved(false);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaved(false);
    setFormError(null);

    let next: RecurringAvailability;
    try {
      next = { ...draft, windows: normalizeWeeklyWindows(draft.windows) };
    } catch (error) {
      if (error instanceof AvailabilityValidationError) {
        setIssues(error.issues);
        return;
      }
      throw error;
    }

    const nextIssues = validateRecurringAvailability(next);
    if (nextIssues.length > 0) {
      setIssues(nextIssues);
      return;
    }

    setIssues([]);
    try {
      setSavingLocal(true);
      await onSave?.(next);
      setSaved(true);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to save availability.');
    } finally {
      setSavingLocal(false);
    }
  };

  return (
    <section
      aria-labelledby={`${formId}-title`}
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div className="flex flex-col gap-1">
        <h2 id={`${formId}-title`} className="text-lg font-semibold text-slate-900">
          Recurring weekly availability
        </h2>
        <p className="text-sm text-slate-600">
          Weekly windows repeat in the selected time zone. Exceptions override the weekly pattern
          and unavailable exceptions always win.
        </p>
      </div>

      <form className="mt-5 space-y-6" onSubmit={(event) => void submit(event)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${formId}-time-zone`} className="block text-sm font-medium text-slate-700">
              Time zone
            </label>
            <input
              id={`${formId}-time-zone`}
              value={draft.timeZone}
              disabled={!canManage}
              aria-invalid={timeZoneError.length > 0}
              onChange={(event) => {
                setDraft((current) => ({ ...current, timeZone: event.target.value }));
                setSaved(false);
              }}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
            />
            {timeZoneError.length > 0 && (
              <p className="mt-1 text-sm text-red-700">{timeZoneError[0].message}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={`${formId}-from`} className="block text-sm font-medium text-slate-700">
                Effective from
              </label>
              <input
                id={`${formId}-from`}
                type="date"
                value={draft.effectiveFrom}
                disabled={!canManage}
                onChange={(event) => {
                  setDraft((current) => ({ ...current, effectiveFrom: event.target.value }));
                  setSaved(false);
                }}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
              />
            </div>
            <div>
              <label htmlFor={`${formId}-until`} className="block text-sm font-medium text-slate-700">
                Effective until
              </label>
              <input
                id={`${formId}-until`}
                type="date"
                value={draft.effectiveUntil ?? ''}
                disabled={!canManage}
                onChange={(event) => {
                  setDraft((current) => ({
                    ...current,
                    effectiveUntil: event.target.value || undefined,
                  }));
                  setSaved(false);
                }}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
              />
            </div>
          </div>
        </div>

        <fieldset className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <legend className="sr-only">Booking policy</legend>
          {[
            ['leadTimeMinutes', 'Lead time (minutes)'],
            ['bufferBeforeMinutes', 'Buffer before (minutes)'],
            ['bufferAfterMinutes', 'Buffer after (minutes)'],
            ['bookingHorizonDays', 'Booking horizon (days)'],
          ].map(([field, label]) => (
            <div key={field}>
              <label
                htmlFor={`${formId}-${field}`}
                className="block text-sm font-medium text-slate-700"
              >
                {label}
              </label>
              <input
                id={`${formId}-${field}`}
                type="number"
                min={0}
                step={1}
                value={draft[field as keyof RecurringAvailability] as number}
                disabled={!canManage}
                aria-invalid={Boolean(policyError(field as keyof RecurringAvailability))}
                onChange={(event) => {
                  setDraft((current) => ({
                    ...current,
                    [field]: Number(event.target.value),
                  }));
                  setSaved(false);
                }}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
              />
              {policyError(field as keyof RecurringAvailability) && (
                <p className="mt-1 text-sm text-red-700">
                  {policyError(field as keyof RecurringAvailability)}
                </p>
              )}
            </div>
          ))}
        </fieldset>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-900">Weekly windows</h3>
            <button
              type="button"
              onClick={addWindow}
              disabled={!canManage}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-60"
            >
              Add window
            </button>
          </div>
          {draft.windows.length === 0 ? (
            <p role="status" className="mt-3 text-sm text-slate-600">
              No weekly windows yet.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {draft.windows.map((window, index) => (
                <li key={index} className="grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
                  <div>
                    <label
                      htmlFor={`${formId}-day-${index}`}
                      className="block text-xs font-medium text-slate-600"
                    >
                      Day
                    </label>
                    <select
                      id={`${formId}-day-${index}`}
                      value={window.dayOfWeek}
                      disabled={!canManage}
                      onChange={(event) =>
                        updateWindow(index, { dayOfWeek: Number(event.target.value) as Weekday })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
                    >
                      {WEEKDAYS.map((day) => (
                        <option key={day} value={day}>
                          {DAY_LABELS[day]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor={`${formId}-start-${index}`}
                      className="block text-xs font-medium text-slate-600"
                    >
                      Start
                    </label>
                    <input
                      id={`${formId}-start-${index}`}
                      type="time"
                      value={window.start}
                      disabled={!canManage}
                      onChange={(event) => updateWindow(index, { start: event.target.value })}
                      className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={`${formId}-end-${index}`}
                      className="block text-xs font-medium text-slate-600"
                    >
                      End
                    </label>
                    <input
                      id={`${formId}-end-${index}`}
                      type="time"
                      value={window.end}
                      disabled={!canManage}
                      onChange={(event) => updateWindow(index, { end: event.target.value })}
                      className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeWindow(index)}
                    disabled={!canManage}
                    aria-label={`Remove ${DAY_LABELS[window.dayOfWeek]} window`}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 disabled:opacity-60"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-900">Exceptions</h3>
            <button
              type="button"
              onClick={addException}
              disabled={!canManage}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-60"
            >
              Add exception
            </button>
          </div>
          {draft.exceptions.length === 0 ? (
            <p role="status" className="mt-3 text-sm text-slate-600">
              No exceptions.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {draft.exceptions.map((exception, index) => (
                <li key={exception.id} className="grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-[1fr_1fr_auto_auto_auto] sm:items-end">
                  <div>
                    <label
                      htmlFor={`${formId}-exception-date-${index}`}
                      className="block text-xs font-medium text-slate-600"
                    >
                      Date
                    </label>
                    <input
                      id={`${formId}-exception-date-${index}`}
                      type="date"
                      value={exception.date}
                      disabled={!canManage}
                      onChange={(event) => updateException(index, { date: event.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={`${formId}-exception-kind-${index}`}
                      className="block text-xs font-medium text-slate-600"
                    >
                      Kind
                    </label>
                    <select
                      id={`${formId}-exception-kind-${index}`}
                      value={exception.kind}
                      disabled={!canManage}
                      onChange={(event) =>
                        updateException(index, {
                          kind: event.target.value as AvailabilityException['kind'],
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
                    >
                      <option value="unavailable">Unavailable</option>
                      <option value="available">Available</option>
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor={`${formId}-exception-start-${index}`}
                      className="block text-xs font-medium text-slate-600"
                    >
                      Start (optional)
                    </label>
                    <input
                      id={`${formId}-exception-start-${index}`}
                      type="time"
                      value={exception.start ?? ''}
                      disabled={!canManage}
                      onChange={(event) =>
                        updateException(index, { start: event.target.value || undefined })
                      }
                      className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={`${formId}-exception-end-${index}`}
                      className="block text-xs font-medium text-slate-600"
                    >
                      End (optional)
                    </label>
                    <input
                      id={`${formId}-exception-end-${index}`}
                      type="time"
                      value={exception.end ?? ''}
                      disabled={!canManage}
                      onChange={(event) =>
                        updateException(index, { end: event.target.value || undefined })
                      }
                      className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeException(index)}
                    disabled={!canManage}
                    aria-label={`Remove exception ${exception.id}`}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 disabled:opacity-60"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {issues.length > 0 && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3">
            <ul className="list-inside list-disc space-y-1 text-sm text-red-700">
              {issues.map((issue) => (
                <li key={`${issue.code}-${issue.field}`}>{issue.message}</li>
              ))}
            </ul>
          </div>
        )}
        {formError && (
          <p role="alert" className="text-sm text-red-700">
            {formError}
          </p>
        )}
        {serverError && !formError && (
          <p role="alert" className="text-sm text-red-700">
            {serverError}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={!canManage || isSaving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {isSaving ? 'Saving…' : 'Save availability'}
          </button>
          {saved && (
            <p role="status" className="text-sm text-emerald-700">
              Availability saved.
            </p>
          )}
          {!canManage && (
            <p role="alert" className="text-sm text-red-700">
              Your role cannot change mentor availability.
            </p>
          )}
        </div>
      </form>
    </section>
  );
}

export default RecurringAvailabilityPanel;
