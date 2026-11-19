/**
 * Public discovery protection (CAPSTONE-032).
 *
 * Building blocks for protecting public discovery pages from scraping without
 * harming normal browsing: a sliding-window rate limiter, enumeration-resistant
 * lookups (hidden and missing items look identical), safe public projections,
 * a cache policy per response kind, and simple bot signals. The clock is
 * injected so everything is deterministic in tests.
 */

export interface RateLimitConfig {
  /** Window length in milliseconds. */
  windowMs: number;
  /** Requests allowed per window per key. */
  max: number;
}

export interface RateDecision {
  allowed: boolean;
  remaining: number;
  /** Seconds until a request would be allowed; 0 when allowed. */
  retryAfterSeconds: number;
}

export class SlidingWindowLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(private readonly config: RateLimitConfig, private readonly now: () => number = Date.now) {
    if (config.windowMs <= 0 || config.max < 1) throw new RangeError("invalid rate limit configuration");
  }

  check(key: string): RateDecision {
    const t = this.now();
    const recent = (this.hits.get(key) ?? []).filter((x) => x > t - this.config.windowMs);
    if (recent.length >= this.config.max) {
      this.hits.set(key, recent);
      return { allowed: false, remaining: 0, retryAfterSeconds: Math.max(1, Math.ceil((recent[0] + this.config.windowMs - t) / 1000)) };
    }
    recent.push(t);
    this.hits.set(key, recent);
    return { allowed: true, remaining: this.config.max - recent.length, retryAfterSeconds: 0 };
  }

  /** Drop idle keys so the map cannot grow without bound. */
  prune(): number {
    const t = this.now();
    let removed = 0;
    for (const [key, list] of this.hits) {
      if (list.every((x) => x <= t - this.config.windowMs)) {
        this.hits.delete(key);
        removed += 1;
      }
    }
    return removed;
  }
}

export interface LookupResult<T> {
  status: 200 | 404;
  body: T | { error: "not_found" };
}

/**
 * Enumeration resistance: an item that does not exist, is hidden, or is not
 * visible to the viewer returns exactly the same response, so ids cannot be
 * probed to learn what exists.
 */
export function publicLookup<T>(item: T | undefined | null, isVisible: (item: T) => boolean): LookupResult<T> {
  if (item === undefined || item === null || !isVisible(item)) return { status: 404, body: { error: "not_found" } };
  return { status: 200, body: item };
}

/** Pick only allow-listed fields; anything else is dropped, including fields added later. */
export function publicProjection<T extends Record<string, unknown>, K extends keyof T>(item: T, allowed: readonly K[]): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const key of allowed) if (key in item) out[key] = item[key];
  return out;
}

export type ResponseKind = "public_list" | "public_detail" | "personalized" | "error";

export interface CachePolicy {
  cacheControl: string;
  vary: string[];
}

export function cachePolicy(kind: ResponseKind): CachePolicy {
  switch (kind) {
    case "public_list":
      return { cacheControl: "public, max-age=60, stale-while-revalidate=300", vary: ["Accept-Encoding"] };
    case "public_detail":
      return { cacheControl: "public, max-age=300, stale-while-revalidate=600", vary: ["Accept-Encoding"] };
    case "personalized":
      return { cacheControl: "private, no-store", vary: ["Authorization", "Cookie"] };
    case "error":
      return { cacheControl: "no-store", vary: [] };
  }
}

const KNOWN_BOTS = /(curl|wget|python-requests|scrapy|httpclient|libwww|go-http-client|headless|phantomjs)/i;

export interface RequestInfo {
  userAgent?: string;
  /** Milliseconds since this client's previous request. */
  sincePreviousMs?: number;
  /** Distinct resource ids this client requested in the current window. */
  distinctIdsInWindow: number;
  /** Fraction (0-1) of those requests that were for sequential ids. */
  sequentialFraction?: number;
}

export type BotVerdict = "ok" | "slow_down" | "challenge";

/** Gentle by default: only clear automation patterns are challenged. */
export function classifyRequest(r: RequestInfo): { verdict: BotVerdict; reasons: string[] } {
  const reasons: string[] = [];
  if (!r.userAgent || KNOWN_BOTS.test(r.userAgent)) reasons.push("automation-like user agent");
  if (r.sincePreviousMs !== undefined && r.sincePreviousMs < 50) reasons.push("requests faster than a person can browse");
  if (r.distinctIdsInWindow > 100) reasons.push("very many distinct items requested");
  if ((r.sequentialFraction ?? 0) > 0.8 && r.distinctIdsInWindow > 20) reasons.push("sequential id walk");
  const verdict: BotVerdict = reasons.length >= 2 ? "challenge" : reasons.length === 1 ? "slow_down" : "ok";
  return { verdict, reasons };
}
