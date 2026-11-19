/**
 * Project opportunity catalog search (CAPSTONE-025).
 *
 * Filters and sorts the opportunities a viewer is allowed to see by discipline,
 * skill, sponsor, cohort, dates, mode, funding, seat status and eligibility.
 * Visibility is applied first, before any filter, so a filter can never reveal
 * the existence of something the viewer may not see. Ordering is total and
 * deterministic, and pagination is keyset-based so pages stay stable.
 */

export type OpportunityKind = "call" | "project";
export type Visibility = "public" | "organization" | "private";
export type SeatStatus = "open" | "waitlist" | "full";

export interface Opportunity {
  id: string;
  kind: OpportunityKind;
  title: string;
  disciplines: string[];
  skills: string[];
  sponsorId?: string;
  cohortId?: string;
  startsOn: string;
  closesOn: string;
  mode: string;
  /** Funding per project in minor units (integer string), if any. */
  fundingMinor?: string;
  seatsTotal: number;
  seatsTaken: number;
  waitlistOpen: boolean;
  visibility: Visibility;
  organizationId: string;
  /** Rule evaluated per viewer; the catalog only needs the result. */
  eligibleFor?: (viewerId: string) => boolean;
}

export interface Viewer {
  id?: string;
  organizationId?: string;
}

export interface CatalogQuery {
  text?: string;
  disciplines?: string[];
  skills?: string[];
  sponsorId?: string;
  cohortId?: string;
  startsAfter?: string;
  closesBefore?: string;
  modes?: string[];
  minFundingMinor?: string;
  seatStatus?: SeatStatus;
  onlyEligible?: boolean;
  /** Sort key; default is closing date. */
  sort?: "closes" | "title" | "funding";
  limit?: number;
  cursor?: string;
}

export interface CatalogEntry {
  id: string;
  kind: OpportunityKind;
  title: string;
  closesOn: string;
  mode: string;
  seatStatus: SeatStatus;
  /** Only present when the viewer is signed in. */
  eligible: boolean | null;
}

export interface CatalogPage {
  entries: CatalogEntry[];
  nextCursor: string | null;
  total: number;
}

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

const norm = (s: string) => s.normalize("NFKC").trim().toLowerCase();

export function seatStatus(o: Pick<Opportunity, "seatsTotal" | "seatsTaken" | "waitlistOpen">): SeatStatus {
  if (o.seatsTaken < o.seatsTotal) return "open";
  return o.waitlistOpen ? "waitlist" : "full";
}

/** Visibility check; applied before anything else. */
export function canSee(o: Opportunity, v: Viewer): boolean {
  if (o.visibility === "public") return true;
  if (o.visibility === "organization") return v.organizationId !== undefined && v.organizationId === o.organizationId;
  return false;
}

function matches(o: Opportunity, q: CatalogQuery, v: Viewer): boolean {
  if (q.text) {
    const hay = norm([o.title, ...o.disciplines, ...o.skills].join(" "));
    if (!norm(q.text).split(" ").every((t) => hay.includes(t))) return false;
  }
  if (q.disciplines?.length && !q.disciplines.some((d) => o.disciplines.map(norm).includes(norm(d)))) return false;
  if (q.skills?.length && !q.skills.every((s) => o.skills.map(norm).includes(norm(s)))) return false;
  if (q.sponsorId && o.sponsorId !== q.sponsorId) return false;
  if (q.cohortId && o.cohortId !== q.cohortId) return false;
  if (q.startsAfter && o.startsOn < q.startsAfter) return false;
  if (q.closesBefore && o.closesOn > q.closesBefore) return false;
  if (q.modes?.length && !q.modes.includes(o.mode)) return false;
  if (q.minFundingMinor !== undefined) {
    if (!/^(0|[1-9][0-9]*)$/.test(q.minFundingMinor) || o.fundingMinor === undefined || BigInt(o.fundingMinor) < BigInt(q.minFundingMinor)) return false;
  }
  if (q.seatStatus && seatStatus(o) !== q.seatStatus) return false;
  if (q.onlyEligible) {
    if (!v.id || !o.eligibleFor || !o.eligibleFor(v.id)) return false;
  }
  return true;
}

function compare(a: Opportunity, b: Opportunity, sort: NonNullable<CatalogQuery["sort"]>): number {
  const byId = a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  if (sort === "title") return a.title.localeCompare(b.title, "en") || byId;
  if (sort === "funding") {
    const fa = BigInt(a.fundingMinor ?? "0");
    const fb = BigInt(b.fundingMinor ?? "0");
    return fa === fb ? byId : fa > fb ? -1 : 1;
  }
  return a.closesOn < b.closesOn ? -1 : a.closesOn > b.closesOn ? 1 : byId;
}

function encodeCursor(id: string): string {
  return btoa(unescape(encodeURIComponent(id))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function decodeCursor(cursor: string): string | null {
  try {
    const padded = cursor.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (cursor.length % 4)) % 4);
    return decodeURIComponent(escape(atob(padded)));
  } catch {
    return null;
  }
}

export type SearchResult = { ok: true; page: CatalogPage } | { ok: false; error: "INVALID_CURSOR" | "INVALID_LIMIT" };

export function searchCatalog(all: readonly Opportunity[], query: CatalogQuery, viewer: Viewer): SearchResult {
  const limit = query.limit ?? DEFAULT_PAGE_SIZE;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) return { ok: false, error: "INVALID_LIMIT" };
  const sort = query.sort ?? "closes";

  const visible = all.filter((o) => canSee(o, viewer));
  const sorted = visible.filter((o) => matches(o, query, viewer)).sort((a, b) => compare(a, b, sort));

  let start = 0;
  if (query.cursor !== undefined) {
    const afterId = decodeCursor(query.cursor);
    if (afterId === null) return { ok: false, error: "INVALID_CURSOR" };
    const index = sorted.findIndex((o) => o.id === afterId);
    // If the anchor vanished (e.g. it just filled up), resume at the first item that sorts after it.
    if (index >= 0) start = index + 1;
    else {
      const anchor = visible.find((o) => o.id === afterId);
      start = anchor ? sorted.findIndex((o) => compare(anchor, o, sort) < 0) : 0;
      if (start < 0) start = sorted.length;
    }
  }

  const slice = sorted.slice(start, start + limit);
  const entries: CatalogEntry[] = slice.map((o) => ({
    id: o.id,
    kind: o.kind,
    title: o.title,
    closesOn: o.closesOn,
    mode: o.mode,
    seatStatus: seatStatus(o),
    eligible: viewer.id && o.eligibleFor ? o.eligibleFor(viewer.id) : null,
  }));
  const more = start + limit < sorted.length;
  return { ok: true, page: { entries, nextCursor: more && slice.length > 0 ? encodeCursor(slice[slice.length - 1].id) : null, total: sorted.length } };
}
