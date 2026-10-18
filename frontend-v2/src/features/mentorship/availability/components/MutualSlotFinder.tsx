'use client';

import { useId, useState } from 'react';
import type { SessionSlotCandidate } from '../slot-finder';

export interface MutualSlotFinderProps {
  slots: readonly SessionSlotCandidate[];
  timeZone?: string;
  loading?: boolean;
  error?: string | null;
  canSearch?: boolean;
  nextCursor?: string;
  onSearch?: () => Promise<void> | void;
  onLoadMore?: () => Promise<void> | void;
  onSelect?: (slot: SessionSlotCandidate) => Promise<void> | void;
}

function formatSlot(startsAt: string, endsAt: string, timeZone: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  try {
    const date = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(start);
    const time = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      minute: '2-digit',
    });
    return `${date}, ${time.format(start)}–${time.format(end)}`;
  } catch {
    return `${start.toISOString()}–${end.toISOString()}`;
  }
}

export function MutualSlotFinder({
  slots,
  timeZone = 'UTC',
  loading = false,
  error,
  canSearch = true,
  nextCursor,
  onSearch,
  onLoadMore,
  onSelect,
}: MutualSlotFinderProps) {
  const baseId = useId();
  const [pending, setPending] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const run = async (key: string, action: () => Promise<void> | void) => {
    setPending(key);
    setLocalError(null);
    try {
      await action();
    } catch (caught) {
      setLocalError(caught instanceof Error ? caught.message : 'The slot request failed.');
    } finally {
      setPending(null);
    }
  };

  const shownError = localError ?? error;

  return (
    <section
      aria-labelledby={`${baseId}-title`}
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div className="flex flex-col gap-1">
        <h2 id={`${baseId}-title`} className="text-lg font-semibold text-slate-900">
          Mutually available session slots
        </h2>
        <p className="text-sm text-slate-600">
          Times are shown in {timeZone}. Existing bookings, blackout periods and both
          participants&apos; time zones are already applied.
        </p>
      </div>

      <div className="mt-4">
        <button
          type="button"
          disabled={!canSearch || pending !== null}
          onClick={() => void run('search', () => onSearch?.())}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending === 'search' ? 'Finding slots…' : 'Find available slots'}
        </button>
      </div>

      <div className="mt-5" aria-live="polite">
        {loading ? (
          <p role="status" className="text-sm text-slate-600">
            Finding available slots…
          </p>
        ) : slots.length === 0 ? (
          <p role="status" className="text-sm text-slate-600">
            No mutual slots found for this range.
          </p>
        ) : (
          <ul aria-label="Available session slots" className="space-y-3">
            {slots.map((slot) => {
              const label = formatSlot(slot.startsAt, slot.endsAt, timeZone);
              return (
                <li
                  key={slot.startsAt}
                  className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <time dateTime={slot.startsAt} className="font-medium text-slate-900">
                      {label}
                    </time>
                    <p className="text-sm text-slate-600">
                      {slot.availableCapacity} place{slot.availableCapacity === 1 ? '' : 's'} available
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={!canSearch || pending !== null}
                    onClick={() => void run(slot.startsAt, () => onSelect?.(slot))}
                    aria-label={`Select slot ${label}`}
                    className="rounded-lg border border-indigo-600 px-3 py-2 text-sm font-semibold text-indigo-700 disabled:opacity-60"
                  >
                    {pending === slot.startsAt ? 'Selecting…' : 'Select'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {nextCursor && (
        <button
          type="button"
          disabled={!canSearch || pending !== null}
          onClick={() => void run('more', () => onLoadMore?.())}
          className="mt-4 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
        >
          {pending === 'more' ? 'Loading…' : 'Load more slots'}
        </button>
      )}

      {shownError && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {shownError}
        </p>
      )}
      {!canSearch && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          Only participants in this program can search for slots.
        </p>
      )}
    </section>
  );
}

export default MutualSlotFinder;
