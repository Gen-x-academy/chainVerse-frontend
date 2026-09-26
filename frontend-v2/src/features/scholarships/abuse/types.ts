/**
 * Rate and abuse controls for scholarship surfaces (closes #1150).
 *
 * Limits are expressed per surface and per risk tier so a standard applicant is
 * not throttled alongside a scripted one. Two properties matter more than the
 * arithmetic:
 *
 * 1. A limited request is **rejected**, never partially applied. The client must
 *    not truncate a payload to fit a window, and `isDraftIntact` exists so that
 *    a saved draft can be proven untouched after a denial.
 * 2. A bypass requires an explicit service authorization id. There is no
 *    "retry harder" path that disables a limit.
 */

export type AbuseSurface =
  | 'public-discovery'
  | 'application-submit'
  | 'document-upload'
  | 'invitation'
  | 'messaging'
  | 'payout-action';

export type RiskTier = 'low' | 'standard' | 'elevated' | 'high';

export type RateLimitPolicy = {
  surface: AbuseSurface;
  riskTier: RiskTier;
  limit: number;
  windowSeconds: number;
  burstAllowance: number;
};

export type RateLimitState = {
  surface: AbuseSurface;
  used: number;
  limit: number;
  windowSeconds: number;
  resetAt: string;
  retryAfterSeconds: number | null;
};

export type RateLimitDecision = {
  allowed: boolean;
  state: RateLimitState;
  guidance: string;
  bypass:
    | { allowed: false; reason: string }
    | { allowed: true; authorizationId: string };
};

export type IdempotentDraft = {
  draftId: string;
  surface: AbuseSurface;
  payload: Record<string, unknown>;
  lastSavedAt: string;
};
