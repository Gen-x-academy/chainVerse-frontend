/**
 * Research theme subscriptions (CAPSTONE-031).
 *
 * Users subscribe to a saved search or theme and get alerts about newly
 * matching opportunities, but only on channels they have consented to. Each
 * opportunity alerts at most once per subscription, a withdrawn consent stops
 * alerts immediately, and alert content contains no more than the public
 * summary of the opportunity.
 */

export type Channel = "email" | "push" | "in_app";

export interface Consent {
  channel: Channel;
  grantedAt: string;
  withdrawnAt?: string;
}

export interface SavedSearch {
  themes: string[];
  skills?: string[];
  modes?: string[];
  text?: string;
}

export interface Subscription {
  id: string;
  userId: string;
  search: SavedSearch;
  channels: Channel[];
  /** "instant" sends one alert per opportunity; "daily" batches them. */
  frequency: "instant" | "daily";
  createdAt: string;
  /** Opportunity ids already alerted for this subscription. */
  alerted: string[];
  active: boolean;
}

export interface AnnouncedOpportunity {
  id: string;
  title: string;
  themes: string[];
  skills: string[];
  mode: string;
  /** Public summary only; never private proposal or participant data. */
  summary: string;
  publishedAt: string;
  visible: boolean;
}

export interface Alert {
  subscriptionId: string;
  userId: string;
  channel: Channel;
  opportunityIds: string[];
  items: Array<{ id: string; title: string; summary: string }>;
}

export const MAX_SUBSCRIPTIONS_PER_USER = 20;
export const MAX_ITEMS_PER_ALERT = 10;

const norm = (s: string) => s.normalize("NFKC").trim().toLowerCase();

export type SubscribeError = "LIMIT_REACHED" | "EMPTY_SEARCH" | "NO_CONSENT" | "NO_CHANNELS" | "DUPLICATE";

export function subscribe(
  existing: readonly Subscription[],
  input: { id: string; userId: string; search: SavedSearch; channels: Channel[]; frequency: Subscription["frequency"] },
  consents: readonly Consent[],
  now: Date,
): { ok: true; subscriptions: Subscription[] } | { ok: false; error: SubscribeError } {
  const mine = existing.filter((s) => s.userId === input.userId && s.active);
  if (mine.length >= MAX_SUBSCRIPTIONS_PER_USER) return { ok: false, error: "LIMIT_REACHED" };
  const { themes, skills = [], modes = [], text = "" } = input.search;
  if (themes.length === 0 && skills.length === 0 && modes.length === 0 && !text.trim()) return { ok: false, error: "EMPTY_SEARCH" };
  if (input.channels.length === 0) return { ok: false, error: "NO_CHANNELS" };
  if (input.channels.some((c) => !hasConsent(consents, c))) return { ok: false, error: "NO_CONSENT" };
  const key = JSON.stringify([norm(themes.join(",")), norm(skills.join(",")), norm(modes.join(",")), norm(text)]);
  if (mine.some((s) => JSON.stringify([norm(s.search.themes.join(",")), norm((s.search.skills ?? []).join(",")), norm((s.search.modes ?? []).join(",")), norm(s.search.text ?? "")]) === key)) return { ok: false, error: "DUPLICATE" };

  const sub: Subscription = { ...input, createdAt: now.toISOString(), alerted: [], active: true };
  return { ok: true, subscriptions: [...existing, sub] };
}

/** True when the channel has a grant that has not been withdrawn. */
export function hasConsent(consents: readonly Consent[], channel: Channel): boolean {
  const latest = consents.filter((c) => c.channel === channel).sort((a, b) => a.grantedAt.localeCompare(b.grantedAt)).pop();
  return latest !== undefined && latest.withdrawnAt === undefined;
}

export function matches(search: SavedSearch, o: AnnouncedOpportunity): boolean {
  if (search.themes.length && !search.themes.some((t) => o.themes.map(norm).includes(norm(t)))) return false;
  if (search.skills?.length && !search.skills.every((s) => o.skills.map(norm).includes(norm(s)))) return false;
  if (search.modes?.length && !search.modes.map(norm).includes(norm(o.mode))) return false;
  if (search.text?.trim()) {
    const hay = norm(`${o.title} ${o.summary}`);
    if (!norm(search.text).split(" ").every((t) => hay.includes(t))) return false;
  }
  return true;
}

/**
 * Build the alerts for a set of newly published opportunities. Opportunities
 * published before the subscription existed, already alerted ones, hidden ones
 * and channels without current consent are skipped. The returned subscriptions
 * record what was alerted, so running this again never repeats an alert.
 */
export function buildAlerts(
  subscriptions: readonly Subscription[],
  opportunities: readonly AnnouncedOpportunity[],
  consentsByUser: ReadonlyMap<string, readonly Consent[]>,
): { alerts: Alert[]; subscriptions: Subscription[] } {
  const alerts: Alert[] = [];
  const updated = subscriptions.map((sub) => {
    if (!sub.active) return sub;
    const fresh = opportunities
      .filter((o) => o.visible && o.publishedAt >= sub.createdAt && !sub.alerted.includes(o.id) && matches(sub.search, o))
      .sort((a, b) => a.publishedAt.localeCompare(b.publishedAt) || a.id.localeCompare(b.id));
    if (fresh.length === 0) return sub;

    const consents = consentsByUser.get(sub.userId) ?? [];
    const channels = sub.channels.filter((c) => hasConsent(consents, c));
    if (channels.length === 0) return sub; // nothing sent, nothing marked as alerted

    const groups = sub.frequency === "instant" ? fresh.map((o) => [o]) : [fresh];
    for (const group of groups) {
      for (let i = 0; i < group.length; i += MAX_ITEMS_PER_ALERT) {
        const chunk = group.slice(i, i + MAX_ITEMS_PER_ALERT);
        for (const channel of channels) {
          alerts.push({ subscriptionId: sub.id, userId: sub.userId, channel, opportunityIds: chunk.map((o) => o.id), items: chunk.map((o) => ({ id: o.id, title: o.title, summary: o.summary })) });
        }
      }
    }
    return { ...sub, alerted: [...sub.alerted, ...fresh.map((o) => o.id)] };
  });
  return { alerts, subscriptions: updated };
}

export function unsubscribe(subscriptions: readonly Subscription[], id: string, userId: string): Subscription[] | null {
  const target = subscriptions.find((s) => s.id === id && s.userId === userId);
  if (!target) return null;
  return subscriptions.map((s) => (s.id === id ? { ...s, active: false } : s));
}
