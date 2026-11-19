import { describe, expect, it } from "vitest";
import {
  MAX_ITEMS_PER_ALERT,
  MAX_SUBSCRIPTIONS_PER_USER,
  buildAlerts,
  hasConsent,
  subscribe,
  unsubscribe,
  type AnnouncedOpportunity,
  type Consent,
  type Subscription,
} from "./theme-subscriptions";

const NOW = new Date("2026-03-01T00:00:00Z");
const consent = (channel: Consent["channel"], withdrawnAt?: string): Consent => ({ channel, grantedAt: "2026-01-01T00:00:00Z", ...(withdrawnAt ? { withdrawnAt } : {}) });
const input = (over: Partial<Parameters<typeof subscribe>[1]> = {}) => ({ id: "s1", userId: "u1", search: { themes: ["climate"] }, channels: ["email" as const], frequency: "instant" as const, ...over });
const opp = (id: string, over: Partial<AnnouncedOpportunity> = {}): AnnouncedOpportunity => ({
  id,
  title: `Opportunity ${id}`,
  themes: ["climate"],
  skills: ["python"],
  mode: "remote",
  summary: `Public summary ${id}`,
  publishedAt: "2026-03-02T00:00:00Z",
  visible: true,
  ...over,
});
function sub(over: Partial<Parameters<typeof subscribe>[1]> = {}, consents = [consent("email")]): Subscription {
  const r = subscribe([], input(over), consents, NOW);
  if (!r.ok) throw new Error(r.error);
  return r.subscriptions[0];
}
const consentsFor = (c: Consent[]) => new Map([["u1", c]]);

describe("theme subscriptions", () => {
  it("requires consent for every chosen channel", () => {
    expect(subscribe([], input(), [], NOW)).toEqual({ ok: false, error: "NO_CONSENT" });
    expect(subscribe([], input({ channels: ["email", "push"] }), [consent("email")], NOW)).toEqual({ ok: false, error: "NO_CONSENT" });
    expect(subscribe([], input({ channels: [] }), [consent("email")], NOW)).toEqual({ ok: false, error: "NO_CHANNELS" });
    expect(hasConsent([consent("email", "2026-02-01T00:00:00Z")], "email")).toBe(false);
  });

  it("rejects empty searches, duplicates and too many subscriptions", () => {
    expect(subscribe([], input({ search: { themes: [] } }), [consent("email")], NOW)).toEqual({ ok: false, error: "EMPTY_SEARCH" });
    const first = sub();
    expect(subscribe([first], input({ id: "s2", search: { themes: [" Climate "] } }), [consent("email")], NOW)).toEqual({ ok: false, error: "DUPLICATE" });
    const many = Array.from({ length: MAX_SUBSCRIPTIONS_PER_USER }, (_, i) => ({ ...first, id: `x${i}`, search: { themes: [`t${i}`] } }));
    expect(subscribe(many, input({ id: "new", search: { themes: ["other"] } }), [consent("email")], NOW)).toEqual({ ok: false, error: "LIMIT_REACHED" });
  });

  it("alerts only for newly published, visible, matching opportunities", () => {
    const s = sub();
    const { alerts } = buildAlerts([s], [opp("a"), opp("old", { publishedAt: "2026-02-01T00:00:00Z" }), opp("hidden", { visible: false }), opp("other", { themes: ["law"] })], consentsFor([consent("email")]));
    expect(alerts.map((a) => a.opportunityIds)).toEqual([["a"]]);
    expect(alerts[0]).toMatchObject({ channel: "email", userId: "u1", subscriptionId: "s1" });
  });

  it("never alerts twice for the same opportunity", () => {
    const s = sub();
    const first = buildAlerts([s], [opp("a")], consentsFor([consent("email")]));
    expect(first.subscriptions[0].alerted).toEqual(["a"]);
    const second = buildAlerts(first.subscriptions, [opp("a"), opp("b")], consentsFor([consent("email")]));
    expect(second.alerts.map((a) => a.opportunityIds)).toEqual([["b"]]);
    expect(buildAlerts(second.subscriptions, [opp("a"), opp("b")], consentsFor([consent("email")])).alerts).toEqual([]);
  });

  it("stops immediately when consent is withdrawn and does not mark anything as alerted", () => {
    const s = sub();
    const r = buildAlerts([s], [opp("a")], consentsFor([consent("email", "2026-03-02T00:00:00Z")]));
    expect(r.alerts).toEqual([]);
    expect(r.subscriptions[0].alerted).toEqual([]);
  });

  it("only uses channels that are still consented to", () => {
    const s = sub({ channels: ["email", "push"] }, [consent("email"), consent("push")]);
    const r = buildAlerts([s], [opp("a")], consentsFor([consent("email"), consent("push", "2026-03-02T00:00:00Z")]));
    expect(r.alerts.map((a) => a.channel)).toEqual(["email"]);
  });

  it("batches daily subscriptions and chunks long lists", () => {
    const s = sub({ frequency: "daily" });
    const many = Array.from({ length: MAX_ITEMS_PER_ALERT + 2 }, (_, i) => opp(`o${String(i).padStart(2, "0")}`));
    const { alerts } = buildAlerts([s], many, consentsFor([consent("email")]));
    expect(alerts.map((a) => a.opportunityIds.length)).toEqual([MAX_ITEMS_PER_ALERT, 2]);
    const instant = buildAlerts([sub()], [opp("a"), opp("b")], consentsFor([consent("email")]));
    expect(instant.alerts).toHaveLength(2);
  });

  it("alert content is the public summary only", () => {
    const { alerts } = buildAlerts([sub()], [{ ...opp("a"), privateNotes: "secret" } as AnnouncedOpportunity], consentsFor([consent("email")]));
    expect(alerts[0].items).toEqual([{ id: "a", title: "Opportunity a", summary: "Public summary a" }]);
    expect(JSON.stringify(alerts)).not.toContain("secret");
  });

  it("lets only the owner unsubscribe, and inactive subscriptions get no alerts", () => {
    const s = sub();
    expect(unsubscribe([s], "s1", "intruder")).toBeNull();
    const off = unsubscribe([s], "s1", "u1");
    expect(off?.[0].active).toBe(false);
    expect(buildAlerts(off ?? [], [opp("a")], consentsFor([consent("email")])).alerts).toEqual([]);
  });
});
