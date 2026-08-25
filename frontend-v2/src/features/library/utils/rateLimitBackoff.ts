export interface RateLimitInfo {
  status: number;
  retryAfterSeconds: number | null;
}

/** Reads server retry guidance from a 429 response instead of guessing a delay. */
export function parseRateLimit(response: Response): RateLimitInfo | null {
  if (response.status !== 429) return null;
  const header = response.headers.get("Retry-After");
  const retryAfterSeconds = header ? Number(header) : null;
  return {
    status: response.status,
    retryAfterSeconds: Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : null,
  };
}

/** Distinguishes temporary throttling from an authorization failure for UI messaging. */
export function isThrottled(info: RateLimitInfo | null): info is RateLimitInfo {
  return info !== null && info.status === 429;
}

/**
 * Computes a bounded backoff delay (ms) from server guidance, falling back to a
 * small default rather than retrying aggressively when no guidance is given.
 */
export function nextBackoffDelayMs(info: RateLimitInfo, attempt: number): number {
  if (info.retryAfterSeconds !== null) return info.retryAfterSeconds * 1000;
  const base = 1000 * 2 ** Math.min(attempt, 4);
  return Math.min(base, 30_000);
}
