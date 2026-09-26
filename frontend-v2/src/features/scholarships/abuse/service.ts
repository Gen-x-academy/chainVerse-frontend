/**
 * Rate limiting, bypass authorisation, and draft integrity (closes #1150).
 *
 * Everything here is pure. The clock is always passed in so a window rollover
 * can be asserted exactly rather than slept through, and no decision path calls
 * `Math.random` or touches global state.
 */

import { apiClient } from '@/src/lib/api-client';
import type {
  AbuseSurface,
  IdempotentDraft,
  RateLimitDecision,
  RateLimitPolicy,
  RateLimitState,
  RiskTier,
} from './types';

export const ABUSE_SURFACES: AbuseSurface[] = [
  'public-discovery',
  'application-submit',
  'document-upload',
  'invitation',
  'messaging',
  'payout-action',
];

export const RISK_TIERS: RiskTier[] = ['low', 'standard', 'elevated', 'high'];

export const DEFAULT_ABUSE_POLICIES: RateLimitPolicy[] = [
  { surface: 'public-discovery', riskTier: 'low', limit: 120, windowSeconds: 3600, burstAllowance: 20 },
  { surface: 'public-discovery', riskTier: 'high', limit: 30, windowSeconds: 3600, burstAllowance: 5 },
  { surface: 'application-submit', riskTier: 'low', limit: 20, windowSeconds: 3600, burstAllowance: 3 },
  { surface: 'application-submit', riskTier: 'standard', limit: 10, windowSeconds: 3600, burstAllowance: 2 },
  { surface: 'application-submit', riskTier: 'elevated', limit: 5, windowSeconds: 3600, burstAllowance: 1 },
  { surface: 'application-submit', riskTier: 'high', limit: 2, windowSeconds: 3600, burstAllowance: 0 },
  { surface: 'document-upload', riskTier: 'standard', limit: 30, windowSeconds: 3600, burstAllowance: 5 },
  { surface: 'document-upload', riskTier: 'high', limit: 6, windowSeconds: 3600, burstAllowance: 1 },
  { surface: 'invitation', riskTier: 'standard', limit: 25, windowSeconds: 86400, burstAllowance: 5 },
  { surface: 'messaging', riskTier: 'standard', limit: 40, windowSeconds: 3600, burstAllowance: 10 },
  { surface: 'payout-action', riskTier: 'standard', limit: 12, windowSeconds: 3600, burstAllowance: 3 },
  { surface: 'payout-action', riskTier: 'high', limit: 3, windowSeconds: 3600, burstAllowance: 0 },
];

/** The most restrictive tier at or below `riskTier`, used when a tier has no explicit policy. */
const TIER_ORDER: RiskTier[] = ['low', 'standard', 'elevated', 'high'];

export function limitForSurface(
  policies: RateLimitPolicy[],
  surface: AbuseSurface,
  riskTier: RiskTier
): RateLimitPolicy | null {
  const exact = policies.find(
    (policy) => policy.surface === surface && policy.riskTier === riskTier
  );
  if (exact) return exact;

  const requestedIndex = TIER_ORDER.indexOf(riskTier);
  const candidates = policies
    .filter((policy) => policy.surface === surface)
    .filter((policy) => TIER_ORDER.indexOf(policy.riskTier) <= requestedIndex)
    .sort((left, right) => TIER_ORDER.indexOf(right.riskTier) - TIER_ORDER.indexOf(left.riskTier));

  return candidates[0] ?? null;
}

export function createRateLimitState(
  policy: RateLimitPolicy,
  now: Date,
  used = 0
): RateLimitState {
  return {
    surface: policy.surface,
    used,
    limit: policy.limit,
    windowSeconds: policy.windowSeconds,
    resetAt: new Date(now.getTime() + policy.windowSeconds * 1000).toISOString(),
    retryAfterSeconds: null,
  };
}

function rollover(state: RateLimitState, now: Date): RateLimitState {
  return {
    ...state,
    used: 0,
    resetAt: new Date(now.getTime() + state.windowSeconds * 1000).toISOString(),
    retryAfterSeconds: null,
  };
}

export function secondsUntilReset(state: RateLimitState, now: Date): number {
  const resetAt = Date.parse(state.resetAt);
  if (!Number.isFinite(resetAt)) return 0;
  return Math.max(0, Math.ceil((resetAt - now.getTime()) / 1000));
}

const NO_BYPASS_NEEDED = {
  allowed: false as const,
  reason: 'No bypass is required — the request is inside the limit.',
};

const BYPASS_REQUIRES_AUTHORIZATION = {
  allowed: false as const,
  reason:
    'Bypass denied. A rate limit can only be lifted with an explicit service authorization id.',
};

/**
 * Decides one request. A closed window is rolled over first, so a caller that
 * returns after the window always gets its budget back rather than a stale
 * denial.
 */
export function evaluateRateLimit(state: RateLimitState, now: Date): RateLimitDecision {
  const current = now.getTime() >= Date.parse(state.resetAt) ? rollover(state, now) : state;
  const remaining = Math.max(0, current.limit - current.used);

  if (remaining > 0) {
    return {
      allowed: true,
      state: { ...current, retryAfterSeconds: null },
      guidance: `Allowed: ${remaining} of ${current.limit} request(s) remain in the ${current.windowSeconds}s window for ${current.surface}.`,
      bypass: NO_BYPASS_NEEDED,
    };
  }

  const retryAfterSeconds = secondsUntilReset(current, now);
  return {
    allowed: false,
    state: { ...current, retryAfterSeconds },
    guidance: `Denied: the ${current.limit} request limit for ${current.surface} is used up. Retry after ${retryAfterSeconds} second(s) (Retry-After: ${retryAfterSeconds}). The request was not applied and any saved draft is unchanged.`,
    bypass: BYPASS_REQUIRES_AUTHORIZATION,
  };
}

/** Counts one attempt against the current window without deciding anything. */
export function recordAttempt(state: RateLimitState, now: Date): RateLimitState {
  const current = now.getTime() >= Date.parse(state.resetAt) ? rollover(state, now) : state;
  return { ...current, used: current.used + 1 };
}

/** Records an attempt and returns both the new state and the resulting decision. */
export function consumeAttempt(input: {
  state: RateLimitState;
  now: Date;
}): { state: RateLimitState; decision: RateLimitDecision } {
  const next = recordAttempt(input.state, input.now);
  return { state: next, decision: evaluateRateLimit(next, input.now) };
}

/**
 * Lifts a limit only when a service authorization id is supplied and the
 * decision was actually a denial. An allowed request is returned unchanged.
 */
export function requestBypass(
  decision: RateLimitDecision,
  serviceAuthorizationId: string | null | undefined
): RateLimitDecision {
  if (decision.allowed) return decision;

  const authorizationId = serviceAuthorizationId?.trim() ?? '';
  if (!authorizationId) {
    return {
      ...decision,
      guidance: `${decision.guidance} Bypass was not granted: no service authorization id was supplied.`,
      bypass: BYPASS_REQUIRES_AUTHORIZATION,
    };
  }

  return {
    allowed: true,
    state: { ...decision.state, retryAfterSeconds: null },
    guidance: `Bypassed under service authorization ${authorizationId}. The limit remains in place for every other caller and the bypass is recorded in the audit trail.`,
    bypass: { allowed: true, authorizationId },
  };
}

function canonical(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (typeof value === 'object') {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => `${key}:${canonical((value as Record<string, unknown>)[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/**
 * True when the submitted payload is byte-for-byte the payload the draft was
 * saved with. A throttled request must never leave a draft short.
 */
export function isDraftIntact(
  draft: IdempotentDraft,
  payload: Record<string, unknown>
): boolean {
  return canonical(draft.payload) === canonical(payload);
}

export function describeDraftIntegrity(
  draft: IdempotentDraft,
  payload: Record<string, unknown>
): string {
  return isDraftIntact(draft, payload)
    ? `Draft ${draft.draftId} is intact — all ${Object.keys(draft.payload).length} field(s) match the last save at ${draft.lastSavedAt}.`
    : `Draft ${draft.draftId} was truncated or altered. Reload the last save from ${draft.lastSavedAt} before resubmitting.`;
}

const ABUSE_PATH = '/scholarships/abuse';

export const scholarshipAbuseService = {
  listPolicies: (): Promise<RateLimitPolicy[]> =>
    apiClient.get<RateLimitPolicy[]>(`${ABUSE_PATH}/policies`),

  getState: (surface: AbuseSurface, subjectId: string): Promise<RateLimitState> =>
    apiClient.get<RateLimitState>(
      `${ABUSE_PATH}/state/${encodeURIComponent(surface)}?subjectId=${encodeURIComponent(subjectId)}`
    ),

  recordAttempt: (state: RateLimitState): Promise<RateLimitState> =>
    apiClient.post<RateLimitState>(`${ABUSE_PATH}/attempts`, state),

  requestBypass: (input: {
    surface: AbuseSurface;
    serviceAuthorizationId: string;
    justification: string;
  }): Promise<{ authorizationId: string }> =>
    apiClient.post<{ authorizationId: string }>(`${ABUSE_PATH}/bypass`, input),
};
