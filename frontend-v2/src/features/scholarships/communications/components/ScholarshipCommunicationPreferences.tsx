'use client';

import { useCallback, useId, useState } from 'react';
import {
  ALL_COMMS_EVENTS,
  COMMS_CHANNELS,
  changesTakeEffectFrom,
  effectivePreference,
  isMandatoryEvent,
  recordOptInConsent,
  requiresOptInConsent,
  togglePreference,
  type PreferenceChange,
  type PreferenceMatrix,
  type ConsentEvidence,
} from '../service';
import type { Channel, ScholarshipNotificationEventName } from '../types';

export type ScholarshipCommunicationPreferencesProps = {
  matrix: PreferenceMatrix | null;
  state?: 'loading' | 'ready' | 'error';
  errorMessage?: string;
  canEdit?: boolean;
  onSave?: (matrix: PreferenceMatrix) => Promise<PreferenceMatrix>;
};

const PANEL = 'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm';
const FOCUS = 'focus:outline-none focus:ring-2 focus:ring-emerald-200';
const CHECKBOX = `h-4 w-4 rounded border-slate-300 text-emerald-600 ${FOCUS}`;

type SaveState = 'idle' | 'saving' | 'success' | 'error';

/** Fixed clock so the effective-time preview is deterministic in tests. */
const NOW = new Date('2026-05-04T10:00:00.000Z');

export function ScholarshipCommunicationPreferences({
  matrix: matrixProp,
  state: stateProp,
  errorMessage,
  canEdit = true,
  onSave,
}: ScholarshipCommunicationPreferencesProps) {
  const headingId = useId();
  const consentId = `${headingId}-consent`;

  const [matrix, setMatrix] = useState<PreferenceMatrix | null>(matrixProp);
  const [pending, setPending] = useState<PreferenceChange[]>([]);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState('');

  const now = NOW;

  const hasOptInConsent = useCallback(
    (eventName: ScholarshipNotificationEventName, channel: Channel) =>
      Boolean(
        matrix?.consents.find(
          (evidence) =>
            evidence.eventName === eventName &&
            evidence.channel === channel &&
            evidence.basis === 'opt-in'
        )
      ),
    [matrix]
  );

  const handleToggle = useCallback(
    (eventName: ScholarshipNotificationEventName, channel: Channel, enabled: boolean) => {
      if (!matrix) return;
      // Mandatory cells are rendered disabled and are never routed through here.
      if (isMandatoryEvent(eventName)) return;

      const change: PreferenceChange = {
        eventName,
        channel,
        enabled,
        effectiveFrom: now.toISOString(),
        changedAt: now.toISOString(),
        scope: 'user',
        scopeId: 'current-user',
      };
      const next = togglePreference(matrix, change, now);
      if (next === matrix) {
        setSaveState('error');
        setSaveError(
          `A consent tick is required before ${channel} can be enabled for "${eventName}".`
        );
        return;
      }
      setMatrix(next);
      setPending((current) => [
        ...current.filter(
          (item) => !(item.eventName === eventName && item.channel === channel)
        ),
        change,
      ]);
      setSaveState('idle');
      setSaveError('');
    },
    [matrix, now]
  );

  const handleConsent = useCallback(
    (granted: boolean) => {
      if (!matrix) return;
      const evidence: ConsentEvidence = {
        eventName: 'review.assigned',
        channel: 'email',
        basis: 'opt-in',
        capturedAt: now.toISOString(),
        policyVersion: '2026-09-01',
      };
      setMatrix(granted ? recordOptInConsent(matrix, evidence) : matrix);
    },
    [matrix, now]
  );

  const handleSave = useCallback(async () => {
    if (!matrix) return;
    setSaveState('saving');
    setSaveError('');
    try {
      const save =
        onSave ??
        (async (next: PreferenceMatrix) => {
          const { communicationsService } = await import('../service');
          return communicationsService.save({
            matrix: next,
            idempotencyKey: `comms-${next.entries.length}-${now.toISOString()}`,
            expectedVersion: next.entries.length,
          });
        });
      const saved = await save(matrix);
      setMatrix(saved);
      setPending([]);
      setSaveState('success');
    } catch (err) {
      setSaveState('error');
      setSaveError(err instanceof Error ? err.message : 'Preferences could not be saved.');
    }
  }, [matrix, now, onSave]);

  if (stateProp === 'loading') {
    return (
      <div className={PANEL} role="status" aria-live="polite" data-testid="prefs-loading">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Loading communication preferences
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Reading the effective channel choices for every scholarship event.
        </p>
      </div>
    );
  }

  if (stateProp === 'error') {
    return (
      <div
        className="rounded-2xl border border-red-200 bg-red-50 p-6"
        role="alert"
        data-testid="prefs-error"
      >
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Communication preferences could not be loaded
        </h1>
        <p className="mt-2 text-sm text-red-800">
          {errorMessage || 'The communications service returned an error.'}
        </p>
        <p className="mt-3 text-sm text-red-800">
          Next step: retry the request before changing any preference.
        </p>
      </div>
    );
  }

  if (!matrix) {
    return (
      <div
        className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6"
        role="status"
        aria-live="polite"
        data-testid="prefs-empty"
      >
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">No preference matrix</h1>
        <p className="mt-2 text-sm text-slate-600">
          Nothing has been recorded for this account yet, so every optional channel is off and every
          required notice is still on. Next step: tick the opt-in consent below to begin.
        </p>
      </div>
    );
  }

  return (
    <section className={PANEL} aria-labelledby={headingId} data-testid="prefs-ready">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
          Communications
        </p>
        <h1 id={headingId} className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
          Notification channel preferences
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Choose how you hear about each scholarship event. Required operational notices are always
          delivered and cannot be switched off.
        </p>
      </header>

      {!canEdit && (
        <div
          className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
          role="note"
          data-testid="prefs-denied"
        >
          You do not have permission to change communication preferences. Next step: contact the
          program administrator if you need a channel added or removed.
        </div>
      )}

      <div className="mt-4 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <input
          id={consentId}
          type="checkbox"
          checked={hasOptInConsent('review.assigned', 'email')}
          disabled={!canEdit}
          onChange={(e) => handleConsent(e.target.checked)}
          aria-describedby={`${consentId}-help`}
          className={CHECKBOX}
        />
        <div>
          <label htmlFor={consentId} className="block text-sm font-semibold text-slate-900">
            I consent to optional scholarship notifications by email, SMS, and push
          </label>
          <p id={`${consentId}-help`} className="mt-1 text-xs text-slate-600">
            Optional channels stay off until this consent is recorded. Required operational notices
            do not need consent.
          </p>
        </div>
      </div>

      {matrix.entries.length === 0 && (
        <p
          className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600"
          role="status"
          aria-live="polite"
          data-testid="prefs-empty-matrix"
        >
          No preferences are recorded yet, so every optional event is off on every channel. Next
          step: record consent, then tick the channels you want.
        </p>
      )}

      <div className="mt-6 space-y-4">
        {ALL_COMMS_EVENTS.map((eventName) => {
          const mandatory = isMandatoryEvent(eventName);
          return (
            <fieldset
              key={eventName}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4"
              disabled={!canEdit}
            >
              <legend className="px-1 text-sm font-semibold text-slate-900">
                {eventName} {mandatory ? '(required notice)' : '(optional)'}
              </legend>
              {mandatory && (
                <p
                  className="mt-1 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900"
                  role="note"
                >
                  Required operational notice &mdash; cannot be switched off.
                </p>
              )}
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {COMMS_CHANNELS.map((channel) => {
                  const cellId = `${headingId}-${eventName}-${channel}`;
                  const resolved = effectivePreference(matrix, eventName, channel, now);
                  const needsConsent =
                    !mandatory && requiresOptInConsent(channel) && !hasOptInConsent(eventName, channel);
                  const helpId = `${cellId}-help`;
                  return (
                    <div key={channel}>
                      <div className="flex items-center gap-2">
                        <input
                          id={cellId}
                          type="checkbox"
                          checked={resolved.enabled}
                          disabled={mandatory || needsConsent || !canEdit}
                          onChange={(e) => handleToggle(eventName, channel, e.target.checked)}
                          aria-describedby={helpId}
                          className={CHECKBOX}
                        />
                        <label htmlFor={cellId} className="text-sm text-slate-700">
                          {channel}
                        </label>
                      </div>
                      <p id={helpId} className="mt-1 text-xs text-slate-500">
                        {mandatory
                          ? 'Checked and disabled: required operational notice.'
                          : needsConsent
                            ? 'Tick the opt-in consent above to enable this channel.'
                            : resolved.reason}
                      </p>
                    </div>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
      </div>

      <section className="mt-6" aria-labelledby={`${headingId}-pending`}>
        <h2 id={`${headingId}-pending`} className="text-lg font-semibold text-slate-900">
          Pending changes
        </h2>
        {pending.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600" role="status" aria-live="polite" data-testid="prefs-no-pending">
            No unsaved changes. Required notices are already on.
          </p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-slate-600" data-testid="prefs-pending">
            {pending.map((change) => (
              <li key={`${change.eventName}-${change.channel}`}>
                <span className="font-semibold text-slate-900">{change.eventName}</span> on{' '}
                {change.channel} will be {change.enabled ? 'on' : 'off'} from{' '}
                <span className="font-mono text-xs">
                  {changesTakeEffectFrom(change, now)}
                </span>{' '}
                (at the next scheduled send).
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!canEdit || saveState === 'saving'}
          aria-busy={saveState === 'saving'}
          className={`rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS}`}
        >
          {saveState === 'saving' ? 'Saving preferences…' : 'Save preferences'}
        </button>
        <p className="text-sm text-slate-600" role="status" aria-live="polite" data-testid="prefs-save-status">
          {saveState === 'success' && 'Preferences saved. The new choices apply at the next scheduled send.'}
          {saveState === 'error' && (saveError || 'Preferences could not be saved.')}
          {saveState === 'idle' && 'Changes are not applied until you save them.'}
        </p>
      </div>
    </section>
  );
}

export default ScholarshipCommunicationPreferences;
