import { describe, expect, it } from "vitest";
import {
  MAX_NOTE_LENGTH,
  MAX_SHORTLIST_ITEMS,
  addItem,
  annotate,
  canAccess,
  emptyShortlist,
  mergeShortlists,
  removeItem,
  reorder,
  type Shortlist,
} from "./shortlists";

const t = (n: number) => new Date(Date.UTC(2026, 0, 1, 0, n, 0));
function must(r: ReturnType<typeof addItem>): Shortlist {
  if (!r.ok) throw new Error(r.error);
  return r.list;
}
const ids = (l: Shortlist) => l.items.map((i) => i.opportunityId);

describe("saved shortlists", () => {
  it("adds, annotates, reorders and removes with a rising revision", () => {
    let l = emptyShortlist("u1");
    l = must(addItem(l, "a", t(1)));
    l = must(addItem(l, "b", t(2), " nice "));
    l = must(addItem(l, "c", t(3)));
    expect(l.items[1].note).toBe("nice");
    l = must(annotate(l, "a", "call them", t(4)));
    l = must(reorder(l, "c", 0));
    expect(ids(l)).toEqual(["c", "a", "b"]);
    l = must(removeItem(l, "a", t(5)));
    expect(ids(l)).toEqual(["c", "b"]);
    expect(l.revision).toBe(6);
    expect(l.removed).toEqual([{ opportunityId: "a", removedAt: t(5).toISOString() }]);
  });

  it("rejects duplicates, limits, long notes and bad targets without changing the list", () => {
    let l = must(addItem(emptyShortlist("u1"), "a", t(1)));
    expect(addItem(l, "a", t(2))).toEqual({ ok: false, error: "DUPLICATE" });
    expect(addItem(l, "z", t(2), "x".repeat(MAX_NOTE_LENGTH + 1))).toEqual({ ok: false, error: "NOTE_TOO_LONG" });
    expect(annotate(l, "nope", "x", t(2))).toEqual({ ok: false, error: "NOT_FOUND" });
    expect(removeItem(l, "nope", t(2))).toEqual({ ok: false, error: "NOT_FOUND" });
    expect(reorder(l, "a", 5)).toEqual({ ok: false, error: "INVALID_POSITION" });
    expect(reorder(l, "nope", 0)).toEqual({ ok: false, error: "NOT_FOUND" });
    for (let i = 0; i < MAX_SHORTLIST_ITEMS - 1; i += 1) l = must(addItem(l, `o${i}`, t(3)));
    expect(addItem(l, "extra", t(4))).toEqual({ ok: false, error: "LIMIT_REACHED" });
  });

  it("does not mutate the previous list", () => {
    const l = must(addItem(emptyShortlist("u1"), "a", t(1)));
    const before = JSON.stringify(l);
    removeItem(l, "a", t(2));
    annotate(l, "a", "x", t(2));
    expect(JSON.stringify(l)).toBe(before);
  });

  it("is private to its owner", () => {
    const l = emptyShortlist("u1");
    expect(canAccess(l, "u1")).toBe(true);
    expect(canAccess(l, "u2")).toBe(false);
    expect(canAccess(l, undefined)).toBe(false);
  });

  it("merges two devices deterministically and commutatively", () => {
    let base = emptyShortlist("u1");
    base = must(addItem(base, "a", t(1)));
    base = must(addItem(base, "b", t(2)));
    const phone = must(addItem(base, "c", t(3)));
    const laptop = must(annotate(base, "a", "laptop note", t(4)));
    const ab = mergeShortlists(phone, laptop);
    const ba = mergeShortlists(laptop, phone);
    expect(ab).toEqual(ba);
    expect(ids(ab).sort()).toEqual(["a", "b", "c"]);
    expect(ab.items.find((i) => i.opportunityId === "a")?.note).toBe("laptop note");
    expect(ab.revision).toBe(Math.max(phone.revision, laptop.revision) + 1);
  });

  it("does not resurrect an item removed after its last edit, but keeps one re-added later", () => {
    let base = emptyShortlist("u1");
    base = must(addItem(base, "a", t(1)));
    const removedOnPhone = must(removeItem(base, "a", t(5)));
    const editedOnLaptop = must(annotate(base, "a", "keep", t(3)));
    expect(ids(mergeShortlists(removedOnPhone, editedOnLaptop))).toEqual([]);
    const editedLater = must(annotate(base, "a", "later", t(9)));
    expect(ids(mergeShortlists(removedOnPhone, editedLater))).toEqual(["a"]);
    const readded = must(addItem(removedOnPhone, "a", t(10)));
    expect(ids(mergeShortlists(readded, editedOnLaptop))).toEqual(["a"]);
  });

  it("refuses to merge lists of different owners", () => {
    expect(() => mergeShortlists(emptyShortlist("u1"), emptyShortlist("u2"))).toThrow();
  });
});
