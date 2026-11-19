/**
 * Supervisor directory search (CAPSTONE-030).
 *
 * Finds eligible supervisors by expertise, methods, language, availability,
 * capacity, affiliation, delivery mode and verified indicators. It searches a
 * public projection only: raw capacity numbers, contact details and unverified
 * credentials are not part of the searchable or returned data. Ordering is by
 * number of matched filters, then name, then id, so results are reproducible.
 */

export interface DirectoryEntry {
  id: string;
  displayName: string;
  expertise: string[];
  methods: string[];
  languages: string[];
  affiliations: string[];
  deliveryModes: string[];
  /** YYYY-MM-DD from which new projects can start. */
  availableFrom?: string;
  acceptingProjects: boolean;
  /** Platform-verified indicators only, e.g. "identity", "credential". */
  verified: string[];
  /** Eligibility status from the verification process; only eligible supervisors are listed. */
  eligible: boolean;
}

export interface DirectoryQuery {
  text?: string;
  expertise?: string[];
  methods?: string[];
  languages?: string[];
  affiliation?: string;
  deliveryMode?: string;
  /** Only supervisors who can start by this date. */
  availableBy?: string;
  acceptingOnly?: boolean;
  /** Required verified indicators. */
  verifiedOnly?: string[];
  limit?: number;
  offset?: number;
}

export interface DirectoryResult {
  supervisors: Array<Pick<DirectoryEntry, "id" | "displayName" | "expertise" | "languages" | "affiliations" | "acceptingProjects" | "verified"> & { matched: number }>;
  total: number;
}

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 50;

const norm = (s: string) => s.normalize("NFKC").trim().toLowerCase();
const has = (list: readonly string[], v: string) => list.some((x) => norm(x) === norm(v));

/** Count how many of the supplied filters an entry satisfies; null when any filter fails. */
function evaluate(e: DirectoryEntry, q: DirectoryQuery): number | null {
  let matched = 0;
  if (q.text) {
    const hay = norm([e.displayName, ...e.expertise, ...e.methods, ...e.affiliations].join(" "));
    if (!norm(q.text).split(" ").every((t) => hay.includes(t))) return null;
    matched += 1;
  }
  if (q.expertise?.length) {
    if (!q.expertise.every((x) => has(e.expertise, x))) return null;
    matched += q.expertise.length;
  }
  if (q.methods?.length) {
    if (!q.methods.every((x) => has(e.methods, x))) return null;
    matched += q.methods.length;
  }
  if (q.languages?.length) {
    if (!q.languages.every((x) => has(e.languages, x))) return null;
    matched += q.languages.length;
  }
  if (q.affiliation) {
    if (!e.affiliations.some((a) => norm(a).includes(norm(q.affiliation as string)))) return null;
    matched += 1;
  }
  if (q.deliveryMode) {
    if (!has(e.deliveryModes, q.deliveryMode)) return null;
    matched += 1;
  }
  if (q.availableBy) {
    if (e.availableFrom === undefined || e.availableFrom > q.availableBy) return null;
    matched += 1;
  }
  if (q.acceptingOnly) {
    if (!e.acceptingProjects) return null;
    matched += 1;
  }
  if (q.verifiedOnly?.length) {
    if (!q.verifiedOnly.every((v) => has(e.verified, v))) return null;
    matched += q.verifiedOnly.length;
  }
  return matched;
}

export type DirectorySearch = { ok: true; result: DirectoryResult } | { ok: false; error: "INVALID_LIMIT" | "INVALID_OFFSET" };

export function searchSupervisors(entries: readonly DirectoryEntry[], q: DirectoryQuery): DirectorySearch {
  const limit = q.limit ?? DEFAULT_LIMIT;
  const offset = q.offset ?? 0;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) return { ok: false, error: "INVALID_LIMIT" };
  if (!Number.isInteger(offset) || offset < 0) return { ok: false, error: "INVALID_OFFSET" };

  const hits = entries
    .filter((e) => e.eligible)
    .map((e) => ({ e, matched: evaluate(e, q) }))
    .filter((x): x is { e: DirectoryEntry; matched: number } => x.matched !== null)
    .sort((a, b) => b.matched - a.matched || a.e.displayName.localeCompare(b.e.displayName, "en") || a.e.id.localeCompare(b.e.id));

  return {
    ok: true,
    result: {
      total: hits.length,
      supervisors: hits.slice(offset, offset + limit).map(({ e, matched }) => ({
        id: e.id,
        displayName: e.displayName,
        expertise: e.expertise,
        languages: e.languages,
        affiliations: e.affiliations,
        acceptingProjects: e.acceptingProjects,
        verified: e.verified,
        matched,
      })),
    },
  };
}
