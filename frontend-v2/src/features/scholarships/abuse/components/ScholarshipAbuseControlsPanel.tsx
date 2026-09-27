'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import {
  ABUSE_SURFACES,
  DEFAULT_ABUSE_POLICIES,
  RISK_TIERS,
  consumeAttempt,
  createRateLimitState,
  describeDraftIntegrity,
  isDraftIntact,
  limitForSurface,
  requestBypass,
  scholarshipAbuseService,
} from '../service';
import type {
  AbuseSurface,
  IdempotentDraft,
  RateLimitDecision,
  RateLimitPolicy,
  RateLimitState,
  RiskTier,
} from '../types';

type ScholarshipAbuseControlsPanelProps = {
  canManage?: boolean;
  subjectId?: string;
  now?: Date;
};

const SELECT_CLASS =
  'mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-200';

const INPUT_CLASS =
  'mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-200';

const SEED_DRAFT: IdempotentDraft = {
  draftId: 'draft-001',
  surface: 'application-submit',
  payload: { programId: 'chainverse-scholarship', statement: 'First draft statement.' },
  lastSavedAt: '2025-03-01T10:00:00.000Z',
};

export function ScholarshipAbuseControlsPanel({
  canManage = true,
  subjectId = 'applicant-001',
  now,
}: ScholarshipAbuseControlsPanelProps) {
  const baseId = useId();
  const surfaceId = `${baseId}-surface`;
  const tierId = `${baseId}-tier`;
  const bypassId = `${baseId}-bypass`;
  const bypassErrorId = `${baseId}-bypass-error`;
  const noteId = `${baseId}-note`;

  const [policies, setPolicies] = useState<RateLimitPolicy[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [surface, setSurface] = useState<AbuseSurface>('application-submit');
  const [riskTier, setRiskTier] = useState<RiskTier>('standard');
  const [state, setState] = useState<RateLimitState | null>(null);
  const [decision, setDecision] = useState<RateLimitDecision | null>(null);
  const [serviceAuthorizationId, setServiceAuthorizationId] = useState('');
  const [bypassError, setBypassError] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState('');
  const [attempts, setAttempts] = useState(0);

  const reference = useMemo(() => now ?? new Date(), [now]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const remote = await scholarshipAbuseService.listPolicies();
      setPolicies(remote);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Unable to load rate limit policies.'
      );
      setPolicies(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activePolicies = policies ?? DEFAULT_ABUSE_POLICIES;
  const policy = limitForSurface(activePolicies, surface, riskTier);

  useEffect(() => {
    if (!policy) {
      setState(null);
      setDecision(null);
      return;
    }
    const next = createRateLimitState(policy, reference);
    setState(next);
    setDecision({
      allowed: true,
      state: next,
      guidance: `Window open: ${policy.limit} request(s) allowed for ${surface} at the ${riskTier} tier.`,
      bypass: { allowed: false, reason: 'No bypass is required — the request is inside the limit.' },
    });
  }, [policy, reference, surface, riskTier]);

  const pendingDraft: IdempotentDraft = useMemo(
    () => ({
      ...SEED_DRAFT,
      surface,
      payload: draftNote.trim()
        ? { ...SEED_DRAFT.payload, unsavedNote: draftNote.trim() }
        : { ...SEED_DRAFT.payload },
    }),
    [surface, draftNote]
  );

  /** True when the payload about to be sent is exactly what the last save holds. */
  const intact = isDraftIntact(SEED_DRAFT, pendingDraft.payload);

  if (loading) {
    return (
      <div
        className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm"
        role="status"
        aria-live="polite"
      >
        Loading rate limit policies for every scholarship surface...
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700"
        role="alert"
      >
        <p className="font-semibold">Rate limit policies could not be loaded.</p>
        <p className="mt-2">{error}</p>
        <p className="mt-2">
          Requests stay denied until a policy is known — the client never assumes a limit is
          unlimited.
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-3 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-200"
        >
          Retry loading policies
        </button>
      </div>
    );
  }

  if (activePolicies.length === 0) {
    return (
      <div
        className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600"
        role="status"
        aria-live="polite"
      >
        <p className="font-semibold text-slate-900">No rate limit policies are configured.</p>
        <p className="mt-2">
          Publish a policy for {ABUSE_SURFACES.join(', ')} before exposing the surfaces.
        </p>
      </div>
    );
  }

  if (!policy || !state || !decision) {
    return (
      <div
        className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600"
        role="status"
        aria-live="polite"
      >
        <p className="font-semibold text-slate-900">No policy for this surface and tier.</p>
        <p className="mt-2">
          Choose a different risk tier for {surface}, or ask an administrator to publish a policy.
        </p>
      </div>
    );
  }

  const used = state.used;
  const percent = Math.min(100, Math.round((used / Math.max(state.limit, 1)) * 100));

  const simulate = () => {
    const outcome = consumeAttempt({ state, now: reference });
    setState(outcome.state);
    setDecision(outcome.decision);
    setAttempts((current) => current + 1);
  };

  const resetWindow = () => {
    setState(createRateLimitState(policy, reference));
    setDecision(null);
    setAttempts(0);
  };

  const requestBypassWithAuthorization = () => {
    if (!serviceAuthorizationId.trim()) {
      setBypassError(
        'Enter the service authorization id. A bypass is never granted without one.'
      );
      setDecision({
        ...decision,
        allowed: false,
        guidance: `${decision.guidance} Bypass was not granted: no service authorization id was supplied.`,
        bypass: {
          allowed: false,
          reason:
            'Bypass denied. A rate limit can only be lifted with an explicit service authorization id.',
        },
      });
      return;
    }
    setBypassError(null);
    setDecision(requestBypass(decision, serviceAuthorizationId));
  };

  return (
    <section
      className="mx-auto max-w-5xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      aria-labelledby={`${baseId}-heading`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">
            Rate and abuse controls
          </p>
          <h2 id={`${baseId}-heading`} className="mt-2 text-3xl font-black text-slate-900">
            Abuse controls for {surface}
          </h2>
        </div>
        <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">
          {riskTier} tier
        </span>
      </div>

      {!canManage && (
        <div
          className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
          role="note"
        >
          <p className="font-semibold">You do not have permission to request a bypass.</p>
          <p className="mt-1">
            You can still read the meter and the guidance. A finance operator or administrator must
            raise the service authorization.
          </p>
        </div>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor={surfaceId} className="block text-sm font-medium text-slate-700">
            Surface
          </label>
          <select
            id={surfaceId}
            value={surface}
            onChange={(event) => setSurface(event.target.value as AbuseSurface)}
            className={SELECT_CLASS}
          >
            {ABUSE_SURFACES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={tierId} className="block text-sm font-medium text-slate-700">
            Risk tier
          </label>
          <select
            id={tierId}
            value={riskTier}
            onChange={(event) => setRiskTier(event.target.value as RiskTier)}
            className={SELECT_CLASS}
          >
            {RISK_TIERS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5">
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="text-lg font-semibold text-slate-900">Live limit meter</h3>
          <p className="text-sm font-semibold text-slate-900">
            {used} / {state.limit} used
          </p>
        </div>
        <div
          role="progressbar"
          aria-label={`${surface} request allowance`}
          aria-valuenow={used}
          aria-valuemin={0}
          aria-valuemax={state.limit}
          aria-valuetext={`${used} of ${state.limit} requests used in the ${state.windowSeconds} second window`}
          className="mt-3 h-3 w-full overflow-hidden rounded-full bg-slate-200"
        >
          <div
            className={`h-full rounded-full ${decision.allowed ? 'bg-emerald-600' : 'bg-red-600'}`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Window {state.windowSeconds}s &middot; resets at {state.resetAt} &middot; burst allowance{' '}
          {policy.burstAllowance} &middot; subject {subjectId}
        </p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
          <h3 className="text-lg font-semibold text-slate-900">Simulate a request</h3>
          <p className="mt-1 text-sm text-slate-600">
            Each press consumes one request from the window. A denied request is rejected whole — it
            is never partially applied.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={simulate}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              Simulate request
            </button>
            <button
              type="button"
              onClick={resetWindow}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              Reset window
            </button>
          </div>

          <div
            className={`mt-4 rounded-lg border p-3 text-sm ${
              decision.allowed
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}
            role="status"
            aria-live="polite"
          >
            <p className="font-semibold uppercase tracking-wide">
              {decision.allowed ? 'Allowed' : 'Denied'}
            </p>
            <p className="mt-2">{decision.guidance}</p>
            <p className="mt-2 text-xs">
              {attempts} request(s) simulated in this window.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
          <h3 className="text-lg font-semibold text-slate-900">Bypass</h3>
          <p className="mt-1 text-sm text-slate-600">
            A limit is only lifted with an explicit service authorization id. There is no retry that
            disables a limit.
          </p>
          <label htmlFor={bypassId} className="mt-4 block text-sm font-medium text-slate-700">
            Service authorization id
          </label>
          <input
            id={bypassId}
            type="text"
            value={serviceAuthorizationId}
            disabled={!canManage}
            aria-invalid={bypassError ? true : undefined}
            aria-describedby={bypassError ? bypassErrorId : undefined}
            onChange={(event) => setServiceAuthorizationId(event.target.value)}
            placeholder="svc-auth-0001"
            className={INPUT_CLASS}
          />
          {bypassError && (
            <p id={bypassErrorId} role="alert" className="mt-1 text-sm text-red-700">
              {bypassError}
            </p>
          )}
          <button
            type="button"
            disabled={!canManage}
            aria-busy={false}
            onClick={requestBypassWithAuthorization}
            className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Request bypass
          </button>
          {!canManage && (
            <p className="mt-2 text-sm text-amber-800">
              Requesting a bypass is disabled for your role — ask a finance operator.
            </p>
          )}
          <p className="mt-3 text-sm text-slate-700">
            {decision.bypass.allowed
              ? `Bypass granted under ${decision.bypass.authorizationId} and recorded.`
              : decision.bypass.reason}
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5">
        <h3 className="text-lg font-semibold text-slate-900">Draft integrity</h3>
        <p className="mt-1 text-sm text-slate-600">
          Draft {SEED_DRAFT.draftId} for {surface}, last saved at {SEED_DRAFT.lastSavedAt}.
        </p>
        <label htmlFor={noteId} className="mt-4 block text-sm font-medium text-slate-700">
          Unsaved local note (for comparison only)
        </label>
        <input
          id={noteId}
          type="text"
          value={draftNote}
          onChange={(event) => setDraftNote(event.target.value)}
          className={INPUT_CLASS}
        />
        <p
          className={`mt-3 rounded-lg border p-3 text-sm ${
            intact
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-amber-200 bg-amber-50 text-amber-800'
          }`}
          role="status"
          aria-live="polite"
        >
          <span className="font-semibold">{intact ? 'Draft intact' : 'Local edits pending'}.</span>{' '}
          {describeDraftIntegrity(SEED_DRAFT, pendingDraft.payload)} A throttled request never truncates or
          corrupts a saved draft.
        </p>
        {!intact && (
          <button
            type="button"
            onClick={() => setDraftNote('')}
            className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-200"
          >
            Discard local edits and reload the last save
          </button>
        )}
      </div>
    </section>
  );
}
