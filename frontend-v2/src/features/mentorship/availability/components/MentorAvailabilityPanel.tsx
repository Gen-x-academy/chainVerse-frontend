'use client';

import { useEffect, useState } from 'react';
import { CalendarClock, RefreshCw } from 'lucide-react';
import { resolveAvailabilityStatus } from '../logic';
import { useAvailabilityStore } from './store';
import type { MentorAvailability, MentorAvailabilityStatus } from '../types';
import { AvailabilityStatusBadge } from './AvailabilityStatusBadge';

const STATUS_OPTIONS: MentorAvailabilityStatus[] = [
  'accepting_requests',
  'limited_availability',
  'waitlist_only',
  'temporarily_unavailable',
  'inactive',
];

/**
 * Staff-facing panel: shows every mentor availability and lets authorized
 * staff schedule the next status with an effective window.
 *
 * Until the mentorship API exists, updates fall back to the local cache so
 * the flow stays usable end to end.
 */
export function MentorAvailabilityPanel() {
  const state = useAvailabilityStore();
  const status = state.status;
  const availabilities = state.availabilities;
  const error = state.error;
  const load = state.load;

  useEffect(() => {
    if (availabilities.length === 0) {
      void load();
    }
    // Run once per mount; reloads are explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentStatus = resolveAvailabilityStatus(availabilities);

  return (
    <section
      className="bg-white rounded-xl border border-gray-200 shadow-sm"
      aria-label="Mentor availability"
    >
      <header className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-gray-500" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-gray-900">Mentor availability</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">Current status</span>
          <AvailabilityStatusBadge status={currentStatus} />
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Reload
        </button>
      </header>
      <div className="p-6">
        {error ? (
          <p role="alert" className="mb-4 text-sm text-red-600">
            {error}
          </p>
        ) : null}
        {status === 'loading' ? (
          <p className="text-sm text-gray-500">Loading availability...</p>
        ) : availabilities.length === 0 ? (
          <p className="text-sm text-gray-500">No availability records yet.</p>
        ) : (
          <ul className="space-y-4">
            {availabilities.map((availability) => (
              <AvailabilityRow
                key={availability.internalId}
                availability={availability}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function AvailabilityRow({ availability }: { availability: MentorAvailability }) {
  const applyUpdate = useAvailabilityStore((state) => state.applyUpdate);
  const [nextStatus, setNextStatus] = useState<MentorAvailabilityStatus>(
    availability.status
  );
  const [effectiveFrom, setEffectiveFrom] = useState(
    availability.effectiveFrom.slice(0, 10)
  );
  const [effectiveUntil, setEffectiveUntil] = useState(
    availability.effectiveUntil?.slice(0, 10) ?? ''
  );
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      await applyUpdate(availability.internalId, {
        status: nextStatus,
        effectiveFrom: new Date(effectiveFrom).toISOString(),
        effectiveUntil: effectiveUntil
          ? new Date(effectiveUntil).toISOString()
          : undefined,
      });
      setFeedback('Saved.');
    } catch {
      setFeedback('Unable to update the record.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="rounded-lg border border-gray-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-gray-900">{availability.publicId}</p>
          <p className="text-sm text-gray-500">
            Effective from {availability.effectiveFrom.slice(0, 10)}
            {availability.effectiveUntil
              ? ` until ${availability.effectiveUntil.slice(0, 10)}`
              : ''}
          </p>
        </div>
        <AvailabilityStatusBadge status={availability.status} />
      </div>
      <form
        className="mt-4 flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <div>
          <label
            htmlFor={`status-${availability.internalId}`}
            className="mb-1 block text-xs font-medium text-gray-700"
          >
            Next status
          </label>
          <select
            id={`status-${availability.internalId}`}
            value={nextStatus}
            onChange={(event) =>
              setNextStatus(event.target.value as MentorAvailabilityStatus)
            }
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor={`from-${availability.internalId}`}
            className="mb-1 block text-xs font-medium text-gray-700"
          >
            From
          </label>
          <input
            id={`from-${availability.internalId}`}
            type="date"
            value={effectiveFrom}
            onChange={(event) => setEffectiveFrom(event.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label
            htmlFor={`until-${availability.internalId}`}
            className="mb-1 block text-xs font-medium text-gray-700"
          >
            Until
          </label>
          <input
            id={`until-${availability.internalId}`}
            type="date"
            value={effectiveUntil}
            onChange={(event) => setEffectiveUntil(event.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={saving || effectiveFrom.length === 0}
          className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {saving ? 'Saving...' : 'Schedule'}
        </button>
        {feedback ? (
          <p aria-live="polite" className="text-xs text-gray-600">
            {feedback}
          </p>
        ) : null}
      </form>
    </li>
  );
}
