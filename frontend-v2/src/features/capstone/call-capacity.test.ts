import { describe, expect, it } from "vitest";
import { apply, confirm, expireOffers, newCapacity, release, resize, seatsFree, seatsTaken, type CapacityState } from "./call-capacity";

const T0 = new Date("2026-03-01T09:00:00Z");
const hours = (h: number) => new Date(T0.getTime() + h * 3_600_000);

function ok(r: ReturnType<typeof apply>): CapacityState {
  if (!r.ok) throw new Error(String(r.error));
  return r.state;
}

describe("call capacity and waitlists", () => {
  it("reserves seats while available and waitlists in order afterwards", () => {
    let s = newCapacity(2);
    s = ok(apply(s, "r1", "a", T0));
    s = ok(apply(s, "r2", "b", T0));
    const third = apply(s, "r3", "c", T0);
    const fourth = apply(third.state, "r4", "d", T0);
    expect(third.events).toEqual([{ type: "waitlisted", applicantId: "c", position: 1 }]);
    expect(fourth.events).toEqual([{ type: "waitlisted", applicantId: "d", position: 2 }]);
    expect(seatsFree(fourth.state)).toBe(0);
    expect(fourth.state.waitlist).toEqual(["c", "d"]);
  });

  it("confirms a reservation before it expires and rejects it after", () => {
    const s = ok(apply(newCapacity(1), "r1", "a", T0, 24));
    expect(confirm(s, "r2", "a", hours(23)).state.confirmed).toEqual(["a"]);
    expect(confirm(s, "r3", "a", hours(24))).toMatchObject({ ok: false, error: "OFFER_EXPIRED" });
    expect(confirm(s, "r4", "zed", hours(1))).toMatchObject({ ok: false, error: "NOT_FOUND" });
  });

  it("is idempotent per request id", () => {
    const first = apply(newCapacity(1), "same", "a", T0);
    const again = apply(first.state, "same", "a", T0);
    expect(again).toMatchObject({ ok: true, replayed: true, events: [] });
    expect(again.state.reserved).toHaveLength(1);
    const c1 = confirm(first.state, "cf", "a", hours(1));
    const c2 = confirm(c1.state, "cf", "a", hours(1));
    expect(c2.replayed).toBe(true);
    expect(c2.state.confirmed).toEqual(["a"]);
  });

  it("rejects an applicant who is already present anywhere", () => {
    const s = ok(apply(newCapacity(1), "r1", "a", T0));
    expect(apply(s, "r2", "a", T0)).toMatchObject({ ok: false, error: "ALREADY_PRESENT" });
    const w = ok(apply(s, "r3", "b", T0));
    expect(apply(w, "r4", "b", T0)).toMatchObject({ ok: false, error: "ALREADY_PRESENT" });
  });

  it("promotes the next waitlisted applicant deterministically when a seat frees", () => {
    let s = newCapacity(1);
    s = ok(apply(s, "r1", "a", T0));
    s = ok(apply(s, "r2", "b", T0));
    s = ok(apply(s, "r3", "c", T0));
    const released = release(s, "r4", "a", hours(1));
    expect(released.events.map((e) => e.type)).toEqual(["released", "promoted"]);
    expect(released.state.reserved.map((r) => r.applicantId)).toEqual(["b"]);
    expect(released.state.waitlist).toEqual(["c"]);
    expect(release(released.state, "r5", "ghost", hours(1))).toMatchObject({ ok: false, error: "NOT_FOUND" });
  });

  it("expires lapsed offers, promotes the waitlist, and is safe to repeat", () => {
    let s = newCapacity(1);
    s = ok(apply(s, "r1", "a", T0, 24));
    s = ok(apply(s, "r2", "b", T0));
    const lapsed = expireOffers(s, hours(25));
    expect(lapsed.events.map((e) => `${e.type}:${e.applicantId}`)).toEqual(["expired:a", "promoted:b"]);
    expect(expireOffers(lapsed.state, hours(25)).events).toEqual([]);
    expect(seatsTaken(lapsed.state)).toBe(1);
  });

  it("releasing a waitlist spot does not free a seat or promote anyone", () => {
    let s = newCapacity(1);
    s = ok(apply(s, "r1", "a", T0));
    s = ok(apply(s, "r2", "b", T0));
    const r = release(s, "r3", "b", hours(1));
    expect(r.events).toEqual([{ type: "released", applicantId: "b" }]);
    expect(r.state.reserved.map((x) => x.applicantId)).toEqual(["a"]);
  });

  it("resizing up promotes, resizing down never evicts", () => {
    let s = newCapacity(1);
    s = ok(apply(s, "r1", "a", T0));
    s = ok(apply(s, "r2", "b", T0));
    const bigger = resize(s, 2, hours(1));
    expect(bigger.events.map((e) => e.type)).toEqual(["promoted"]);
    const smaller = resize(bigger.state, 1, hours(1));
    expect(smaller.state.reserved).toHaveLength(2);
    expect(seatsFree(smaller.state)).toBe(0);
    expect(resize(s, -1, hours(1))).toMatchObject({ ok: false, error: "INVALID_SEATS" });
    expect(() => newCapacity(-1)).toThrow();
  });

  it("never mutates its input state", () => {
    const s = newCapacity(1);
    const before = JSON.stringify(s);
    apply(s, "r1", "a", T0);
    expect(JSON.stringify(s)).toBe(before);
  });
});
