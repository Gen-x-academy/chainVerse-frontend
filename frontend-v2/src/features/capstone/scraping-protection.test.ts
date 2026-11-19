import { describe, expect, it } from "vitest";
import { SlidingWindowLimiter, cachePolicy, classifyRequest, publicLookup, publicProjection } from "./scraping-protection";

describe("public discovery protection", () => {
  it("allows normal browsing and limits bursts per key", () => {
    let t = 0;
    const limiter = new SlidingWindowLimiter({ windowMs: 60_000, max: 3 }, () => t);
    expect(limiter.check("ip1")).toEqual({ allowed: true, remaining: 2, retryAfterSeconds: 0 });
    t = 1000;
    limiter.check("ip1");
    t = 2000;
    expect(limiter.check("ip1").remaining).toBe(0);
    t = 3000;
    expect(limiter.check("ip1")).toEqual({ allowed: false, remaining: 0, retryAfterSeconds: 57 });
    expect(limiter.check("ip2").allowed).toBe(true); // other clients unaffected
  });

  it("recovers as old requests leave the window and can prune idle keys", () => {
    let t = 0;
    const limiter = new SlidingWindowLimiter({ windowMs: 1000, max: 1 }, () => t);
    limiter.check("a");
    expect(limiter.check("a").allowed).toBe(false);
    t = 1001;
    expect(limiter.check("a").allowed).toBe(true);
    limiter.check("b");
    t = 5000;
    expect(limiter.prune()).toBe(2);
    expect(() => new SlidingWindowLimiter({ windowMs: 0, max: 1 })).toThrow();
  });

  it("makes missing, hidden and invisible items indistinguishable", () => {
    const item = { id: "a", hidden: false };
    const visible = (i: { hidden: boolean }) => !i.hidden;
    const missing = publicLookup(undefined, visible);
    const hidden = publicLookup({ id: "b", hidden: true }, visible);
    expect(missing).toEqual(hidden);
    expect(missing).toEqual({ status: 404, body: { error: "not_found" } });
    expect(publicLookup(item, visible)).toEqual({ status: 200, body: item });
    expect(publicLookup(null, visible).status).toBe(404);
  });

  it("projects only allow-listed fields, dropping later additions", () => {
    const row = { id: "a", title: "T", internalNotes: "x", budgetMinor: "5", newColumn: 1 };
    expect(publicProjection(row, ["id", "title"])).toEqual({ id: "a", title: "T" });
    expect(Object.keys(publicProjection(row, ["id", "title", "nope" as never]))).toEqual(["id", "title"]);
  });

  it("caches public pages briefly and never caches personalized or error responses", () => {
    expect(cachePolicy("public_list").cacheControl).toMatch(/^public, max-age=60/);
    expect(cachePolicy("public_detail").cacheControl).toMatch(/^public, max-age=300/);
    expect(cachePolicy("personalized")).toEqual({ cacheControl: "private, no-store", vary: ["Authorization", "Cookie"] });
    expect(cachePolicy("error").cacheControl).toBe("no-store");
  });

  it("leaves normal browsers alone and escalates clear automation", () => {
    const browser = "Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Safari/605.1.15";
    expect(classifyRequest({ userAgent: browser, sincePreviousMs: 800, distinctIdsInWindow: 12 })).toEqual({ verdict: "ok", reasons: [] });
    expect(classifyRequest({ userAgent: browser, sincePreviousMs: 10, distinctIdsInWindow: 5 }).verdict).toBe("slow_down");
    expect(classifyRequest({ userAgent: "curl/8.0", sincePreviousMs: 5, distinctIdsInWindow: 5 }).verdict).toBe("challenge");
    expect(classifyRequest({ distinctIdsInWindow: 1 }).verdict).toBe("slow_down"); // no user agent
    const walk = classifyRequest({ userAgent: browser, sincePreviousMs: 500, distinctIdsInWindow: 150, sequentialFraction: 0.95 });
    expect(walk.verdict).toBe("challenge");
    expect(walk.reasons).toEqual(["very many distinct items requested", "sequential id walk"]);
  });
});
