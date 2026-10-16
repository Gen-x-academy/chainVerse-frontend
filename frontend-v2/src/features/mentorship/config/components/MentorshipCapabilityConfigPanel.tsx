'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import {
  enabledMentorshipCapabilities,
  mentorshipConfigService,
  SAFE_DEFAULT_MENTORSHIP_CONFIG,
  validateMentorshipConfig,
} from '../service';
import {
  MENTORSHIP_ENVIRONMENTS,
  MENTORSHIP_FEATURE_FLAG_KEYS,
  SESSION_DURATIONS_MINUTES,
  SUPPORTED_CURRENCIES,
  type MentorshipCapabilityConfig,
  type MentorshipEnvironment,
  type MentorshipFeatureFlagKey,
} from '../types';

type Props = {
  canManage?: boolean;
  environment?: MentorshipEnvironment;
};

const INPUT_CLASS =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-200';
const SELECT_CLASS =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-200';

const LIMIT_FIELDS: { key: keyof MentorshipCapabilityConfig['limits']; label: string }[] = [
  { key: 'maxActiveEngagementsPerMentor', label: 'Max active engagements per mentor' },
  { key: 'maxActiveEngagementsPerMentee', label: 'Max active engagements per mentee' },
  { key: 'maxSessionsPerEngagement', label: 'Max sessions per engagement' },
  { key: 'maxSessionDurationMinutes', label: 'Max session duration (minutes)' },
  { key: 'minCancellationNoticeHours', label: 'Minimum cancellation notice (hours)' },
];

export function MentorshipCapabilityConfigPanel({
  canManage = true,
  environment: initialEnvironment = 'staging',
}: Props) {
  const baseId = useId();
  const [environment, setEnvironment] = useState<MentorshipEnvironment>(initialEnvironment);
  const [config, setConfig] = useState<MentorshipCapabilityConfig | null>(null);
  const [source, setSource] = useState<'remote' | 'default'>('default');
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (target: MentorshipEnvironment) => {
    setLoading(true);
    setSaveError(null);
    try {
      const resolution = await mentorshipConfigService.resolve(target);
      setConfig(resolution.config);
      setSource(resolution.source);
    } catch (error) {
      setConfig({ ...SAFE_DEFAULT_MENTORSHIP_CONFIG, environment: target });
      setSource('default');
      setSaveError(error instanceof Error ? error.message : 'Unable to load the configuration.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(environment);
  }, [environment, load]);

  const validationErrors = useMemo(
    () => (config ? validateMentorshipConfig(config) : []),
    [config],
  );

  const errorByPath = useMemo(() => {
    const map = new Map<string, string>();
    for (const error of validationErrors) map.set(error.path, error.message);
    return map;
  }, [validationErrors]);

  const toggleFlag = (key: MentorshipFeatureFlagKey) => {
    if (!config || !canManage) return;
    const featureFlags: Record<MentorshipFeatureFlagKey, boolean> = {
      ...config.featureFlags,
      [key]: !config.featureFlags[key],
    };
    setConfig({ ...config, featureFlags });
  };

  const setLimit = (key: keyof MentorshipCapabilityConfig['limits'], raw: string) => {
    if (!config) return;
    const value = Number(raw);
    const limits = {
      ...config.limits,
      [key]: Number.isFinite(value) ? value : NaN,
    } as MentorshipCapabilityConfig['limits'];
    setConfig({ ...config, limits });
  };

  const persist = async () => {
    if (!config) return;
    if (validationErrors.length > 0) {
      setSaveError('Fix the highlighted fields before saving.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await mentorshipConfigService.put(environment, config);
      setConfig(saved);
      setSource('remote');
      setStatus(`Saved the ${environment} capability configuration (v${saved.version}).`);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to save the configuration.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div
        className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm"
        role="status"
        aria-live="polite"
      >
        Loading mentorship capability configuration...
      </div>
    );
  }

  if (!config) {
    return (
      <div
        className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600"
        role="status"
        aria-live="polite"
      >
        <p className="font-semibold text-slate-900">No capability configuration is available.</p>
        <p className="mt-2">Every mentorship capability stays disabled until a valid document is configured.</p>
      </div>
    );
  }

  const live = enabledMentorshipCapabilities(config);

  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      aria-labelledby={`${baseId}-heading`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-700">
            Capability configuration
          </p>
          <h2 id={`${baseId}-heading`} className="mt-2 text-2xl font-black text-slate-900">
            Mentorship capabilities
          </h2>
        </div>
        <div>
          <label htmlFor={`${baseId}-env`} className="sr-only">
            Environment
          </label>
          <select
            id={`${baseId}-env`}
            className={SELECT_CLASS}
            value={environment}
            onChange={(event) => setEnvironment(event.target.value as MentorshipEnvironment)}
          >
            {MENTORSHIP_ENVIRONMENTS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="mt-3 text-sm text-slate-600" role="status" aria-live="polite">
        {live.length > 0
          ? `Live capabilities: ${live.join(', ')}.`
          : 'No capabilities are live; safe defaults are in effect.'}
      </p>

      {source === 'default' && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" role="note">
          <p className="font-semibold">Safe defaults are active.</p>
          <p className="mt-1">
            The remote configuration was missing or invalid, so every flag is off and the limits are conservative.
          </p>
        </div>
      )}

      {!canManage && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" role="note">
          <p className="font-semibold">You do not have permission to change this configuration.</p>
          <p className="mt-1">Read-only view: ask an administrator to change a capability or limit.</p>
        </div>
      )}

      {status && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800" role="status" aria-live="polite">
          {status}
        </div>
      )}

      {saveError && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          <p className="font-semibold">The configuration could not be saved.</p>
          <p className="mt-1">{saveError}</p>
        </div>
      )}

      <fieldset className="mt-6">
        <legend className="text-sm font-semibold text-slate-800">Feature flags</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {MENTORSHIP_FEATURE_FLAG_KEYS.map((key) => {
            const id = `${baseId}-flag-${key}`;
            return (
              <div key={key} className="flex items-center gap-2 rounded-lg border border-slate-200 p-3">
                <input
                  id={id}
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  checked={config.featureFlags[key]}
                  disabled={!canManage}
                  onChange={() => toggleFlag(key)}
                />
                <label htmlFor={id} className="text-sm text-slate-700">
                  {key}
                </label>
              </div>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="mt-6">
        <legend className="text-sm font-semibold text-slate-800">Limits</legend>
        <div className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LIMIT_FIELDS.map(({ key, label }) => {
            const errorMessage = errorByPath.get(`limits.${key}`);
            const fieldId = `${baseId}-limit-${key}`;
            const messageId = `${fieldId}-error`;
            return (
              <div key={key}>
                <label htmlFor={fieldId} className="block text-sm font-medium text-slate-700">
                  {label}
                </label>
                <input
                  id={fieldId}
                  type="number"
                  min={0}
                  value={Number.isFinite(config.limits[key]) ? config.limits[key] : ''}
                  disabled={!canManage}
                  aria-invalid={errorMessage ? true : undefined}
                  aria-describedby={errorMessage ? messageId : undefined}
                  onChange={(event) => setLimit(key, event.target.value)}
                  className={INPUT_CLASS}
                />
                {errorMessage && (
                  <p id={messageId} role="alert" className="mt-1 text-sm text-red-700">
                    {errorMessage}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-sm font-semibold text-slate-800">Supported currencies</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {config.supportedCurrencies.map((currency) => (
              <li
                key={currency}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
              >
                {currency}
                {currency === config.defaultCurrency ? ' (default)' : ''}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-500">Available: {SUPPORTED_CURRENCIES.join(', ')}</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">Session durations</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {config.sessionDurationsMinutes.map((duration) => (
              <li key={duration} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {duration} min
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-500">Allowed: {SESSION_DURATIONS_MINUTES.join(', ')} min</p>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <p className="font-semibold text-slate-900">Cancellation window and evidence rules</p>
        <p className="mt-1">Cancellation window: {config.cancellationWindowHours} hours before a session.</p>
        <p className="mt-1">
          Session summary {config.evidenceRules.requireSessionSummary ? 'required' : 'optional'} · accepted
          deliverable {config.evidenceRules.requireAcceptedDeliverable ? 'required' : 'optional'} · completion
          acknowledgement {config.evidenceRules.requireCompletionAcknowledgement ? 'required' : 'optional'}.
        </p>
        <p className="mt-1">
          Maximum evidence size: {(config.evidenceRules.maxEvidenceBytes / (1024 * 1024)).toFixed(1)} MB.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!canManage || saving || validationErrors.length > 0}
          aria-busy={saving}
          onClick={() => void persist()}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? 'Saving configuration...' : 'Save configuration'}
        </button>
        <button
          type="button"
          disabled={!canManage}
          onClick={() => setConfig({ ...SAFE_DEFAULT_MENTORSHIP_CONFIG, environment })}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Reset to safe defaults
        </button>
      </div>
    </section>
  );
}
