import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ABUSE_POLICIES,
  consumeAttempt,
  createRateLimitState,
  describeDraftIntegrity,
  evaluateRateLimit,
  isDraftIntact,
  limitForSurface,
  recordAttempt,
  requestBypass,
  secondsUntilReset,
} from '../abuse/service';
import type { IdempotentDraft, RateLimitState } from '../abuse/types';

const WINDOW_START = new Date('2025-03-01T00:00:00.000Z');

function state(overrides: Partial<RateLimitState> = {}): RateLimitState {
  return {
    surface: 'application-submit',
    used: 0,
    limit: 3,
    windowSeconds: 60,
    resetAt: '2025-03-01T00:01:00.000Z',
    retryAfterSeconds: null,
    ...overrides,
  };
}

describe('limitForSurface', () => {
  it('returns the exact policy for a surface and tier', () => {
    const policy = limitForSurface(DEFAULT_ABUSE_POLICIES, 'application-submit', 'high');
    expect(policy?.limit).toBe(2);
    expect(policy?.burstAllowance).toBe(0);
  });

  it('falls back to the closest lower tier', () => {
    const policy = limitForSurface(DEFAULT_ABUSE_POLICIES, 'messaging', 'high');
    expect(policy?.riskTier).toBe('standard');
  });

  it('returns null when a surface has no policy at all', () => {
    expect(limitForSurface([], 'messaging', 'low')).toBeNull();
  });
});

describe('evaluateRateLimit', () => {
  it('allows a request while budget remains', () => {
    const decision = evaluateRateLimit(state({ used: 1 }), WINDOW_START);
    expect(decision.allowed).toBe(true);
    expect(decision.guidance).toContain('2 of 3');
    expect(decision.bypass.allowed).toBe(false);
  });

  it('denies once the limit is used up and states the retry guidance', () => {
    const decision = evaluateRateLimit(state({ used: 3 }), WINDOW_START);
    expect(decision.allowed).toBe(false);
    expect(decision.state.retryAfterSeconds).toBe(60);
    expect(decision.guidance).toContain('Retry after 60 second(s)');
    expect(decision.guidance).toContain('Retry-After: 60');
    expect(decision.guidance).toContain('draft is unchanged');
  });

  it('rolls the window over after it closes', () => {
    const decision = evaluateRateLimit(
      state({ used: 3, resetAt: '2025-02-28T23:59:00.000Z' }),
      WINDOW_START
    );
    expect(decision.allowed).toBe(true);
    expect(decision.state.used).toBe(0);
    expect(decision.state.retryAfterSeconds).toBeNull();
  });

  it('counts the seconds left in the window', () => {
    expect(secondsUntilReset(state(), new Date('2025-03-01T00:00:30.000Z'))).toBe(30);
    expect(secondsUntilReset(state(), new Date('2025-03-01T00:02:00.000Z'))).toBe(0);
  });
});

describe('recordAttempt', () => {
  it('increments the counter inside an open window', () => {
    expect(recordAttempt(state(), WINDOW_START).used).toBe(1);
  });

  it('resets instead of overflowing a closed window', () => {
    const next = recordAttempt(state({ used: 3, resetAt: '2025-02-01T00:00:00.000Z' }), WINDOW_START);
    expect(next.used).toBe(1);
  });

  it('drives a state to denial through consumeAttempt', () => {
    let current = createRateLimitState(
      { surface: 'messaging', riskTier: 'low', limit: 2, windowSeconds: 60, burstAllowance: 1 },
      WINDOW_START
    );
    const first = consumeAttempt({ state: current, now: WINDOW_START });
    expect(first.decision.allowed).toBe(true);
    current = first.state;
    const second = consumeAttempt({ state: current, now: WINDOW_START });
    expect(second.decision.allowed).toBe(false);
    expect(second.decision.state.retryAfterSeconds).toBe(60);
  });
});

describe('requestBypass', () => {
  const denied = evaluateRateLimit(state({ used: 3 }), WINDOW_START);

  it('denies a bypass when no service authorization is supplied', () => {
    const attempt = requestBypass(denied, '');
    expect(attempt.allowed).toBe(false);
    expect(attempt.bypass.allowed).toBe(false);
    expect(attempt.guidance).toContain('not granted');
  });

  it('denies a bypass for a blank or missing authorization', () => {
    expect(requestBypass(denied, '   ').bypass.allowed).toBe(false);
    expect(requestBypass(denied, null).bypass.allowed).toBe(false);
    expect(requestBypass(denied, undefined).bypass.allowed).toBe(false);
  });

  it('grants a bypass only with an explicit service authorization id', () => {
    const attempt = requestBypass(denied, 'svc-auth-42');
    expect(attempt.allowed).toBe(true);
    if (attempt.bypass.allowed) {
      expect(attempt.bypass.authorizationId).toBe('svc-auth-42');
    }
    expect(attempt.guidance).toContain('audit trail');
  });

  it('leaves an allowed request untouched', () => {
    const allowed = evaluateRateLimit(state(), WINDOW_START);
    expect(requestBypass(allowed, 'svc-auth-42')).toBe(allowed);
  });
});

describe('draft integrity', () => {
  const draft: IdempotentDraft = {
    draftId: 'draft-001',
    surface: 'application-submit',
    payload: { programId: 'chainverse-scholarship', statement: 'Full statement.' },
    lastSavedAt: '2025-03-01T00:00:00.000Z',
  };

  it('is intact when the payload still matches the last save', () => {
    expect(isDraftIntact(draft, { statement: 'Full statement.', programId: 'chainverse-scholarship' })).toBe(
      true
    );
  });

  it('is not intact when a throttled request truncated the payload', () => {
    expect(isDraftIntact(draft, { programId: 'chainverse-scholarship' })).toBe(false);
    expect(isDraftIntact(draft, { ...draft.payload, statement: 'Full state' })).toBe(false);
  });

  it('stays intact across a denied attempt', () => {
    const payload = { ...draft.payload };
    evaluateRateLimit(state({ used: 3 }), WINDOW_START);
    requestBypass(evaluateRateLimit(state({ used: 3 }), WINDOW_START), '');
    expect(isDraftIntact(draft, payload)).toBe(true);
  });

  it('describes both outcomes', () => {
    expect(describeDraftIntegrity(draft, draft.payload)).toContain('intact');
    expect(describeDraftIntegrity(draft, {})).toContain('truncated or altered');
  });
});
