/**
 * Saved project shortlists (CAPSTONE-027).
 *
 * A student's private, ordered list of opportunities with notes, usable across
 * devices. Every change returns a new list with a higher revision. Two devices
 * that edited the same list are reconciled by `mergeShortlists`, which is
 * deterministic and commutative so both devices converge on the same result.
 */

export const MAX_SHORTLIST_ITEMS = 50;
export const MAX_NOTE_LENGTH = 500;

export interface ShortlistItem {
  opportunityId: string;
  note: string;
  /** ISO instant of the last edit to this item (note or presence). */
  updatedAt: string;
}

export interface Shortlist {
  ownerId: string;
  /** Items in display order. */
  items: ShortlistItem[];
  /** Ids removed on some device, with the removal time, so a merge does not resurrect them. */
  removed: Array<{ opportunityId: string; removedAt: string }>;
  revision: number;
}

export type ShortlistError = "LIMIT_REACHED" | "DUPLICATE" | "NOT_FOUND" | "NOTE_TOO_LONG" | "INVALID_POSITION" | "FORBIDDEN";

export type ShortlistResult = { ok: true; list: Shortlist } | { ok: false; error: ShortlistError };

export function emptyShortlist(ownerId: string): Shortlist {
  return { ownerId, items: [], removed: [], revision: 0 };
}

/** Private to its owner; nobody else may read or change it. */
export function canAccess(list: Shortlist, userId: string | undefined): boolean {
  return userId !== undefined && userId === list.ownerId;
}

const bump = (list: Shortlist, patch: Partial<Shortlist>): Shortlist => ({ ...list, ...patch, revision: list.revision + 1 });

export function addItem(list: Shortlist, opportunityId: string, now: Date, note = ""): ShortlistResult {
  if (list.items.some((i) => i.opportunityId === opportunityId)) return { ok: false, error: "DUPLICATE" };
  if (list.items.length >= MAX_SHORTLIST_ITEMS) return { ok: false, error: "LIMIT_REACHED" };
  if (note.length > MAX_NOTE_LENGTH) return { ok: false, error: "NOTE_TOO_LONG" };
  const item: ShortlistItem = { opportunityId, note: note.trim(), updatedAt: now.toISOString() };
  return { ok: true, list: bump(list, { items: [...list.items, item], removed: list.removed.filter((r) => r.opportunityId !== opportunityId) }) };
}

export function removeItem(list: Shortlist, opportunityId: string, now: Date): ShortlistResult {
  if (!list.items.some((i) => i.opportunityId === opportunityId)) return { ok: false, error: "NOT_FOUND" };
  return {
    ok: true,
    list: bump(list, {
      items: list.items.filter((i) => i.opportunityId !== opportunityId),
      removed: [...list.removed.filter((r) => r.opportunityId !== opportunityId), { opportunityId, removedAt: now.toISOString() }],
    }),
  };
}

export function annotate(list: Shortlist, opportunityId: string, note: string, now: Date): ShortlistResult {
  if (note.length > MAX_NOTE_LENGTH) return { ok: false, error: "NOTE_TOO_LONG" };
  if (!list.items.some((i) => i.opportunityId === opportunityId)) return { ok: false, error: "NOT_FOUND" };
  return { ok: true, list: bump(list, { items: list.items.map((i) => (i.opportunityId === opportunityId ? { ...i, note: note.trim(), updatedAt: now.toISOString() } : i)) }) };
}

/** Move an item to a new zero-based position. */
export function reorder(list: Shortlist, opportunityId: string, toIndex: number): ShortlistResult {
  const from = list.items.findIndex((i) => i.opportunityId === opportunityId);
  if (from < 0) return { ok: false, error: "NOT_FOUND" };
  if (!Number.isInteger(toIndex) || toIndex < 0 || toIndex >= list.items.length) return { ok: false, error: "INVALID_POSITION" };
  const items = [...list.items];
  const [moved] = items.splice(from, 1);
  items.splice(toIndex, 0, moved);
  return { ok: true, list: bump(list, { items }) };
}

/**
 * Reconcile two copies of the same owner's list. An item survives unless it
 * was removed after its latest edit; for items on both sides the newer edit
 * wins; order follows the copy with the higher revision, with items only the
 * other copy has appended in id order. The result is the same whichever copy
 * is passed first.
 */
export function mergeShortlists(a: Shortlist, b: Shortlist): Shortlist {
  if (a.ownerId !== b.ownerId) throw new RangeError("cannot merge shortlists of different owners");
  const [primary, secondary] = a.revision > b.revision || (a.revision === b.revision && JSON.stringify(a) <= JSON.stringify(b)) ? [a, b] : [b, a];

  const latest = new Map<string, ShortlistItem>();
  for (const item of [...primary.items, ...secondary.items]) {
    const existing = latest.get(item.opportunityId);
    if (!existing || item.updatedAt > existing.updatedAt || (item.updatedAt === existing.updatedAt && item.note > existing.note)) latest.set(item.opportunityId, item);
  }

  const removedAt = new Map<string, string>();
  for (const r of [...a.removed, ...b.removed]) {
    if (!removedAt.has(r.opportunityId) || r.removedAt > (removedAt.get(r.opportunityId) as string)) removedAt.set(r.opportunityId, r.removedAt);
  }
  for (const [id, item] of [...latest]) {
    const gone = removedAt.get(id);
    if (gone !== undefined && gone >= item.updatedAt) latest.delete(id);
  }

  const orderedIds = [
    ...primary.items.map((i) => i.opportunityId).filter((id) => latest.has(id)),
    ...[...latest.keys()].filter((id) => !primary.items.some((i) => i.opportunityId === id)).sort(),
  ];
  const items = orderedIds.slice(0, MAX_SHORTLIST_ITEMS).map((id) => latest.get(id) as ShortlistItem);
  return {
    ownerId: a.ownerId,
    items,
    removed: [...removedAt].map(([opportunityId, at]) => ({ opportunityId, removedAt: at })).filter((r) => !latest.has(r.opportunityId)).sort((x, y) => x.opportunityId.localeCompare(y.opportunityId)),
    revision: Math.max(a.revision, b.revision) + 1,
  };
}
