/** MENTOR-029: discovery abuse and scraping controls (sliding-window limits and enumeration detection). */
export interface RateRule {
  limit: number;
  windowMs: number;
}

export const DISCOVERY_RULES = {
  search: { limit: 30, windowMs: 60_000 } as RateRule,
  profileView: { limit: 60, windowMs: 60_000 } as RateRule,
  /** Distinct profiles viewed in the window beyond which a client looks like a scraper. */
  distinctProfiles: { limit: 40, windowMs: 300_000 } as RateRule,
};

export interface ClientActivity {
  searches: number[];
  profileViews: { at: number; profileId: string }[];
}

export interface AbuseDecision {
  allowed: boolean;
  retryAfterMs?: number;
  reason?: 'search_rate' | 'profile_rate' | 'enumeration';
}

const within = (t: number, now: number, rule: RateRule) => now - t < rule.windowMs;

function retryAfter(times: number[], now: number, rule: RateRule): number {
  const oldest = Math.min(...times.filter((t) => within(t, now, rule)));
  return Math.max(0, oldest + rule.windowMs - now);
}

export function evaluateSearch(a: ClientActivity, now: number): AbuseDecision {
  const recent = a.searches.filter((t) => within(t, now, DISCOVERY_RULES.search));
  if (recent.length >= DISCOVERY_RULES.search.limit) {
    return { allowed: false, reason: 'search_rate', retryAfterMs: retryAfter(recent, now, DISCOVERY_RULES.search) };
  }
  return { allowed: true };
}

export function evaluateProfileView(a: ClientActivity, profileId: string, now: number): AbuseDecision {
  const recent = a.profileViews.filter((v) => within(v.at, now, DISCOVERY_RULES.profileView));
  if (recent.length >= DISCOVERY_RULES.profileView.limit) {
    return { allowed: false, reason: 'profile_rate', retryAfterMs: retryAfter(recent.map((v) => v.at), now, DISCOVERY_RULES.profileView) };
  }
  const windowed = a.profileViews.filter((v) => within(v.at, now, DISCOVERY_RULES.distinctProfiles));
  const distinct = new Set(windowed.map((v) => v.profileId));
  distinct.add(profileId);
  if (distinct.size > DISCOVERY_RULES.distinctProfiles.limit) {
    return { allowed: false, reason: 'enumeration', retryAfterMs: retryAfter(windowed.map((v) => v.at), now, DISCOVERY_RULES.distinctProfiles) };
  }
  return { allowed: true };
}

/** Records an allowed action and prunes old entries so the activity record stays bounded. */
export function recordActivity(a: ClientActivity, kind: 'search' | 'profile', now: number, profileId = ''): ClientActivity {
  const keep = DISCOVERY_RULES.distinctProfiles.windowMs;
  return {
    searches: [...a.searches, ...(kind === 'search' ? [now] : [])].filter((t) => now - t < keep),
    profileViews: [...a.profileViews, ...(kind === 'profile' ? [{ at: now, profileId }] : [])].filter((v) => now - v.at < keep),
  };
}
