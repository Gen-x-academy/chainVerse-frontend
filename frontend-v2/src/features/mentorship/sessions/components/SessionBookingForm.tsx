'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import {
  AGENDA_MAX_LENGTH,
  LOCATION_REF_PATTERN,
  buildBookingConfirmation,
  type BookingConfirmation,
} from '../session-booking';
import type { BookSessionRequest, BookSessionResponse } from '../session-booking.service';
import {
  SESSION_MODES,
  SESSION_MODE_LABELS,
  describeSchedulingFailure,
  formatLocalAndUtc,
  isSafePlainText,
  type SchedulingError,
  type SchedulingAgreement,
  type SessionMode,
} from '../session-core';

export interface SessionBookingFormProps {
  /** Null when no agreement has been chosen. */
  agreement: Pick<SchedulingAgreement, 'agreementId' | 'status'> | null;
  /** The slot picked in the slot finder. Null until one is chosen. */
  slot: { startsAt: string; endsAt: string } | null;
  /** The viewer's IANA time zone. */
  timeZone: string;
  allowedDurationsMinutes: readonly number[];
  /** False when the viewer may not schedule for this agreement. */
  canBook?: boolean;
  onSubmit: (request: BookSessionRequest) => Promise<BookSessionResponse>;
  /** Injectable so tests and callers control key generation. */
  createIdempotencyKey?: () => string;
}

function defaultKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `book-${crypto.randomUUID()}`;
  }
  return `book-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

const FIELD_NAMES = ['mode', 'locationRef', 'agenda', 'startsAt', 'durationMinutes'] as const;
type FieldName = (typeof FIELD_NAMES)[number];
type FieldErrors = Partial<Record<FieldName, string>>;

export function SessionBookingForm({
  agreement,
  slot,
  timeZone,
  allowedDurationsMinutes,
  canBook = true,
  onSubmit,
  createIdempotencyKey = defaultKey,
}: SessionBookingFormProps) {
  const baseId = useId();
  const [mode, setMode] = useState<SessionMode>('virtual');
  const [locationRef, setLocationRef] = useState('');
  const [agenda, setAgenda] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<SchedulingError | null>(null);
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null);

  const keyRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const submittingRef = useRef(false);
  const alertRef = useRef<HTMLDivElement>(null);
  const successRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (failure) alertRef.current?.focus();
  }, [failure]);

  useEffect(() => {
    if (confirmation) successRef.current?.focus();
  }, [confirmation]);

  const titleId = `${baseId}-title`;

  if (!canBook) {
    return (
      <section aria-labelledby={titleId} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 id={titleId} className="text-lg font-semibold text-slate-900">Book a session</h2>
        <p role="alert" className="mt-3 text-sm text-red-700">
          You do not have permission to book sessions for this agreement.
        </p>
      </section>
    );
  }

  if (!agreement) {
    return (
      <section aria-labelledby={titleId} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 id={titleId} className="text-lg font-semibold text-slate-900">Book a session</h2>
        <p role="status" className="mt-3 text-sm text-slate-600">
          No agreement selected. Choose an active agreement to book a session.
        </p>
      </section>
    );
  }

  if (agreement.status !== 'active') {
    return (
      <section aria-labelledby={titleId} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 id={titleId} className="text-lg font-semibold text-slate-900">Book a session</h2>
        <p role="alert" className="mt-3 text-sm text-red-700">
          Sessions can only be booked while the agreement is active.
        </p>
      </section>
    );
  }

  if (!slot) {
    return (
      <section aria-labelledby={titleId} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 id={titleId} className="text-lg font-semibold text-slate-900">Book a session</h2>
        <p role="status" className="mt-3 text-sm text-slate-600">
          Pick an available slot first, then add the details here.
        </p>
      </section>
    );
  }

  const durationMinutes = Math.round((Date.parse(slot.endsAt) - Date.parse(slot.startsAt)) / 60_000);
  const time = formatLocalAndUtc(slot.startsAt, slot.endsAt, timeZone);
  const needsLocation = mode !== 'virtual';

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};
    if (!allowedDurationsMinutes.includes(durationMinutes)) {
      errors.durationMinutes = `This slot is ${durationMinutes} minutes. Allowed lengths are ${allowedDurationsMinutes.join(', ')} minutes.`;
    }
    if (needsLocation && !locationRef.trim()) {
      errors.locationRef = 'Enter a location reference for in-person and hybrid sessions.';
    } else if (locationRef.trim() && !LOCATION_REF_PATTERN.test(locationRef.trim())) {
      errors.locationRef = 'Use letters, numbers, hyphens or underscores only.';
    }
    if (agenda.length > AGENDA_MAX_LENGTH) {
      errors.agenda = `Keep the agenda to ${AGENDA_MAX_LENGTH} characters or fewer.`;
    } else if (!isSafePlainText(agenda)) {
      errors.agenda = 'Use plain text without markup.';
    }
    return errors;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;

    const errors = validate();
    setFieldErrors(errors);
    setFailure(null);
    if (Object.keys(errors).length > 0) return;

    const request: Omit<BookSessionRequest, 'idempotencyKey'> = {
      startsAt: slot.startsAt,
      durationMinutes,
      mode,
      timeZone,
      ...(locationRef.trim() ? { locationRef: locationRef.trim() } : {}),
      ...(agenda.trim() ? { agenda: agenda.trim() } : {}),
    };

    // The same intent keeps the same key, so a retry after a failure can never
    // book twice. Changing any field is a new intent and gets a new key.
    const fingerprint = JSON.stringify(request);
    if (!keyRef.current || keyRef.current.fingerprint !== fingerprint) {
      keyRef.current = { fingerprint, key: createIdempotencyKey() };
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const response = await onSubmit({ ...request, idempotencyKey: keyRef.current.key });
      setConfirmation(buildBookingConfirmation(response.session, timeZone, response.replayed));
    } catch (caught) {
      const described = describeSchedulingFailure(caught);
      const mapped: FieldErrors = {};
      for (const issue of described.issues ?? []) {
        if ((FIELD_NAMES as readonly string[]).includes(issue.field)) {
          mapped[issue.field as FieldName] = issue.message;
        }
      }
      setFieldErrors(mapped);
      setFailure(described);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  if (confirmation) {
    return (
      <section aria-labelledby={titleId} className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
        <h2
          id={titleId}
          ref={successRef}
          tabIndex={-1}
          className="text-lg font-semibold text-emerald-900 focus:outline-none"
        >
          Session booked
        </h2>
        <div role="status" className="mt-3 space-y-2 text-sm text-emerald-900">
          {confirmation.replayed && (
            <p>This booking was already confirmed. No second session was created.</p>
          )}
          <p>
            <span className="font-medium">Your time:</span>{' '}
            <time dateTime={confirmation.time.startsAtUtc}>{confirmation.time.local}</time>
          </p>
          <p>
            <span className="font-medium">UTC:</span>{' '}
            <time dateTime={confirmation.time.startsAtUtc}>{confirmation.time.utc}</time>
          </p>
          <p>
            {SESSION_MODE_LABELS[confirmation.mode]}, {confirmation.durationMinutes} minutes
          </p>
        </div>
      </section>
    );
  }

  const describedBy = (field: keyof FieldErrors, extra?: string) =>
    [fieldErrors[field] ? `${baseId}-${field}-error` : null, extra].filter(Boolean).join(' ') || undefined;

  return (
    <section aria-labelledby={titleId} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 id={titleId} className="text-lg font-semibold text-slate-900">Book a session</h2>
      <p className="mt-1 text-sm text-slate-600">
        <time dateTime={time.startsAtUtc}>{time.local}</time>
        <span className="block text-xs text-slate-500">UTC: {time.utc}</span>
      </p>

      <form onSubmit={handleSubmit} noValidate aria-busy={submitting} className="mt-5 space-y-5">
        <p className="text-sm text-slate-700">Duration: {durationMinutes} minutes</p>
        {fieldErrors.durationMinutes && (
          <p id={`${baseId}-durationMinutes-error`} className="text-sm text-red-700">
            {fieldErrors.durationMinutes}
          </p>
        )}

        <fieldset className="space-y-2" disabled={submitting}>
          <legend className="text-sm font-medium text-slate-900">Session mode</legend>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
            {SESSION_MODES.map((option) => (
              <label key={option} className="flex min-h-[44px] items-center gap-2 text-sm text-slate-800">
                <input
                  type="radio"
                  name={`${baseId}-mode`}
                  value={option}
                  checked={mode === option}
                  onChange={() => setMode(option)}
                  className="h-4 w-4"
                />
                {SESSION_MODE_LABELS[option]}
              </label>
            ))}
          </div>
        </fieldset>

        {needsLocation && (
          <div>
            <label htmlFor={`${baseId}-location`} className="block text-sm font-medium text-slate-900">
              Location reference
            </label>
            <input
              id={`${baseId}-location`}
              type="text"
              value={locationRef}
              onChange={(event) => setLocationRef(event.target.value)}
              disabled={submitting}
              required
              aria-required="true"
              aria-invalid={fieldErrors.locationRef ? true : undefined}
              aria-describedby={describedBy('locationRef', `${baseId}-location-hint`)}
              className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <p id={`${baseId}-location-hint`} className="mt-1 text-xs text-slate-500">
              An identifier for a saved location, not an address.
            </p>
            {fieldErrors.locationRef && (
              <p id={`${baseId}-locationRef-error`} className="mt-1 text-sm text-red-700">
                {fieldErrors.locationRef}
              </p>
            )}
          </div>
        )}

        <div>
          <label htmlFor={`${baseId}-agenda`} className="block text-sm font-medium text-slate-900">
            Agenda <span className="font-normal text-slate-500">(optional)</span>
          </label>
          <textarea
            id={`${baseId}-agenda`}
            value={agenda}
            onChange={(event) => setAgenda(event.target.value)}
            disabled={submitting}
            rows={4}
            aria-invalid={fieldErrors.agenda ? true : undefined}
            aria-describedby={describedBy('agenda', `${baseId}-agenda-count`)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <p id={`${baseId}-agenda-count`} className="mt-1 text-xs text-slate-500">
            {agenda.length} of {AGENDA_MAX_LENGTH} characters
          </p>
          {fieldErrors.agenda && (
            <p id={`${baseId}-agenda-error`} className="mt-1 text-sm text-red-700">
              {fieldErrors.agenda}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="min-h-[44px] w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
        >
          {submitting ? 'Booking session…' : failure?.retryable ? 'Try again' : 'Book session'}
        </button>

        {failure && (
          <div
            ref={alertRef}
            role="alert"
            tabIndex={-1}
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 focus:outline-none"
          >
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
      </form>
    </section>
  );
}

export default SessionBookingForm;
