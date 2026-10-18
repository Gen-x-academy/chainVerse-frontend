'use client';

import { useId, useState } from 'react';
import {
  CALENDAR_PROVIDERS,
  type CalendarConnection,
  type CalendarProvider,
} from '../external-calendar';

export interface ExternalCalendarPanelProps {
  connections: readonly CalendarConnection[];
  busyWindowCount?: number;
  canManage?: boolean;
  loading?: boolean;
  error?: string | null;
  successMessage?: string | null;
  onConnect?: (provider: CalendarProvider) => Promise<void> | void;
  onSync?: (connectionId: string) => Promise<void> | void;
  onDisconnect?: (connectionId: string) => Promise<void> | void;
}

const PROVIDER_LABELS: Record<CalendarProvider, string> = {
  google: 'Google Calendar',
  microsoft: 'Microsoft Outlook',
};

export function ExternalCalendarPanel({
  connections,
  busyWindowCount = 0,
  canManage = true,
  loading = false,
  error,
  successMessage,
  onConnect,
  onSync,
  onDisconnect,
}: ExternalCalendarPanelProps) {
  const baseId = useId();
  const [provider, setProvider] = useState<CalendarProvider>('google');
  const [pending, setPending] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const run = async (key: string, action: () => Promise<void> | void) => {
    setPending(key);
    setLocalError(null);
    try {
      await action();
    } catch (caught) {
      setLocalError(caught instanceof Error ? caught.message : 'Calendar action failed.');
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
          External calendar
        </h2>
        <p className="text-sm text-slate-600">
          Only free/busy windows are imported. Event titles, attendees, locations and descriptions
          are discarded and never stored.
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label htmlFor={`${baseId}-provider`} className="block text-sm font-medium text-slate-700">
            Calendar provider
          </label>
          <select
            id={`${baseId}-provider`}
            value={provider}
            disabled={!canManage || pending !== null}
            onChange={(event) => setProvider(event.target.value as CalendarProvider)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-50"
          >
            {CALENDAR_PROVIDERS.map((option) => (
              <option key={option} value={option}>
                {PROVIDER_LABELS[option]}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          disabled={!canManage || pending !== null}
          onClick={() => void run('connect', () => onConnect?.(provider))}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending === 'connect' ? 'Connecting…' : 'Connect calendar'}
        </button>
      </div>

      <div className="mt-5" aria-live="polite">
        {loading ? (
          <p role="status" className="text-sm text-slate-600">
            Loading calendar connections…
          </p>
        ) : connections.length === 0 ? (
          <p role="status" className="text-sm text-slate-600">
            No calendar connections yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {connections.map((connection) => {
              const revoked = connection.status === 'revoked';
              return (
                <li
                  key={connection.id}
                  className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {PROVIDER_LABELS[connection.provider]}
                    </p>
                    <p className="text-sm text-slate-600">
                      {revoked
                        ? 'Disconnected'
                        : connection.lastSyncedAt
                          ? `Last synced ${new Date(connection.lastSyncedAt).toLocaleString()}`
                          : 'Not synced yet'}
                    </p>
                    <p className="text-xs text-slate-500">
                      Access: {connection.scopes.join(', ')}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!canManage || revoked || pending !== null}
                      onClick={() => void run(`sync-${connection.id}`, () => onSync?.(connection.id))}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
                    >
                      {pending === `sync-${connection.id}` ? 'Syncing…' : 'Sync busy times'}
                    </button>
                    <button
                      type="button"
                      disabled={!canManage || revoked || pending !== null}
                      onClick={() =>
                        void run(`disconnect-${connection.id}`, () => onDisconnect?.(connection.id))
                      }
                      className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 disabled:opacity-60"
                    >
                      {pending === `disconnect-${connection.id}` ? 'Disconnecting…' : 'Disconnect'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="mt-4 text-sm text-slate-600">
        Busy windows retained: <strong>{busyWindowCount}</strong>
      </p>

      {shownError && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {shownError}
        </p>
      )}
      {successMessage && (
        <p role="status" className="mt-3 text-sm text-emerald-700">
          {successMessage}
        </p>
      )}
      {!canManage && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          Your role cannot manage calendar connections.
        </p>
      )}
    </section>
  );
}

export default ExternalCalendarPanel;
