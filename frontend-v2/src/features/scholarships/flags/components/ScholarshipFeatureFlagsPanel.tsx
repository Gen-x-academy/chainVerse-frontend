'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import {
  ROLLOUT_ENVIRONMENTS,
  describeCohort,
  evaluateFlag,
  isSafeFallback,
  recordExposureFromEvaluation,
  rolloutPercentageOf,
  scholarshipFlagService,
  SCHOLARSHIP_FLAG_KEYS,
} from '../service';
import type {
  FlagDefinition,
  RolloutEnvironment,
  ScholarshipFlagKey,
} from '../types';

type ScholarshipFeatureFlagsPanelProps = {
  canManage?: boolean;
  cohortSeed?: string;
  onExpose?: (exposedAt: string) => void;
};

type FlagDrafts = Record<ScholarshipFlagKey, FlagDefinition>;

const INPUT_CLASS =
  'mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-200';
const SELECT_CLASS =
  'mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-200';

function toDrafts(flags: FlagDefinition[]): FlagDrafts {
  const drafts = {} as FlagDrafts;
  for (const flag of flags) {
    drafts[flag.key] = flag;
  }
  return drafts;
}

export function ScholarshipFeatureFlagsPanel({
  canManage = true,
  cohortSeed = 'chainverse-scholarships',
  onExpose,
}: ScholarshipFeatureFlagsPanelProps) {
  const baseId = useId();
  const environmentId = `${baseId}-environment`;
  const userIdInputId = `${baseId}-user-id`;
  const seedId = `${baseId}-cohort-seed`;

  const [flags, setFlags] = useState<FlagDefinition[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [environment, setEnvironment] = useState<RolloutEnvironment>('staging');
  const [userId, setUserId] = useState('');
  const [drafts, setDrafts] = useState<FlagDrafts>({} as FlagDrafts);
  const [percentError, setPercentError] = useState<Partial<Record<ScholarshipFlagKey, string>>>({});
  const [savingKey, setSavingKey] = useState<ScholarshipFlagKey | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [exposed, setExposed] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const remote = await scholarshipFlagService.list();
      setFlags(remote);
      setDrafts(toDrafts(remote));
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : 'Unable to load feature flags.';
      setError(message);
      setFlags(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const context = useMemo(
    () => ({
      environment,
      userId: userId.trim() || undefined,
      cohortSeed,
    }),
    [environment, userId, cohortSeed]
  );

  const evaluations = useMemo(() => {
    if (!flags) return [];
    const resolvedAt = new Date();
    return flags.map((flag) => {
      const source = drafts[flag.key] ?? flag;
      return evaluateFlag(source, context, resolvedAt);
    });
  }, [flags, drafts, context]);

  if (loading) {
    return (
      <div
        className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm"
        role="status"
        aria-live="polite"
      >
        Loading feature flag definitions and rollout cohorts...
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700"
        role="alert"
      >
        <p className="font-semibold">Feature flags could not be loaded.</p>
        <p className="mt-2">{error}</p>
        <p className="mt-2">Every surface stays disabled until the flag service responds.</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-3 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-200"
        >
          Retry loading flags
        </button>
      </div>
    );
  }

  if (!flags || flags.length === 0) {
    return (
      <div
        className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600"
        role="status"
        aria-live="polite"
      >
        <p className="font-semibold text-slate-900">No feature flags are defined yet.</p>
        <p className="mt-2">
          Create a definition for {SCHOLARSHIP_FLAG_KEYS.join(', ')} to start a staged rollout.
        </p>
      </div>
    );
  }

  const setEnvironmentToggle = (
    key: ScholarshipFlagKey,
    next: RolloutEnvironment,
    enabled: boolean
  ) => {
    setDrafts((current) => ({
      ...current,
      [key]: {
        ...current[key],
        environments: { ...current[key].environments, [next]: enabled },
      },
    }));
  };

  const setPercent = (key: ScholarshipFlagKey, raw: string) => {
    const value = Number(raw);
    if (raw.trim() === '' || !Number.isFinite(value) || value < 0 || value > 100) {
      setPercentError((current) => ({
        ...current,
        [key]: 'Enter a whole number between 0 and 100.',
      }));
      return;
    }
    setPercentError((current) => ({ ...current, [key]: undefined }));
    setDrafts((current) => ({
      ...current,
      [key]: {
        ...current[key],
        cohort: { kind: 'percentage', percent: value },
      },
    }));
  };

  const persist = async (key: ScholarshipFlagKey) => {
    setSavingKey(key);
    setSaveError(null);
    try {
      const saved = await scholarshipFlagService.upsert(drafts[key]);
      setFlags((current) =>
        (current ?? []).map((flag) => (flag.key === key ? saved : flag))
      );
      setStatus(`Saved rollout for ${key}.`);
    } catch (persistError) {
      setSaveError(
        persistError instanceof Error ? persistError.message : 'Unable to save the rollout.'
      );
    } finally {
      setSavingKey(null);
    }
  };

  const expose = (key: ScholarshipFlagKey, enabled: boolean) => {
    const evaluation = evaluations.find((item) => item.key === key);
    if (!evaluation) return;
    const record = recordExposureFromEvaluation(evaluation, userId.trim() || 'anonymous', 'flags-panel');
    setExposed((current) => [record.surface, ...current].slice(0, 5));
    setStatus(
      `Recorded exposure for ${key} (${record.enabled ? 'enabled' : 'disabled'}).${
        isSafeFallback(evaluation) ? ' Failing closed because the flag service is unavailable.' : ''
      }`
    );
    onExpose?.(record.exposedAt);
  };

  return (
    <section
      className="mx-auto max-w-5xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      aria-labelledby={`${baseId}-heading`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
            Staged rollout
          </p>
          <h2 id={`${baseId}-heading`} className="mt-2 text-3xl font-black text-slate-900">
            Scholarship feature flags
          </h2>
        </div>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
          {flags.length} flag(s)
        </span>
      </div>

      {!canManage && (
        <div
          className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
          role="note"
        >
          <p className="font-semibold">You do not have permission to change rollouts.</p>
          <p className="mt-1">
            Read-only view: ask an administrator or the finance operations team to change an
            environment toggle or a cohort.
          </p>
        </div>
      )}

      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <p className="font-semibold text-slate-900">Fail-closed policy</p>
        <p className="mt-1">
          If the flag service cannot be reached, every surface is treated as disabled. A missing
          configuration never switches a feature on.
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div>
          <label htmlFor={environmentId} className="block text-sm font-medium text-slate-700">
            Resolve environment
          </label>
          <select
            id={environmentId}
            value={environment}
            onChange={(event) => setEnvironment(event.target.value as RolloutEnvironment)}
            className={SELECT_CLASS}
          >
            {ROLLOUT_ENVIRONMENTS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={userIdInputId} className="block text-sm font-medium text-slate-700">
            Evaluate for user id
          </label>
          <input
            id={userIdInputId}
            type="text"
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            placeholder="user-123"
            className={INPUT_CLASS}
          />
          <p className="mt-1 text-xs text-slate-500">
            A percentage rollout needs a user id; anonymous users get the owner default.
          </p>
        </div>

        <div>
          <label htmlFor={seedId} className="block text-sm font-medium text-slate-700">
            Cohort seed
          </label>
          <input
            id={seedId}
            type="text"
            value={cohortSeed}
            readOnly
            className={`${INPUT_CLASS} bg-slate-100`}
          />
          <p className="mt-1 text-xs text-slate-500">
            Changing the seed reshuffles cohorts deterministically.
          </p>
        </div>
      </div>

      {status && (
        <div
          className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
          role="status"
          aria-live="polite"
        >
          {status}
        </div>
      )}

      {saveError && (
        <div
          className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          role="alert"
          id={`${baseId}-save-error`}
        >
          <p className="font-semibold">The rollout could not be saved.</p>
          <p className="mt-1">{saveError}</p>
          <p className="mt-1">Fix the highlighted value and try saving again.</p>
        </div>
      )}

      <ul className="mt-6 space-y-4">
        {flags.map((flag) => {
          const draft = drafts[flag.key] ?? flag;
          const evaluation = evaluations.find((item) => item.key === flag.key);
          const percentInputId = `${baseId}-${flag.key}-percent`;
          const percentMessageId = `${baseId}-${flag.key}-percent-error`;
          const percentErrorMessage = percentError[flag.key];
          const percent = rolloutPercentageOf(draft);
          const isSaving = savingKey === flag.key;

          return (
            <li key={flag.key} className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{flag.key}</h3>
                  <p className="mt-1 text-sm text-slate-600">{flag.description}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Owner {flag.owner} &middot; v{flag.version} &middot; updated {flag.updatedAt}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                    evaluation?.enabled
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {evaluation?.enabled ? 'Enabled' : 'Disabled'} in {environment}
                </span>
              </div>

              <fieldset className="mt-4">
                <legend className="text-sm font-semibold text-slate-800">
                  Environment toggles for {flag.key}
                </legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {ROLLOUT_ENVIRONMENTS.map((item) => {
                    const toggleId = `${baseId}-${flag.key}-${item}`;
                    return (
                      <div key={item} className="flex items-center gap-2">
                        <input
                          id={toggleId}
                          type="checkbox"
                          checked={draft.environments[item]}
                          disabled={!canManage}
                          aria-describedby={!canManage ? `${baseId}-readonly-${flag.key}` : undefined}
                          onChange={(event) =>
                            setEnvironmentToggle(flag.key, item, event.target.checked)
                          }
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                        />
                        <label htmlFor={toggleId} className="text-sm text-slate-700">
                          {item}
                        </label>
                      </div>
                    );
                  })}
                </div>
                {!canManage && (
                  <p id={`${baseId}-readonly-${flag.key}`} className="mt-2 text-xs text-amber-800">
                    Environment toggles are read-only for your role.
                  </p>
                )}
              </fieldset>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Rollout cohort
                  </p>
                  <p className="mt-1 text-sm text-slate-700">{describeCohort(draft.cohort)}</p>
                  {draft.cohort.kind === 'allowlist' && (
                    <p className="mt-1 text-xs text-slate-500">
                      Allowlisted: {draft.cohort.userIds.join(', ') || 'no user ids yet'}
                    </p>
                  )}
                  {draft.cohort.kind === 'percentage' && (
                    <div className="mt-2">
                      <label
                        htmlFor={percentInputId}
                        className="block text-sm font-medium text-slate-700"
                      >
                        Percentage of cohort
                      </label>
                      <input
                        id={percentInputId}
                        type="number"
                        min={0}
                        max={100}
                        value={percent ?? 0}
                        disabled={!canManage}
                        aria-invalid={percentErrorMessage ? true : undefined}
                        aria-describedby={
                          percentErrorMessage ? percentMessageId : undefined
                        }
                        onChange={(event) => setPercent(flag.key, event.target.value)}
                        className={INPUT_CLASS}
                      />
                      {percentErrorMessage && (
                        <p
                          id={percentMessageId}
                          className="mt-1 text-sm text-red-700"
                          role="alert"
                        >
                          {percentErrorMessage}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Resolved state
                  </p>
                  <p className="mt-1 text-sm text-slate-700">{evaluation?.reason}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Source: {evaluation?.source === 'remote' ? 'remote definition' : 'client default'}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={!canManage || Boolean(percentErrorMessage) || isSaving}
                  aria-busy={isSaving}
                  onClick={() => void persist(flag.key)}
                  aria-describedby={
                    !canManage ? `${baseId}-readonly-${flag.key}` : undefined
                  }
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? 'Saving rollout...' : `Save ${flag.key} rollout`}
                </button>
                <button
                  type="button"
                  onClick={() => expose(flag.key, evaluation?.enabled ?? false)}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-200"
                >
                  Record exposure for {flag.key}
                </button>
                {exposed.length > 0 && (
                  <span className="text-xs text-slate-500">
                    {exposed.length} exposure(s) recorded this session.
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
